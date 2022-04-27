import { describe, run, Chain, beforeEach, it, assertEquals, types} from "../../../../../deps.ts";
import { Accounts, Context } from "../../../../../src/context.ts";
import { NewYorkCityCoinAuthModelV2 } from "../../../../../models/cities/nyc/newyorkcitycoin-auth-v2.model.ts";
import { NewYorkCityCoinCoreModelV2 } from "../../../../../models/cities/nyc/newyorkcitycoin-core-v2.model.ts";
import { NewYorkCityCoinTokenModelV2 } from "../../../../../models/cities/nyc/newyorkcitycoin-token-v2.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let authV2: NewYorkCityCoinAuthModelV2;
let coreV2: NewYorkCityCoinCoreModelV2;
let tokenV2: NewYorkCityCoinTokenModelV2;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  authV2 = ctx.models.get(NewYorkCityCoinAuthModelV2, "newyorkcitycoin-auth-v2");
  coreV2 = ctx.models.get(NewYorkCityCoinCoreModelV2, "newyorkcitycoin-core-v2");
  tokenV2 = ctx.models.get(NewYorkCityCoinTokenModelV2, "newyorkcitycoin-token-v2");
})

describe("[NewYorkCityCoin Auth v2]", () => {
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
          .expectUint(NewYorkCityCoinAuthModelV2.ErrCode.ERR_UNAUTHORIZED);
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
          .expectUint(NewYorkCityCoinTokenModelV2.ErrCode.ERR_UNAUTHORIZED);
      });
      it("succeeds and updates token uri to none if no new value is provided", () => {
        // arrange
        const sender = accounts.get("nyc_wallet")!;
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
        const sender = accounts.get("nyc_wallet")!;
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
    describe("update-coinbase-thresholds()", () => {
      it("fails with ERR_UNAUTHORIZED when called by someone who is not city wallet", () => {
        // arrange
        const sender = accounts.get("wallet_2")!;
        // act
        const block = chain.mineBlock([
          authV2.updateCoinbaseThresholds(
            sender,
            coreV2.address,
            tokenV2.address,
            100,
            200,
            300,
            400,
            500
          ),
        ]);
        // assert
        const receipt = block.receipts[0];

        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinAuthModelV2.ErrCode.ERR_UNAUTHORIZED);
      });
      it("fails with ERR_UNAUTHORIZED when called by someone who is not auth contract", () => {
        // arrange
        const sender = accounts.get("wallet_2")!;
        // act
        const block = chain.mineBlock([
          tokenV2.updateCoinbaseThresholds(sender, 100, 200, 300, 400, 500)
        ]);
        // assert
        const receipt = block.receipts[0];

        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinTokenModelV2.ErrCode.ERR_UNAUTHORIZED);
      });
      it("succeeds and sets new coinbase thresholds in token and core contract", () => {
        // arrange
        const sender = accounts.get("nyc_wallet")!;
        const coinbaseThresholds = [100, 200, 300, 400, 500];

        chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(sender),
        ]);
        // act
        const block = chain.mineBlock([
          authV2.updateCoinbaseThresholds(
            sender,
            coreV2.address,
            tokenV2.address,
            coinbaseThresholds[0],
            coinbaseThresholds[1],
            coinbaseThresholds[2],
            coinbaseThresholds[3],
            coinbaseThresholds[4]
          )
        ]);
        // assert
        const receipt = block.receipts[0];
        receipt.result.expectOk().expectBool(true);

        const expectedResult = {
          coinbaseThreshold1: types.uint(coinbaseThresholds[0]),
          coinbaseThreshold2: types.uint(coinbaseThresholds[1]),
          coinbaseThreshold3: types.uint(coinbaseThresholds[2]),
          coinbaseThreshold4: types.uint(coinbaseThresholds[3]),
          coinbaseThreshold5: types.uint(coinbaseThresholds[4])
        }

        const tokenResult = tokenV2.getCoinbaseThresholds().result;
        assertEquals(tokenResult.expectOk().expectTuple(), expectedResult);

        const coreResult = coreV2.getCoinbaseThresholds().result;
        assertEquals(coreResult.expectOk().expectTuple(), expectedResult);
      });
    });
    describe("update-coinbase-amounts()", () => {
      it("fails with ERR_UNAUTHORIZED when called by someone who is not city wallet", () => {
        // arrange
        const sender = accounts.get("wallet_2")!;
        // act
        const block = chain.mineBlock([
          authV2.updateCoinbaseAmounts(
            sender,
            coreV2.address,
            tokenV2.address,
            100,
            200,
            300,
            400,
            500,
            600,
            700
          ),
        ]);
        // assert
        const receipt = block.receipts[0];

        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinAuthModelV2.ErrCode.ERR_UNAUTHORIZED);
      });
      it("fails with ERR_UNAUTHORIZED when called by someone who is not auth contract", () => {
        // arrange
        const sender = accounts.get("wallet_2")!;
        // act
        const block = chain.mineBlock([
          tokenV2.updateCoinbaseAmounts(sender, 100, 200, 300, 400, 500, 600, 700)
        ]);
        // assert
        const receipt = block.receipts[0];

        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinTokenModelV2.ErrCode.ERR_UNAUTHORIZED);
      });
      it("succeeds and sets new coinbase amounts in token and core contract", () => {
        // arrange
        const sender = accounts.get("nyc_wallet")!;
        const coinbaseAmounts = [250000, 100000, 50000, 25000, 12500, 6250, 3125];

        chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(sender),
        ]);
        // act
        const block = chain.mineBlock([
          authV2.updateCoinbaseAmounts(
            sender,
            coreV2.address,
            tokenV2.address,
            coinbaseAmounts[0],
            coinbaseAmounts[1],
            coinbaseAmounts[2],
            coinbaseAmounts[3],
            coinbaseAmounts[4],
            coinbaseAmounts[5],
            coinbaseAmounts[6]
          )
        ]);
        // assert
        const receipt = block.receipts[0];
        receipt.result.expectOk().expectBool(true);

        const expectedResult = {
          coinbaseAmount1: types.uint(coinbaseAmounts[1]),
          coinbaseAmount2: types.uint(coinbaseAmounts[2]),
          coinbaseAmount3: types.uint(coinbaseAmounts[3]),
          coinbaseAmount4: types.uint(coinbaseAmounts[4]),
          coinbaseAmount5: types.uint(coinbaseAmounts[5]),
          coinbaseAmountBonus: types.uint(coinbaseAmounts[0]),
          coinbaseAmountDefault: types.uint(coinbaseAmounts[6]),
        }

        const tokenResult = tokenV2.getCoinbaseAmounts().result;
        assertEquals(tokenResult.expectOk().expectTuple(), expectedResult);

        const coreResult = coreV2.getCoinbaseAmounts().result;
        assertEquals(coreResult.expectOk().expectTuple(), expectedResult);
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
          .expectUint(NewYorkCityCoinAuthModelV2.ErrCode.ERR_UNAUTHORIZED);
        receipts[1].result
          .expectErr()
          .expectUint(NewYorkCityCoinAuthModelV2.ErrCode.ERR_UNAUTHORIZED);
      });
    });
  });
});

run();
