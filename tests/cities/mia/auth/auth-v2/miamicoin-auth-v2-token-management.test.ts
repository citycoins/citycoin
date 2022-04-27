import { describe, run, Chain, beforeEach, it} from "../../../../../deps.ts";
import { Accounts, Context } from "../../../../../src/context.ts";
import { MiamiCoinAuthModelV2 } from "../../../../../models/cities/mia/miamicoin-auth-v2.model.ts";
import { MiamiCoinTokenModelV2 } from "../../../../../models/cities/mia/miamicoin-token-v2.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let authV2: MiamiCoinAuthModelV2;
let tokenV2: MiamiCoinTokenModelV2;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  authV2 = ctx.models.get(MiamiCoinAuthModelV2, "miamicoin-auth-v2");
  tokenV2 = ctx.models.get(MiamiCoinTokenModelV2, "miamicoin-token-v2");
})

describe("[MiamiCoin Auth v2]", () => {
  //////////////////////////////////////////////////
  // TOKEN MANAGEMENT
  //////////////////////////////////////////////////
  describe("TOKEN MANAGEMENT", () => {
    describe("set-token-uri()", () => {
      it("fails with ERR_UNAUTHORIZED when called by someone who is not city wallet", () => {
        // arrange
        const sender = accounts.get("wallet_2")!;
        // act
        const block = chain.mineBlock([
          authV2.setTokenUri(
            sender,
            tokenV2.address,
            "http://something-something.com"
          ),
        ]);
        // assert
        const receipt = block.receipts[0];

        receipt.result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_UNAUTHORIZED);
      });
      it("fails with ERR_UNAUTHORIZED when called by someone who is not auth contract", () => {
        // arrange
        const sender = accounts.get("wallet_2")!;
        // act
        const block = chain.mineBlock([
          tokenV2.setTokenUri(sender, "http://something-something.com"),
        ]);
        // assert
        const receipt = block.receipts[0];

        receipt.result
          .expectErr()
          .expectUint(MiamiCoinTokenModelV2.ErrCode.ERR_UNAUTHORIZED);
      });
      it("succeeds and updates token uri to none if no new value is provided", () => {
        // arrange
        const sender = accounts.get("mia_wallet")!;
        // act
        const block = chain.mineBlock([
          authV2.setTokenUri(sender, tokenV2.address),
        ]);
        // assert
        const receipt = block.receipts[0];

        receipt.result.expectOk().expectBool(true);

        const result = tokenV2.getTokenUri().result;
        result.expectOk().expectNone();
      });
      it("succeeds and updates token uri to new value if provided", () => {
        // arrange
        const sender = accounts.get("mia_wallet")!;
        const newUri = "http://something-something.com";
        // act
        const block = chain.mineBlock([
          authV2.setTokenUri(
            sender,
            tokenV2.address,
            newUri
          ),
        ]);
        // assert
        const receipt = block.receipts[0];

        receipt.result.expectOk().expectBool(true);

        const result = tokenV2.getTokenUri().result;
        result.expectOk().expectSome().expectUtf8(newUri);
      });
    });
  });

  describe("APPROVERS MANAGEMENT", () => {
    describe("execute-replace-approver-job()", () => {
      it("succeeds and replaces one approver with a new principal", () => {
        const jobId = 1;
        const approver1 = accounts.get("wallet_1")!;
        const approver2 = accounts.get("wallet_2")!;
        const approver3 = accounts.get("wallet_3")!;
        const approver4 = accounts.get("wallet_4")!;
        const newApprover = accounts.get("wallet_7")!;

        authV2.isApprover(newApprover).result.expectBool(false);
        chain.mineBlock([
          authV2.createJob(
            "replace approver1",
            authV2.address,
            approver1
          ),
          authV2.addPrincipalArgument(
            jobId,
            "oldApprover",
            approver1.address,
            approver1
          ),
          authV2.addPrincipalArgument(
            jobId,
            "newApprover",
            newApprover.address,
            approver1
          ),
          authV2.activateJob(jobId, approver1),
          authV2.approveJob(jobId, approver1),
          authV2.approveJob(jobId, approver2),
          authV2.approveJob(jobId, approver3),
          authV2.approveJob(jobId, approver4),
        ]);

        const receipt = chain.mineBlock([
          authV2.executeReplaceApproverJob(jobId, approver1),
        ]).receipts[0];

        receipt.result.expectOk().expectBool(true);

        authV2.isApprover(approver1).result.expectBool(false);
        authV2.isApprover(newApprover).result.expectBool(true);
      });

      it("fails with ERR_UNAUTHORIZED if replaced/inactive approver creates or approves jobs", () => {
        const replaceApproverJobId = 1;
        const anotherJobId = 2;
        const oldApprover = accounts.get("wallet_1")!;
        const approver2 = accounts.get("wallet_2")!;
        const approver3 = accounts.get("wallet_3")!;
        const approver4 = accounts.get("wallet_4")!;
        const newApprover = accounts.get("wallet_7")!;

        authV2.isApprover(newApprover).result.expectBool(false);
        chain.mineBlock([
          authV2.createJob(
            "replace oldApprover",
            authV2.address,
            approver2
          ),
          authV2.addPrincipalArgument(
            replaceApproverJobId,
            "oldApprover",
            oldApprover.address,
            approver2
          ),
          authV2.addPrincipalArgument(
            replaceApproverJobId,
            "newApprover",
            newApprover.address,
            approver2
          ),
          authV2.activateJob(replaceApproverJobId, approver2),
          authV2.approveJob(replaceApproverJobId, oldApprover),
          authV2.approveJob(replaceApproverJobId, approver2),
          authV2.approveJob(replaceApproverJobId, approver3),
          authV2.approveJob(replaceApproverJobId, approver4),
          authV2.executeReplaceApproverJob(
            replaceApproverJobId,
            oldApprover
          ),
          authV2.createJob(
            "new job",
            authV2.address,
            approver2
          ),
          authV2.activateJob(anotherJobId, approver2),
        ]);

        // act
        const receipts = chain.mineBlock([
          authV2.createJob(
            "test job",
            authV2.address,
            oldApprover
          ),
          authV2.approveJob(anotherJobId, oldApprover),
        ]).receipts;

        // assert
        receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_UNAUTHORIZED);
        receipts[1].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_UNAUTHORIZED);
      });
    });
  });
});

run();
