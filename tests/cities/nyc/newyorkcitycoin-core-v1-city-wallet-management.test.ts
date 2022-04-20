import { describe, run, Chain, beforeEach, it } from "../../deps.ts";
import { CoreModel } from "../../models/core.model.ts";
import { TokenModel } from "../../models/token.model.ts";
import { Accounts, Context } from "../../src/context.ts";


let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let core: CoreModel;
let token: TokenModel;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  core = ctx.models.get(CoreModel);
  token = ctx.models.get(TokenModel);
});

describe("[CityCoin Core]", () => {
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
        const cityWallet = accounts.get("city_wallet")!;
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
          .expectUint(CoreModel.ErrCode.ERR_UNAUTHORIZED);
      });
    });
  });
});

run();
