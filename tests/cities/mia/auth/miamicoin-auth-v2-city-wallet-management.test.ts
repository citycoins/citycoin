import { describe, run, Chain, beforeEach, it} from "../../../../deps.ts";
import { Accounts, Context } from "../../../../src/context.ts";
import { MiamiCoinAuthModelV2 } from "../../../../models/cities/mia/miamicoin-auth-v2.model.ts";
import { MiamiCoinCoreModelV2 } from "../../../../models/cities/mia/miamicoin-core-v2.model.ts";

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

describe("[MiamiCoin Auth v2]", () => {
  //////////////////////////////////////////////////
  // CITY WALLET MANAGEMENT
  //////////////////////////////////////////////////
  describe("CITY WALLET MANAGEMENT", () => {
    describe("get-city-wallet()", () => {
      it("succeeds and returns city wallet", () => {
        // arrange
        const cityWallet = accounts.get("mia_wallet")!;
        // act
        const result = authV2.getCityWallet().result;
        // assert
        result.expectOk().expectPrincipal(cityWallet.address);
      });
    });
    describe("set-city-wallet()", () => {
      it("fails with ERR_CORE_CONTRACT_NOT_FOUND if principal not found in core contracts map", () => {
        // arrange
        const cityWallet = accounts.get("mia_wallet")!;
        const newCityWallet = accounts.get("wallet_2")!;
        // act
        const receipt = chain.mineBlock([
          authV2.setCityWallet(
            coreV2.address,
            newCityWallet,
            cityWallet
          ),
        ]).receipts[0];
        // assert
        receipt.result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_CORE_CONTRACT_NOT_FOUND);
      });

      it("fails with ERR_UNAUTHORIZED if not called by city wallet", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const newCityWallet = accounts.get("wallet_2")!;
        chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
        ]);
        // act
        const receipt = chain.mineBlock([
          authV2.setCityWallet(
            coreV2.address,
            newCityWallet,
            sender
          ),
        ]).receipts[0];
        // assert
        receipt.result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_UNAUTHORIZED);
      });

      it("fails with ERR_UNAUTHORIZED if not called by the active core contract", () => {
        // arrange
        const cityWallet = accounts.get("mia_wallet")!;
        const newCityWallet = accounts.get("wallet_2")!;
        chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
        ]);
        // act
        const receipt = chain.mineBlock([
          authV2.setCityWallet(
            coreV2.address,
            newCityWallet,
            cityWallet
          ),
        ]).receipts[0];
        // assert
        receipt.result
          .expectErr()
          .expectUint(MiamiCoinAuthModelV2.ErrCode.ERR_UNAUTHORIZED);
      });

      it("succeeds and updates city wallet variable when called by current city wallet", () => {
        // arrange
        const cityWallet = accounts.get("mia_wallet")!;
        const newCityWallet = accounts.get("wallet_2")!;
        chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          authV2.testSetActiveCoreContract(cityWallet),
        ]);

        // act
        const receipt = chain.mineBlock([
          authV2.setCityWallet(
            coreV2.address,
            newCityWallet,
            cityWallet
          ),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);
        coreV2
          .getCityWallet()
          .result.expectPrincipal(newCityWallet.address);
        authV2
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
        const cityWallet = accounts.get("mia_wallet")!;
        const newCityWallet = accounts.get("wallet_2")!;
        chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          authV2.testSetActiveCoreContract(cityWallet),
        ]);

        chain.mineBlock([
          authV2.createJob(
            "update city wallet 1",
            authV2.address,
            sender
          ),
          authV2.addPrincipalArgument(
            jobId,
            "newCityWallet",
            newCityWallet.address,
            sender
          ),
          authV2.activateJob(jobId, sender),
          authV2.approveJob(jobId, approver1),
          authV2.approveJob(jobId, approver2),
          authV2.approveJob(jobId, approver3),
        ]);

        // act
        const receipt = chain.mineBlock([
          authV2.executeSetCityWalletJob(
            jobId,
            coreV2.address,
            approver1
          ),
        ]).receipts[0];

        // asserts
        receipt.result.expectOk().expectBool(true);

        coreV2
          .getCityWallet()
          .result.expectPrincipal(newCityWallet.address);
      });
    });
  });
});

run();
