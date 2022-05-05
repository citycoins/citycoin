import { assertEquals, describe, run, Chain, beforeEach, it, Account, types } from "../../../../deps.ts";
import { Accounts, Context } from "../../../../src/context.ts";
import { NewYorkCityCoinAuthModel } from "../../../../models/cities/nyc/newyorkcitycoin-auth.model.ts";
import { NewYorkCityCoinCoreModel } from "../../../../models/cities/nyc/newyorkcitycoin-core.model.ts";
import { NewYorkCityCoinCoreModelPatch } from "../../../../models/cities/nyc/newyorkcitycoin-core-v1-patch.model.ts";
import { NewYorkCityCoinCoreModelV2 } from "../../../../models/cities/nyc/newyorkcitycoin-core-v2.model.ts";
import { NewYorkCityCoinTokenModel } from "../../../../models/cities/nyc/newyorkcitycoin-token.model.ts";
import { NewYorkCityCoinTokenModelV2 } from "../../../../models/cities/nyc/newyorkcitycoin-token-v2.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let auth: NewYorkCityCoinAuthModel;
let core: NewYorkCityCoinCoreModel;
let coreV1Patch: NewYorkCityCoinCoreModelPatch;
let coreV2: NewYorkCityCoinCoreModelV2;
let token: NewYorkCityCoinTokenModel;
let tokenV2: NewYorkCityCoinTokenModelV2;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  auth = ctx.models.get(NewYorkCityCoinAuthModel, "newyorkcitycoin-auth");
  core = ctx.models.get(NewYorkCityCoinCoreModel, "newyorkcitycoin-core-v1");
  coreV1Patch = ctx.models.get(NewYorkCityCoinCoreModelPatch, "newyorkcitycoin-core-v1-patch");
  coreV2 = ctx.models.get(NewYorkCityCoinCoreModelV2, "newyorkcitycoin-core-v2");
  token = ctx.models.get(NewYorkCityCoinTokenModel, "newyorkcitycoin-token");
  tokenV2 = ctx.models.get(NewYorkCityCoinTokenModelV2, "newyorkcitycoin-token-v2");
});

