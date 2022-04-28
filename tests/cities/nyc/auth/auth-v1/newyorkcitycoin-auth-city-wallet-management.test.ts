import { describe, run, Chain, beforeEach, it} from "../../../../../deps.ts";
import { Accounts, Context } from "../../../../../src/context.ts";
import { NewYorkCityCoinAuthModel } from "../../../../../models/cities/nyc/newyorkcitycoin-auth.model.ts";
import { NewYorkCityCoinCoreModel } from "../../../../../models/cities/nyc/newyorkcitycoin-core.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let core: NewYorkCityCoinCoreModel;
let auth: NewYorkCityCoinAuthModel;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  auth = ctx.models.get(NewYorkCityCoinAuthModel, "newyorkcitycoin-auth");
  core = ctx.models.get(NewYorkCityCoinCoreModel, "newyorkcitycoin-core-v1");
})

describe("[NewYorkCityCoin Auth]", () => {
  //////////////////////////////////////////////////
  // CITY WALLET MANAGEMENT
  //////////////////////////////////////////////////
  describe("CITY WALLET MANAGEMENT", () => {
    describe("get-city-wallet()", () => {
      it("succeeds and returns city wallet", () => {
        // arrange
        const cityWallet = accounts.get("nyc_wallet")!;
        // act
        const result = auth.getCityWallet().result;
        // assert
        result.expectOk().expectPrincipal(cityWallet.address);
      });
    });
    describe("set-city-wallet()", () => {
      it("fails with ERR_CORE_CONTRACT_NOT_FOUND if principal not found in core contracts map", () => {
        // arrange
        const cityWallet = accounts.get("nyc_wallet")!;
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
          .expectUint(NewYorkCityCoinAuthModel.ErrCode.ERR_CORE_CONTRACT_NOT_FOUND);
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
          .expectUint(NewYorkCityCoinAuthModel.ErrCode.ERR_UNAUTHORIZED);
      });

      it("fails with ERR_UNAUTHORIZED if not called by the active core contract", () => {
        // arrange
        const cityWallet = accounts.get("nyc_wallet")!;
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
          .expectUint(NewYorkCityCoinAuthModel.ErrCode.ERR_UNAUTHORIZED);
      });

      it("succeeds and updates city wallet variable when called by current city wallet", () => {
        // arrange
        const cityWallet = accounts.get("nyc_wallet")!;
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
        const cityWallet = accounts.get("nyc_wallet")!;
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
});

run();
