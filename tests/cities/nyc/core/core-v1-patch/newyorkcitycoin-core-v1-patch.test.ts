import { describe, run, Chain, beforeEach, it } from "../../../../../deps.ts";
import { Accounts, Context } from "../../../../../src/context.ts";
import { NewYorkCityCoinAuthModel } from "../../../../../models/cities/nyc/newyorkcitycoin-auth.model.ts";
import { NewYorkCityCoinCoreModelPatch } from "../../../../../models/cities/nyc/newyorkcitycoin-core-v1-patch.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let auth: NewYorkCityCoinAuthModel;
let coreV1Patch: NewYorkCityCoinCoreModelPatch;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  auth = ctx.models.get(NewYorkCityCoinAuthModel, "newyorkcitycoin-auth");
  coreV1Patch = ctx.models.get(NewYorkCityCoinCoreModelPatch, "newyorkcitycoin-core-v1-patch");
});

describe("[NewYorkCityCoin Core v1 Patch]", () => {
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
        receipt.result.expectErr().expectUint(NewYorkCityCoinCoreModelPatch.ErrCode.ERR_CONTRACT_DISABLED);
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
        receipt.result.expectErr().expectUint(NewYorkCityCoinCoreModelPatch.ErrCode.ERR_CONTRACT_DISABLED);
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
        receipt.result.expectErr().expectUint(NewYorkCityCoinCoreModelPatch.ErrCode.ERR_CONTRACT_DISABLED);
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
        receipt.result.expectErr().expectUint(NewYorkCityCoinCoreModelPatch.ErrCode.ERR_CONTRACT_DISABLED);
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
        receipt.result.expectErr().expectUint(NewYorkCityCoinCoreModelPatch.ErrCode.ERR_CONTRACT_DISABLED);
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
          receipt.result.expectErr().expectUint(NewYorkCityCoinCoreModelPatch.ErrCode.ERR_UNAUTHORIZED);
      });
      it("succeeds when called by the auth contract the first time", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        // act
        const receipt = chain.mineBlock([
          auth.testSetCityWalletPatch("ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.newyorkcitycoin-core-v1-patch", sender)
        ]).receipts[0];
        // assert
        receipt.result.expectOk().expectBool(true);
      });
      it("fails with ERR_CONTRACT_DISABLED when called by the auth contract the second time", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        chain.mineBlock([
          auth.testSetCityWalletPatch("ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.newyorkcitycoin-core-v1-patch", sender)
        ]);
        // act
        const receipt = chain.mineBlock([
          auth.testSetCityWalletPatch("ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.newyorkcitycoin-core-v1-patch", sender)
        ]).receipts[0];
        // assert
        receipt.result.expectErr().expectUint(NewYorkCityCoinCoreModelPatch.ErrCode.ERR_CONTRACT_DISABLED);
      });
    });
  });
});

run();
