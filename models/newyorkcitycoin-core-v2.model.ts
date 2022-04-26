import { Account, ReadOnlyFn, Tx, types } from "../deps.ts";
import { Model } from "../src/model.ts";

enum ErrCode {
  ERR_FT_INSUFFICIENT_BALANCE = 1,
  ERR_UNAUTHORIZED = 1000,
  ERR_USER_ALREADY_REGISTERED,
  ERR_USER_NOT_FOUND,
  ERR_USER_ID_NOT_FOUND,
  ERR_ACTIVATION_THRESHOLD_REACHED,
  ERR_CONTRACT_NOT_ACTIVATED,
  ERR_USER_ALREADY_MINED,
  ERR_INSUFFICIENT_COMMITMENT,
  ERR_INSUFFICIENT_BALANCE,
  ERR_USER_DID_NOT_MINE_IN_BLOCK,
  ERR_CLAIMED_BEFORE_MATURITY,
  ERR_NO_MINERS_AT_BLOCK,
  ERR_REWARD_ALREADY_CLAIMED,
  ERR_MINER_DID_NOT_WIN,
  ERR_NO_VRF_SEED_FOUND,
  ERR_STACKING_NOT_AVAILABLE,
  ERR_CANNOT_STACK,
  ERR_REWARD_CYCLE_NOT_COMPLETED,
  ERR_NOTHING_TO_REDEEM,
  ERR_UNABLE_TO_FIND_CITY_WALLET,
  ERR_CLAIM_IN_WRONG_CONTRACT
}

export class NewYorkCityCoinCoreModelV2 extends Model {
  name = "newyorkcitycoin-core-v2"

  static readonly ErrCode = ErrCode;
  static readonly ACTIVATION_DELAY = 150;
  static readonly ACTIVATION_THRESHOLD = 20;
  static readonly TOKEN_EPOCH_LENGTH = 25000;
  static readonly REWARD_CYCLE_LENGTH = 2100;
  static readonly SPLIT_CITY_PCT = 0.3;
  static readonly TOKEN_REWARD_MATURITY = 100;
  static readonly BONUS_PERIOD_LENGTH = 10000;

  //////////////////////////////////////////////////
  // CITY WALLET MANAGEMENT
  //////////////////////////////////////////////////

  setCityWallet(newCityWallet: Account, sender: Account): Tx {
    return this.callPublic(
      "set-city-wallet",
      [types.principal(newCityWallet.address)],
      sender.address
    );
  }

  getCityWallet(): ReadOnlyFn {
    return this.callReadOnly("get-city-wallet");
  }

  //////////////////////////////////////////////////
  // REGISTRATION
  //////////////////////////////////////////////////

  getActivationBlock(): ReadOnlyFn {
    return this.callReadOnly("get-activation-block");
  }

  getActivationDelay(): ReadOnlyFn {
    return this.callReadOnly("get-activation-delay");
  }

  getActivationStatus(): ReadOnlyFn {
    return this.callReadOnly("get-activation-status");
  }

  getActivationThreshold(): ReadOnlyFn {
    return this.callReadOnly("get-activation-threshold");
  }

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

  getRegisteredUsersNonce(): ReadOnlyFn {
    return this.callReadOnly("get-registered-users-nonce");
  }

  getUserId(user: Account): ReadOnlyFn {
    return this.callReadOnly("get-user-id", [types.principal(user.address)]);
  }

  getUser(userId: number): ReadOnlyFn {
    return this.callReadOnly("get-user", [types.uint(userId)]);
  }

  //////////////////////////////////////////////////
  // MINING CONFIGURATION
  //////////////////////////////////////////////////

  getBlockWinnerId(stacksHeight: number): ReadOnlyFn {
    return this.callReadOnly("get-block-winner-id", [
      types.uint(stacksHeight),
    ]);
  }

  //////////////////////////////////////////////////
  // MINING ACTIONS
  //////////////////////////////////////////////////

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

