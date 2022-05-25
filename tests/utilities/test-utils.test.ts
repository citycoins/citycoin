import { describe, run, Chain, beforeEach, it, afterEach } from "../../deps.ts";
import { Accounts, Context } from "../../src/context.ts";
import { TestUtilsModel } from "../../models/utilities/test-utils.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let testUtils: TestUtilsModel;

beforeEach(()=>{
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  testUtils = ctx.models.get(TestUtilsModel);
})

afterEach(() => {
  ctx.terminate()
});

describe("[CityCoin Test Utils]", () => {
  describe("test-wallet-attack()", () => {
    it("fails with ERR_UNAUTHORIZED when changing city wallet to a new address", () => {
      //arrange
      const sender = accounts.get("wallet_1")!;

      // act
      const block = chain.mineBlock([
        testUtils.testWalletAttack(sender),
      ]);

      // assert
      block.receipts[0].result.expectErr().expectUint(1000);
    });
  });
  describe("test-wallet-attack-as-contract()", () => {
    it("fails with ERR_UNAUTHORIZED when changing city wallet to a new address as a contract", () => {
      //arrange
      const sender = accounts.get("wallet_1")!;

      // act
      const block = chain.mineBlock([
        testUtils.testWalletAttackAsContract(sender),
      ]);

      // assert
      block.receipts[0].result.expectErr().expectUint(1000);
    });
  });
});

run();
