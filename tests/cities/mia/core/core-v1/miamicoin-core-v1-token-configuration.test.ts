import { assertEquals, describe, types, run, Chain, beforeEach, it } from "../../../../../deps.ts";
import { Accounts, Context } from "../../../../../src/context.ts";
import { MiamiCoinCoreModel } from "../../../../../models/cities/mia/miamicoin-core.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let core: MiamiCoinCoreModel;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  core = ctx.models.get(MiamiCoinCoreModel, "miamicoin-core-v1");
});

describe("[MiamiCoin Core]", () => {
  //////////////////////////////////////////////////
  // TOKEN CONFIGURATION
  //////////////////////////////////////////////////
  describe("TOKEN CONFIGURATION", () => {
    describe("get-coinbase-thresholds()", () => {
      it("fails with ERR_CONTRACT_NOT_ACTIVATED if called before activation", () => {
        // act
        const result = core.getCoinbaseThresholds().result;
        // assert
        result.expectErr().expectUint(MiamiCoinCoreModel.ErrCode.ERR_CONTRACT_NOT_ACTIVATED);
      });
      it("succeeds and returns coinbase thresholds", () => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(user)
        ]);
        const activationBlockHeight =
          block.height + MiamiCoinCoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);
        // act
        const result = core.getCoinbaseThresholds().result;
        // assert
        const expectedResult = {
          coinbaseThreshold1: types.uint(activationBlockHeight + MiamiCoinCoreModel.TOKEN_HALVING_BLOCKS),     // 210151
          coinbaseThreshold2: types.uint(activationBlockHeight + MiamiCoinCoreModel.TOKEN_HALVING_BLOCKS * 2), // 420151
          coinbaseThreshold3: types.uint(activationBlockHeight + MiamiCoinCoreModel.TOKEN_HALVING_BLOCKS * 3), // 630151
          coinbaseThreshold4: types.uint(activationBlockHeight + MiamiCoinCoreModel.TOKEN_HALVING_BLOCKS * 4), // 840151
          coinbaseThreshold5: types.uint(activationBlockHeight + MiamiCoinCoreModel.TOKEN_HALVING_BLOCKS * 5)  // 1050151
        };
        assertEquals(result.expectOk().expectTuple(), expectedResult);
      });
    });
  });
});

run();
