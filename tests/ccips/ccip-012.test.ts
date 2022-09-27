import {
  describe,
  run,
  Chain,
  beforeEach,
  it,
  assertEquals,
  types,
  afterEach,
  Account,
} from "../../deps.ts";
import { Accounts, Context } from "../../src/context.ts";
import { MiamiCoinAuthModelV2 } from "../../models/cities/mia/miamicoin-auth-v2.model.ts";
import { MiamiCoinCoreModelV2 } from "../../models/cities/mia/miamicoin-core-v2.model.ts";
import { MiamiCoinTokenModelV2 } from "../../models/cities/mia/miamicoin-token-v2.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let authV2: MiamiCoinAuthModelV2;
let coreV2: MiamiCoinCoreModelV2;
let tokenV2: MiamiCoinTokenModelV2;
let targetCore = "";
let targetToken = "";

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  authV2 = ctx.models.get(MiamiCoinAuthModelV2, "miamicoin-auth-v2");
  coreV2 = ctx.models.get(MiamiCoinCoreModelV2, "miamicoin-core-v2");
  tokenV2 = ctx.models.get(MiamiCoinTokenModelV2, "miamicoin-token-v2");
  targetCore = coreV2.address;
  targetToken = tokenV2.address;
});

afterEach(() => {
  ctx.terminate();
});

const upgradeTarget = 76990;
const microCityCoins = 10 ** 6;

const coinbaseAmountsNew = {
  amount1: 100000,
  amount2: 50000,
  amount3: 2292,
  amount4: 2440,
  amount5: 2730,
  amountBonus: 250000,
  amountDefault: 3402,
};

const coinbaseThresholdsNew = {
  coinbaseThreshold1: 59497,
  coinbaseThreshold2: 76990,
  coinbaseThreshold3: 209497,
  coinbaseThreshold4: 409497,
  coinbaseThreshold5: 809497,
};

const setupCoreContractMining = (wallet: Account) => {
  // initialize core contract
  chain.mineEmptyBlockUntil(100); // temp fix for clarinet bug
  chain.mineEmptyBlockUntil(24497); // MIA activation height (24494)
  const block = chain.mineBlock([
    coreV2.testInitializeCore(coreV2.address),
    coreV2.testSetActivationThreshold(1),
    coreV2.registerUser(wallet),
  ]);
  const activationBlockHeight =
    block.height + MiamiCoinCoreModelV2.ACTIVATION_DELAY;
  activationBlockHeight;
  chain.mineEmptyBlockUntil(activationBlockHeight);

  // mining configuration
  const minerCommit = 1000;

  // mine in epoch 1
  // Blocks: MIA 34,497 - 59,497 --> target: 50,000
  // Blocks: NYC 47,449 - 72,449 --> target: 50,000
  const epoch1 = 50000;
  chain.mineEmptyBlockUntil(epoch1);
  const epoch1Block1 = chain.mineBlock([
    coreV2.mineTokens(minerCommit, wallet),
  ]);
  const epoch1Block2 = chain.mineBlock([
    coreV2.mineTokens(minerCommit, wallet),
  ]);

  // mine in epoch 2 before the upgrade target
  // MIA 59,497 - 76,990 --> target: 73,000
  // NYC 72,449 - 76,990 --> target: 73,000
  const epoch2 = 73000;
  chain.mineEmptyBlockUntil(epoch2);
  const epoch2Block1 = chain.mineBlock([
    coreV2.mineTokens(minerCommit, wallet),
  ]);
  const epoch2Block2 = chain.mineBlock([
    coreV2.mineTokens(minerCommit, wallet),
  ]);

  // mine in what is now epoch 3 after the upgrade target
  // MIA 76,990 - 209,497 --> target: 77,000
  // NYC 76,990 - 222,449 --> target: 77,000
  const epoch3 = 77000;
  chain.mineEmptyBlockUntil(epoch3);
  const epoch3Block1 = chain.mineBlock([
    coreV2.mineTokens(minerCommit, wallet),
  ]);
  const epoch3Block2 = chain.mineBlock([
    coreV2.mineTokens(minerCommit, wallet),
  ]);

  // fast-forward past maturity window
  chain.mineEmptyBlock(MiamiCoinCoreModelV2.TOKEN_REWARD_MATURITY + 1);

  return {
    epoch1: {
      height: epoch1,
      block1: epoch1Block1,
      block2: epoch1Block2,
    },
    epoch2: {
      height: epoch2,
      block1: epoch2Block1,
      block2: epoch2Block2,
    },
    epoch3: {
      height: epoch3,
      block1: epoch3Block1,
      block2: epoch3Block2,
    },
  };
};

