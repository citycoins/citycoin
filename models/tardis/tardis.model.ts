import { Account, ReadOnlyFn, Tx, types } from "../../deps.ts";
import { Model } from "../../src/model.ts";

enum ErrCode {
  ERR_INVALID_BLOCK = 7000,
  ERR_CYCLE_NOT_FOUND,
  ERR_USER_NOT_FOUND,
  ERR_SUPPLY_NOT_FOUND,
  ERR_BALANCE_NOT_FOUND,
}

export class TardisModel extends Model {
  name = "citycoin-tardis-v2";
  static readonly ErrCode = ErrCode;

  getHistoricalBalance(blockHeight: number, user: Account): ReadOnlyFn {
    return this.callReadOnly("get-historical-balance", [types.uint(blockHeight), types.principal(user.address)]);
  }

  getHistoricalSupply(blockHeight: number): ReadOnlyFn {
    return this.callReadOnly("get-historical-supply", [types.uint(blockHeight)]);
  }

  getHistoricalStackingStats(blockHeight: number): ReadOnlyFn {
    return this.callReadOnly("get-historical-stacking-stats", [types.uint(blockHeight)]);
  }

  getHistoricalStackingStatsOrDefault(blockHeight: number): ReadOnlyFn {
    return this.callReadOnly("get-historical-stacking-stats-or-default", [types.uint(blockHeight)]);
  }

  getHistoricalStackerStats(blockHeight: number, user: Account): ReadOnlyFn {
    return this.callReadOnly("get-historical-stacker-stats", [types.uint(blockHeight), types.principal(user.address)]);
  }

  getHistoricalStackerStatsOrDefault(blockHeight: number, user: Account): ReadOnlyFn {
    return this.callReadOnly("get-historical-stacker-stats-or-default", [types.uint(blockHeight), types.principal(user.address)]);
  }
}