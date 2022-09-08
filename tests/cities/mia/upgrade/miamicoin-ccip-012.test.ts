import {
  describe,
  run,
  Chain,
  beforeEach,
  it,
  assertEquals,
  types,
  afterEach,
} from "../../../../deps.ts";
import { Accounts, Context } from "../../../../src/context.ts";
import { MiamiCoinAuthModelV2 } from "../../../../models/cities/mia/miamicoin-auth-v2.model.ts";
import { MiamiCoinCoreModelV2 } from "../../../../models/cities/mia/miamicoin-core-v2.model.ts";
import { MiamiCoinTokenModelV2 } from "../../../../models/cities/mia/miamicoin-token-v2.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let authV2: MiamiCoinAuthModelV2;
let coreV2: MiamiCoinCoreModelV2;
let tokenV2: MiamiCoinTokenModelV2;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  authV2 = ctx.models.get(MiamiCoinAuthModelV2, "miamicoin-auth-v2");
  coreV2 = ctx.models.get(MiamiCoinCoreModelV2, "miamicoin-core-v2");
  tokenV2 = ctx.models.get(MiamiCoinTokenModelV2, "miamicoin-token-v2");
});

afterEach(() => {
  ctx.terminate();
});

// fast forward to block height based on timeline
// perform actions and verify coinbase amounts before/after job + steps of job
// veirfy contract as principal in wallet payout

describe("[CCIP-012]", () => {
  //////////////////////////////////////////////////
  // CCIP-012 IMPLEMENTATION
  //////////////////////////////////////////////////
  describe("Phase 1: update coinbase amounts", () => {
    it("updates coinbase amounts with 2% emissions calculations in token and core contract", () => {
      // arrange
      const jobId = 1;
      const sender = accounts.get("wallet_1")!;
      const approver1 = accounts.get("wallet_2")!;
      const approver2 = accounts.get("wallet_3")!;
      const approver3 = accounts.get("wallet_4")!;
      const coinbaseAmounts = [250000, 100000, 50000, 2230, 2359, 2639, 3288]; // MIA
      // const coinbaseAmounts = [250000, 100000, 50000, 1978, 2094, 2342, 2918]; // NYC
      const targetCore = coreV2.address;
      const targetToken = tokenV2.address;
      chain.mineBlock([
        coreV2.testInitializeCore(coreV2.address),
        coreV2.testSetActivationThreshold(1),
        coreV2.registerUser(sender),
      ]);
      // fast forward to block 77,000
      chain.mineEmptyBlockUntil(77000);
      chain.mineBlock([
        authV2.createJob("update coinbase amounts", authV2.address, sender),
        authV2.addUIntArgument(
          jobId,
          "amountBonus",
          coinbaseAmounts[0],
          sender
        ),
        authV2.addUIntArgument(jobId, "amount1", coinbaseAmounts[1], sender),
        authV2.addUIntArgument(jobId, "amount2", coinbaseAmounts[2], sender),
        authV2.addUIntArgument(jobId, "amount3", coinbaseAmounts[3], sender),
        authV2.addUIntArgument(jobId, "amount4", coinbaseAmounts[4], sender),
        authV2.addUIntArgument(jobId, "amount5", coinbaseAmounts[5], sender),
        authV2.addUIntArgument(
          jobId,
          "amountDefault",
          coinbaseAmounts[6],
          sender
        ),
        authV2.activateJob(jobId, sender),
        authV2.approveJob(jobId, approver1),
        authV2.approveJob(jobId, approver2),
        authV2.approveJob(jobId, approver3),
      ]);

      // act
      const update = chain.mineBlock([
        authV2.executeUpdateCoinbaseAmountsJob(
          jobId,
          targetCore,
          targetToken,
          sender
        ),
      ]);

      // assert
      update.receipts[0].result.expectOk();

      const expectedResult = {
        coinbaseAmount1: types.uint(coinbaseAmounts[1]),
        coinbaseAmount2: types.uint(coinbaseAmounts[2]),
        coinbaseAmount3: types.uint(coinbaseAmounts[3]),
        coinbaseAmount4: types.uint(coinbaseAmounts[4]),
        coinbaseAmount5: types.uint(coinbaseAmounts[5]),
        coinbaseAmountBonus: types.uint(coinbaseAmounts[0]),
        coinbaseAmountDefault: types.uint(coinbaseAmounts[6]),
      };

      const tokenResult = tokenV2.getCoinbaseAmounts().result;
      assertEquals(tokenResult.expectOk().expectTuple(), expectedResult);

      const coreResult = coreV2.getCoinbaseAmounts().result;
      assertEquals(coreResult.expectOk().expectTuple(), expectedResult);
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
      console.log(typeof newCityWallet, newCityWallet);
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