const performCcip012Upgrade = (sender: Account) => {
  let jobId = 1;
  const approver1 = accounts.get("wallet_2")!;
  const approver2 = accounts.get("wallet_3")!;
  const approver3 = accounts.get("wallet_4")!;

  // create update coinbase amounts job
  chain.mineBlock([
    authV2.createJob("update coinbase amounts", authV2.address, sender),
    authV2.addUIntArgument(
      jobId,
      "amount1",
      coinbaseAmountsNew["amount1"] * microCityCoins,
      sender
    ),
    authV2.addUIntArgument(
      jobId,
      "amount2",
      coinbaseAmountsNew["amount2"] * microCityCoins,
      sender
    ),
    authV2.addUIntArgument(
      jobId,
      "amount3",
      coinbaseAmountsNew["amount3"] * microCityCoins,
      sender
    ),
    authV2.addUIntArgument(
      jobId,
      "amount4",
      coinbaseAmountsNew["amount4"] * microCityCoins,
      sender
    ),
    authV2.addUIntArgument(
      jobId,
      "amount5",
      coinbaseAmountsNew["amount5"] * microCityCoins,
      sender
    ),
    authV2.addUIntArgument(
      jobId,
      "amountDefault",
      coinbaseAmountsNew["amountDefault"] * microCityCoins,
      sender
    ),
    authV2.addUIntArgument(
      jobId,
      "amountBonus",
      coinbaseAmountsNew["amountBonus"] * microCityCoins,
      sender
    ),
    authV2.activateJob(jobId, sender),
    authV2.approveJob(jobId, approver1),
    authV2.approveJob(jobId, approver2),
    authV2.approveJob(jobId, approver3),
  ]);

  // create update coinbase thresholds job
  jobId++;
  chain.mineBlock([
    authV2.createJob("update coinbase thresholds", authV2.address, sender),
    authV2.addUIntArgument(
      jobId,
      "threshold1",
      coinbaseThresholdsNew["coinbaseThreshold1"],
      sender
    ),
    authV2.addUIntArgument(
      jobId,
      "threshold2",
      coinbaseThresholdsNew["coinbaseThreshold2"],
      sender
    ),
    authV2.addUIntArgument(
      jobId,
      "threshold3",
      coinbaseThresholdsNew["coinbaseThreshold3"],
      sender
    ),
    authV2.addUIntArgument(
      jobId,
      "threshold4",
      coinbaseThresholdsNew["coinbaseThreshold4"],
      sender
    ),
    authV2.addUIntArgument(
      jobId,
      "threshold5",
      coinbaseThresholdsNew["coinbaseThreshold5"],
      sender
    ),
    authV2.activateJob(jobId, sender),
    authV2.approveJob(jobId, approver1),
    authV2.approveJob(jobId, approver2),
    authV2.approveJob(jobId, approver3),
  ]);

  // act
  const updateAmounts = chain.mineBlock([
    authV2.executeUpdateCoinbaseAmountsJob(
      jobId - 1,
      targetCore,
      targetToken,
      sender
    ),
  ]);
  const updateThresholds = chain.mineBlock([
    authV2.executeUpdateCoinbaseThresholdsJob(
      jobId,
      targetCore,
      targetToken,
      sender
    ),
  ]);

  return {
    updateAmounts,
    updateThresholds,
  };
};

// fast forward to block height based on timeline
// perform actions and verify coinbase amounts before/after job + steps of job
// veirfy contract as principal in wallet payout

