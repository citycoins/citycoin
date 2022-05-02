import { describe, assertEquals, types, Account, run, Chain, it, beforeEach} from "../../deps.ts";
import { Accounts, Context } from "../../src/context.ts";
import { CoreModel } from "../../models/base/core.model.ts";
import { TokenModel } from "../../models/base/token.model.ts";
import { TardisModel } from "../../models/tardis/tardis.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let core: CoreModel;
let token: TokenModel;
let tardis: TardisModel;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  core = ctx.models.get(CoreModel);
  token = ctx.models.get(TokenModel);
  tardis = ctx.models.get(TardisModel);
})

describe("[CityCoin Tardis]", () => {
  describe("HISTORICAL ACTIONS", () => {
    describe("get-historical-balance()", () => {
      it("succeeds and returns the CityCoin balance at a prior block height", () => {
        // arrange
        const wallet_1 = accounts.get("wallet_1")!;
        const mintAmount = 100;

        chain.mineEmptyBlock(100);
        chain.mineBlock([
          token.testMint(mintAmount, wallet_1)
        ]);
        chain.mineEmptyBlock(100);
        chain.mineBlock([
          token.testMint(mintAmount, wallet_1)
        ]);

        // act
        const result1 = tardis.getHistoricalBalance(1, wallet_1).result;
        const result2 = tardis.getHistoricalBalance(101, wallet_1).result;
        const result3 = token.getBalance(wallet_1).result;

        // assert
        result1.expectOk().expectUint(0);
        result2.expectOk().expectUint(mintAmount);
        result3.expectOk().expectUint(mintAmount * 2);
      });
    });

    describe("get-historical-supply()", () => {
      it("succeeds and returns the CityCoin supply at a prior block height", () => {
        // arrange
        const wallet_1 = accounts.get("wallet_1")!;
        const mintAmount = 100;

        chain.mineEmptyBlock(100);
        chain.mineBlock([
          token.testMint(mintAmount, wallet_1)
        ]);
        chain.mineEmptyBlock(100);
        chain.mineBlock([
          token.testMint(mintAmount, wallet_1)
        ]);
        
        // act
        const result1 = tardis.getHistoricalSupply(1).result;
        const result2 = tardis.getHistoricalSupply(101).result;
        const result3 = token.getTotalSupply().result;

        // assert
        result1.expectOk().expectUint(0);
        result2.expectOk().expectUint(mintAmount);
        result3.expectOk().expectUint(mintAmount * 2);
      });
    });

    describe("get-historical-stacking-stats()", () => {
      it("fails with ERR_CYCLE_NOT_FOUND if the cycle ID is not found", () => {
        // arrange
        const wallet_1 = accounts.get("wallet_1")!;
        const blockHeight = 4350;

        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(wallet_1),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH * 2);

        // act
        const result = tardis.getHistoricalStackingStats(blockHeight).result;

        // assert
        result.expectErr().expectUint(TardisModel.ErrCode.ERR_CYCLE_NOT_FOUND);
      });
      it("succeeds and returns the CityCoin stacking statistics at a prior block height", () => {
        // arrange
        const wallet_1 = accounts.get("wallet_1")!;
        const amountStacked = 1000;
        const lockPeriod = 5;

        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(wallet_1),
          token.testMint(amountStacked * 2, wallet_1)
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // stack in cycles 2-3
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        const cycle1 = chain.mineBlock([
          core.stackTokens(amountStacked, lockPeriod, wallet_1)
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        const cycle2 = chain.mineBlock([
          core.stackTokens(amountStacked, lockPeriod, wallet_1)
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH * 2);

        // act
        const result1 = tardis.getHistoricalStackingStats(cycle1.height + CoreModel.REWARD_CYCLE_LENGTH + 1).result;
        const result2 = tardis.getHistoricalStackingStats(cycle2.height + CoreModel.REWARD_CYCLE_LENGTH + 1).result;

        const expectedStats1 = {
          amountToken: types.uint(amountStacked),
          amountUstx: types.uint(0)
        }
        const expectedStats2 = {
          amountToken: types.uint(amountStacked * 2),
          amountUstx: types.uint(0)
        }

        // assert
        assertEquals(result1.expectOk().expectTuple(), expectedStats1);
        assertEquals(result2.expectOk().expectTuple(), expectedStats2);
      });
    });

    describe("get-historical-stacking-stats-or-default()", () => {
      it("succeeds and returns an empty record if the cycle ID is not found", () => {
        // arrange
        const wallet_1 = accounts.get("wallet_1")!;
        const blockHeight = 4350;

        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(wallet_1),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH * 2);

        // act
        const result = tardis.getHistoricalStackingStatsOrDefault(blockHeight).result;

        const expectedStats = {
          amountToken: types.uint(0),
          amountUstx: types.uint(0)
        }
        // assert
        assertEquals(result.expectSome().expectTuple(), expectedStats);
      });
      it("succeeds and returns the CityCoin stacking statistics at a prior block height", () => {
        // arrange
        const wallet_1 = accounts.get("wallet_1")!;
        const amountStacked = 1000;
        const lockPeriod = 5;

        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(wallet_1),
          token.testMint(amountStacked * 2, wallet_1)
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // stack in cycles 2-3
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        const cycle1 = chain.mineBlock([
          core.stackTokens(amountStacked, lockPeriod, wallet_1)
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        const cycle2 = chain.mineBlock([
          core.stackTokens(amountStacked, lockPeriod, wallet_1)
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH * 2);

        // act
        const result1 = tardis.getHistoricalStackingStatsOrDefault(cycle1.height + CoreModel.REWARD_CYCLE_LENGTH + 1).result;
        const result2 = tardis.getHistoricalStackingStatsOrDefault(cycle2.height + CoreModel.REWARD_CYCLE_LENGTH + 1).result;

        const expectedStats1 = {
          amountToken: types.uint(amountStacked),
          amountUstx: types.uint(0)
        }
        const expectedStats2 = {
          amountToken: types.uint(amountStacked * 2),
          amountUstx: types.uint(0)
        }

        // assert
        assertEquals(result1.expectSome().expectTuple(), expectedStats1);
        assertEquals(result2.expectSome().expectTuple(), expectedStats2);
      });
    });

    describe("get-historical-stacker-stats()", () => {
      it("fails with ERR_CYCLE_NOT_FOUND if the cycle ID is not found", () => {
        // arrange
        const wallet_1 = accounts.get("wallet_1")!;
        const blockHeight = 4350;

        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(wallet_1),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH * 2);

        // act
        const result = tardis.getHistoricalStackerStats(blockHeight, wallet_1).result;

        // assert
        result.expectErr().expectUint(TardisModel.ErrCode.ERR_CYCLE_NOT_FOUND);
      });
      it("fails with ERR_USER_NOT_FOUND if the user is not found", () => {
        // arrange
        const wallet_1 = accounts.get("wallet_1")!;
        const blockHeight = 1000;
        chain.mineEmptyBlockUntil(blockHeight + 1);
        // act
        const result = tardis.getHistoricalStackerStats(blockHeight, wallet_1).result;

        // assert
        result.expectErr().expectUint(TardisModel.ErrCode.ERR_USER_NOT_FOUND);
      });

      it("succeeds and returns the CityCoin stacker statistics for a user at a prior block height", () => {
        // arrange
        const wallet_1 = accounts.get("wallet_1")!;
        const amountStacked = 1000;
        const lockPeriod = 5;

        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(wallet_1),
          token.testMint(amountStacked * 2, wallet_1)
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // stack in cycles 2-3
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        const cycle1 = chain.mineBlock([
          core.stackTokens(amountStacked, lockPeriod, wallet_1)
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        const cycle2 = chain.mineBlock([
          core.stackTokens(amountStacked, lockPeriod, wallet_1)
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH * 2);

        // act
        const result1 = tardis.getHistoricalStackerStats(cycle1.height + CoreModel.REWARD_CYCLE_LENGTH + 1, wallet_1).result;
        const result2 = tardis.getHistoricalStackerStats(cycle2.height + CoreModel.REWARD_CYCLE_LENGTH + 1, wallet_1).result;

        const expectedStats1 = {
          amountStacked: types.uint(amountStacked),
          toReturn: types.uint(0)
        }
        const expectedStats2 = {
          amountStacked: types.uint(amountStacked * 2),
          toReturn: types.uint(0)
        }

        // assert
        assertEquals(result1.expectOk().expectTuple(), expectedStats1);
        assertEquals(result2.expectOk().expectTuple(), expectedStats2);
      });
    });
    describe("get-historical-stacker-stats-or-default()", () => {
      it("succeeds and returns an empty record if the user is not found", () => {
        // arrange
        const wallet_1 = accounts.get("wallet_1")!;
        const blockHeight = 4350;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(wallet_1),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH * 2);

        // act
        const result = tardis.getHistoricalStackerStatsOrDefault(blockHeight, wallet_1).result;

        const expectedStats = {
          amountStacked: types.uint(0),
          toReturn: types.uint(0)
        }
        // assert
        assertEquals(result.expectSome().expectTuple(), expectedStats);
      });
      it("succeeds and returns the CityCoin stacker statistics for a user at a prior block height", () => {
        // arrange
        const wallet_1 = accounts.get("wallet_1")!;
        const amountStacked = 1000;
        const lockPeriod = 5;

        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(wallet_1),
          token.testMint(amountStacked * 2, wallet_1)
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // stack in cycles 2-3
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        const cycle1 = chain.mineBlock([
          core.stackTokens(amountStacked, lockPeriod, wallet_1)
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        const cycle2 = chain.mineBlock([
          core.stackTokens(amountStacked, lockPeriod, wallet_1)
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH * 2);

        // act
        const result1 = tardis.getHistoricalStackerStatsOrDefault(cycle1.height + CoreModel.REWARD_CYCLE_LENGTH + 1, wallet_1).result;
        const result2 = tardis.getHistoricalStackerStatsOrDefault(cycle2.height + CoreModel.REWARD_CYCLE_LENGTH + 1, wallet_1).result;

        const expectedStats1 = {
          amountStacked: types.uint(amountStacked),
          toReturn: types.uint(0)
        }
        const expectedStats2 = {
          amountStacked: types.uint(amountStacked * 2),
          toReturn: types.uint(0)
        }

        // assert
        assertEquals(result1.expectSome().expectTuple(), expectedStats1);
        assertEquals(result2.expectSome().expectTuple(), expectedStats2);
      });
    });
  });
});

run();