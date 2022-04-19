import { describe, run, Chain, beforeEach, it} from "../../deps.ts";
import { AuthModel } from "../../models/auth.model.ts";
import { CoreModel } from "../../models/core.model.ts";
import { TokenModel } from "../../models/token.model.ts";
import { Accounts, Context } from "../../src/context.ts";

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
      it("fails with ERR_CORE_CONTRACT_NOT_FOUND if principal not found in core contracts map", () => {
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

      it("fails with ERR_UNAUTHORIZED if not called by city wallet", () => {
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

      it("fails with ERR_UNAUTHORIZED if not called by the active core contract", () => {
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

      it("succeeds and updates city wallet variable when called by current city wallet", () => {
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
      it("succeeds and updates city wallet variable when called by job approver", () => {
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
      it("succeeds and updates token uri to none if no new value is provided", () => {
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
      it("succeeds and updates token uri to new value if provided", () => {
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
      it("succeeds and replaces one approver with a new principal", () => {
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

      it("fails with ERR_UNAUTHORIZED if replaced/inactive approver creates or approves jobs", () => {
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
