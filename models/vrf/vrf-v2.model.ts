import { Account, ReadOnlyFn, Tx, types } from "../../deps.ts";
import { Model } from "../../src/model.ts";

enum ErrCode {
  ERR_FAIL = 3000,
}

export class VrfModelV2 extends Model {
  name = "citycoin-vrf-v2";
  static readonly ErrCode = ErrCode;

  getSaveRnd(blockHeight: number, sender: Account): Tx {
    return this.callPublic(
      "get-save-rnd",
      [types.uint(blockHeight)],
      sender.address
    );
  }

  getRnd(blockHeight: number): ReadOnlyFn {
    return this.callReadOnly("get-rnd", [types.uint(blockHeight)]);
  }

}
