import { describe, assertEquals, types, run, Chain, it, beforeEach} from "../../../../../deps.ts";
import { Accounts, Context } from "../../../../../src/context.ts";
import { NewYorkCityCoinTokenModel } from "../../../../../models/cities/nyc/newyorkcitycoin-token.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let token: NewYorkCityCoinTokenModel;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  token = ctx.models.get(NewYorkCityCoinTokenModel, "newyorkcitycoin-token");
})

describe("[NewYorkCityCoin Token]", () => {
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
          "newyorkcitycoin"
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
          "newyorkcitycoin"
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
          .expectUint(NewYorkCityCoinTokenModel.ErrCode.ERR_UNAUTHORIZED);
      });
    });

    describe("get-name()", () => {
      it("succeeds and returns 'newyorkcitycoin'", () => {
        const result = token.getName().result;

        result.expectOk().expectAscii("newyorkcitycoin");
      });
    });

    describe("get-symbol()", () => {
      it("succeeds and returns 'NYC'", () => {
        const result = token.getSymbol().result;

        result.expectOk().expectAscii("NYC");
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
        const tokenUri = "https://cdn.citycoins.co/metadata/newyorkcitycoin.json";

        console.log(`\n  URI: ${tokenUri}`);
        result.expectOk().expectSome().expectUtf8(tokenUri);
      });
    });

    describe("burn()", () => {
      it("fails with ERR_UNAUTHORIZED when owner is different than transaction sender", () => {
        // arrange
        const owner = accounts.get("wallet_1")!;
        const sender = accounts.get("wallet_2")!;
        const amount = 500;

        // act
        const receipt = chain.mineBlock([token.burn(amount, owner, sender)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinTokenModel.ErrCode.ERR_UNAUTHORIZED);
      });

      it("fails with u1 when sender is trying to burn more tokens than they own", () => {
        const owner = accounts.get("wallet_5")!;
        const amount = 8888912313;

        // act
        const receipt = chain.mineBlock([
          token.burn(amount, owner, owner),
        ]).receipts[0];

        receipt.result.expectErr().expectUint(1); // 1 is standard ft-burn error code
      })

      it("succeeds when called by token owner and burns correct amount of tokens", () => {
        // arrange
        const owner = accounts.get("wallet_1")!;
        const amount = 300;
        chain.mineBlock([
          token.testMint(amount, owner)
        ]);

        // act
        const receipt = chain.mineBlock([
          token.burn(amount, owner, owner),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);

        receipt.events.expectFungibleTokenBurnEvent(
          amount,
          owner.address,
          "newyorkcitycoin"
        );
      });
    });
  });
});

run();
