import { assertEquals, describe, run, Chain, beforeEach, it, Account } from "../../../../deps.ts";
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
    console.log("---------- Mining")
    console.info(chain.mineBlock([
      core.mineTokens(minerCommit * 1000, user1),
      core.mineTokens(minerCommit, user2),
      core.mineTokens(minerCommit, user3),
    ]));
    chain.mineEmptyBlock(100);
    chain.mineBlock([
      core.mineTokens(minerCommit, user1),
      core.mineTokens(minerCommit * 1000, user2),
      core.mineTokens(minerCommit, user3),
    ]);
    chain.mineEmptyBlock(100);
    chain.mineBlock([
      core.mineTokens(minerCommit, user1),
      core.mineTokens(minerCommit, user2),
      core.mineTokens(minerCommit * 1000, user3),
    ]);

    // fast-forward to MIA cycle 12 (49697)
    // stack tokens for testing claims
    // before during and after shutdown
    chain.mineEmptyBlockUntil(49700);
    console.log("---------- Stacking")
    console.info(chain.mineBlock([
      core.stackTokens(1000, 4, user1),  // cycles 12 - 15
      core.stackTokens(1000, 5, user2),  // cycles 12 - 16
      core.stackTokens(1000, 10, user3), // cycles 12 - 22
    ]));

    // setup upgrade job
    console.log("---------- Upgrade prep")
    console.info(chain.mineBlock([
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
    ]));

    // fast-forward to proposed shutdown height
    // and setup upgrade using approvers job
    // citycoin-core-v1 -> citycoin-core-v1-patch
    chain.mineEmptyBlockUntil(59000);
    
    // perform contract upgrade and activate
    // new core-v2 contract for mining/stacking
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

  it("Test 1", () => {
    console.log(`----------------------------`)
    console.log(`Test 1`)
    console.log(`jobId: ${jobId}`)
    console.log(`sender: ${sender.address}`)
    console.log(`v1 active core: ${auth.getActiveCoreContract().result}`)
    console.log(`v2 active core: ${authV2.getActiveCoreContract().result}`)
    console.log(`job info: ${auth.getJob(jobId).result}`)
    console.log(auth.getCoreContractInfo(core.address).result);
    console.log(auth.getCoreContractInfo(coreV1Patch.address).result);
    console.log(authV2.getCoreContractInfo(coreV2.address).result);
    console.log(`----------------------------`)
  });
});

run();

/*
- v1 mining fails after core shutdown
- v1 mining claim succeeds after shutdown before shutdown block
- v1 mining claim fails after shutdown after shutdown block (confirms bug)
- v2 mining fails before initialization
- v2 mining succeeds after initialization
- stacking claim succeeds after shutdown for all cycles
  - confirm current bug, then confirm fixed
  - current, previous, and future cycles
- auth v1 upgrade succeeds with upgrade to v1 patch (already in core-v1-patch test?)
- activation block heights v1 = v2
- compare coinbase thresholds manually

before shutdown, include multiple mining/stacking records in v1
*/