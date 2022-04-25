import { Account, Chain, Tx } from "../deps.ts";

export abstract class Model {
  abstract readonly name: string;
  private contractName: string | undefined;

  constructor(readonly chain: Chain, readonly deployer: Account, contractName?: string | undefined) {
    this.contractName = contractName;
  }

  get address(): string {
    return `${this.deployer.address}.${typeof this.contractName === "string" ? this.contractName : this.name}`;
  }

  callReadOnly(method: string, args: Array<any> = [], sender: string | Account = this.deployer) {
    return this.chain.callReadOnlyFn(this.name, method, args, typeof sender === "string" ? sender : sender.address);
  }

  callPublic(method: string, args: Array<any> = [], sender: string | Account = this.deployer): Tx {
    return Tx.contractCall(this.name, method, args, typeof sender === "string" ? sender : sender.address);
  }
}

export class Models {
  constructor(readonly chain: Chain, readonly deployer: Account) {}

  get<T extends Model>(
    type: { new (chain: Chain, deployer: Account, contractName?: string | undefined): T },
    contractName?: string | undefined
  ): T {
    return new type(this.chain, this.deployer, contractName);
  }
}
