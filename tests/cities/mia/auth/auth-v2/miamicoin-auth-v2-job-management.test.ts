import { assertEquals, describe, types, run, Chain, beforeEach, it, afterEach} from "../../../../../deps.ts";
import { Accounts, Context } from "../../../../../src/context.ts";
import { MiamiCoinAuthModelV2 } from "../../../../../models/cities/mia/miamicoin-auth-v2.model.ts";
import { MiamiCoinCoreModelV2 } from "../../../../../models/cities/mia/miamicoin-core-v2.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let authV2: MiamiCoinAuthModelV2;
let coreV2: MiamiCoinCoreModelV2;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  authV2 = ctx.models.get(MiamiCoinAuthModelV2, "miamicoin-auth-v2");
  coreV2 = ctx.models.get(MiamiCoinCoreModelV2, "miamicoin-core-v2");
})

afterEach(() => {
  ctx.terminate()
});

describe("[MiamiCoin Auth v2]", () => {
  //////////////////////////////////////////////////
  // JOB MANAGEMENT
  //////////////////////////////////////////////////
  describe("JOB MANAGEMENT", () => {
    describe("get-last-job-id()", () => {
      it("succeeds and returns u0 if no jobs have been created", () => {
        // act
        const result = authV2.getLastJobId().result;

        // assert
        result.expectUint(0);
      });
      it("succeeds and returns u1 after a job has been created", () => {
        // arrange
        const name = "job_1";
        const target = coreV2.address;
        const sender = accounts.get("wallet_1")!;

        // act
        chain.mineBlock([authV2.createJob(name, target, sender)]);

        const result = authV2.getLastJobId().result;

        // assert
        result.expectUint(1);
      });
    });

    describe("create-job()", () => {
      it("fails with ERR_UNAUTHORIZED if not called by an approver", () => {
        // arrange
        const name = "job_1";
        const target = coreV2.address;
        const sender = accounts.get("deployer")!;

        // act
        const block = chain.mineBlock([
          authV2.createJob(name, target, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_UNAUTHORIZED);
      });

      it("succeeds and creates new job if called by an approver", () => {
        // arrange
        const name = "job_1";
        const target = coreV2.address;
        const sender = accounts.get("wallet_1")!;

        // act
        const block = chain.mineBlock([
          authV2.createJob(name, target, sender),
        ]);

        // assert
        block.receipts[0].result.expectOk().expectUint(1);
      });
    });

    describe("get-job()", () => {
      it("succeeds and returns none for unknown job ID", () => {
        // arrange
        const jobId = 1;

        // act
        const result = authV2.getJob(jobId).result;

        // assert
        result.expectNone();
      });

      it("succeeds and returns some with job details for known job ID", () => {
        // arrange
        const name = "job123";
        const target = coreV2.address;
        const sender = accounts.get("wallet_1")!;
        chain.mineBlock([authV2.createJob(name, target, sender)]);

        // act
        const result = authV2.getJob(1).result;

        // assert
        const expectedJob = {
          creator: sender.address,
          name: types.ascii(name),
          target: target,
          approvals: types.uint(0),
          disapprovals: types.uint(0),
          isActive: types.bool(false),
          isExecuted: types.bool(false),
        };
        const actualJob = result.expectSome().expectTuple();
        assertEquals(actualJob, expectedJob);
      });
    });

    describe("activate-job()", () => {
      it("fails with ERR_UNKNOWN_JOB while activating unknown job ID", () => {
        // arrange
        const jobId = 10;
        const wallet = accounts.get("wallet_4")!;

        // act
        const block = chain.mineBlock([
          authV2.activateJob(jobId, wallet),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_UNKNOWN_JOB);
      });

      it("fails with ERR_UNAUTHORIZED while activating job by someone who is not its creator", () => {
        // arrange
        const name = "job-123456";
        const target = coreV2.address;
        const creator = accounts.get("wallet_1")!;
        const jobId = 1;
        const wallet = accounts.get("wallet_4")!;

        chain.mineBlock([authV2.createJob(name, target, creator)]);

        // act
        const block = chain.mineBlock([
          authV2.activateJob(jobId, wallet),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_UNAUTHORIZED);
      });

      it("fails with ERR_JOB_IS_ACTIVE while activating job that is already active", () => {
        // arrange
        const name = "job-123456";
        const target = coreV2.address;
        const creator = accounts.get("wallet_1")!;
        const jobId = 1;
        chain.mineBlock([
          authV2.createJob(name, target, creator),
          authV2.activateJob(1, creator),
        ]);

        // act
        const block = chain.mineBlock([
          authV2.activateJob(jobId, creator),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_JOB_IS_ACTIVE);
      });

      it("succeeds and activates job if called by its creator", () => {
        // arrange
        const name = "job-123456";
        const target = coreV2.address;
        const creator = accounts.get("wallet_1")!;
        const jobId = 1;
        chain.mineBlock([authV2.createJob(name, target, creator)]);

        // act
        const block = chain.mineBlock([
          authV2.activateJob(jobId, creator),
        ]);

        // assert
        block.receipts[0].result.expectOk().expectBool(true);

        const expectedJob = {
          creator: creator.address,
          name: types.ascii(name),
          target: target,
          approvals: types.uint(0),
          disapprovals: types.uint(0),
          isActive: types.bool(true),
          isExecuted: types.bool(false),
        };

        const actualJob = authV2
          .getJob(jobId)
          .result.expectSome()
          .expectTuple();

        assertEquals(actualJob, expectedJob);
      });
    });

    describe("approve-job()", () => {
      it("fails with ERR_UNKNOWN_JOB while approving unknown job ID", () => {
        // arrange
        const approver = accounts.get("wallet_2")!;
        const jobId = 399;

        // act
        const block = chain.mineBlock([
          authV2.approveJob(jobId, approver),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_UNKNOWN_JOB);
      });

      it("fails with ERR_JOB_IS_NOT_ACTIVE while approving inactive job ID", () => {
        // arrange
        const name = "job-123456";
        const target = coreV2.address;
        const creator = accounts.get("wallet_1")!;
        const approver = accounts.get("wallet_2")!;
        const jobId = 1;
        chain.mineBlock([authV2.createJob(name, target, creator)]);

        // act
        const block = chain.mineBlock([
          authV2.approveJob(jobId, approver),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_JOB_IS_NOT_ACTIVE);
      });

      it("fails with ERR_ALREADY_VOTED_THIS_WAY while approving job previously approved", () => {
        // arrange
        const name = "job-123456";
        const target = coreV2.address;
        const creator = accounts.get("wallet_1")!;
        const approver = accounts.get("wallet_2")!;
        const jobId = 1;
        chain.mineBlock([
          authV2.createJob(name, target, creator),
          authV2.activateJob(jobId, creator),
          authV2.approveJob(jobId, approver),
        ]);

        // act
        const block = chain.mineBlock([
          authV2.approveJob(jobId, approver),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_ALREADY_VOTED_THIS_WAY);
      });

      it("fails with ERR_UNAUTHORIZED while approving job by user who is not an approver", () => {
        // arrange
        const name = "job-123456";
        const target = coreV2.address;
        const creator = accounts.get("wallet_1")!;
        const approver = accounts.get("wallet_8")!;
        const jobId = 1;
        chain.mineBlock([
          authV2.createJob(name, target, creator),
          authV2.activateJob(jobId, creator),
        ]);

        // act
        const block = chain.mineBlock([
          authV2.approveJob(jobId, approver),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_UNAUTHORIZED);
      });

      it("succeeds and saves approvals", () => {
        // arrange
        const name = "job-123456";
        const target = coreV2.address;
        const creator = accounts.get("wallet_1")!;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const jobId = 1;
        chain.mineBlock([
          authV2.createJob(name, target, creator),
          authV2.activateJob(jobId, creator),
        ]);

        // act
        const block = chain.mineBlock([
          authV2.approveJob(jobId, approver1),
          authV2.approveJob(jobId, approver2),
        ]);

        // assert
        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectBool(true);

        const expectedJob = {
          creator: creator.address,
          name: types.ascii(name),
          target: target,
          approvals: types.uint(2),
          disapprovals: types.uint(0),
          isActive: types.bool(true),
          isExecuted: types.bool(false),
        };

        const actualJob = authV2
          .getJob(jobId)
          .result.expectSome()
          .expectTuple();

        assertEquals(actualJob, expectedJob);
      });

      it("succeeds and approves previously disapproved job", () => {
        // arrange
        const name = "job-123456";
        const target = coreV2.address;
        const creator = accounts.get("wallet_1")!;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const jobId = 1;
        chain.mineBlock([
          authV2.createJob(name, target, creator),
          authV2.activateJob(jobId, creator),
          authV2.disapproveJob(jobId, approver1),
        ]);

        // act
        const block = chain.mineBlock([
          authV2.approveJob(jobId, approver1),
          authV2.approveJob(jobId, approver2),
        ]);

        // assert
        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectBool(true);

        const expectedJob = {
          creator: creator.address,
          name: types.ascii(name),
          target: target,
          approvals: types.uint(2),
          disapprovals: types.uint(0),
          isActive: types.bool(true),
          isExecuted: types.bool(false),
        };

        const actualJob = authV2
          .getJob(jobId)
          .result.expectSome()
          .expectTuple();

        assertEquals(actualJob, expectedJob);
      });
    });

    describe("disapprove-job()", () => {
      it("fails with ERR_UNKNOWN_JOB while disapproving unknown job ID", () => {
        // arrange
        const approver = accounts.get("wallet_2")!;
        const jobId = 399;

        // act
        const block = chain.mineBlock([
          authV2.disapproveJob(jobId, approver),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_UNKNOWN_JOB);
      });

      it("fails with ERR_JOB_IS_NOT_ACTIVE while disapproving inactive job ID", () => {
        // arrange
        const name = "job-123456";
        const target = coreV2.address;
        const creator = accounts.get("wallet_1")!;
        const approver = accounts.get("wallet_2")!;
        const jobId = 1;
        chain.mineBlock([authV2.createJob(name, target, creator)]);

        // act
        const block = chain.mineBlock([
          authV2.disapproveJob(jobId, approver),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_JOB_IS_NOT_ACTIVE);
      });

      it("fails with ERR_ALREADY_VOTED_THIS_WAY while disapproving job previously disapproved", () => {
        // arrange
        const name = "job-123456";
        const target = coreV2.address;
        const creator = accounts.get("wallet_1")!;
        const approver = accounts.get("wallet_2")!;
        const jobId = 1;
        chain.mineBlock([
          authV2.createJob(name, target, creator),
          authV2.activateJob(jobId, creator),
          authV2.disapproveJob(jobId, approver),
        ]);

        // act
        const block = chain.mineBlock([
          authV2.disapproveJob(jobId, approver),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_ALREADY_VOTED_THIS_WAY);
      });

      it("fails with ERR_UNAUTHORIZED while disapproving job by user who is not an approver", () => {
        // arrange
        const name = "job-123456";
        const target = coreV2.address;
        const creator = accounts.get("wallet_1")!;
        const approver = accounts.get("wallet_8")!;
        const jobId = 1;
        chain.mineBlock([
          authV2.createJob(name, target, creator),
          authV2.activateJob(jobId, creator),
        ]);

        // act
        const block = chain.mineBlock([
          authV2.disapproveJob(jobId, approver),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_UNAUTHORIZED);
      });

      it("succeeds and saves disapprovals", () => {
        // arrange
        const name = "job-123456";
        const target = coreV2.address;
        const creator = accounts.get("wallet_1")!;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const jobId = 1;
        chain.mineBlock([
          authV2.createJob(name, target, creator),
          authV2.activateJob(jobId, creator),
        ]);

        // act
        const block = chain.mineBlock([
          authV2.disapproveJob(jobId, approver1),
          authV2.disapproveJob(jobId, approver2),
        ]);

        // assert
        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectBool(true);

        const expectedJob = {
          creator: creator.address,
          name: types.ascii(name),
          target: target,
          approvals: types.uint(0),
          disapprovals: types.uint(2),
          isActive: types.bool(true),
          isExecuted: types.bool(false),
        };

        const actualJob = authV2
          .getJob(jobId)
          .result.expectSome()
          .expectTuple();

        assertEquals(actualJob, expectedJob);
      });

      it("succeeds and disapproves previously approved job", () => {
        // arrange
        const name = "job-123456";
        const target = coreV2.address;
        const creator = accounts.get("wallet_1")!;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const jobId = 1;
        chain.mineBlock([
          authV2.createJob(name, target, creator),
          authV2.activateJob(jobId, creator),
          authV2.approveJob(jobId, approver1),
        ]);

        // act
        const block = chain.mineBlock([
          authV2.disapproveJob(jobId, approver1),
          authV2.disapproveJob(jobId, approver2),
        ]);

        // assert
        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectBool(true);

        const expectedJob = {
          creator: creator.address,
          name: types.ascii(name),
          target: target,
          approvals: types.uint(0),
          disapprovals: types.uint(2),
          isActive: types.bool(true),
          isExecuted: types.bool(false),
        };

        const actualJob = authV2
          .getJob(jobId)
          .result.expectSome()
          .expectTuple();

        assertEquals(actualJob, expectedJob);
      });
    });

    describe("is-job-approved()", () => {
      it("succeeds and returns false when called with unknown job ID", () => {
        // arrange
        const jobId = 234234;

        // act
        const result = authV2.isJobApproved(jobId).result;

        // assert
        result.expectBool(false);
      });

      it("succeeds and returns false when called with inactive job ID", () => {
        // arrange
        const name = "job-123456";
        const target = coreV2.address;
        const creator = accounts.get("wallet_1")!;
        const jobId = 1;
        chain.mineBlock([authV2.createJob(name, target, creator)]);

        // act
        const result = authV2.isJobApproved(jobId).result;

        // assert
        result.expectBool(false);
      });

      it("succeeds and returns false when called with an active job without any approvals", () => {
        // arrange
        const name = "job-123456";
        const target = coreV2.address;
        const creator = accounts.get("wallet_1")!;
        const jobId = 1;
        chain.mineBlock([
          authV2.createJob(name, target, creator),
          authV2.approveJob(jobId, creator),
        ]);

        // act
        const result = authV2.isJobApproved(jobId).result;

        // assert
        result.expectBool(false);
      });

      it("succeeds and returns true when asked about an active job with 3 or more approvals", () => {
        // arrange
        const name = "job-123456";
        const target = coreV2.address;
        const creator = accounts.get("wallet_1")!;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const approver3 = accounts.get("wallet_4")!;
        const jobId = 1;
        chain.mineBlock([
          authV2.createJob(name, target, creator),
          authV2.activateJob(jobId, creator),
          authV2.approveJob(jobId, approver1),
          authV2.approveJob(jobId, approver2),
          authV2.approveJob(jobId, approver3),
        ]);

        // act
        const result = authV2.isJobApproved(jobId).result;

        // assert
        result.expectBool(true);
      });
    });

    describe("mark-job-as-executed()", () => {
      it("fails with ERR_UNKNOWN_JOB when called with unknown job ID", () => {
        // arrange
        const jobId = 123;
        const sender = accounts.get("wallet_1")!;

        // act
        const block = chain.mineBlock([
          authV2.markJobAsExecuted(jobId, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_UNKNOWN_JOB);
      });

      it("fails with ERR_JOB_IS_NOT_ACTIVE when called with inactive job ID", () => {
        // arrange
        const name = "job-name";
        const creator = accounts.get("wallet_1")!;
        const target = coreV2.address;
        const jobId = 1;
        const sender = accounts.get("wallet_1")!;
        chain.mineBlock([authV2.createJob(name, target, creator)]);

        // act
        const block = chain.mineBlock([
          authV2.markJobAsExecuted(jobId, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_JOB_IS_NOT_ACTIVE);
      });

      it("fails with ERR_JOB_IS_NOT_APPROVED when called with unapproved job ID", () => {
        // arrange
        const name = "job-name";
        const creator = accounts.get("wallet_1")!;
        const target = coreV2.address;
        const jobId = 1;
        const sender = accounts.get("wallet_1")!;
        chain.mineBlock([
          authV2.createJob(name, target, creator),
          authV2.activateJob(jobId, creator),
        ]);

        // act
        const block = chain.mineBlock([
          authV2.markJobAsExecuted(jobId, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_JOB_IS_NOT_APPROVED);
      });

      it("fails with ERR_UNAUTHORIZED when called by sender that is not the target", () => {
        // arrange
        const name = "job-name";
        const creator = accounts.get("wallet_1")!;
        const target = coreV2.address;
        const jobId = 1;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const approver3 = accounts.get("wallet_4")!;
        const sender = accounts.get("wallet_1")!;
        chain.mineBlock([
          authV2.createJob(name, target, creator),
          authV2.activateJob(jobId, creator),
          authV2.approveJob(jobId, approver1),
          authV2.approveJob(jobId, approver2),
          authV2.approveJob(jobId, approver3),
        ]);

        // act
        const block = chain.mineBlock([
          authV2.markJobAsExecuted(jobId, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_UNAUTHORIZED);
      });

      it("succeeds and marks job as executed when called by target", () => {
        // arrange
        const name = "job-name";
        const creator = accounts.get("wallet_1")!;
        const sender = accounts.get("wallet_5")!;
        const target = sender.address;
        const jobId = 1;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const approver3 = accounts.get("wallet_4")!;
        chain.mineBlock([
          authV2.createJob(name, target, creator),
          authV2.activateJob(jobId, creator),
          authV2.approveJob(jobId, approver1),
          authV2.approveJob(jobId, approver2),
          authV2.approveJob(jobId, approver3),
        ]);

        // act
        const block = chain.mineBlock([
          authV2.markJobAsExecuted(jobId, sender),
        ]);

        // assert
        block.receipts[0].result.expectOk().expectBool(true);

        const expectedJob = {
          creator: creator.address,
          name: types.ascii(name),
          target: target,
          approvals: types.uint(MiamiCoinAuthModelV2.REQUIRED_APPROVALS),
          disapprovals: types.uint(0),
          isActive: types.bool(true),
          isExecuted: types.bool(true),
        };

        const actualJob = authV2
          .getJob(jobId)
          .result.expectSome()
          .expectTuple();
        assertEquals(actualJob, expectedJob);
      });

      it("fails with ERR_JOB_IS_EXECUTED while trying to mark same job executed 2nd time", () => {
        // arrange
        const name = "job-name";
        const creator = accounts.get("wallet_1")!;
        const sender = accounts.get("wallet_5")!;
        const target = sender.address;
        const jobId = 1;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const approver3 = accounts.get("wallet_4")!;
        chain.mineBlock([
          authV2.createJob(name, target, creator),
          authV2.activateJob(jobId, creator),
          authV2.approveJob(jobId, approver1),
          authV2.approveJob(jobId, approver2),
          authV2.approveJob(jobId, approver3),
          authV2.markJobAsExecuted(jobId, sender),
        ]);

        // act
        const block = chain.mineBlock([
          authV2.markJobAsExecuted(jobId, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_JOB_IS_EXECUTED);
      });
    });

    describe("add-uint-argument()", () => {
      it("fails with ERR_UNKNOWN_JOB while adding argument to unknown job ID", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const jobId = 1;
        const argumentName = "test1";
        const value = 123;

        // act
        const block = chain.mineBlock([
          authV2.addUIntArgument(jobId, argumentName, value, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_UNKNOWN_JOB);
      });

      it("fails with ERR_JOB_IS_ACTIVE while adding argument to active job ID", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const jobId = 1;
        const argumentName = "test1";
        const value = 123;
        const jobName = "test-job";
        const target = sender.address;
        chain.mineBlock([
          authV2.createJob(jobName, target, sender),
          authV2.activateJob(jobId, sender),
        ]);

        // act
        const block = chain.mineBlock([
          authV2.addUIntArgument(jobId, argumentName, value, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_JOB_IS_ACTIVE);
      });

      it("fails with ERR_UNAUTHORIZED while adding argument by someone who is not the job creator", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const jobId = 1;
        const argumentName = "test1";
        const value = 123;
        const jobName = "test-job";
        const target = sender.address;
        const creator = accounts.get("wallet_2")!;
        chain.mineBlock([authV2.createJob(jobName, target, creator)]);

        // act
        const block = chain.mineBlock([
          authV2.addUIntArgument(jobId, argumentName, value, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_UNAUTHORIZED);
      });

      it("succeeds and saves new argument", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const jobId = 1;
        const argumentName = "test1";
        const value = 123;
        const jobName = "test-job";
        const target = sender.address;
        chain.mineBlock([authV2.createJob(jobName, target, sender)]);

        // act
        const block = chain.mineBlock([
          authV2.addUIntArgument(jobId, argumentName, value, sender),
        ]);

        // assert
        block.receipts[0].result.expectOk().expectBool(true);

        authV2
          .getUIntValueByName(jobId, argumentName)
          .result.expectSome()
          .expectUint(value);

        authV2
          .getUIntValueById(jobId, 1)
          .result.expectSome()
          .expectUint(value);
      });

      it("fails with ERR_ARGUMENT_ALREADY_EXISTS while adding same argument 2nd time", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const jobId = 1;
        const argumentName = "test1";
        const value = 123;
        const jobName = "test-job";
        const target = sender.address;
        chain.mineBlock([
          authV2.createJob(jobName, target, sender),
          authV2.addUIntArgument(jobId, argumentName, value, sender),
        ]);

        // act
        const block = chain.mineBlock([
          authV2.addUIntArgument(jobId, argumentName, value, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_ARGUMENT_ALREADY_EXISTS);
      });
    });

    describe("add-principal-argument()", () => {
      it("fails with ERR_UNKNOWN_JOB while adding argument to unknown job ID", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const jobId = 1;
        const argumentName = "test1";
        const value = sender.address;

        // act
        const block = chain.mineBlock([
          authV2.addPrincipalArgument(jobId, argumentName, value, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_UNKNOWN_JOB);
      });

      it("fails with ERR_JOB_IS_ACTIVE while adding argument to active job ID", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const jobId = 1;
        const argumentName = "test1";
        const value = sender.address;
        const jobName = "test-job";
        const target = sender.address;
        chain.mineBlock([
          authV2.createJob(jobName, target, sender),
          authV2.activateJob(jobId, sender),
        ]);

        // act
        const block = chain.mineBlock([
          authV2.addPrincipalArgument(jobId, argumentName, value, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_JOB_IS_ACTIVE);
      });

      it("fails with ERR_UNAUTHORIZED while adding argument by someone who is not job creator", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const jobId = 1;
        const argumentName = "test1";
        const value = sender.address;
        const jobName = "test-job";
        const target = sender.address;
        const creator = accounts.get("wallet_2")!;
        chain.mineBlock([authV2.createJob(jobName, target, creator)]);

        // act
        const block = chain.mineBlock([
          authV2.addPrincipalArgument(jobId, argumentName, value, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_UNAUTHORIZED);
      });

      it("successfully save new argument", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const jobId = 1;
        const argumentName = "test1";
        const value = sender.address;
        const jobName = "test-job";
        const target = sender.address;
        chain.mineBlock([authV2.createJob(jobName, target, sender)]);

        // act
        const block = chain.mineBlock([
          authV2.addPrincipalArgument(jobId, argumentName, value, sender),
        ]);

        // assert
        block.receipts[0].result.expectOk().expectBool(true);

        authV2
          .getPrincipalValueByName(jobId, argumentName)
          .result.expectSome()
          .expectPrincipal(value);

        authV2
          .getPrincipalValueById(jobId, 1)
          .result.expectSome()
          .expectPrincipal(value);
      });

      it("fails with ERR_ARGUMENT_ALREADY_EXISTS while adding same argument 2nd time", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const jobId = 1;
        const argumentName = "test1";
        const value = sender.address;
        const jobName = "test-job";
        const target = sender.address;
        chain.mineBlock([
          authV2.createJob(jobName, target, sender),
          authV2.addPrincipalArgument(jobId, argumentName, value, sender),
        ]);

        // act
        const block = chain.mineBlock([
          authV2.addPrincipalArgument(jobId, argumentName, value, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_ARGUMENT_ALREADY_EXISTS);
      });
    });
  });
});

run();
