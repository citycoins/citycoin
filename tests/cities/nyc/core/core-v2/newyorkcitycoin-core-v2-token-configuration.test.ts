import { assertEquals, describe, types, run, Chain, beforeEach, it } from "../../../../../deps.ts";
import { Accounts, Context } from "../../../../../src/context.ts";
import { NewYorkCityCoinCoreModelV2 } from "../../../../../models/cities/nyc/newyorkcitycoin-core-v2.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let coreV2: NewYorkCityCoinCoreModelV2;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  coreV2 = ctx.models.get(NewYorkCityCoinCoreModelV2, "newyorkcitycoin-core-v2");
});

describe("[NewYorkCityCoin Core v2]", () => {
  //////////////////////////////////////////////////
  // TOKEN CONFIGURATION
  //////////////////////////////////////////////////
  describe("TOKEN CONFIGURATION", () => {
    describe("get-coinbase-thresholds()", () => {
      it("fails with ERR_CONTRACT_NOT_ACTIVATED if called before activation", () => {
        // act
        const result = coreV2.getCoinbaseThresholds().result;
        // assert
        result.expectErr().expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_CONTRACT_NOT_ACTIVATED);
      });
      it("succeeds and returns coinbase thresholds", () => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const block = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(user)
        ]);
        const activationBlockHeight =
          block.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);
        // act
        const result = coreV2.getCoinbaseThresholds().result;
        // assert
        const expectedResult = {
          coinbaseThreshold1: types.uint(activationBlockHeight + NewYorkCityCoinCoreModelV2.BONUS_PERIOD_LENGTH + NewYorkCityCoinCoreModelV2.TOKEN_EPOCH_LENGTH),     // 210151
          coinbaseThreshold2: types.uint(activationBlockHeight + NewYorkCityCoinCoreModelV2.BONUS_PERIOD_LENGTH + NewYorkCityCoinCoreModelV2.TOKEN_EPOCH_LENGTH * 2), // 420151
          coinbaseThreshold3: types.uint(activationBlockHeight + NewYorkCityCoinCoreModelV2.BONUS_PERIOD_LENGTH + NewYorkCityCoinCoreModelV2.TOKEN_EPOCH_LENGTH * 3), // 630151
          coinbaseThreshold4: types.uint(activationBlockHeight + NewYorkCityCoinCoreModelV2.BONUS_PERIOD_LENGTH + NewYorkCityCoinCoreModelV2.TOKEN_EPOCH_LENGTH * 4), // 840151
          coinbaseThreshold5: types.uint(activationBlockHeight + NewYorkCityCoinCoreModelV2.BONUS_PERIOD_LENGTH + NewYorkCityCoinCoreModelV2.TOKEN_EPOCH_LENGTH * 5)  // 1050151
        };
        assertEquals(result.expectOk().expectTuple(), expectedResult);
      });
    });
    describe("get-coinbase-amounts()", () => {
      it("fails with ERR_CONTRACT_NOT_ACTIVATED if called before activation", () => {
        // act
        const result = coreV2.getCoinbaseAmounts().result;
        // assert
        result.expectErr().expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_CONTRACT_NOT_ACTIVATED);
      });
      it("succeeds and returns coinbase amounts", () => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const block = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(user)
        ]);
        const activationBlockHeight =
          block.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);
        // act
        const result = coreV2.getCoinbaseAmounts().result;
        // assert
        const expectedResult = {
          coinbaseAmount1: types.uint(100000 * NewYorkCityCoinCoreModelV2.MICRO_CITYCOINS),
          coinbaseAmount2: types.uint(50000 * NewYorkCityCoinCoreModelV2.MICRO_CITYCOINS),
          coinbaseAmount3: types.uint(25000 * NewYorkCityCoinCoreModelV2.MICRO_CITYCOINS),
          coinbaseAmount4: types.uint(12500 * NewYorkCityCoinCoreModelV2.MICRO_CITYCOINS),
          coinbaseAmount5: types.uint(6250 * NewYorkCityCoinCoreModelV2.MICRO_CITYCOINS),
          coinbaseAmountBonus: types.uint(250000 * NewYorkCityCoinCoreModelV2.MICRO_CITYCOINS),
          coinbaseAmountDefault: types.uint(3125 * NewYorkCityCoinCoreModelV2.MICRO_CITYCOINS),
        };
        assertEquals(result.expectOk().expectTuple(), expectedResult);
      });
    });
  });
});

run();
