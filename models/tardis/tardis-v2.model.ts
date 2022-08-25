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

  getBalanceMia(blockHeight: number, user: Account): ReadOnlyFn {
    return this.callReadOnly("get-balance-mia", [
      types.uint(blockHeight),
      types.principal(user.address),
    ]);
  }

  getBalanceNyc(blockHeight: number, user: Account): ReadOnlyFn {
    return this.callReadOnly("get-balance-nyc", [
      types.uint(blockHeight),
      types.principal(user.address),
    ]);
  }

  getSupplyMia(blockHeight: number): ReadOnlyFn {
    return this.callReadOnly("get-supply-mia", [types.uint(blockHeight)]);
  }

  getSupplyNyc(blockHeight: number): ReadOnlyFn {
    return this.callReadOnly("get-supply-nyc", [types.uint(blockHeight)]);
  }

  getStackingStatsMia(blockHeight: number): ReadOnlyFn {
    return this.callReadOnly("get-stacking-stats-mia", [
      types.uint(blockHeight),
    ]);
  }

  getStackingStatsNyc(blockHeight: number): ReadOnlyFn {
    return this.callReadOnly("get-stacking-stats-nyc", [
      types.uint(blockHeight),
    ]);
  }

  getStackerStatsMia(blockHeight: number, user: Account): ReadOnlyFn {
    return this.callReadOnly("get-stacker-stats-mia", [
      types.uint(blockHeight),
      types.principal(user.address),
    ]);
  }

  getStackerStatsNyc(blockHeight: number, user: Account): ReadOnlyFn {
    return this.callReadOnly("get-stacker-stats-nyc", [
      types.uint(blockHeight),
      types.principal(user.address),
    ]);
  }
}
