import { assertEquals, describe, run, Chain, beforeEach, it, Account, types } from "../../../../deps.ts";
import { Accounts, Context } from "../../../../src/context.ts";
import { MiamiCoinAuthModel } from "../../../../models/cities/mia/miamicoin-auth.model.ts";
import { MiamiCoinAuthModelV2 } from "../../../../models/cities/mia/miamicoin-auth-v2.model.ts";
import { MiamiCoinCoreModel } from "../../../../models/cities/mia/miamicoin-core.model.ts";
import { MiamiCoinCoreModelPatch } from "../../../../models/cities/mia/miamicoin-core-v1-patch.model.ts";
import { MiamiCoinCoreModelV2 } from "../../../../models/cities/mia/miamicoin-core-v2.model.ts";
import { MiamiCoinTokenModel } from "../../../../models/cities/mia/miamicoin-token.model.ts";
import { MiamiCoinTokenModelV2 } from "../../../../models/cities/mia/miamicoin-token-v2.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let auth: MiamiCoinAuthModel;
let authV2: MiamiCoinAuthModelV2;
let core: MiamiCoinCoreModel;
let coreV1Patch: MiamiCoinCoreModelPatch;
let coreV2: MiamiCoinCoreModelV2;
let token: MiamiCoinTokenModel;
let tokenV2: MiamiCoinTokenModelV2;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  auth = ctx.models.get(MiamiCoinAuthModel, "miamicoin-auth");
  authV2 = ctx.models.get(MiamiCoinAuthModelV2, "miamicoin-auth-v2");
  core = ctx.models.get(MiamiCoinCoreModel, "miamicoin-core-v1");
  coreV1Patch = ctx.models.get(MiamiCoinCoreModelPatch, "miamicoin-core-v1-patch");
  coreV2 = ctx.models.get(MiamiCoinCoreModelV2, "miamicoin-core-v2");
  token = ctx.models.get(MiamiCoinTokenModel, "miamicoin-token");
  tokenV2 = ctx.models.get(MiamiCoinTokenModelV2, "miamicoin-token-v2");
});

