import { Account, ReadOnlyFn, Tx, types } from "../../deps.ts";
import { Model } from "../../src/model.ts";

enum ErrCode {
  ERR_INVALID_BLOCK = 7000,
  ERR_SUPPLY_NOT_FOUND = 7003,
  ERR_BALANCE_NOT_FOUND,
}

export class TardisModel extends Model {
  name = "citycoin-tardis-v3";
  static readonly ErrCode = ErrCode;

  getBalance(blockHeight: number, user: Account): ReadOnlyFn {
    return this.callReadOnly("get-balance", [
      types.uint(blockHeight),
      types.principal(user.address),
    ]);
  }

  getSupply(blockHeight: number): ReadOnlyFn {
    return this.callReadOnly("get-supply", [types.uint(blockHeight)]);
  }

  getStackingStats(blockHeight: number): ReadOnlyFn {
    return this.callReadOnly("get-stacking-stats", [types.uint(blockHeight)]);
  }

  getStackerStats(blockHeight: number, user: Account): ReadOnlyFn {
    return this.callReadOnly("get-stacker-stats", [
      types.uint(blockHeight),
      types.principal(user.address),
    ]);
  }
}
