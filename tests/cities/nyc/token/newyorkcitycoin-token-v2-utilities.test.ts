import { describe, run, Chain, it, beforeEach, types} from "../../../../deps.ts";
import { NewYorkCityCoinCoreModel } from "../../../../models/newyorkcitycoin-core.model.ts";
import { NewYorkCityCoinTokenModel } from "../../../../models/newyorkcitycoin-token.model.ts";
import { NewYorkCityCoinTokenModelV2 } from "../../../../models/newyorkcitycoin-token-v2.model.ts";
import { Accounts, Context } from "../../../../src/context.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let core: NewYorkCityCoinCoreModel;
let token: NewYorkCityCoinTokenModel;
let tokenV2: NewYorkCityCoinTokenModelV2;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  core = ctx.models.get(NewYorkCityCoinCoreModel, "newyorkcitycoin-core-v1");
  token = ctx.models.get(NewYorkCityCoinTokenModel, "newyorkcitycoin-token");
  tokenV2 = ctx.models.get(NewYorkCityCoinTokenModelV2, "newyorkcitycoin-token-v2");
})

describe("[NewYorkCityCoin Token v2]", () => {
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
          .expectUint(NewYorkCityCoinTokenModelV2.ErrCode.ERR_CORE_CONTRACT_NOT_FOUND);
      });

      it("succeeds when called by trusted caller and mints requested amount of tokens", () => {
        const amount = 200;
        const recipient = accounts.get("wallet_3")!;

        chain.mineBlock([
          core.testInitializeCore(core.address),
        ]);

        let block = chain.mineBlock([
          tokenV2.testMint(amount, recipient),
        ]);

        let receipt = block.receipts[0];
        receipt.result.expectOk().expectBool(true);

        receipt.events.expectFungibleTokenMintEvent(
          amount,
          recipient.address,
          "newyorkcitycoin"
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
          .expectUint(NewYorkCityCoinTokenModelV2.ErrCode.ERR_CORE_CONTRACT_NOT_FOUND);
      });
    });
    describe("convert-to-v2()", () => {
      it("fails with ERR_V1_BALANCE_NOT_FOUND if v1 balance is not found for the user", () => {
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
          .expectUint(NewYorkCityCoinTokenModelV2.ErrCode.ERR_V1_BALANCE_NOT_FOUND);
      });
      it("fails with ERR_V1_BALANCE_NOT_FOUND if v1 balance is found but is zero", () => {
        // arrange
        const wallet_1 = accounts.get("wallet_1")!;
        const amount = 500;
        chain.mineBlock([
          tokenV2.testMint(amount, wallet_1)
        ]);
        chain.mineBlock([
          tokenV2.burn(amount, wallet_1, wallet_1)
        ]);
        // act
        const block = chain.mineBlock([
          tokenV2.convertToV2(wallet_1)
        ]);
        // assert
        const receipt = block.receipts[0];
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinTokenModelV2.ErrCode.ERR_V1_BALANCE_NOT_FOUND);
      });
      it("succeeds and burns V1 tokens then mints V2 tokens * MICRO_CITYCOINS", () => {
        // arrange
        const wallet_1 = accounts.get("wallet_1")!;
        const amount = 500;
        chain.mineBlock([
          token.testMint(amount, wallet_1)
        ]);
        // act
        const block = chain.mineBlock([
          tokenV2.convertToV2(wallet_1)
        ]);
        // assert
        const receipt = block.receipts[0];
        receipt.result.expectOk().expectBool(true);
        receipt.events.expectFungibleTokenBurnEvent(
          amount,
          wallet_1.address,
          "newyorkcitycoin"
        );
        receipt.events.expectFungibleTokenMintEvent(
          amount * NewYorkCityCoinTokenModelV2.MICRO_CITYCOINS,
          wallet_1.address,
          "newyorkcitycoin"
        );
        const expectedPrintMsg = `{burnedV1: ${types.uint(amount)}, contract-caller: ${wallet_1.address}, mintedV2: ${types.uint(amount *NewYorkCityCoinTokenModelV2.MICRO_CITYCOINS)}, tx-sender: ${wallet_1.address}}`;
        receipt.events.expectPrintEvent(tokenV2.address, expectedPrintMsg);
      });
    });
  });
});

run();