describe("[MiamiCoin Core Upgrade v1-v2]", () => {
  const jobId = 1;
  const minerCommit = 1;
  const mintAmount = 1000000;
  let sender: Account;
  let approver1: Account;
  let approver2: Account;
  let approver3: Account;
  let user1: Account;
  let user2: Account;
  let user3: Account;

  beforeEach(() => {
    // setup accounts
    sender = accounts.get("wallet_1")!;
    approver1 = accounts.get("wallet_2")!;
    approver2 = accounts.get("wallet_3")!;
    approver3 = accounts.get("wallet_4")!;
    user1 = accounts.get("wallet_6")!;
    user2 = accounts.get("wallet_7")!;
    user3 = accounts.get("wallet_8")!;

    // activate core v1
    const setupBlock = chain.mineBlock([
      token.testMint(mintAmount, user1),
      token.testMint(mintAmount, user2),
      token.testMint(mintAmount, user3),
      core.testInitializeCore(core.address),
      core.testSetActivationThreshold(1),
      core.registerUser(sender),
    ]);
    const activationBlock = setupBlock.height + MiamiCoinCoreModelV2.ACTIVATION_DELAY - 1;
    chain.mineEmptyBlockUntil(activationBlock);

    // mine tokens for claim in past
    // console.log("---------- Mining")
    // console.log(`block: 152, user1`)
    chain.mineBlock([
      core.mineTokens(minerCommit * 1000, user1),
      core.mineTokens(minerCommit, user2),
      core.mineTokens(minerCommit, user3),
    ]);
    chain.mineEmptyBlock(100);
    // console.log(`block: 253, user2`)
    chain.mineBlock([
      core.mineTokens(minerCommit, user1),
      core.mineTokens(minerCommit * 1000, user2),
      core.mineTokens(minerCommit, user3),
    ]);
    chain.mineEmptyBlock(100);
    // console.log(`block: 354, user3`)
    chain.mineBlock([
      core.mineTokens(minerCommit, user1),
      core.mineTokens(minerCommit, user2),
      core.mineTokens(minerCommit * 1000, user3),
    ]);

    // fast-forward to MIA cycle 12 (49697)
    // stack tokens for testing claims
    // before during and after shutdown
    chain.mineEmptyBlockUntil(49699);
    // console.log("---------- Stacking")
    // console.log(`block: 49,700`)
    chain.mineBlock([
      core.stackTokens(1000, 4, user1),  // cycles 12 - 15
      core.stackTokens(1000, 5, user2),  // cycles 12 - 16
      core.stackTokens(1000, 10, user3), // cycles 12 - 22
    ]);

    // fast-forward to just before the upgrade
    // and mine past the shutdown height
    chain.mineEmptyBlockUntil(58949);
    // console.log("---------- Mining past shutdown")
    // console.log(`block: 58,950`)
    const minerCommits = new Array(100).fill(minerCommit * 100);
    chain.mineBlock([
      core.mineMany(minerCommits, user1),
    ]);

    // setup upgrade job
    // console.log("---------- Upgrade prep")
    // console.log(`block: 58,951`)
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
    chain.mineEmptyBlockUntil(58999);
    
    // perform contract upgrade and activate
    // new core-v2 contract for mining/stacking
    // console.log("---------- Contract upgrade")
    // console.log(`block: 59,000`)
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
    const activationBlockUpgrade = upgradeBlock.height + MiamiCoinCoreModelV2.ACTIVATION_DELAY - 1;
    chain.mineEmptyBlockUntil(activationBlockUpgrade);
  });

  it("register-user() succeeded in v2 and set correct activation block", () => {
    // act
    const coreV2Activation = coreV2.getActivationBlock().result;
    // assert
    coreV2Activation.expectOk().expectUint(MiamiCoinCoreModelV2.MIAMICOIN_ACTIVATION_HEIGHT);
  });

  it("register-user() succeeds and sets correct coinbase thresholds", () => {
    // arrange
    const activationBlock = MiamiCoinCoreModelV2.MIAMICOIN_ACTIVATION_HEIGHT;
    const bonusPeriod = MiamiCoinCoreModelV2.BONUS_PERIOD_LENGTH;
    const epochLength = MiamiCoinCoreModelV2.TOKEN_EPOCH_LENGTH;
    // act
    const result = coreV2.getCoinbaseThresholds().result;
    console.log(`result: ${result}`)
    // assert
    const expectedResult = {
      coinbaseThreshold1: types.uint(activationBlock + bonusPeriod + epochLength),      // 59497
      coinbaseThreshold2: types.uint(activationBlock + bonusPeriod + epochLength * 3),  // 109497
      coinbaseThreshold3: types.uint(activationBlock + bonusPeriod + epochLength * 7),  // 209497
      coinbaseThreshold4: types.uint(activationBlock + bonusPeriod + epochLength * 15), // 409497
      coinbaseThreshold5: types.uint(activationBlock + bonusPeriod + epochLength * 31)  // 809497
    };
    assertEquals(result.expectOk().expectTuple(), expectedResult);
  });

  // MIA activation: 24497

  // epoch 1: 24497  + 10000  = 34497  (100k)
  // epoch 2: 34497  + 25000  = 59497  (50k)
  // epoch 3: 54497  + 50000  = 109497 (25k)
  // epoch 4: 109497 + 100000 = 209497 (12.5k)
  // epoch 5: 209497 + 200000 = 409497 (6.25k)
  // epoch 6: 409497 + 400000 = 809497 (3.125k)

  // epoch 1: 24497 + 10000                                              = 34497
  // epoch 2: 24497 + 10000 + 25000                                      = 59497
  // epoch 3: 24497 + 10000 + (25000 + 50000)                            = 109497
  // epoch 4: 24497 + 10000 + (25000 + 50000 + 100000)                   = 209497
  // epoch 5: 24497 + 10000 + (25000 + 50000 + 100000 + 200000)          = 409497
  // epoch 6: 24497 + 10000 + (25000 + 50000 + 100000 + 200000 + 400000) = 809497

  // epoch 1: 24497 + 10000              = 34497
  // epoch 2: 24497 + 10000 + 25000      = 59497  (+ 25000)
  // epoch 3: 24497 + 10000 + 25000 * 3  = 109497 (+ 50000)
  // epoch 4: 24497 + 10000 + 25000 * 7  = 209497 (+ 100000)
  // epoch 5: 24497 + 10000 + 25000 * 15 = 409497 (+ 200000)
  // epoch 6: 24497 + 10000 + 25000 * 31 = 809497 (+ 400000)

});

run();

/*

it("register-user() succeeds and sets correct coinbase amounts");

it("mine-tokens() fails in v1 with ERR_CONTRACT_NOT_ACTIVATED after upgrade");
it("mine-tokens() fails in v2 with ERR_CONTRACT_NOT_ACTIVATED if called before initalized")
it("mine-tokens() succeeds in v2 contract after upgrade and intialization");

it("mine-many() fails in v1 with ERR_CONTRACT_NOT_ACTIVATED after upgrade");
it("mine-many() fails in v2 with ERR_CONTRACT_NOT_ACTIVATED if called before initalized")
it("mine-many() succeeds in v2 contract after upgrade and intialization");

// also eval token split, cycle status, etc
it("stack-tokens() succeeds in v2 contract starting at cycle X");
it("stack-tokens() succeeds in v2 contract after cycle X");

it("claim-mining-reward() fails in v1 with ERR_CLAIM_IN_WRONG_CONTRACT after shutdown block");
it("claim-mining-reward() succeeds in v1 with block height in the past");

it("claim-stacking-reward() succeeds in v1 with reward cycle in the past");
// known issue below, will not return uSTX
it("claim-stacking-reward() succeeds in v1 with current reward cycle during shutdown");
it("claim-stacking-reward() succeeds in v1 with reward cycle in the future");

*/