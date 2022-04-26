import { describe, run, Chain, beforeEach, it } from "../../../../../deps.ts";
import { Accounts, Context } from "../../../../../src/context.ts";
import { MiamiCoinCoreModelV2 } from "../../../../../models/cities/mia/miamicoin-core-v2.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let coreV2: MiamiCoinCoreModelV2;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  coreV2 = ctx.models.get(MiamiCoinCoreModelV2, "miamicoin-core-v2");
});

describe("[MiamiCoin Core v2]", () => {
  //////////////////////////////////////////////////
  // CITY WALLET MANAGEMENT
  //////////////////////////////////////////////////
  describe("CITY WALLET MANAGEMENT", () => {
    describe("get-city-wallet()", () => {
      it("succeeds and returns current city wallet variable as contract address before initialization", () => {
        // arrange
        const result = coreV2.getCityWallet().result;

        // assert
        result.expectPrincipal(coreV2.address);
      });
      it("succeeds and returns current city wallet variable as city wallet address after initialization", () => {
        // arrange
        const cityWallet = accounts.get("mia_wallet")!;
        chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
        ]);

        const result = coreV2.getCityWallet().result;

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
          coreV2.setCityWallet(wallet, wallet),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(MiamiCoinCoreModelV2.ErrCode.ERR_UNAUTHORIZED);
      });
    });
  });
});

run();
