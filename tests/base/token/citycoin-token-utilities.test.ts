import { describe, run, Chain, it, beforeEach} from "../../../deps.ts";
import { CoreModel } from "../../../models/core.model.ts";
import { TokenModel } from "../../../models/token.model.ts";
import { Accounts, Context } from "../../../src/context.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let token: TokenModel;
let core: CoreModel;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  token = ctx.models.get(TokenModel);
  core = ctx.models.get(CoreModel);
})

describe("[CityCoin Token]", () => {
  //////////////////////////////////////////////////
  // TOKEN UTILITIES
  //////////////////////////////////////////////////
  describe("UTILITIES", () => {
    describe("mint()", () => {
      it("fails with ERR_CORE_CONTRACT_NOT_FOUND if called by an unapproved sender", () => {
        const wallet_2 = accounts.get("wallet_2")!;
        let block = chain.mineBlock([
          token.mint(200, wallet_2, wallet_2),
        ]);

        let receipt = block.receipts[0];

        receipt.result
          .expectErr()
          .expectUint(TokenModel.ErrCode.ERR_CORE_CONTRACT_NOT_FOUND);
      });

      it("succeeds when called by trusted caller and mints requested amount of tokens", () => {
        const wallet_2 = accounts.get("wallet_2")!;
        const amount = 200;
        const recipient = accounts.get("wallet_3")!;

        chain.mineBlock([
          core.testInitializeCore(core.address),
        ]);

        let block = chain.mineBlock([
          token.testMint(amount, recipient),
        ]);

        let receipt = block.receipts[0];
        receipt.result.expectOk().expectBool(true);

        receipt.events.expectFungibleTokenMintEvent(
          amount,
          recipient.address,
          "citycoins"
        );
      });
    });
    describe("activate-token()", () => {
      it("fails with ERR_UNAUTHORIZED if called by an unapproved sender", () => {
        const wallet_2 = accounts.get("wallet_2")!;
        const block = chain.mineBlock([
          token.activateToken(wallet_2, 10),
        ]);
        const receipt = block.receipts[0];
        receipt.result
          .expectErr()
          .expectUint(TokenModel.ErrCode.ERR_CORE_CONTRACT_NOT_FOUND);
      });
    });
  });
});

run();
