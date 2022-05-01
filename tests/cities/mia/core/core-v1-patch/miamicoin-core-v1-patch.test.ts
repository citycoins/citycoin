import { assertEquals, describe, run, Chain, beforeEach, it, Account } from "../../../../../deps.ts";
import { Accounts, Context } from "../../../../../src/context.ts";
import { MiamiCoinAuthModel } from "../../../../../models/cities/mia/miamicoin-auth.model.ts";
import { MiamiCoinCoreModel } from "../../../../../models/cities/mia/miamicoin-core.model.ts";
import { MiamiCoinTokenModel } from "../../../../../models/cities/mia/miamicoin-token.model.ts";
import { MiamiCoinCoreModelPatch } from "../../../../../models/cities/mia/miamicoin-core-v1-patch.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let auth: MiamiCoinAuthModel;
let core: MiamiCoinCoreModel;
let coreV1Patch: MiamiCoinCoreModelPatch;
let token: MiamiCoinTokenModel;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  auth = ctx.models.get(MiamiCoinAuthModel, "miamicoin-auth");
  core = ctx.models.get(MiamiCoinCoreModel, "miamicoin-core-v1");
  coreV1Patch = ctx.models.get(MiamiCoinCoreModelPatch, "miamicoin-core-v1-patch");
  token = ctx.models.get(MiamiCoinTokenModel, "miamicoin-token");
});

describe("[MiamiCoin Core v1 Patch]", () => {
  describe("DISABLED FUNCTIONS", () => {
    describe("register-user()", () => {
      it("fails with ERR_CONTRACT_DISABLED when called", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        // act
        const receipt = chain.mineBlock([
          coreV1Patch.registerUser(sender)
        ]).receipts[0];
        // assert
        receipt.result.expectErr().expectUint(MiamiCoinCoreModelPatch.ErrCode.ERR_CONTRACT_DISABLED);
      });
    });
    describe("mine-tokens()", () => {
      it("fails with ERR_CONTRACT_DISABLED when called", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        // act
        const receipt = chain.mineBlock([
          coreV1Patch.mineTokens(1, sender)
        ]).receipts[0];
        // assert
        receipt.result.expectErr().expectUint(MiamiCoinCoreModelPatch.ErrCode.ERR_CONTRACT_DISABLED);
      });
    });
    describe("claim-mining-reward()", () => {
      it("fails with ERR_CONTRACT_DISABLED when called", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        // act
        const receipt = chain.mineBlock([
          coreV1Patch.claimMiningReward(1, sender)
        ]).receipts[0];
        // assert
        receipt.result.expectErr().expectUint(MiamiCoinCoreModelPatch.ErrCode.ERR_CONTRACT_DISABLED);
      });
    });
    describe("stack-tokens()", () => {
      it("fails with ERR_CONTRACT_DISABLED when called", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        // act
        const receipt = chain.mineBlock([
          coreV1Patch.stackTokens(1, 1, sender)
        ]).receipts[0];
        // assert
        receipt.result.expectErr().expectUint(MiamiCoinCoreModelPatch.ErrCode.ERR_CONTRACT_DISABLED);
      });
    });
    describe("claim-stacking-reward()", () => {
      it("fails with ERR_CONTRACT_DISABLED when called", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        // act
        const receipt = chain.mineBlock([
          coreV1Patch.claimStackingReward(1, sender)
        ]).receipts[0];
        // assert
        receipt.result.expectErr().expectUint(MiamiCoinCoreModelPatch.ErrCode.ERR_CONTRACT_DISABLED);
      });
    });
    describe("set-city-wallet()", () => {
      it("fails with ERR_UNAUTHORIZED if not called by auth contract", () => {
          // arrange
          const sender = accounts.get("wallet_1")!;
          // act
          const receipt = chain.mineBlock([
            coreV1Patch.setCityWallet(sender, sender)
          ]).receipts[0];
          // assert
          receipt.result.expectErr().expectUint(MiamiCoinCoreModelPatch.ErrCode.ERR_UNAUTHORIZED);
      });
      it("succeeds when called by the auth contract the first time", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        // act
        const receipt = chain.mineBlock([
          auth.testSetCityWalletPatch("ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.miamicoin-core-v1-patch", sender)
        ]).receipts[0];
        // assert
        receipt.result.expectOk().expectBool(true);
      });
      it("fails with ERR_CONTRACT_DISABLED when called by the auth contract the second time", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        chain.mineBlock([
          auth.testSetCityWalletPatch("ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.miamicoin-core-v1-patch", sender)
        ]);
        // act
        const receipt = chain.mineBlock([
          auth.testSetCityWalletPatch("ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.miamicoin-core-v1-patch", sender)
        ]).receipts[0];
        // assert
        receipt.result.expectErr().expectUint(MiamiCoinCoreModelPatch.ErrCode.ERR_CONTRACT_DISABLED);
      });
    });
  });
  describe("BURN PASS-THROUGH", () => {
    describe("burn-mia-v1()", () => {
      let owner: Account;
      let cityWallet: Account;
      let oldContract: string;
      let newContract: string;
      let amount: number;

      beforeEach(() => {
        // setup accounts
        owner = accounts.get("wallet_1")!;
        cityWallet = accounts.get("mia_wallet")!;
        oldContract = core.address;
        newContract = coreV1Patch.address;
        amount = 500;
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
      });
      
      it("fails with ERR_UNAUTHORIZED when owner is different than transaction sender", () => {
        // arrange
        const sender = accounts.get("wallet_2")!;
        // act
        const receipt = chain.mineBlock([
          coreV1Patch.burnMiaV1(amount, owner, sender)
        ]).receipts[0];
        // assert
        receipt.result.expectErr().expectUint(MiamiCoinCoreModelPatch.ErrCode.ERR_UNAUTHORIZED);
      });
      it("fails with u1 when sender is trying to burn more tokens than they own", () => {
        // arrange
        const amount = 123456789;
        // act
        const receipt = chain.mineBlock([
          coreV1Patch.burnMiaV1(amount, owner, owner)
        ]).receipts[0];
        // assert
        receipt.result.expectErr().expectUint(1); // 1 is standard ft-burn error code
      });
      it("succeeds when called by token owner and burns correct amount of tokens", () => {
        // act
        const receipt = chain.mineBlock([
          coreV1Patch.burnMiaV1(amount, owner, owner)
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
  });
});

run();
