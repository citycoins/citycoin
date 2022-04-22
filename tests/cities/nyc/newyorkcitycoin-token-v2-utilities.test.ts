import { describe, run, Chain, it, beforeEach} from "../../../deps.ts";
import { NewYorkCityCoinCoreModel } from "../../../models/newyorkcitycoin-core.model.ts";
import { NewYorkCityCoinTokenModel } from "../../../models/newyorkcitycoin-token.model.ts";
import { NewYorkCityCoinTokenModelV2 } from "../../../models/newyorkcitycoin-token-v2.model.ts";
import { Accounts, Context } from "../../../src/context.ts";

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
  token = ctx.models.get(NewYorkCityCoinTokenModelV2, "newyorkcitycoin-token");
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
          .expectUint(NewYorkCityCoinTokenModel.ErrCode.ERR_CORE_CONTRACT_NOT_FOUND);
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
          .expectUint(NewYorkCityCoinTokenModel.ErrCode.ERR_CORE_CONTRACT_NOT_FOUND);
      });
    });
  });
});

run();
