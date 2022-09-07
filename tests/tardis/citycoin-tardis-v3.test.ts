import {
  describe,
  assertEquals,
  types,
  run,
  Chain,
  it,
  beforeEach,
  afterEach,
} from "../../deps.ts";
import { Accounts, Context } from "../../src/context.ts";
import { CoreModel } from "../../models/base/core.model.ts";
import { TokenModel } from "../../models/base/token.model.ts";
import { TardisModel } from "../../models/tardis/tardis-v2.model.ts";

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
});

afterEach(() => {
  ctx.terminate();
});

describe("[CityCoin Tardis]", () => {
  describe("HISTORICAL ACTIONS", () => {
    describe("get-balance()", () => {
      it("succeeds and returns the CityCoin balance at a prior block height", () => {
        // arrange
        const wallet_1 = accounts.get("wallet_1")!;
        const mintAmount = 100;

        chain.mineEmptyBlock(100);
        let block = chain.mineBlock([token.testMint(mintAmount, wallet_1)]);
        chain.mineEmptyBlock(100);
        chain.mineBlock([token.testMint(mintAmount, wallet_1)]);

        // act
        const result1 = tardis.getBalance(1, wallet_1).result;
        const result2 = tardis.getBalance(block.height, wallet_1).result;
        const result3 = token.getBalance(wallet_1).result;

        // assert
        result1.expectOk().expectUint(0);
        result2.expectOk().expectUint(mintAmount);
        result3.expectOk().expectUint(mintAmount * 2);
      });
    });

    describe("get-supply()", () => {
      it("succeeds and returns the CityCoin supply at a prior block height", () => {
        // arrange
        const wallet_1 = accounts.get("wallet_1")!;
        const mintAmount = 100;

        chain.mineEmptyBlock(100);
        let block = chain.mineBlock([token.testMint(mintAmount, wallet_1)]);
        chain.mineEmptyBlock(100);
        chain.mineBlock([token.testMint(mintAmount, wallet_1)]);

        // act
        const result1 = tardis.getSupply(1).result;
        const result2 = tardis.getSupply(block.height).result;
        const result3 = token.getTotalSupply().result;

        // assert
        result1.expectOk().expectUint(0);
        result2.expectOk().expectUint(mintAmount);
        result3.expectOk().expectUint(mintAmount * 2);
      });
    });

    describe("get-stacking-stats()", () => {
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
        const result = tardis.getStackingStats(blockHeight).result;

        const expectedStats = {
          amountToken: types.uint(0),
          amountUstx: types.uint(0),
        };
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
          token.testMint(amountStacked * 2, wallet_1),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // stack in cycles 2-3
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        const cycle1 = chain.mineBlock([
          core.stackTokens(amountStacked, lockPeriod, wallet_1),
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        const cycle2 = chain.mineBlock([
          core.stackTokens(amountStacked, lockPeriod, wallet_1),
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH * 2);

        // act
        const result1 = tardis.getStackingStats(
          cycle1.height + CoreModel.REWARD_CYCLE_LENGTH + 1
        ).result;
        const result2 = tardis.getStackingStats(
          cycle2.height + CoreModel.REWARD_CYCLE_LENGTH + 1
        ).result;

        const expectedStats1 = {
          amountToken: types.uint(amountStacked),
          amountUstx: types.uint(0),
        };
        const expectedStats2 = {
          amountToken: types.uint(amountStacked * 2),
          amountUstx: types.uint(0),
        };

        // assert
        assertEquals(result1.expectSome().expectTuple(), expectedStats1);
        assertEquals(result2.expectSome().expectTuple(), expectedStats2);
      });
    });

    describe("get-stacker-stats()", () => {
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
        const result = tardis.getStackerStats(blockHeight, wallet_1).result;

        const expectedStats = {
          amountStacked: types.uint(0),
          toReturn: types.uint(0),
        };
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
          token.testMint(amountStacked * 2, wallet_1),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // stack in cycles 2-3
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        const cycle1 = chain.mineBlock([
          core.stackTokens(amountStacked, lockPeriod, wallet_1),
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        const cycle2 = chain.mineBlock([
          core.stackTokens(amountStacked, lockPeriod, wallet_1),
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH * 2);

        // act
        const result1 = tardis.getStackerStats(
          cycle1.height + CoreModel.REWARD_CYCLE_LENGTH + 1,
          wallet_1
        ).result;
        const result2 = tardis.getStackerStats(
          cycle2.height + CoreModel.REWARD_CYCLE_LENGTH + 1,
          wallet_1
        ).result;

        const expectedStats1 = {
          amountStacked: types.uint(amountStacked),
          toReturn: types.uint(0),
        };
        const expectedStats2 = {
          amountStacked: types.uint(amountStacked * 2),
          toReturn: types.uint(0),
        };

        // assert
        assertEquals(result1.expectSome().expectTuple(), expectedStats1);
        assertEquals(result2.expectSome().expectTuple(), expectedStats2);
      });
    });
  });
});

run();
