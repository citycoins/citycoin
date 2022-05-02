import { describe, run, Chain, it, beforeEach, types, assertEquals} from "../../../../../deps.ts";
import { Accounts, Context } from "../../../../../src/context.ts";
import { MiamiCoinAuthModel } from "../../../../../models/cities/mia/miamicoin-auth.model.ts";
import { MiamiCoinCoreModel } from "../../../../../models/cities/mia/miamicoin-core.model.ts";
import { MiamiCoinCoreModelPatch } from "../../../../../models/cities/mia/miamicoin-core-v1-patch.model.ts";
import { MiamiCoinCoreModelV2 } from "../../../../../models/cities/mia/miamicoin-core-v2.model.ts";
import { MiamiCoinTokenModel } from "../../../../../models/cities/mia/miamicoin-token.model.ts";
import { MiamiCoinTokenModelV2 } from "../../../../../models/cities/mia/miamicoin-token-v2.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let auth: MiamiCoinAuthModel;
let core: MiamiCoinCoreModel;
let coreV1Patch: MiamiCoinCoreModelPatch;
let coreV2: MiamiCoinCoreModelV2;
let token: MiamiCoinTokenModel;
let tokenV2: MiamiCoinTokenModelV2;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  auth = ctx.models.get(MiamiCoinAuthModel, "miamicoin-auth");
  core = ctx.models.get(MiamiCoinCoreModel, "miamicoin-core-v1");
  coreV1Patch = ctx.models.get(MiamiCoinCoreModelPatch, "miamicoin-core-v1-patch");
  coreV2 = ctx.models.get(MiamiCoinCoreModelV2, "miamicoin-core-v2");
  token = ctx.models.get(MiamiCoinTokenModel, "miamicoin-token");
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
    describe("burn()", () => {
      it("fails with ERR_UNAUTHORIZED when owner is different than transaction sender", () => {
        // arrange
        const owner = accounts.get("wallet_1")!;
        const sender = accounts.get("wallet_2")!;
        const amount = 500;

        // act
        const receipt = chain.mineBlock([tokenV2.burn(amount, owner, sender)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(MiamiCoinTokenModelV2.ErrCode.ERR_UNAUTHORIZED);
      });

      it("fails with u1 when sender is trying to burn more tokens than they own", () => {
        const owner = accounts.get("wallet_5")!;
        const amount = 8888912313;

        // act
        const receipt = chain.mineBlock([
          tokenV2.burn(amount, owner, owner),
        ]).receipts[0];

        receipt.result.expectErr().expectUint(1); // 1 is standard ft-burn error code
      })
      it("succeeds when called by token owner and burns correct amount of tokens", () => {
        // arrange
        const owner = accounts.get("wallet_1")!;
        const amount = 300;
        chain.mineBlock([
          tokenV2.testMint(amount, owner)
        ]);

        // act
        const receipt = chain.mineBlock([
          tokenV2.burn(amount, owner, owner),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);

        receipt.events.expectFungibleTokenBurnEvent(
          amount,
          owner.address,
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
          .expectUint(MiamiCoinTokenModelV2.ErrCode.ERR_V1_BALANCE_NOT_FOUND);
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
          .expectUint(MiamiCoinTokenModelV2.ErrCode.ERR_V1_BALANCE_NOT_FOUND);
      });
      it("succeeds and burns V1 tokens then mints V2 tokens * MICRO_CITYCOINS", () => {
        // arrange
        // setup accounts
        const owner = accounts.get("wallet_1")!;
        const cityWallet = accounts.get("mia_wallet")!;
        const oldContract = core.address;
        const newContract = coreV1Patch.address;
        const amount = 500;
        // mint amount and activate core contract
        chain.mineBlock([
          token.testMint(amount, owner),
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(owner)
        ]);
        // upgrade core contract to v1 patch
        chain.mineBlock([
          auth.upgradeCoreContract(oldContract, newContract, cityWallet),
        ]);
        // act
        const block = chain.mineBlock([
          tokenV2.convertToV2(owner)
        ]);
        // assert
        const receipt = block.receipts[0];
        receipt.result.expectOk().expectBool(true);
        receipt.events.expectFungibleTokenBurnEvent(
          amount,
          owner.address,
          "miamicoin"
        );
        receipt.events.expectFungibleTokenMintEvent(
          amount * MiamiCoinTokenModelV2.MICRO_CITYCOINS,
          owner.address,
          "miamicoin"
        );
        const expectedPrintMsg = `{burnedV1: ${types.uint(amount)}, contract-caller: ${owner.address}, mintedV2: ${types.uint(amount *MiamiCoinTokenModelV2.MICRO_CITYCOINS)}, tx-sender: ${owner.address}}`;
        receipt.events.expectPrintEvent(tokenV2.address, expectedPrintMsg);
      });
    });
  });
});

run();
