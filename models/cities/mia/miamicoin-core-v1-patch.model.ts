import { Account, Tx, types } from "../../../deps.ts";
import { Model } from "../../../src/model.ts";

enum ErrCode {
  ERR_UNAUTHORIZED = 1001,
  ERR_CONTRACT_DISABLED = 1021
}

export class MiamiCoinCoreModelPatch extends Model {
  name = "miamicoin-core-v1-patch"

  static readonly ErrCode = ErrCode;

  registerUser(sender: Account, memo: string | undefined = undefined): Tx {
    return this.callPublic(
      "register-user",
      [
        typeof memo == "undefined"
          ? types.none()
          : types.some(types.utf8(memo)),
      ],
      sender.address
    );
  }

  mineTokens(
    amountUstx: number,
    miner: Account,
    memo: ArrayBuffer | undefined = undefined
  ): Tx {
    return this.callPublic(
      "mine-tokens",
      [
        types.uint(amountUstx),
        typeof memo == "undefined"
          ? types.none()
          : types.some(types.buff(memo)),
      ],
      miner.address
    );
  }

  claimMiningReward(minerBlockHeight: number, sender: Account): Tx {
    return this.callPublic(
      "claim-mining-reward",
      [types.uint(minerBlockHeight)],
      sender.address
    );
  }

  stackTokens(amountTokens: number, lockPeriod: number, stacker: Account): Tx {
    return this.callPublic(
      "stack-tokens",
      [types.uint(amountTokens), types.uint(lockPeriod)],
      stacker.address
    );
  }

  claimStackingReward(targetCycle: number, sender: Account): Tx {
    return this.callPublic(
      "claim-stacking-reward",
      [types.uint(targetCycle)],
      sender.address
    );
  }

  setCityWallet(newCityWallet: Account, sender: Account): Tx {
    return this.callPublic(
      "set-city-wallet",
      [types.principal(newCityWallet.address)],
      sender.address
    );
  }

  shutdownContract(blockHeight: number, sender: Account): Tx {
    return this.callPublic(
      "shutdown-contract",
      [types.uint(blockHeight)],
      sender.address
    );
  }

  burnMiaV1(amountUstx: number, owner: Account, sender: Account) {
    return this.callPublic(
      "burn-mia-v1",
      [types.uint(amountUstx), types.principal(owner.address)],
      sender.address
    );
  }

}