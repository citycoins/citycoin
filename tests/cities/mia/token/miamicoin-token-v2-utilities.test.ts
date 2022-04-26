import { describe, run, Chain, it, beforeEach} from "../../../../deps.ts";
import { Accounts, Context } from "../../../../src/context.ts";
import { MiamiCoinCoreModelV2 } from "../../../../models/cities/mia/miamicoin-core-v2.model.ts";
import { MiamiCoinTokenModelV2 } from "../../../../models/cities/mia/miamicoin-token-v2.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let coreV2: MiamiCoinCoreModelV2;
let tokenV2: MiamiCoinTokenModelV2;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  coreV2 = ctx.models.get(MiamiCoinCoreModelV2, "miamicoin-core-v2");
  tokenV2 = ctx.models.get(MiamiCoinTokenModelV2, "miamicoin-token-v2");
})

describe("[MiamiCoin Token v2]", () => {
  //////////////////////////////////////////////////
  // TOKEN UTILITIES
  //////////////////////////////////////////////////
  describe("UTILITIES", () => {
    describe("mint()", () => {
      it("fails with ERR_CORE_CONTRACT_NOT_FOUND if called by an unapproved sender", () => {
        const wallet_2 = accounts.get("wallet_2")!;
        let block = chain.mineBlock([
          tokenV2.mint(200, wallet_2, wallet_2),
        ]);

        let receipt = block.receipts[0];

        receipt.result
          .expectErr()
          .expectUint(MiamiCoinTokenModelV2.ErrCode.ERR_CORE_CONTRACT_NOT_FOUND);
      });

      it("succeeds when called by trusted caller and mints requested amount of tokens", () => {
        const amount = 200;
        const recipient = accounts.get("wallet_3")!;

        chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
        ]);

        let block = chain.mineBlock([
          tokenV2.testMint(amount, recipient),
        ]);

        let receipt = block.receipts[0];
        receipt.result.expectOk().expectBool(true);

        receipt.events.expectFungibleTokenMintEvent(
          amount,
          recipient.address,
          "miamicoin"
        );
      });
    });
    describe("activate-token()", () => {
      it("fails with ERR_UNAUTHORIZED if called by an unapproved sender", () => {
        const wallet_2 = accounts.get("wallet_2")!;
        const block = chain.mineBlock([
          tokenV2.activateToken(wallet_2, 10),
        ]);
        const receipt = block.receipts[0];
        receipt.result
          .expectErr()
          .expectUint(MiamiCoinTokenModelV2.ErrCode.ERR_CORE_CONTRACT_NOT_FOUND);
      });
    });
    describe("convert-to-v2()", () => {
      it("fails with ERR_V1_BALANCE_NOT_FOUND if no v1 balance is found for the user", () => {
        // arrange
        const wallet_1 = accounts.get("wallet_1")!;
        // act
        const block = chain.mineBlock([
          tokenV2.convertToV2(wallet_1)
        ]);
        // assert
        const receipt = block.receipts[0];
        receipt.result
          .expectErr()
          .expectUint(MiamiCoinTokenModelV2.ErrCode.ERR_V1_BALANCE_NOT_FOUND);
      });
      // it("fails with ERR_V1_BALANCE_NOT_FOUND if v1 balance is found but is zero", () => {});
      // it("succeeds and burns V1 tokens then mints V2 tokens * 6 decimal places", () => {});
    });
  });
});

run();
