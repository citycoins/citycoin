import { describe, run, Chain, beforeEach, it } from "../../../../deps.ts";
import { MiamiCoinCoreModel } from "../../../../models/miamicoin-core.model.ts";
import { MiamiCoinTokenModel } from "../../../../models/miamicoin-token.model.ts";
import { Accounts, Context } from "../../../../src/context.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let core: MiamiCoinCoreModel;
let token: MiamiCoinTokenModel;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  core = ctx.models.get(MiamiCoinCoreModel, "miamicoin-core-v1");
  token = ctx.models.get(MiamiCoinTokenModel, "miamicoin-token");
});

describe("[MiamiCoin Core]", () => {
  //////////////////////////////////////////////////
  // CITY WALLET MANAGEMENT
  //////////////////////////////////////////////////
  describe("CITY WALLET MANAGEMENT", () => {
    describe("get-city-wallet()", () => {
      it("succeeds and returns current city wallet variable as contract address before initialization", () => {
        // arrange
        const result = core.getCityWallet().result;

        // assert
        result.expectPrincipal(core.address);
      });
      it("succeeds and returns current city wallet variable as city wallet address after initialization", () => {
        // arrange
        const cityWallet = accounts.get("mia_wallet")!;
        chain.mineBlock([
          core.testInitializeCore(core.address),
        ]);

        const result = core.getCityWallet().result;

        // assert
        result.expectPrincipal(cityWallet.address);
      });
    });
    describe("set-city-wallet()", () => {
      it("fails with ERR_UNAUTHORIZED when called by non-city wallet", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;

        // act
        const receipt = chain.mineBlock([
          core.setCityWallet(wallet, wallet),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(MiamiCoinCoreModel.ErrCode.ERR_UNAUTHORIZED);
      });
    });
  });
});

run();
