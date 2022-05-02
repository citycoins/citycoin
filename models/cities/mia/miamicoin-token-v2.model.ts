import { Account, ReadOnlyFn, Tx, types } from "../../../deps.ts";
import { Model } from "../../../src/model.ts";

enum ErrCode {
  ERR_UNAUTHORIZED = 2000,
  ERR_TOKEN_NOT_ACTIVATED,
  ERR_TOKEN_ALREADY_ACTIVATED,
  ERR_V1_BALANCE_NOT_FOUND,
  ERR_CORE_CONTRACT_NOT_FOUND = 6009,
}

export class MiamiCoinTokenModelV2 extends Model {
  name = "miamicoin-token-v2";
  static readonly ErrCode = ErrCode;
  static readonly MICRO_CITYCOINS = 1000000;

  //////////////////////////////////////////////////
  // SIP-010 FUNCTIONS
  //////////////////////////////////////////////////

  transfer(
    amount: number,
    from: Account,
    to: Account,
    sender: Account,
    memo: ArrayBuffer | undefined = undefined
  ): Tx {
    let memoVal: string;

    if (typeof memo == "undefined") {
      memoVal = types.none();
    } else {
      memoVal = types.some(types.buff(memo));
    }

    return this.callPublic(
      "transfer",
      [
        types.uint(amount),
        types.principal(from.address),
        types.principal(to.address),
        memoVal,
      ],
      sender.address
    );
  }

  getName(): ReadOnlyFn {
    return this.callReadOnly("get-name");
  }

  getSymbol(): ReadOnlyFn {
    return this.callReadOnly("get-symbol");
  }

  getDecimals(): ReadOnlyFn {
    return this.callReadOnly("get-decimals");
  }

  getBalance(user: Account): ReadOnlyFn {
    return this.callReadOnly("get-balance", [types.principal(user.address)]);
  }

  getTotalSupply(): ReadOnlyFn {
    return this.callReadOnly("get-total-supply");
  }

  getTokenUri(): ReadOnlyFn {
    return this.callReadOnly("get-token-uri");
  }

  //////////////////////////////////////////////////
  // TOKEN CONFIGURATION
  //////////////////////////////////////////////////

  activateToken(sender: Account, stacksHeight: number): Tx {
    return this.callPublic(
      "activate-token",
      [types.principal(sender.address), types.uint(stacksHeight)],
      sender.address
    );
  }

  //////////////////////////////////////////////////
  // UTILITIES
  //////////////////////////////////////////////////

  setTokenUri(sender: Account, newUri?: string | undefined): Tx {
    let newUriVal: string;

    if (typeof newUri == "undefined") {
      newUriVal = types.none();
    } else {
      newUriVal = types.some(types.utf8(newUri));
    }

    return this.callPublic(
      "set-token-uri",
      [newUriVal],
      sender.address
    );
  }

  mint(amount: number, recipient: Account, sender: Account): Tx {
    return this.callPublic(
      "mint",
      [types.uint(amount), types.principal(recipient.address)],
      sender.address
    );
  }

  burn(amount: number, owner: Account, sender: Account): Tx {
    return this.callPublic(
      "burn",
      [types.uint(amount), types.principal(owner.address)],
      sender.address
    );
  }

  convertToV2(sender: Account): Tx {
    return this.callPublic("convert-to-v2", [], sender.address);
  }

  getCoinbaseThresholds(): ReadOnlyFn {
    return this.callReadOnly("get-coinbase-thresholds");
  }

  updateCoinbaseThresholds(sender: Account, threshold1: number, threshold2: number, threshold3: number, threshold4: number, threshold5: number): Tx {
    return this.callPublic(
      "update-coinbase-thresholds",
      [
        types.uint(threshold1),
        types.uint(threshold2),
        types.uint(threshold3),
        types.uint(threshold4),
        types.uint(threshold5),
      ],
      sender.address
    );
  }

  getCoinbaseAmounts(): ReadOnlyFn {
    return this.callReadOnly("get-coinbase-amounts");
  }

  updateCoinbaseAmounts(sender: Account, amountBonus: number, amount1: number, amount2: number, amount3: number, amount4: number, amount5: number, amountDefault: number): Tx {
    return this.callPublic(
      "update-coinbase-amounts",
      [
        types.uint(amountBonus),
        types.uint(amount1),
        types.uint(amount2),
        types.uint(amount3),
        types.uint(amount4),
        types.uint(amount5),
        types.uint(amountDefault),
      ],
      sender.address
    );
  }

  //////////////////////////////////////////////////
  // TESTING ONLY
  //////////////////////////////////////////////////

  /**
   * Mints token to make testing easier.
   *
   * @param amount
   * @param recipient
   */
  testMint(amount: number, recipient: Account): Tx {
    return this.callPublic(
      "test-mint",
      [types.uint(amount), types.principal(recipient.address)],
      this.deployer.address
    );
  }

  //////////////////////////////////////////////////
  // SEND-MANY
  //////////////////////////////////////////////////

  sendMany(recipients: Array<SendManyRecord>, sender: Account): Tx {
    return this.callPublic(
      "send-many",
      [
        types.list(
          recipients.map((record) => {
            return types.tuple({
              to: types.principal(record.to.address),
              amount: types.uint(record.amount),
              memo:
                typeof record.memo == "undefined"
                  ? types.none()
                  : types.some(types.buff(record.memo)),
            });
          })
        ),
      ],
      sender.address
    );
  }
}

export class SendManyRecord {
  constructor(
    readonly to: Account,
    readonly amount: number,
    readonly memo?: ArrayBuffer | undefined
  ) {}
}
