import { describe, assertEquals, types, run, Chain, it, beforeEach, afterEach} from "../../../../../deps.ts";
import { Accounts, Context } from "../../../../../src/context.ts";
import { MiamiCoinCoreModel } from "../../../../../models/cities/mia/miamicoin-core.model.ts";
import { MiamiCoinTokenModel } from "../../../../../models/cities/mia/miamicoin-token.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let core: MiamiCoinCoreModel;
let token: MiamiCoinTokenModel;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  core = ctx.models.get(MiamiCoinCoreModel, "miamicoin-core-v1")
  token = ctx.models.get(MiamiCoinTokenModel, "miamicoin-token");
})

afterEach(() => {
  ctx.terminate()
});

describe("[MiamiCoin Token]", () => {
  //////////////////////////////////////////////////
  // SIP-010 FUNCTIONS
  //////////////////////////////////////////////////
  describe("SIP-010 FUNCTIONS", () => {
    describe("transfer()", () => {
      it("succeeds with no memo supplied", () => {
        const from = accounts.get("wallet_1")!;
        const to = accounts.get("wallet_2")!;
        const amount = 100;

        chain.mineBlock([token.testMint(amount, from)]);

        const block = chain.mineBlock([
          token.transfer(amount, from, to, from),
        ]);

        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk();
        block.receipts[0].events.expectFungibleTokenTransferEvent(
          amount,
          from.address,
          to.address,
          "miamicoin"
        );
      });

      it("succeeds with memo supplied", () => {
        const from = accounts.get("wallet_1")!;
        const to = accounts.get("wallet_2")!;
        const amount = 100;
        const memo = new TextEncoder().encode(
          "MiamiCoin is the first CityCoin"
        );

        chain.mineBlock([token.testMint(amount, from)]);

        const block = chain.mineBlock([
          token.transfer(amount, from, to, from, memo),
        ]);

        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk();

        const expectedEvent = {
          type: "contract_event",
          contract_event: {
            contract_identifier: token.address,
            topic: "print",
            value: types.some(types.buff(memo)),
          },
        };

        const receipt = block.receipts[0];
        assertEquals(receipt.events.length, 2);
        assertEquals(receipt.events[0], expectedEvent);
        receipt.events.expectFungibleTokenTransferEvent(
          amount,
          from.address,
          to.address,
          "miamicoin"
        );
      });

      it("fails with u1 when sender does not have enough funds", () => {
        const from = accounts.get("wallet_1")!;
        const to = accounts.get("wallet_2")!;

        const block = chain.mineBlock([
          token.transfer(100, from, to, from),
        ]);

        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectErr().expectUint(1);
      });

      it("fails with u2 when sender and recipient are the same", () => {
        const from = accounts.get("wallet_1")!;
        const to = accounts.get("wallet_1")!;

        chain.mineBlock([token.testMint(100, from)]);

        const block = chain.mineBlock([
          token.transfer(100, from, to, from),
        ]);

        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectErr().expectUint(2);
      });

      it("fails with ERR_UNAUTHORIZED when token sender is different than transaction sender", () => {
        const from = accounts.get("wallet_1")!;
        const to = accounts.get("wallet_2")!;
        const sender = accounts.get("wallet_3")!;
        const amount = 100;

        chain.mineBlock([token.testMint(amount, from)]);

        const block = chain.mineBlock([
          token.transfer(amount, from, to, sender),
        ]);

        assertEquals(block.receipts.length, 1);
        block.receipts[0].result
          .expectErr()
          .expectUint(MiamiCoinTokenModel.ErrCode.ERR_UNAUTHORIZED);
      });
    });

    describe("get-name()", () => {
      it("succeeds and returns 'miamicoin'", () => {
        const result = token.getName().result;

        result.expectOk().expectAscii("miamicoin");
      });
    });

    describe("get-symbol()", () => {
      it("succeeds and returns 'MIA'", () => {
        const result = token.getSymbol().result;

        result.expectOk().expectAscii("MIA");
      });
    });

    describe("get-decimals()", () => {
      it("succeeds and returns 0", () => {
        const result = token.getDecimals().result;

        result.expectOk().expectUint(0);
      });
    });

    describe("get-balance()", () => {
      it("succeeds and returns 0 when no tokens are minted", () => {
        const wallet_1 = accounts.get("wallet_1")!;
        const result = token.getBalance(wallet_1).result;

        result.expectOk().expectUint(0);
      });

      it("succeeds and returns 100 after 100 tokens are minted to a wallet", () => {
        const wallet_1 = accounts.get("wallet_1")!;
        chain.mineBlock([token.testMint(100, wallet_1)]);

        const result = token.getBalance(wallet_1).result;

        result.expectOk().expectUint(100);
      });
    });

    describe("get-total-supply()", () => {
      it("succeeds and returns 0 when no tokens are minted", () => {
        const result = token.getTotalSupply().result;

        result.expectOk().expectUint(0);
      });

      it("succeeds and returns 100 after 100 tokens are minted", () => {
        const wallet_1 = accounts.get("wallet_1")!;
        chain.mineBlock([token.testMint(100, wallet_1)]);

        const result = token.getTotalSupply().result;

        result.expectOk().expectUint(100);
      });
    });
    describe("get-token-uri()", () => {
      it("succeds and returns correct uri", () => {
        const result = token.getTokenUri().result;
        const tokenUri = "https://cdn.citycoins.co/metadata/miamicoin.json";

        console.log(`\n  URI: ${tokenUri}`);
        result.expectOk().expectSome().expectUtf8(tokenUri);
      });
    });

    describe("burn()", () => {
      it("fails with ERR_CORE_CONTRACT_NOT_FOUND when called by someone who is not a trusted caller", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;
        const amount = 500;
        // act
        const receipt = chain.mineBlock([
          token.burn(amount, wallet, wallet)
        ]).receipts[0];
        // assert
        receipt.result.expectErr().expectUint(MiamiCoinTokenModel.ErrCode.ERR_CORE_CONTRACT_NOT_FOUND);
      });

      it("succeeds when called by trusted caller and burns tokens", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;
        const amount = 500;
        chain.mineBlock([
          token.testMint(amount, wallet),
          core.testInitializeCore(core.address)
        ]);
        // act
        const receipt = chain.mineBlock([
          core.testBurn(amount, wallet, wallet)
        ]).receipts[0];
        // assert
        receipt.result.expectOk();
        assertEquals(receipt.events.length, 1);
        receipt.events.expectFungibleTokenBurnEvent(amount, wallet.address, "miamicoin");
      });

    });
  });
});

run();