  mineMany(amounts: number[], miner: Account): Tx {
    return this.callPublic(
      "mine-many",
      [types.list(amounts.map((amount) => types.uint(amount)))],
      miner.address
    );
  }

  hasMinedAtBlock(stacksHeight: number, userId: number): ReadOnlyFn {
    return this.callReadOnly("has-mined-at-block", [
      types.uint(stacksHeight),
      types.uint(userId),
    ]);
  }

  //////////////////////////////////////////////////
  // MINING REWARD CLAIM ACTIONS
  //////////////////////////////////////////////////

  claimMiningReward(minerBlockHeight: number, sender: Account): Tx {
    return this.callPublic(
      "claim-mining-reward",
      [types.uint(minerBlockHeight)],
      sender.address
    );
  }

  isBlockWinner(user: Account, minerBlockHeight: number): ReadOnlyFn {
    return this.callReadOnly("is-block-winner", [
      types.principal(user.address),
      types.uint(minerBlockHeight),
    ]);
  }

  canClaimMiningReward(user: Account, minerBlockHeight: number): ReadOnlyFn {
    return this.callReadOnly("can-claim-mining-reward", [
      types.principal(user.address),
      types.uint(minerBlockHeight),
    ]);
  }

  //////////////////////////////////////////////////
  // STACKING CONFIGURATION
  //////////////////////////////////////////////////

  getStackerAtCycleOrDefault(rewardCycle: number, userId: number): ReadOnlyFn {
    return this.callReadOnly("get-stacker-at-cycle-or-default", [
      types.uint(rewardCycle),
      types.uint(userId),
    ]);
  }

  getFirstStacksBlockInRewardCycle(rewardCycle: number): ReadOnlyFn {
    return this.callReadOnly("get-first-stacks-block-in-reward-cycle", [
      types.uint(rewardCycle),
    ]);
  }

  getRewardCycle(blockHeight: number): ReadOnlyFn {
    return this.callReadOnly("get-reward-cycle", [types.uint(blockHeight)]);
  }

  getStackingReward(userId: number, targetCycle: number): ReadOnlyFn {
    return this.callReadOnly("get-stacking-reward", [types.uint(userId), types.uint(targetCycle)]);
  }

  //////////////////////////////////////////////////
  // STACKING ACTIONS
  //////////////////////////////////////////////////

  stackTokens(amountTokens: number, lockPeriod: number, stacker: Account): Tx {
    return this.callPublic(
      "stack-tokens",
      [types.uint(amountTokens), types.uint(lockPeriod)],
      stacker.address
    );
  }

  //////////////////////////////////////////////////
  // STACKING REWARD CLAIMS
  //////////////////////////////////////////////////

  claimStackingReward(targetCycle: number, sender: Account): Tx {
    return this.callPublic(
      "claim-stacking-reward",
      [types.uint(targetCycle)],
      sender.address
    );
  }

  //////////////////////////////////////////////////
  // TOKEN CONFIGURATION
  //////////////////////////////////////////////////

  getCoinbaseThresholds(): ReadOnlyFn {
    return this.callReadOnly("get-coinbase-thresholds");
  }

  //////////////////////////////////////////////////
  // UTILITIES
  //////////////////////////////////////////////////

  //////////////////////////////////////////////////
  // TESTING ONLY
  //////////////////////////////////////////////////

  testSetCityWallet(newCityWallet: Account): Tx {
    return this.callPublic(
      "test-set-city-wallet",
      [types.principal(newCityWallet.address)],
      this.deployer.address
    );
  }

  testSetActivationThreshold(newThreshold: number): Tx {
    return this.callPublic(
      "test-set-activation-threshold",
      [types.uint(newThreshold)],
      this.deployer.address
    );
  }

  testInitializeCore(coreContract: string): Tx {
    return this.callPublic(
      "test-initialize-core",
      [types.principal(coreContract)],
      this.deployer.address
    );
  }

}