describe("[NewYorkCityCoin Upgrade v1-v2]", () => {
  const jobId = 1;
  const minerCommit = 10;
  const mintAmount = 1000000;
  const upgradeTarget = 58905;
  let sender: Account;
  let approver1: Account;
  let approver2: Account;
  let approver3: Account;
  let user1: Account;
  let user2: Account;
  let user3: Account;
  let cityWallet: Account;

  beforeEach(() => {
    // setup accounts
    sender = accounts.get("wallet_1")!;
    approver1 = accounts.get("wallet_2")!;
    approver2 = accounts.get("wallet_3")!;
    approver3 = accounts.get("wallet_4")!;
    user1 = accounts.get("wallet_6")!;
    user2 = accounts.get("wallet_7")!;
    user3 = accounts.get("wallet_8")!;
    cityWallet = accounts.get("nyc_wallet")!;

    // activate core v1
    chain.mineEmptyBlockUntil(NewYorkCityCoinCoreModelV2.NEWYORKCITYCOIN_ACTIVATION_HEIGHT - 1);
    const setupBlock = chain.mineBlock([
      token.testMint(mintAmount, user1),
      token.testMint(mintAmount, user2),
      token.testMint(mintAmount, user3),
      core.testInitializeCore(core.address),
      core.testSetActivationThreshold(1),
      core.registerUser(sender),
    ]);
    const activationBlock = setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY - 1;
    chain.mineEmptyBlockUntil(activationBlock);

    // mine tokens for claim in past
    // block: 37599, user1
    chain.mineBlock([
      core.mineTokens(minerCommit * 1000, user1),
      core.mineTokens(minerCommit, user2),
      core.mineTokens(minerCommit, user3),
    ]);
    chain.mineEmptyBlock(100);
    // block: 37700, user2
    chain.mineBlock([
      core.mineTokens(minerCommit, user1),
      core.mineTokens(minerCommit * 1000, user2),
      core.mineTokens(minerCommit, user3),
    ]);
    chain.mineEmptyBlock(100);
    // block: 37801, user3
    chain.mineBlock([
      core.mineTokens(minerCommit, user1),
      core.mineTokens(minerCommit, user2),
      core.mineTokens(minerCommit * 1000, user3),
    ]);

    // fast-forward to NYC cycle 4 (45849)
    // stack tokens for testing claims
    // before during and after shutdown
    chain.mineEmptyBlockUntil(46000);
    chain.mineBlock([
      core.stackTokens(1000, 3, user1),  // cycles 5 - 7
      core.stackTokens(1000, 6, user2),  // cycles 5 - 10
      core.stackTokens(1000, 10, user3), // cycles 5 - 14
    ]);

    // mine in NYC cycle 5 after tokens are stacked
    chain.mineEmptyBlock(NewYorkCityCoinCoreModelV2.REWARD_CYCLE_LENGTH);
    chain.mineBlock([
      core.mineTokens(minerCommit * 1000, user1),
      core.mineTokens(minerCommit, user2),
      core.mineTokens(minerCommit, user3),
    ]);

    // mine in NYC cycle 10 before the upgrade (58449)
    chain.mineEmptyBlockUntil(58475);
    chain.mineBlock([
      core.mineTokens(minerCommit * 1000, user1),
      core.mineTokens(minerCommit, user2),
      core.mineTokens(minerCommit, user3),
    ]);

    // fast-forward to just before the upgrade
    // and mine past the shutdown height
    chain.mineEmptyBlockUntil(58850);
    const minerCommits = new Array(100).fill(minerCommit * 100);
    chain.mineBlock([
      core.mineMany(minerCommits, user1),
    ]);

    // setup upgrade job
    chain.mineBlock([
      auth.createJob(
        "upgrade core",
        auth.address,
        sender
      ),
      auth.addPrincipalArgument(
        jobId,
        "oldContract",
        core.address,
        sender
      ),
      auth.addPrincipalArgument(
        jobId,
        "newContract",
        coreV1Patch.address,
        sender
      ),
      auth.activateJob(jobId, sender),
      auth.approveJob(jobId, approver1),
      auth.approveJob(jobId, approver2),
      auth.approveJob(jobId, approver3),
    ]);

    // fast-forward to proposed shutdown height
    // and setup upgrade using approvers job
    // citycoin-core-v1 -> citycoin-core-v1-patch
    chain.mineEmptyBlockUntil(upgradeTarget);
    
    // perform contract upgrade to v1-patch and
    // activate the new core-v2 contract
    const upgradeBlock = chain.mineBlock([
      auth.executeUpgradeCoreContractJob(
        jobId,
        core.address,
        coreV1Patch.address,
        sender
      ),
      coreV2.testInitializeCore(coreV2.address),
      coreV2.testSetActivationThreshold(1),
      coreV2.registerUser(sender),
    ]);
    const activationBlockUpgrade = upgradeBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY - 1;
    chain.mineEmptyBlockUntil(activationBlockUpgrade);
  });

  /////////////////////////
  // register-user()
  /////////////////////////

  it("register-user() succeeded in v2 and set correct activation block", () => {
    // act
    const coreV2Activation = coreV2.getActivationBlock().result;
    // assert
    coreV2Activation.expectOk().expectUint(NewYorkCityCoinCoreModelV2.NEWYORKCITYCOIN_ACTIVATION_HEIGHT);
  });

  it("register-user() succeeds and sets correct coinbase thresholds", () => {
    // arrange
    const activationBlock = NewYorkCityCoinCoreModelV2.NEWYORKCITYCOIN_ACTIVATION_HEIGHT;
    const bonusPeriod = NewYorkCityCoinCoreModelV2.BONUS_PERIOD_LENGTH;
    const epochLength = NewYorkCityCoinCoreModelV2.TOKEN_EPOCH_LENGTH;
    // act
    const result = coreV2.getCoinbaseThresholds().result;
    // assert
    const expectedResult = {
      coinbaseThreshold1: types.uint(activationBlock + bonusPeriod + epochLength),      // 72449
      coinbaseThreshold2: types.uint(activationBlock + bonusPeriod + epochLength * 3),  // 122449
      coinbaseThreshold3: types.uint(activationBlock + bonusPeriod + epochLength * 7),  // 222449
      coinbaseThreshold4: types.uint(activationBlock + bonusPeriod + epochLength * 15), // 422449
      coinbaseThreshold5: types.uint(activationBlock + bonusPeriod + epochLength * 31)  // 822449
    };
    assertEquals(result.expectOk().expectTuple(), expectedResult);
  });

  it("register-user() succeeds and sets correct coinbase amounts", () => {
    // arrange
    const user = accounts.get("wallet_1")!;
    const microCitycoins = NewYorkCityCoinCoreModelV2.MICRO_CITYCOINS;
    const block = chain.mineBlock([
      coreV2.testInitializeCore(coreV2.address),
      coreV2.testSetActivationThreshold(1),
      coreV2.registerUser(user)
    ]);
    const activationBlockHeight =
      block.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY - 1;
    chain.mineEmptyBlockUntil(activationBlockHeight);
    // act
    const result = coreV2.getCoinbaseAmounts().result;
    // assert
    const expectedResult = {
      coinbaseAmount1: types.uint(100000 * microCitycoins),
      coinbaseAmount2: types.uint(50000 * microCitycoins),
      coinbaseAmount3: types.uint(25000 * microCitycoins),
      coinbaseAmount4: types.uint(12500 * microCitycoins),
      coinbaseAmount5: types.uint(6250 * microCitycoins),
      coinbaseAmountBonus: types.uint(250000 * microCitycoins),
      coinbaseAmountDefault: types.uint(3125 * microCitycoins),
    };
    assertEquals(result.expectOk().expectTuple(), expectedResult);
  });

  /////////////////////////
  // mine-tokens()
  /////////////////////////

  it("mine-tokens() fails in v1 with ERR_CONTRACT_NOT_ACTIVATED after upgrade", () => {
    // act
    const receipt = chain.mineBlock([
      core.mineTokens(minerCommit, user1),
    ]).receipts[0];
    // assert
    receipt.result.expectErr().expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_CONTRACT_NOT_ACTIVATED);
  });

  it("mine-tokens() succeeds in v2 contract after upgrade and intialization", () => {
    // act
    const receipt = chain.mineBlock([
      coreV2.mineTokens(minerCommit, user1),
    ]).receipts[0];
    // assert
    receipt.result.expectOk().expectBool(true);
    assertEquals(receipt.events.length, 1);
    receipt.events.expectSTXTransferEvent(
      minerCommit,
      user1.address,
      cityWallet.address
    );
  });

  /////////////////////////
  // mine-many()
  /////////////////////////

  it("mine-many() fails in v1 with ERR_CONTRACT_NOT_ACTIVATED after upgrade", () => {
    // arrange
    const minerCommits = new Array(100).fill(minerCommit * 100);
    // act
    const receipt = chain.mineBlock([
      core.mineMany(minerCommits, user1),
    ]).receipts[0];
    // assert
    receipt.result.expectErr().expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_CONTRACT_NOT_ACTIVATED);
  });

  it("mine-many() succeeds in v2 contract after upgrade and intialization", () => {
    // arrange
    const minerCommits = new Array(100).fill(minerCommit * 100);
    // act
    const block = chain.mineBlock([
      coreV2.mineMany(minerCommits, user1),
    ]);
    const receipt = block.receipts[0];
    // assert
    receipt.result.expectOk().expectBool(true);
    assertEquals(receipt.events.length, 2);
    receipt.events.expectSTXTransferEvent(
      minerCommit * 10000,
      user1.address,
      cityWallet.address
    );
  });

  /////////////////////////
  // stack-tokens()
  /////////////////////////

  it("stack-tokens() succeeds in v2 contract starting at cycle shutdown occurred in", () => {
    // arrange
    const amountStacked = 200;
    const lockPeriod = 5;
    chain.mineBlock([
      tokenV2.convertToV2(user1),
    ]);
    // act
    const block = chain.mineBlock([
      coreV2.stackTokens(amountStacked, lockPeriod, user1),
    ]);
    const receipt = block.receipts[0];
    // assert
    receipt.result.expectOk().expectBool(true);
    assertEquals(receipt.events.length, 2);
    receipt.events.expectFungibleTokenTransferEvent(
      amountStacked,
      user1.address,
      coreV2.address,
      "newyorkcitycoin"
    );
  });

  it("stack-tokens() succeeds in v2 contract after v1 shutdown occurred", () => {
    // arrange
    chain.mineEmptyBlock(NewYorkCityCoinCoreModelV2.REWARD_CYCLE_LENGTH)
    const amountStacked = 200;
    const lockPeriod = 5;
    chain.mineBlock([
      tokenV2.convertToV2(user1),
    ]);
    // act
    const block = chain.mineBlock([
      coreV2.stackTokens(amountStacked, lockPeriod, user1),
    ]);
    const receipt = block.receipts[0];
    // assert
    receipt.result.expectOk().expectBool(true);
    assertEquals(receipt.events.length, 2);
    receipt.events.expectFungibleTokenTransferEvent(
      amountStacked,
      user1.address,
      coreV2.address,
      "newyorkcitycoin"
    );
  });

  /////////////////////////
  // claim-mining-reward()
  /////////////////////////

  it("claim-mining-reward() fails in v1 with ERR_CLAIM_IN_WRONG_CONTRACT after shutdown block", () => {
    // arrange
    const targetBlock = 59000;
    // act
    const block = chain.mineBlock([
      core.claimMiningReward(targetBlock, user1),
    ]);
    const receipt = block.receipts[0];
    // assert
    receipt.result.expectErr().expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_CLAIM_IN_WRONG_CONTRACT);
  });

  it("claim-mining-reward() succeeds in v1 with block height in the past", () => {
    // arrange
    const targetBlock1 = 37598;
    const targetBlock2 = 37699;
    const targetBlock3 = 37800;
    // act
    const block = chain.mineBlock([
      core.claimMiningReward(targetBlock1, user1),
      core.claimMiningReward(targetBlock2, user2),
      core.claimMiningReward(targetBlock3, user3),
    ]);
    // assert
    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(true);
    block.receipts[2].result.expectOk().expectBool(true);
  });

  it("claim-mining-reward() succeeds in v1 with two blocks prior to end of the upgrade", () => {
    // arrange
    const targetBlock1 = upgradeTarget - 2;
    const targetBlock2 = upgradeTarget - 1;
    // act
    const block = chain.mineBlock([
      core.claimMiningReward(targetBlock1, user1),
      core.claimMiningReward(targetBlock2, user1),
    ]);
    // assert
    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(true);
  });

  /////////////////////////
  // claim-stacking-reward()
  /////////////////////////

  it("claim-stacking-reward() succeeds in v1 with reward cycle in the past after shutdown", () => {
    // arrange
    const targetCycle = 5;
    // act
    const block = chain.mineBlock([
      core.claimStackingReward(targetCycle, user1),
      core.claimStackingReward(targetCycle, user2),
      core.claimStackingReward(targetCycle, user3),
    ]);
    // assert
    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(true);
    block.receipts[2].result.expectOk().expectBool(true);
  });

  it("claim-stacking-reward() succeeds in v1 with current reward cycle after shutdown and returns CityCoins without returning STX", () => {
    // this confirms a known bug in `get-entitled-stacking-reward`
    // arrange
    const targetCycle = 10;
    // act
    const block = chain.mineBlock([
      core.claimStackingReward(targetCycle, user2)
    ]);
    const receipt = block.receipts[0];
    // assert
    receipt.result.expectOk().expectBool(true);
    assertEquals(receipt.events.length, 1);
    receipt.events.expectFungibleTokenTransferEvent(
      1000,
      core.address,
      user2.address,
      "newyorkcitycoin"
    );
  });

  it("claim-stacking-reward() succeeds in v1 with current reward cycle after shutdown and returns CityCoins and STX", () => {
    // this mitigates a known bug in `get-entitled-stacking-reward`
    // arrange
    const targetCycle = 10;
    // proceed to cycle 11 (60549)
    chain.mineEmptyBlockUntil(60750);
    // act
    const block = chain.mineBlock([
      core.claimStackingReward(targetCycle, user2)
    ]);
    const receipt = block.receipts[0];
    // assert
    receipt.result.expectOk().expectBool(true);
    assertEquals(receipt.events.length, 2);
    receipt.events.expectFungibleTokenTransferEvent(
      1000,
      core.address,
      user2.address,
      "newyorkcitycoin"
    );
    receipt.events.expectSTXTransferEvent(
      35000,
      core.address,
      user2.address
    );
  });

  it("claim-stacking-reward() succeeds in v1 with future reward cycle after shutdown and returns CityCoins", () => {
    // arrange
    const targetCycle = 14;
    // act
    const block = chain.mineBlock([
      core.claimStackingReward(targetCycle, user3)
    ]);
    const receipt = block.receipts[0];
    // assert
    receipt.result.expectOk().expectBool(true);
    assertEquals(receipt.events.length, 1);
    receipt.events.expectFungibleTokenTransferEvent(
      1000,
      core.address,
      user3.address,
      "newyorkcitycoin"
    );
  });
  
});

run();
