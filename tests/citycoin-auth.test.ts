import { assertEquals, describe, types, run, Chain, beforeEach, it} from "../deps.ts";
import { AuthModel } from "../models/auth.model.ts";
import { CoreModel } from "../models/core.model.ts";
import { TokenModel } from "../models/token.model.ts";
import { Accounts, Context } from "../src/context.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let core: CoreModel;
let core2: CoreModel;
let core3: CoreModel;
let auth: AuthModel;
let token: TokenModel;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  auth = ctx.models.get(AuthModel);
  core = ctx.models.get(CoreModel, "citycoin-core-v1");
  core2 = ctx.models.get(CoreModel, "citycoin-core-v2");
  core3 = ctx.models.get(CoreModel, "citycoin-core-v3");
  token = ctx.models.get(TokenModel);
})

describe("[CityCoin Auth]", () => {
  //////////////////////////////////////////////////
  // JOB MANAGEMENT
  //////////////////////////////////////////////////
  describe("JOB MANAGEMENT", () => {
    describe("get-last-job-id()", () => {
      it("returns u0 if no jobs have been created", () => {
        // act
        const result = auth.getLastJobId().result;

        // assert
        result.expectUint(0);
      });
      it("returns u1 after a job has been created", () => {
        // arrange
        const name = "job_1";
        const target = core.address;
        const sender = accounts.get("wallet_1")!;

        // act
        chain.mineBlock([auth.createJob(name, target, sender)]);

        const result = auth.getLastJobId().result;

        // assert
        result.expectUint(1);
      });
    });

    describe("create-job()", () => {
      it("throws ERR_UNAUTHORIZED if not called by an approver", () => {
        // arrange
        const name = "job_1";
        const target = core.address;
        const sender = accounts.get("deployer")!;

        // act
        const block = chain.mineBlock([
          auth.createJob(name, target, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNAUTHORIZED);
      });

      it("creates new job", () => {
        // arrange
        const name = "job_1";
        const target = core.address;
        const sender = accounts.get("wallet_1")!;

        // act
        const block = chain.mineBlock([
          auth.createJob(name, target, sender),
        ]);

        // assert
        block.receipts[0].result.expectOk().expectUint(1);
      });
    });

    describe("get-job()", () => {
      it("returns 'none' for unknown jobId", () => {
        // arrange
        const jobId = 1;

        // act
        const result = auth.getJob(jobId).result;

        // assert
        result.expectNone();
      });

      it("returns 'some' with job details for known jobId", () => {
        // arrange
        const name = "job123";
        const target = core.address;
        const sender = accounts.get("wallet_1")!;
        chain.mineBlock([auth.createJob(name, target, sender)]);

        // act
        const result = auth.getJob(1).result;

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
      it("throws ERR_UNKNOWN_JOB while activating unknown job", () => {
        // arrange
        const jobId = 10;
        const wallet = accounts.get("wallet_4")!;

        // act
        const block = chain.mineBlock([
          auth.activateJob(jobId, wallet),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNKNOWN_JOB);
      });

      it("throws ERR_UNAUTHORIZED while activating job by someone who is not its creator", () => {
        // arrange
        const name = "job-123456";
        const target = core.address;
        const creator = accounts.get("wallet_1")!;
        const jobId = 1;
        const wallet = accounts.get("wallet_4")!;

        chain.mineBlock([auth.createJob(name, target, creator)]);

        // act
        const block = chain.mineBlock([
          auth.activateJob(jobId, wallet),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNAUTHORIZED);
      });

      it("throws ERR_JOB_IS_ACTIVE while activating job that is already active", () => {
        // arrange
        const name = "job-123456";
        const target = core.address;
        const creator = accounts.get("wallet_1")!;
        const jobId = 1;
        chain.mineBlock([
          auth.createJob(name, target, creator),
          auth.activateJob(1, creator),
        ]);

        // act
        const block = chain.mineBlock([
          auth.activateJob(jobId, creator),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_JOB_IS_ACTIVE);
      });

      it("successfully activate job by its creator", () => {
        // arrange
        const name = "job-123456";
        const target = core.address;
        const creator = accounts.get("wallet_1")!;
        const jobId = 1;
        chain.mineBlock([auth.createJob(name, target, creator)]);

        // act
        const block = chain.mineBlock([
          auth.activateJob(jobId, creator),
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

        const actualJob = auth
          .getJob(jobId)
          .result.expectSome()
          .expectTuple();

        assertEquals(actualJob, expectedJob);
      });
    });

    describe("approve-job()", () => {
      it("throws ERR_UNKNOWN_JOB while approving unknown job", () => {
        // arrange
        const approver = accounts.get("wallet_2")!;
        const jobId = 399;

        // act
        const block = chain.mineBlock([
          auth.approveJob(jobId, approver),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNKNOWN_JOB);
      });

      it("throws ERR_JOB_IS_NOT_ACTIVE while approving not active job", () => {
        // arrange
        const name = "job-123456";
        const target = core.address;
        const creator = accounts.get("wallet_1")!;
        const approver = accounts.get("wallet_2")!;
        const jobId = 1;
        chain.mineBlock([auth.createJob(name, target, creator)]);

        // act
        const block = chain.mineBlock([
          auth.approveJob(jobId, approver),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_JOB_IS_NOT_ACTIVE);
      });

      it("throws ERR_ALREADY_VOTED_THIS_WAY while approving job previously approved", () => {
        // arrange
        const name = "job-123456";
        const target = core.address;
        const creator = accounts.get("wallet_1")!;
        const approver = accounts.get("wallet_2")!;
        const jobId = 1;
        chain.mineBlock([
          auth.createJob(name, target, creator),
          auth.activateJob(jobId, creator),
          auth.approveJob(jobId, approver),
        ]);

        // act
        const block = chain.mineBlock([
          auth.approveJob(jobId, approver),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_ALREADY_VOTED_THIS_WAY);
      });

      it("throws ERR_UNAUTHORIZED while approving job by user who is not approver", () => {
        // arrange
        const name = "job-123456";
        const target = core.address;
        const creator = accounts.get("wallet_1")!;
        const approver = accounts.get("wallet_8")!;
        const jobId = 1;
        chain.mineBlock([
          auth.createJob(name, target, creator),
          auth.activateJob(jobId, creator),
        ]);

        // act
        const block = chain.mineBlock([
          auth.approveJob(jobId, approver),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNAUTHORIZED);
      });

      it("successfully saves approvals", () => {
        // arrange
        const name = "job-123456";
        const target = core.address;
        const creator = accounts.get("wallet_1")!;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const jobId = 1;
        chain.mineBlock([
          auth.createJob(name, target, creator),
          auth.activateJob(jobId, creator),
        ]);

        // act
        const block = chain.mineBlock([
          auth.approveJob(jobId, approver1),
          auth.approveJob(jobId, approver2),
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

        const actualJob = auth
          .getJob(jobId)
          .result.expectSome()
          .expectTuple();

        assertEquals(actualJob, expectedJob);
      });

      it("successfully approve previously disapproved job", () => {
        // arrange
        const name = "job-123456";
        const target = core.address;
        const creator = accounts.get("wallet_1")!;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const jobId = 1;
        chain.mineBlock([
          auth.createJob(name, target, creator),
          auth.activateJob(jobId, creator),
          auth.disapproveJob(jobId, approver1),
        ]);

        // act
        const block = chain.mineBlock([
          auth.approveJob(jobId, approver1),
          auth.approveJob(jobId, approver2),
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

        const actualJob = auth
          .getJob(jobId)
          .result.expectSome()
          .expectTuple();

        assertEquals(actualJob, expectedJob);
      });
    });

    describe("disapprove-job()", () => {
      it("throws ERR_UNKNOWN_JOB while disapproving unknown job", () => {
        // arrange
        const approver = accounts.get("wallet_2")!;
        const jobId = 399;

        // act
        const block = chain.mineBlock([
          auth.disapproveJob(jobId, approver),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNKNOWN_JOB);
      });

      it("throws ERR_JOB_IS_NOT_ACTIVE while disapproving not active job", () => {
        // arrange
        const name = "job-123456";
        const target = core.address;
        const creator = accounts.get("wallet_1")!;
        const approver = accounts.get("wallet_2")!;
        const jobId = 1;
        chain.mineBlock([auth.createJob(name, target, creator)]);

        // act
        const block = chain.mineBlock([
          auth.disapproveJob(jobId, approver),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_JOB_IS_NOT_ACTIVE);
      });

      it("throws ERR_ALREADY_VOTED_THIS_WAY while disapproving job previously disapproved", () => {
        // arrange
        const name = "job-123456";
        const target = core.address;
        const creator = accounts.get("wallet_1")!;
        const approver = accounts.get("wallet_2")!;
        const jobId = 1;
        chain.mineBlock([
          auth.createJob(name, target, creator),
          auth.activateJob(jobId, creator),
          auth.disapproveJob(jobId, approver),
        ]);

        // act
        const block = chain.mineBlock([
          auth.disapproveJob(jobId, approver),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_ALREADY_VOTED_THIS_WAY);
      });

      it("throws ERR_UNAUTHORIZED while disapproving job by user who is not approver", () => {
        // arrange
        const name = "job-123456";
        const target = core.address;
        const creator = accounts.get("wallet_1")!;
        const approver = accounts.get("wallet_8")!;
        const jobId = 1;
        chain.mineBlock([
          auth.createJob(name, target, creator),
          auth.activateJob(jobId, creator),
        ]);

        // act
        const block = chain.mineBlock([
          auth.disapproveJob(jobId, approver),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNAUTHORIZED);
      });

      it("successfully saves disapprovals", () => {
        // arrange
        const name = "job-123456";
        const target = core.address;
        const creator = accounts.get("wallet_1")!;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const jobId = 1;
        chain.mineBlock([
          auth.createJob(name, target, creator),
          auth.activateJob(jobId, creator),
        ]);

        // act
        const block = chain.mineBlock([
          auth.disapproveJob(jobId, approver1),
          auth.disapproveJob(jobId, approver2),
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

        const actualJob = auth
          .getJob(jobId)
          .result.expectSome()
          .expectTuple();

        assertEquals(actualJob, expectedJob);
      });

      it("successfully disapprove previously approved job", () => {
        // arrange
        const name = "job-123456";
        const target = core.address;
        const creator = accounts.get("wallet_1")!;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const jobId = 1;
        chain.mineBlock([
          auth.createJob(name, target, creator),
          auth.activateJob(jobId, creator),
          auth.approveJob(jobId, approver1),
        ]);

        // act
        const block = chain.mineBlock([
          auth.disapproveJob(jobId, approver1),
          auth.disapproveJob(jobId, approver2),
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

        const actualJob = auth
          .getJob(jobId)
          .result.expectSome()
          .expectTuple();

        assertEquals(actualJob, expectedJob);
      });
    });

    describe("is-job-approved()", () => {
      it("returns false when asked about unknown job", () => {
        // arrange
        const jobId = 234234;

        // act
        const result = auth.isJobApproved(jobId).result;

        // assert
        result.expectBool(false);
      });

      it("returns false when asked about inactive job", () => {
        // arrange
        const name = "job-123456";
        const target = core.address;
        const creator = accounts.get("wallet_1")!;
        const jobId = 1;
        chain.mineBlock([auth.createJob(name, target, creator)]);

        // act
        const result = auth.isJobApproved(jobId).result;

        // assert
        result.expectBool(false);
      });

      it("returns false when asked about active job without any approvals", () => {
        // arrange
        const name = "job-123456";
        const target = core.address;
        const creator = accounts.get("wallet_1")!;
        const jobId = 1;
        chain.mineBlock([
          auth.createJob(name, target, creator),
          auth.approveJob(jobId, creator),
        ]);

        // act
        const result = auth.isJobApproved(jobId).result;

        // assert
        result.expectBool(false);
      });

      it("returns when asked about active job with 3 or more approvals", () => {
        // arrange
        const name = "job-123456";
        const target = core.address;
        const creator = accounts.get("wallet_1")!;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const approver3 = accounts.get("wallet_4")!;
        const jobId = 1;
        chain.mineBlock([
          auth.createJob(name, target, creator),
          auth.activateJob(jobId, creator),
          auth.approveJob(jobId, approver1),
          auth.approveJob(jobId, approver2),
          auth.approveJob(jobId, approver3),
        ]);

        // act
        const result = auth.isJobApproved(jobId).result;

        // assert
        result.expectBool(true);
      });
    });

    describe("mark-job-as-executed()", () => {
      it("throws ERR_UNKNOWN_JOB when requested to mark unknown job", () => {
        // arrange
        const jobId = 123;
        const sender = accounts.get("wallet_1")!;

        // act
        const block = chain.mineBlock([
          auth.markJobAsExecuted(jobId, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNKNOWN_JOB);
      });

      it("throws ERR_JOB_IS_NOT_ACTIVE when requested to mark not active job", () => {
        // arrange
        const name = "job-name";
        const creator = accounts.get("wallet_1")!;
        const target = core.address;
        const jobId = 1;
        const sender = accounts.get("wallet_1")!;
        chain.mineBlock([auth.createJob(name, target, creator)]);

        // act
        const block = chain.mineBlock([
          auth.markJobAsExecuted(jobId, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_JOB_IS_NOT_ACTIVE);
      });

      it("throws ERR_JOB_IS_NOT_APPROVED when requested to mark not approved job", () => {
        // arrange
        const name = "job-name";
        const creator = accounts.get("wallet_1")!;
        const target = core.address;
        const jobId = 1;
        const sender = accounts.get("wallet_1")!;
        chain.mineBlock([
          auth.createJob(name, target, creator),
          auth.activateJob(jobId, creator),
        ]);

        // act
        const block = chain.mineBlock([
          auth.markJobAsExecuted(jobId, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_JOB_IS_NOT_APPROVED);
      });

      it("throws ERR_UNAUTHORIZED when requested to mark as approved not by target", () => {
        // arrange
        const name = "job-name";
        const creator = accounts.get("wallet_1")!;
        const target = core.address;
        const jobId = 1;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const approver3 = accounts.get("wallet_4")!;
        const sender = accounts.get("wallet_1")!;
        chain.mineBlock([
          auth.createJob(name, target, creator),
          auth.activateJob(jobId, creator),
          auth.approveJob(jobId, approver1),
          auth.approveJob(jobId, approver2),
          auth.approveJob(jobId, approver3),
        ]);

        // act
        const block = chain.mineBlock([
          auth.markJobAsExecuted(jobId, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNAUTHORIZED);
      });

      it("successfully marks job as executed when called by target", () => {
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
          auth.createJob(name, target, creator),
          auth.activateJob(jobId, creator),
          auth.approveJob(jobId, approver1),
          auth.approveJob(jobId, approver2),
          auth.approveJob(jobId, approver3),
        ]);

        // act
        const block = chain.mineBlock([
          auth.markJobAsExecuted(jobId, sender),
        ]);

        // assert
        block.receipts[0].result.expectOk().expectBool(true);

        const expectedJob = {
          creator: creator.address,
          name: types.ascii(name),
          target: target,
          approvals: types.uint(AuthModel.REQUIRED_APPROVALS),
          disapprovals: types.uint(0),
          isActive: types.bool(true),
          isExecuted: types.bool(true),
        };

        const actualJob = auth
          .getJob(jobId)
          .result.expectSome()
          .expectTuple();
        assertEquals(actualJob, expectedJob);
      });

      it("throws ERR_JOB_IS_EXECUTED while trying to mark same job 2nd time", () => {
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
          auth.createJob(name, target, creator),
          auth.activateJob(jobId, creator),
          auth.approveJob(jobId, approver1),
          auth.approveJob(jobId, approver2),
          auth.approveJob(jobId, approver3),
          auth.markJobAsExecuted(jobId, sender),
        ]);

        // act
        const block = chain.mineBlock([
          auth.markJobAsExecuted(jobId, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_JOB_IS_EXECUTED);
      });
    });

    describe("add-uint-argument()", () => {
      it("throws ERR_UNKNOWN_JOB while adding argument to unknown job", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const jobId = 1;
        const argumentName = "test1";
        const value = 123;

        // act
        const block = chain.mineBlock([
          auth.addUIntArgument(jobId, argumentName, value, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNKNOWN_JOB);
      });

      it("throws ERR_JOB_IS_ACTIVE while adding argument to active job", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const jobId = 1;
        const argumentName = "test1";
        const value = 123;
        const jobName = "test-job";
        const target = sender.address;
        chain.mineBlock([
          auth.createJob(jobName, target, sender),
          auth.activateJob(jobId, sender),
        ]);

        // act
        const block = chain.mineBlock([
          auth.addUIntArgument(jobId, argumentName, value, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_JOB_IS_ACTIVE);
      });

      it("throws ERR_UNAUTHORIZED while adding argument by someone who is not job creator", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const jobId = 1;
        const argumentName = "test1";
        const value = 123;
        const jobName = "test-job";
        const target = sender.address;
        const creator = accounts.get("wallet_2")!;
        chain.mineBlock([auth.createJob(jobName, target, creator)]);

        // act
        const block = chain.mineBlock([
          auth.addUIntArgument(jobId, argumentName, value, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNAUTHORIZED);
      });

      it("successfully save new argument", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const jobId = 1;
        const argumentName = "test1";
        const value = 123;
        const jobName = "test-job";
        const target = sender.address;
        chain.mineBlock([auth.createJob(jobName, target, sender)]);

        // act
        const block = chain.mineBlock([
          auth.addUIntArgument(jobId, argumentName, value, sender),
        ]);

        // assert
        block.receipts[0].result.expectOk().expectBool(true);

        auth
          .getUIntValueByName(jobId, argumentName)
          .result.expectSome()
          .expectUint(value);

        auth
          .getUIntValueById(jobId, 1)
          .result.expectSome()
          .expectUint(value);
      });

      it("throws ERR_ARGUMENT_ALREADY_EXISTS while adding same argument 2nd time", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const jobId = 1;
        const argumentName = "test1";
        const value = 123;
        const jobName = "test-job";
        const target = sender.address;
        chain.mineBlock([
          auth.createJob(jobName, target, sender),
          auth.addUIntArgument(jobId, argumentName, value, sender),
        ]);

        // act
        const block = chain.mineBlock([
          auth.addUIntArgument(jobId, argumentName, value, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_ARGUMENT_ALREADY_EXISTS);
      });
    });

    describe("add-principal-argument()", () => {
      it("throws ERR_UNKNOWN_JOB while adding argument to unknown job", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const jobId = 1;
        const argumentName = "test1";
        const value = sender.address;

        // act
        const block = chain.mineBlock([
          auth.addPrincipalArgument(jobId, argumentName, value, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNKNOWN_JOB);
      });

      it("throws ERR_JOB_IS_ACTIVE while adding argument to active job", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const jobId = 1;
        const argumentName = "test1";
        const value = sender.address;
        const jobName = "test-job";
        const target = sender.address;
        chain.mineBlock([
          auth.createJob(jobName, target, sender),
          auth.activateJob(jobId, sender),
        ]);

        // act
        const block = chain.mineBlock([
          auth.addPrincipalArgument(jobId, argumentName, value, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_JOB_IS_ACTIVE);
      });

      it("throws ERR_UNAUTHORIZED while adding argument by someone who is not job creator", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const jobId = 1;
        const argumentName = "test1";
        const value = sender.address;
        const jobName = "test-job";
        const target = sender.address;
        const creator = accounts.get("wallet_2")!;
        chain.mineBlock([auth.createJob(jobName, target, creator)]);

        // act
        const block = chain.mineBlock([
          auth.addPrincipalArgument(jobId, argumentName, value, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNAUTHORIZED);
      });

      it("successfully save new argument", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const jobId = 1;
        const argumentName = "test1";
        const value = sender.address;
        const jobName = "test-job";
        const target = sender.address;
        chain.mineBlock([auth.createJob(jobName, target, sender)]);

        // act
        const block = chain.mineBlock([
          auth.addPrincipalArgument(jobId, argumentName, value, sender),
        ]);

        // assert
        block.receipts[0].result.expectOk().expectBool(true);

        auth
          .getPrincipalValueByName(jobId, argumentName)
          .result.expectSome()
          .expectPrincipal(value);

        auth
          .getPrincipalValueById(jobId, 1)
          .result.expectSome()
          .expectPrincipal(value);
      });

      it("throws ERR_ARGUMENT_ALREADY_EXISTS while adding same argument 2nd time", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const jobId = 1;
        const argumentName = "test1";
        const value = sender.address;
        const jobName = "test-job";
        const target = sender.address;
        chain.mineBlock([
          auth.createJob(jobName, target, sender),
          auth.addPrincipalArgument(jobId, argumentName, value, sender),
        ]);

        // act
        const block = chain.mineBlock([
          auth.addPrincipalArgument(jobId, argumentName, value, sender),
        ]);

        // assert
        block.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_ARGUMENT_ALREADY_EXISTS);
      });
    });
  });
  //////////////////////////////////////////////////
  // CONTRACT MANAGEMENT
  //////////////////////////////////////////////////
  describe("CONTRACT MANAGEMENT", () => {
    describe("get-active-core-contract()", () => {
      it("throws ERR_NO_ACTIVE_CORE_CONTRACT if auth is not initialized", () => {
        // act
        const result = auth.getActiveCoreContract().result;

        // assert
        result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_NO_ACTIVE_CORE_CONTRACT);
      });
      it("returns correct value after auth is initialized", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const target = core.address;
        chain.mineBlock([auth.testSetActiveCoreContract(sender)]);

        // act
        const result = auth.getActiveCoreContract().result;

        // assert
        result.expectOk().expectPrincipal(target);
      });
    });

    describe("initialize-contracts()", () => {
      it("throws ERR_UNAUTHORIZED if not called by CONTRACT_OWNER", () => {
        // arrange
        const sender = accounts.get("wallet_2")!;
        const target = core.address;

        // act
        const receipt = chain.mineBlock([
          auth.initializeContracts(target, sender),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNAUTHORIZED);
      });

      it("throws ERR_UNAUTHORIZED if auth is already initialized", () => {
        // arrange
        const sender = accounts.get("deployer")!;
        const target = core.address;

        // act
        chain.mineBlock([auth.initializeContracts(target, sender)]);

        const receipt = chain.mineBlock([
          auth.initializeContracts(target, sender),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNAUTHORIZED);
      });

      it("throws ERR_INCORRECT_CONTRACT_STATE if new contract is not in STATE_DEPLOYED", () => {
        // arrange
        const sender = accounts.get("city_wallet")!;
        const contract = core.address;

        chain.mineBlock([
          core.testInitializeCore(contract),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(sender),
        ]);

        // act
        const testActive = chain.mineBlock([
          auth.testSetCoreContractState(contract, AuthModel.ContractState.STATE_ACTIVE, sender),
        ]);
        const receiptActive = chain.mineBlock([
          auth.activateCoreContract(contract, testActive.height, sender)
        ]).receipts[0];

        const testInactive = chain.mineBlock([
          auth.testSetCoreContractState(contract, AuthModel.ContractState.STATE_INACTIVE, sender),
        ]);
        const receiptInactive = chain.mineBlock([
          auth.activateCoreContract(contract, testInactive.height, sender)
        ]).receipts[0];

        // assert
        receiptActive.result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_INCORRECT_CONTRACT_STATE);

        receiptInactive.result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_INCORRECT_CONTRACT_STATE);
      });

      it("succeeds and updates core contract map", () => {
        // arrange
        const sender = accounts.get("deployer")!;
        const target = core.address;

        // act
        const receipt = chain.mineBlock([
          auth.initializeContracts(target, sender),
        ]).receipts[0];

        const result = auth.getCoreContractInfo(target).result;

        // assert
        receipt.result.expectOk();

        const expectedContractData = {
          state: types.uint(AuthModel.ContractState.STATE_DEPLOYED),
          startHeight: types.uint(0),
          endHeight: types.uint(0),
        };

        const actualContractData = result.expectOk().expectTuple();

        assertEquals(actualContractData, expectedContractData);
      });
    });

    describe("upgrade-core-contract()", () => {
      it("throws ERR_CORE_CONTRACT_NOT_FOUND if principal not found in core contracts map", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const oldContract = core.address;
        const newContract = core.address;

        // act
        const receipt = chain.mineBlock([
          auth.upgradeCoreContract(oldContract, newContract, sender),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_CORE_CONTRACT_NOT_FOUND);
      });
      it("throws ERR_CONTRACT_ALREADY_EXISTS if old and new contract are the same", () => {
        // arrange
        const sender = accounts.get("city_wallet")!;
        const oldContract = core.address;
        const newContract = core.address;

        chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(sender),
        ]);

        // act
        const receipt = chain.mineBlock([
          auth.upgradeCoreContract(oldContract, newContract, sender),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_CONTRACT_ALREADY_EXISTS);
      });
      it("throws ERR_CONTRACT_ALREADY_EXISTS if called with a target contract already in core contracts map", () => {
        // arrange
        const sender = accounts.get("city_wallet")!;
        const oldContract = core.address;
        const newContract = core2.address;

        chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(sender),
          auth.testSetCoreContractState(newContract, AuthModel.ContractState.STATE_INACTIVE, sender),
        ]);

        // act
        const receipt = chain.mineBlock([
          auth.upgradeCoreContract(oldContract, newContract, sender),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_CONTRACT_ALREADY_EXISTS);
      });
      it("throws ERR_UNAUTHORIZED if not called by city wallet", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const oldContract = core.address;
        const newContract = core2.address;

        chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(sender),
        ]);

        // act
        const receipt = chain.mineBlock([
          auth.upgradeCoreContract(oldContract, newContract, sender),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNAUTHORIZED);
      });
      it("succeeds and updates core contract map and active variable", () => {
        // arrange
        const sender = accounts.get("city_wallet")!;
        const oldContract = core.address;
        const newContract = core2.address;

        chain.mineBlock([
          core.testInitializeCore(oldContract),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(sender),
        ]);

        // act
        const blockUpgrade = chain.mineBlock([
          auth.upgradeCoreContract(oldContract, newContract, sender),
        ]);

        // act
        const activeContract = auth.getActiveCoreContract().result;
        const oldContractData =
          auth.getCoreContractInfo(oldContract).result;
        const newContractData =
          auth.getCoreContractInfo(newContract).result;

        // assert
        blockUpgrade.receipts[0].result.expectOk();

        activeContract.expectOk().expectPrincipal(newContract);

        // TODO: why the +1 and -1 here ??
        const expectedOldContractData = {
          state: types.uint(AuthModel.ContractState.STATE_INACTIVE),
          startHeight: types.uint(CoreModel.ACTIVATION_DELAY + 1),
          endHeight: types.uint(blockUpgrade.height - 1),
        };
        const expectedNewContractData = {
          state: types.uint(AuthModel.ContractState.STATE_DEPLOYED),
          startHeight: types.uint(0),
          endHeight: types.uint(0),
        };
        const actualOldContractData = oldContractData.expectOk().expectTuple();
        const actualNewContractData = newContractData.expectOk().expectTuple();

        assertEquals(actualOldContractData, expectedOldContractData);
        assertEquals(actualNewContractData, expectedNewContractData);
      });
    });

    describe("execute-upgrade-core-contract-job()", () => {
      it("throws ERR_UNAUTHORIZED if contract-caller is not an approver", () => {
        // arrange
        const jobId = 1;
        const sender = accounts.get("wallet_1")!;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const approver3 = accounts.get("wallet_4")!;
        const invalidApprover = accounts.get("wallet_6")!;
        const oldContract = core.address;
        const newContract = core2.address;

        chain.mineBlock([
          core.testInitializeCore(oldContract),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(sender),
          auth.createJob(
            "upgrade core",
            auth.address,
            sender
          ),
          auth.addPrincipalArgument(
            jobId,
            "oldContract",
            oldContract,
            sender
          ),
          auth.addPrincipalArgument(
            jobId,
            "newContract",
            newContract,
            sender
          ),
          auth.activateJob(jobId, sender),
          auth.approveJob(jobId, approver1),
          auth.approveJob(jobId, approver2),
          auth.approveJob(jobId, approver3),
        ]);

        // act
        const blockUpgrade = chain.mineBlock([
          auth.executeUpgradeCoreContractJob(
            jobId,
            oldContract,
            newContract,
            invalidApprover
          ),
        ]);

        // assert
        blockUpgrade.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNAUTHORIZED);
      });

      it("throws ERR_UNAUTHORIZED if submitted trait principal does not match job principal", () => {
        // arrange
        const jobId = 1;
        const sender = accounts.get("wallet_1")!;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const approver3 = accounts.get("wallet_4")!;
        const oldContract = core.address;
        const newContract = core2.address;
        const invalidContract = core3.address;

        chain.mineBlock([
          core.testInitializeCore(oldContract),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(sender),
          auth.createJob(
            "upgrade core",
            auth.address,
            sender
          ),
          auth.addPrincipalArgument(
            jobId,
            "oldContract",
            oldContract,
            sender
          ),
          auth.addPrincipalArgument(
            jobId,
            "newContract",
            newContract,
            sender
          ),
          auth.activateJob(jobId, sender),
          auth.approveJob(jobId, approver1),
          auth.approveJob(jobId, approver2),
          auth.approveJob(jobId, approver3),
        ]);

        // act
        const blockUpgrade = chain.mineBlock([
          auth.executeUpgradeCoreContractJob(
            jobId,
            oldContract,
            invalidContract,
            sender
          ),
        ]);

        // assert
        blockUpgrade.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNAUTHORIZED);
      });

      it("throws ERR_CONTRACT_ALREADY_EXISTS if old and new contract are the same", () => {
        // arrange
        const jobId = 1;
        const sender = accounts.get("wallet_1")!;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const approver3 = accounts.get("wallet_4")!;
        const oldContract = core.address;

        chain.mineBlock([
          core.testInitializeCore(oldContract),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(sender),
          auth.createJob(
            "upgrade core",
            auth.address,
            sender
          ),
          auth.addPrincipalArgument(
            jobId,
            "oldContract",
            oldContract,
            sender
          ),
          auth.addPrincipalArgument(
            jobId,
            "newContract",
            oldContract,
            sender
          ),
          auth.activateJob(jobId, sender),
          auth.approveJob(jobId, approver1),
          auth.approveJob(jobId, approver2),
          auth.approveJob(jobId, approver3),
        ]);

        // act
        const blockUpgrade = chain.mineBlock([
          auth.executeUpgradeCoreContractJob(
            jobId,
            oldContract,
            oldContract,
            sender
          ),
        ]);

        // assert
        blockUpgrade.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_CONTRACT_ALREADY_EXISTS);
      });

      it("throws ERR_CONTRACT_ALREADY_EXISTS if called with a target contract already in core contracts map", () => {
        // arrange
        const jobId = 1;
        const sender = accounts.get("wallet_1")!;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const approver3 = accounts.get("wallet_4")!;
        const oldContract = core.address;
        const newContract = core2.address;

        chain.mineBlock([
          core.testInitializeCore(oldContract),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(sender),
          auth.testSetCoreContractState(newContract, AuthModel.ContractState.STATE_INACTIVE, sender),
          auth.createJob(
            "upgrade core",
            auth.address,
            sender
          ),
          auth.addPrincipalArgument(
            jobId,
            "oldContract",
            oldContract,
            sender
          ),
          auth.addPrincipalArgument(
            jobId,
            "newContract",
            newContract,
            sender
          ),
          auth.activateJob(jobId, sender),
          auth.approveJob(jobId, approver1),
          auth.approveJob(jobId, approver2),
          auth.approveJob(jobId, approver3),
        ]);

        // act
        const blockUpgrade = chain.mineBlock([
          auth.executeUpgradeCoreContractJob(
            jobId,
            oldContract,
            newContract,
            sender
          ),
        ]);

        // assert
        blockUpgrade.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_CONTRACT_ALREADY_EXISTS);
      });

      it("succeeds and updates core contract map and active variable", () => {
        // arrange
        const jobId = 1;
        const sender = accounts.get("wallet_1")!;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const approver3 = accounts.get("wallet_4")!;
        const oldContract = core.address;
        const newContract = core2.address;

        chain.mineBlock([
          core.testInitializeCore(oldContract),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(sender),
          auth.createJob(
            "upgrade core",
            auth.address,
            sender
          ),
          auth.addPrincipalArgument(
            jobId,
            "oldContract",
            oldContract,
            sender
          ),
          auth.addPrincipalArgument(
            jobId,
            "newContract",
            newContract,
            sender
          ),
          auth.activateJob(jobId, sender),
          auth.approveJob(jobId, approver1),
          auth.approveJob(jobId, approver2),
          auth.approveJob(jobId, approver3),
        ]);

        // act
        const blockUpgrade = chain.mineBlock([
          auth.executeUpgradeCoreContractJob(
            jobId,
            oldContract,
            newContract,
            sender
          ),
        ]);

        // act
        const activeContract = auth.getActiveCoreContract().result;
        const oldContractData =
          auth.getCoreContractInfo(oldContract).result;
        const newContractData =
          auth.getCoreContractInfo(newContract).result;

        // assert
        blockUpgrade.receipts[0].result.expectOk();

        activeContract.expectOk().expectPrincipal(newContract);

        // TODO: why the +1 and -1 here ??
        const expectedOldContractData = {
          state: types.uint(AuthModel.ContractState.STATE_INACTIVE),
          startHeight: types.uint(CoreModel.ACTIVATION_DELAY + 1),
          endHeight: types.uint(blockUpgrade.height - 1),
        };
        const expectedNewContractData = {
          state: types.uint(AuthModel.ContractState.STATE_DEPLOYED),
          startHeight: types.uint(0),
          endHeight: types.uint(0),
        };
        const actualOldContractData = oldContractData.expectOk().expectTuple();
        const actualNewContractData = newContractData.expectOk().expectTuple();

        assertEquals(actualOldContractData, expectedOldContractData);
        assertEquals(actualNewContractData, expectedNewContractData);
      });
    });
  });

  //////////////////////////////////////////////////
  // CITY WALLET MANAGEMENT
  //////////////////////////////////////////////////
  describe("CITY WALLET MANAGEMENT", () => {
    describe("get-city-wallet()", () => {
      it("succeeds and returns city wallet", () => {
        // arrange
        const cityWallet = accounts.get("city_wallet")!;
        // act
        const result = auth.getCityWallet().result;
        // assert
        result.expectOk().expectPrincipal(cityWallet.address);
      });
    });
    describe("set-city-wallet()", () => {
      it("throws ERR_CORE_CONTRACT_NOT_FOUND if principal not found in core contracts map", () => {
        // arrange
        const cityWallet = accounts.get("city_wallet")!;
        const newCityWallet = accounts.get("wallet_2")!;
        // act
        const receipt = chain.mineBlock([
          auth.setCityWallet(
            core.address,
            newCityWallet,
            cityWallet
          ),
        ]).receipts[0];
        // assert
        receipt.result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_CORE_CONTRACT_NOT_FOUND);
      });

      it("throws ERR_UNAUTHORIZED if not called by city wallet", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const newCityWallet = accounts.get("wallet_2")!;
        chain.mineBlock([
          core.testInitializeCore(core.address),
        ]);
        // act
        const receipt = chain.mineBlock([
          auth.setCityWallet(
            core.address,
            newCityWallet,
            sender
          ),
        ]).receipts[0];
        // assert
        receipt.result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNAUTHORIZED);
      });

      it("throws ERR_UNAUTHORIZED if not called by the active core contract", () => {
        // arrange
        const cityWallet = accounts.get("city_wallet")!;
        const newCityWallet = accounts.get("wallet_2")!;
        chain.mineBlock([
          core.testInitializeCore(core.address),
        ]);
        // act
        const receipt = chain.mineBlock([
          auth.setCityWallet(
            core.address,
            newCityWallet,
            cityWallet
          ),
        ]).receipts[0];
        // assert
        receipt.result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNAUTHORIZED);
      });

      it("successfully change city walled when called by current city wallet", () => {
        // arrange
        const cityWallet = accounts.get("city_wallet")!;
        const newCityWallet = accounts.get("wallet_2")!;
        chain.mineBlock([
          core.testInitializeCore(core.address),
          auth.testSetActiveCoreContract(cityWallet),
        ]);

        // act
        const receipt = chain.mineBlock([
          auth.setCityWallet(
            core.address,
            newCityWallet,
            cityWallet
          ),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);
        core
          .getCityWallet()
          .result.expectPrincipal(newCityWallet.address);
        auth
          .getCityWallet()
          .result.expectOk()
          .expectPrincipal(newCityWallet.address);
      });
    });
    describe("execute-set-city-wallet-job()", () => {
      it("successfully change city wallet when called by job approver", () => {
        // arrange
        const jobId = 1;
        const sender = accounts.get("wallet_1")!;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const approver3 = accounts.get("wallet_4")!;
        const cityWallet = accounts.get("city_wallet")!;
        const newCityWallet = accounts.get("wallet_2")!;
        chain.mineBlock([
          core.testInitializeCore(core.address),
          auth.testSetActiveCoreContract(cityWallet),
        ]);

        chain.mineBlock([
          auth.createJob(
            "update city wallet 1",
            auth.address,
            sender
          ),
          auth.addPrincipalArgument(
            jobId,
            "newCityWallet",
            newCityWallet.address,
            sender
          ),
          auth.activateJob(jobId, sender),
          auth.approveJob(jobId, approver1),
          auth.approveJob(jobId, approver2),
          auth.approveJob(jobId, approver3),
        ]);

        // act
        const receipt = chain.mineBlock([
          auth.executeSetCityWalletJob(
            jobId,
            core.address,
            approver1
          ),
        ]).receipts[0];

        // asserts
        receipt.result.expectOk().expectBool(true);

        core
          .getCityWallet()
          .result.expectPrincipal(newCityWallet.address);
      });
    });
  });

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
          auth.setTokenUri(
            sender,
            token.address,
            "http://something-something.com"
          ),
        ]);
        // assert
        const receipt = block.receipts[0];

        receipt.result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNAUTHORIZED);
      });
      it("fails with ERR_UNAUTHORIZED when called by someone who is not auth contract", () => {
        // arrange
        const sender = accounts.get("wallet_2")!;
        // act
        const block = chain.mineBlock([
          token.setTokenUri(sender, "http://something-something.com"),
        ]);
        // assert
        const receipt = block.receipts[0];

        receipt.result
          .expectErr()
          .expectUint(TokenModel.ErrCode.ERR_UNAUTHORIZED);
      });
      it("succeeds and changes token uri to none if no new value is provided", () => {
        // arrange
        const sender = accounts.get("city_wallet")!;
        // act
        const block = chain.mineBlock([
          auth.setTokenUri(sender, token.address),
        ]);
        // assert
        const receipt = block.receipts[0];

        receipt.result.expectOk().expectBool(true);

        const result = token.getTokenUri().result;
        result.expectOk().expectNone();
      });
      it("succeeds and changes token uri to new value if provided", () => {
        // arrange
        const sender = accounts.get("city_wallet")!;
        const newUri = "http://something-something.com";
        // act
        const block = chain.mineBlock([
          auth.setTokenUri(
            sender,
            token.address,
            newUri
          ),
        ]);
        // assert
        const receipt = block.receipts[0];

        receipt.result.expectOk().expectBool(true);

        const result = token.getTokenUri().result;
        result.expectOk().expectSome().expectUtf8(newUri);
      });
    });
  });

  describe("APPROVERS MANAGEMENT", () => {
    describe("execute-replace-approver-job()", () => {
      it("successfully replace one approver with another one", () => {
        const jobId = 1;
        const approver1 = accounts.get("wallet_1")!;
        const approver2 = accounts.get("wallet_2")!;
        const approver3 = accounts.get("wallet_3")!;
        const approver4 = accounts.get("wallet_4")!;
        const newApprover = accounts.get("wallet_7")!;

        auth.isApprover(newApprover).result.expectBool(false);
        chain.mineBlock([
          auth.createJob(
            "replace approver1",
            auth.address,
            approver1
          ),
          auth.addPrincipalArgument(
            jobId,
            "oldApprover",
            approver1.address,
            approver1
          ),
          auth.addPrincipalArgument(
            jobId,
            "newApprover",
            newApprover.address,
            approver1
          ),
          auth.activateJob(jobId, approver1),
          auth.approveJob(jobId, approver1),
          auth.approveJob(jobId, approver2),
          auth.approveJob(jobId, approver3),
          auth.approveJob(jobId, approver4),
        ]);

        const receipt = chain.mineBlock([
          auth.executeReplaceApproverJob(jobId, approver1),
        ]).receipts[0];

        receipt.result.expectOk().expectBool(true);

        auth.isApprover(approver1).result.expectBool(false);
        auth.isApprover(newApprover).result.expectBool(true);
      });

      it("replaced approver is not allowed to create nor approve jobs", () => {
        const replaceApproverJobId = 1;
        const anotherJobId = 2;
        const oldApprover = accounts.get("wallet_1")!;
        const approver2 = accounts.get("wallet_2")!;
        const approver3 = accounts.get("wallet_3")!;
        const approver4 = accounts.get("wallet_4")!;
        const newApprover = accounts.get("wallet_7")!;

        auth.isApprover(newApprover).result.expectBool(false);
        chain.mineBlock([
          auth.createJob(
            "replace oldApprover",
            auth.address,
            approver2
          ),
          auth.addPrincipalArgument(
            replaceApproverJobId,
            "oldApprover",
            oldApprover.address,
            approver2
          ),
          auth.addPrincipalArgument(
            replaceApproverJobId,
            "newApprover",
            newApprover.address,
            approver2
          ),
          auth.activateJob(replaceApproverJobId, approver2),
          auth.approveJob(replaceApproverJobId, oldApprover),
          auth.approveJob(replaceApproverJobId, approver2),
          auth.approveJob(replaceApproverJobId, approver3),
          auth.approveJob(replaceApproverJobId, approver4),
          auth.executeReplaceApproverJob(
            replaceApproverJobId,
            oldApprover
          ),
          auth.createJob(
            "new job",
            auth.address,
            approver2
          ),
          auth.activateJob(anotherJobId, approver2),
        ]);

        // act
        const receipts = chain.mineBlock([
          auth.createJob(
            "test job",
            auth.address,
            oldApprover
          ),
          auth.approveJob(anotherJobId, oldApprover),
        ]).receipts;

        // assert
        receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNAUTHORIZED);
        receipts[1].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNAUTHORIZED);
      });
    });
  });
});

run();