describe("[CCIP-012]", () => {
  //////////////////////////////////////////////////
  // CCIP-012 IMPLEMENTATION
  //////////////////////////////////////////////////
  describe("Phase 1: update coinbase amounts and thresholds", () => {
    it("updates 2% emissions through coinbase thresholds and amounts in both token and core contracts", () => {
      // arrange
      const wallet = accounts.get("wallet_1")!;
      const { epoch1, epoch2, epoch3 } = setupCoreContractMining(wallet);

      // act

      // test claiming before the changes
      const epochClaimsBefore = chain.mineBlock([
        coreV2.claimMiningReward(epoch1.height, wallet), // 100,000
        coreV2.claimMiningReward(epoch2.height, wallet), // 50,000
        coreV2.claimMiningReward(epoch3.height, wallet), // 50,000
      ]);

      // submit the coinbase threshold/amount change jobs
      const { updateAmounts, updateThresholds } = performCcip012Upgrade(wallet);

      // test claiming after the changes
      const epochClaimsAfter = chain.mineBlock([
        coreV2.claimMiningReward(epoch1.height + 1, wallet), // 100,000
        coreV2.claimMiningReward(epoch2.height + 1, wallet), // 50,000
        coreV2.claimMiningReward(epoch3.height + 1, wallet), // 2,292
      ]);

      // assert

      // verify the coinbase amounts and thresholds were updated
      updateAmounts.receipts[0].result.expectOk().expectBool(true);
      updateThresholds.receipts[0].result.expectOk().expectBool(true);

      const tokenAmounts = tokenV2.getCoinbaseAmounts().result;
      const coreAmounts = coreV2.getCoinbaseAmounts().result;
      assertEquals(tokenAmounts, coreAmounts);

      const tokenThresholds = tokenV2.getCoinbaseThresholds().result;
      const coreThresholds = coreV2.getCoinbaseThresholds().result;
      assertEquals(tokenThresholds, coreThresholds);

      // verify claims before the upgrade
      epochClaimsBefore.receipts[0].result.expectOk().expectBool(true);
      epochClaimsBefore.receipts[1].result.expectOk().expectBool(true);
      epochClaimsBefore.receipts[2].result.expectOk().expectBool(true);
      assertEquals(
        +epochClaimsBefore.receipts[0].events[0].ft_mint_event.amount,
        coinbaseAmountsNew["amount1"] * microCityCoins
      );
      assertEquals(
        +epochClaimsBefore.receipts[1].events[0].ft_mint_event.amount,
        coinbaseAmountsNew["amount2"] * microCityCoins
      );
      assertEquals(
        +epochClaimsBefore.receipts[2].events[0].ft_mint_event.amount,
        coinbaseAmountsNew["amount2"] * microCityCoins
      );

      // verify claims after the upgrade
      epochClaimsAfter.receipts[0].result.expectOk().expectBool(true);
      epochClaimsAfter.receipts[1].result.expectOk().expectBool(true);
      epochClaimsAfter.receipts[2].result.expectOk().expectBool(true);
      assertEquals(
        +epochClaimsAfter.receipts[0].events[0].ft_mint_event.amount,
        coinbaseAmountsNew["amount1"] * microCityCoins
      );
      assertEquals(
        +epochClaimsAfter.receipts[1].events[0].ft_mint_event.amount,
        coinbaseAmountsNew["amount2"] * microCityCoins
      );
      assertEquals(
        +epochClaimsAfter.receipts[2].events[0].ft_mint_event.amount,
        coinbaseAmountsNew["amount3"] * microCityCoins
      );
    });
  });

  describe("Phase 2: update city wallet to DAO contract address", () => {
    it("succeeds and updates city wallet in token and core contracts", () => {
      // arrange
      const jobId = 1;
      const sender = accounts.get("wallet_1")!;
      const approver1 = accounts.get("wallet_2")!;
      const approver2 = accounts.get("wallet_3")!;
      const approver3 = accounts.get("wallet_4")!;
      const cityWallet = accounts.get("mia_wallet")!;
      const newCityWallet = coreV2.address;
      chain.mineBlock([
        coreV2.testInitializeCore(coreV2.address),
        authV2.testSetActiveCoreContract(cityWallet),
      ]);

      chain.mineBlock([
        authV2.createJob("update city wallet 1", authV2.address, sender),
        authV2.addPrincipalArgument(
          jobId,
          "newCityWallet",
          newCityWallet,
          sender
        ),
        authV2.activateJob(jobId, sender),
        authV2.approveJob(jobId, approver1),
        authV2.approveJob(jobId, approver2),
        authV2.approveJob(jobId, approver3),
      ]);

      // act
      const receipt = chain.mineBlock([
        authV2.executeSetCityWalletJob(jobId, coreV2.address, approver1),
      ]).receipts[0];

      // asserts
      receipt.result.expectOk().expectBool(true);

      coreV2.getCityWallet().result.expectPrincipal(newCityWallet);
      authV2.getCityWallet().result.expectOk().expectPrincipal(newCityWallet);
    });
  });
});

run();
