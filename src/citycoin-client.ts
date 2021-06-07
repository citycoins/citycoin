import { Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.6.0/index.ts';

//used only for better intellisense 
export interface Result {
  session_id: number,
  result: string
  events: []
}

export enum ErrCode {
  ERR_NO_WINNER = 0,
  ERR_NO_SUCH_MINER,
  ERR_IMMATURE_TOKEN_REWARD,
  ERR_UNAUTHORIZED,
  ERR_ALREADY_CLAIMED,
  ERR_STACKING_NOT_AVAILABLE,
  ERR_CANNOT_STACK,
  ERR_INSUFFICIENT_BALANCE,
  ERR_ALREADY_MINED,
  ERR_ROUND_FULL,
  ERR_NOTHING_TO_REDEEM,
  ERR_CANNOT_MINE,
  ERR_MINER_ALREADY_REGISTERED,
  ERR_MINING_ACTIVATION_THRESHOLD_REACHED,
  ERR_MINER_ID_NOT_FOUND,
  ERR_TOO_SMALL_COMMITMENT
}

export const TOKEN_NAME = 'miamicoin';
export const TOKEN_SYMBOL = 'MIA';
export const MINING_HALVING_BLOCKS = 210000;
export const MINING_ACTIVATION_DELAY = 100;
export const FIRST_STACKING_BLOCK = 1 + MINING_ACTIVATION_DELAY;
export const REWARD_CYCLE_LENGTH = 500;
export const CITY_CUSTODIED_WALLET = "STRKQ271SRDWB166VNV4FMXPH3X35YPQ5N192EWN";
export const SPLIT_STACKER_PERCENTAGE = 0.7;
export const SPLIT_CITY_PERCENTAGE = 0.3;

export class CityCoinClient {
  contractName: string = "citycoin"
  chain: Chain;
  deployer: Account;

  constructor(chain: Chain, deployer: Account) {
    this.chain = chain;
    this.deployer = deployer;
  }

  private callReadOnlyFn(method: string, args: Array<any> = [], sender: Account = this.deployer): Result {
    const result = this.chain.callReadOnlyFn(
      this.contractName,
      method,
      args,
      sender?.address
    );

    return result;
  }

  public getContractAddress(): string {
    return `${this.deployer.address}.${this.contractName}`;
  }

  /**
   * Mints token to make testing easier.
   * 
   * @param amount 
   * @param recipient 
   */
  ftMint(amount: number, recipient: Account): Tx {
    return Tx.contractCall(
      this.contractName,
      "ft-mint",
      [
        types.uint(amount),
        types.principal(recipient.address)
      ],
      this.deployer.address
    );
  }

  setMiningActivationThreshold(newThreshold: number): Tx {
    return Tx.contractCall(
      this.contractName,
      "set-mining-activation-threshold",
      [
        types.uint(newThreshold)
      ],
      this.deployer.address
    )
  }

  // read only functions

  getCoinbaseAmount(stacksBlockHeight: number): Result {
    return this.callReadOnlyFn("get-coinbase-amount", [
      types.uint(stacksBlockHeight)
    ]);
  }

  getMinersAtBlock(stacksBlockHeight: number): Result {
    return this.callReadOnlyFn("get-miners-at-block", [
      types.uint(stacksBlockHeight)
    ]);
  }

  getStackedInCycle(miner: Account, rewardCycle: number): Result {
    return this.callReadOnlyFn("get-stacked-in-cycle", [
      types.principal(miner.address),
      types.uint(rewardCycle)
    ]);
  }

  getTokensPerCycle(rewardCycle: number): Result {
    return this.callReadOnlyFn("get-tokens-per-cycle", [
      types.uint(rewardCycle)
    ]);
  }

  getPoxLiteInfo(): Result {
    return this.callReadOnlyFn("get-pox-lite-info");
  }

  getBlockCommitTotal(stacksBlockHeight: number): Result {
    return this.callReadOnlyFn(
      "get-block-commit-total",
      [
        types.uint(stacksBlockHeight)
      ]
    );
  }

  getBlockCommitToStackers(stacksBlockHeight: number): Result {
    return this.callReadOnlyFn(
      "get-block-commit-to-stackers",
      [
        types.uint(stacksBlockHeight)
      ]
    );
  }

  getBlockCommitToCity(stacksBlockHeight: number): Result {
    return this.callReadOnlyFn(
      "get-block-commit-to-city",
      [
        types.uint(stacksBlockHeight)
      ]
    );
  }

  getBlockWinner(stacksBlockHeight: number, randomSampleUint: number): Result {
    return this.callReadOnlyFn(
      "get-block-winner",
      [
        types.uint(stacksBlockHeight),
        types.uint(randomSampleUint),
      ]
    )
  }

  generateMinerId(miner: Account): Tx {
    return Tx.contractCall(
      this.contractName,
      "generate-miner-id",
      [
        types.principal(miner.address)
      ],
      this.deployer.address
    )
  }

  getMinerId(miner: Account): number {
    const result =  this.callReadOnlyFn(
      "get-miner-id",
      [
        types.principal(miner.address)
      ]
    ).result

    const regex = /\(some u(\d+)\)/g;
    const match = regex.exec(result);
    const minerId = (!match) ? 1 : match[1];

    return Number(minerId);
  }

  hasMined(miner: Account, blockHeight: number): Result {
  return this.callReadOnlyFn(
      "has-mined",
      [
        types.uint(this.getMinerId(miner)),
        types.uint(blockHeight)
      ]
    );
  }

  canClaimTokens(
    claimer: Account,
    claimerStacksBlockHeight: number,
    randomSample: number,
    minedBlock: MinedBlock,
    currentStacksBlock: number
  ): Result {
    return this.callReadOnlyFn(
      'can-claim-tokens',
      [
        types.principal(claimer.address),
        types.uint(claimerStacksBlockHeight),
        types.uint(randomSample),
        minedBlock.convert(),
        types.uint(currentStacksBlock)
      ]
    );
  }

  canMineTokens(
    miner: Account,
    minerId: number,
    stacksBlockHeight: number,
    amountUstx: number,
  ): Result {
    return this.callReadOnlyFn(
      "can-mine-tokens",
      [
        types.principal(miner.address),
        types.uint(minerId),
        types.uint(stacksBlockHeight),
        types.uint(amountUstx)
      ]
    );
  }

  canStackTokens(
    stacker: Account,
    amountTokens: number,
    nowStacksHeight: number,
    startStacksHeight: number,
    lockPeriod: number
  ): Result {
    return this.callReadOnlyFn(
      "can-stack-tokens",
      [
        types.principal(stacker.address),
        types.uint(amountTokens),
        types.uint(nowStacksHeight),
        types.uint(startStacksHeight),
        types.uint(lockPeriod)
      ]
    );
  }

  getEntitledStackingReward(
    stacker: Account,
    targetRewardCycle: number,
    currentBlockHeight: number
  ): Result {
    return this.callReadOnlyFn(
      "get-entitled-stacking-reward",
      [
        types.principal(stacker.address),
        types.uint(targetRewardCycle),
        types.uint(currentBlockHeight)
      ],
    )
  }

  getRewardCycle(stacksBlockHeight: number): Result {
    return this.callReadOnlyFn(
      "get-reward-cycle",
      [
        types.uint(stacksBlockHeight)
      ]
    )
  }

  getFirstBlockHeightInRewardCycle(rewardCycle: number): Result {
    return this.callReadOnlyFn(
      "get-first-block-height-in-reward-cycle",
      [
        types.uint(rewardCycle)
      ]
    );
  }

  getRandomUintAtBlock(stacksBlock: number): Result {
    return this.callReadOnlyFn(
      "get-random-uint-at-block",
      [
        types.uint(stacksBlock)
      ]
    );
  }

  // public functions

  stackTokens(amountTokens: number, startStacksHeight: number, lockPeriod: number, sender: Account): Tx {
    return Tx.contractCall(
      this.contractName,
      "stack-tokens",
      [
        types.uint(amountTokens),
        types.uint(startStacksHeight),
        types.uint(lockPeriod)
      ],
      sender.address
    );
  }

  mineTokens(amountUstx: number, sender: Account, memo: ArrayBuffer|undefined = undefined): Tx {
    let memoVal: string;

    if ( typeof memo == "undefined" ) {
      memoVal = types.none();
    } else {
      memoVal = types.some(types.buff(memo));
    }

    return Tx.contractCall(
      this.contractName,
      "mine-tokens",
      [
        types.uint(amountUstx),
        memoVal
      ],
      sender.address
    );
  }

  claimTokenReward(minedStacksBlockHeight: number, sender: Account): Tx {
    return Tx.contractCall(
      this.contractName,
      "claim-token-reward",
      [
        types.uint(minedStacksBlockHeight)
      ],
      sender.address
    );
  }

  claimStackingReward(targetRewardCycle: number, sender: Account): Tx {
    return Tx.contractCall(
      this.contractName,
      "claim-stacking-reward",
      [
        types.uint(targetRewardCycle)
      ],
      sender.address
    );
  }

  registerMiner(sender: Account, memo: ArrayBuffer|undefined = undefined): Tx {
    let memoVal: string;
    
    if ( typeof memo == "undefined" ) {
      memoVal = types.none();
    } else {
      memoVal = types.some(types.buff(memo));
    }
    
    return Tx.contractCall(
      this.contractName,
      "register-miner",
      [
        memoVal
      ],
      sender.address
    )
  }

  setCityWalletUnsafe(cityWallet: Account): Tx {
    return Tx.contractCall(
      this.contractName,
      "set-city-wallet-unsafe",
      [
        types.principal(cityWallet.address)
      ],
      this.deployer.address
    )
  }

  setCityWallet(cityWallet:Account, sender: Account): Tx {
    return Tx.contractCall(
      this.contractName,
      "set-city-wallet",
      [
        types.principal(cityWallet.address)
      ],
      sender.address
    )
  }

  getCityWallet(): Result {
    return this.callReadOnlyFn("get-city-wallet");
  }

  getTotalSupplyUstx(): Result {
    return this.callReadOnlyFn("get-total-supply-ustx");
  }

  setTokenUri(sender: Account, newUri?:string|undefined): Tx {
    let newUriVal: string;

    if ( typeof newUri == "undefined" ) {
      newUriVal = types.none();
    } else {
      newUriVal = types.some(types.utf8(newUri));
    }

    return Tx.contractCall(
      this.contractName,
      "set-token-uri",
      [
        newUriVal
      ],
      sender.address
    )
  }

  // SIP-010 functions

  transfer(amount: number, from: Account, to: Account, sender: Account): Tx {
    return Tx.contractCall(
      this.contractName,
      "transfer",
      [
        types.uint(amount),
        types.principal(from.address),
        types.principal(to.address),
        types.none()
      ],
      sender.address
    );
  }

  getName(): Result {
    return this.callReadOnlyFn("get-name");
  }

  getSymbol(): Result {
    return this.callReadOnlyFn("get-symbol");
  }

  getDecimals(): Result {
    return this.callReadOnlyFn("get-decimals");
  }

  getBalance(user: Account): Result {
    return this.callReadOnlyFn("get-balance", [
      types.principal(user.address)
    ])
  }

  getTotalSupply(): Result {
    return this.callReadOnlyFn("get-total-supply");
  }

  getTokenUri(): Result {
    return this.callReadOnlyFn("get-token-uri");
  }
}

export class MinedBlock {

  minersCount: number;
  leastCommitmentIdx: number;
  leastCommitmentUstx: number;
  claimed: boolean;

  constructor(minersCount: number, leastCommitmentIdx: number, leastCommitmentUstx: number, claimed: boolean) {
    this.minersCount = minersCount;
    this.leastCommitmentIdx = leastCommitmentIdx;
    this.leastCommitmentUstx = leastCommitmentUstx;
    this.claimed = claimed;
  }

  convert(): string {
    return types.tuple({
      "miners-count": types.uint(this.minersCount),
      "least-commitment-idx": types.uint(this.leastCommitmentIdx),
      "least-commitment-ustx": types.uint(this.leastCommitmentUstx),
      "claimed": types.bool(this.claimed)
    })
  }

}

export interface MinerCommit {
  miner: Account,
  minerId: number,
  amountUstx: number
}

export class MinersList extends Array<MinerCommit> {
  convert(): string {
    if (this.length > 128) {
      throw new Error("Miners list can't have more than 128 elements.")
    }

    let miners = this.map(minerCommit => {
      return types.tuple({
        "miner-id": types.uint(minerCommit.minerId),
        "amount-ustx": types.uint(minerCommit.amountUstx)
      });
    });

    return types.list(miners)
  }

  getFormatted(index: number) {
    let item = this[index];
    return {
      "miner-id": types.uint(item.minerId),
      "ustx": types.uint(item.amountUstx)
    }
  }
}

export class MinersRec {
  miners: MinersList;
  claimed: boolean;
  leastCommitment?: MinerCommit;

  constructor(miners: MinersList, claimed: boolean, leastCommitment?: MinerCommit) {
    this.claimed = claimed;
    this.miners = miners;

    if( typeof leastCommitment !== "undefined")
    {
      this.leastCommitment = leastCommitment;
    }
  }

  convert(): string {
    let leastCommitment;
    if(this.leastCommitment !== undefined) {
      leastCommitment = types.some(types.tuple({
        "miner-id": types.uint(this.leastCommitment.minerId),
        "amount-ustx": types.uint(this.leastCommitment.amountUstx)
      }))
    } else {
      leastCommitment = types.none();
    }

    return types.tuple({
      miners: this.miners.convert(),
      claimed: types.bool(this.claimed),
      "least-commitment": leastCommitment
    })
  }
}