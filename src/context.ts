import { Account, Chain, Tx } from "../deps.ts";
import { Models } from "./model.ts";

export class Accounts extends Map<string, Account> {}

export class Context {
  readonly chain: Chain;
  readonly accounts: Accounts;
  readonly contracts: Map<string, any>;
  readonly models: Models;
  readonly deployer: Account;

  constructor(preSetupTx?: Array<Tx>) {
    (Deno as any).core.ops();

    let result = JSON.parse(
      (Deno as any).core.opSync("api/v1/new_session", {
        name: "test",
        loadDeployment: true,
        deploymentPath: null,
      })
    );
    this.chain = new Chain(result["session_id"]);
    this.accounts = new Map();
    for (let account of result["accounts"]) {
      this.accounts.set(account.name, account);
    }
    this.contracts = new Map();
    for (let contract of result["contracts"]) {
      this.contracts.set(contract.contract_id, contract);
    }

    this.deployer = this.accounts.get("deployer")!;

    this.models = new Models(this.chain, this.deployer);
  }

  terminate() {
    JSON.parse(
      (Deno as any).core.opSync("api/v1/terminate_session", {
        sessionId: this.chain.sessionId,
      })
    );
  }
}
