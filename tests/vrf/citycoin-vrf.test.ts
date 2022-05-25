import { describe, assertEquals, run, Chain, it, beforeEach, afterEach} from "../../deps.ts";
import { Accounts, Context } from "../../src/context.ts";
import { VrfModel } from "../../models/vrf/vrf.model.ts";
import { VrfModelV2 } from "../../models/vrf/vrf-v2.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let vrf: VrfModel;
let vrfV2: VrfModelV2;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  vrf = ctx.models.get(VrfModel);
  vrfV2 = ctx.models.get(VrfModelV2);
});

afterEach(() => {
  ctx.terminate()
});

describe("[CityCoin VRF]", () => {
  it("v1 succeeds and returns none if block height is in the future", () => {
    // arrange
    const futureBlock = 10;
    // act
    const result = vrf.getRandomUintAtBlock(futureBlock).result;
    // assert
    result.expectNone();
  });

  it("v2 fails with ERR_FAIL if block height is in the future", () => {
    // arrange
    const user = accounts.get("wallet_1")!;
    const futureBlock = 10;
    // act
    const result = vrfV2.getRnd(futureBlock).result;
    const receipt = chain.mineBlock([
      vrfV2.getSaveRnd(futureBlock, user),
    ]).receipts[0];
    // assert
    result.expectErr().expectUint(VrfModelV2.ErrCode.ERR_FAIL);
    receipt.result.expectErr().expectUint(VrfModelV2.ErrCode.ERR_FAIL);
  });

  it("succeeds and returns the same value from v1 and v2", () => {
    // arrange
    const blocks = 10;
    // act
    const block_1 = chain.mineEmptyBlock(blocks).block_height - 1;
    const resultV1_1 = vrf.getRandomUintAtBlock(block_1).result;
    const resultV2_1 = vrfV2.getRnd(block_1).result;

    const block_2 = chain.mineEmptyBlock(blocks * 2).block_height - 1;
    const resultV1_2 = vrf.getRandomUintAtBlock(block_2).result;
    const resultV2_2 = vrfV2.getRnd(block_2).result;

    const block_3 = chain.mineEmptyBlock(blocks * 3).block_height - 1;
    const resultV1_3 = vrf.getRandomUintAtBlock(block_3).result;
    const resultV2_3 = vrfV2.getRnd(block_3).result;
    // assert
    assertEquals(resultV1_1.expectSome(), resultV2_1.expectOk());
    assertEquals(resultV1_2.expectSome(), resultV2_2.expectOk());
    assertEquals(resultV1_3.expectSome(), resultV2_3.expectOk());
  });

  it("succeeds and returns the same value from both v2 methods", () => {
    // arrange
    const user = accounts.get("wallet_1")!;
    const blocks = 10;
    // act
    const block_1 = chain.mineEmptyBlock(blocks).block_height - 1;
    const receipt_1 = chain.mineBlock([
      vrfV2.getSaveRnd(block_1, user),
    ]).receipts[0];
    const receipt_2 = chain.mineBlock([
      vrfV2.getSaveRnd(block_1, user),
    ]).receipts[0];
    const result_3 = vrfV2.getRnd(block_1).result;
    // assert
    assertEquals(
      receipt_1.result.expectOk(),
      receipt_2.result.expectOk(),
      result_3
    );
  });

});

run();
