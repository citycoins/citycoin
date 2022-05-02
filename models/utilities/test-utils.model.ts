import { Account, Tx } from "../../deps.ts";
import { Model } from "../../src/model.ts";

export class TestUtilsModel extends Model {
  name = "test-utils";

  testWalletAttack(sender: Account) {
    return this.callPublic(
      "test-wallet-attack",
      [],
      sender.address
    );
  }

  testWalletAttackAsContract(sender: Account) {
    return this.callPublic(
      "test-wallet-attack-as-contract",
      [],
      sender.address
    );
  }
}
