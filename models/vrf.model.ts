import { ReadOnlyFn, types } from "../deps.ts";
import { Model } from "../src/model.ts";

export class VrfModelV1 extends Model {
  name = "citycoin-vrf";

  getRandomUintAtBlock(blockheight: number): ReadOnlyFn {
    return this.callReadOnly("get-random-uint-at-block", [types.uint(blockheight)]);
  }

}
