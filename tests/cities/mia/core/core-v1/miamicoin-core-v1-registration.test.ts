import { assertEquals, describe, types, run, Chain, beforeEach, it, afterEach } from "../../../../../deps.ts";
import { Accounts, Context } from "../../../../../src/context.ts";
import { MiamiCoinCoreModel } from "../../../../../models/cities/mia/miamicoin-core.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let core: MiamiCoinCoreModel;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  core = ctx.models.get(MiamiCoinCoreModel, "miamicoin-core-v1");
});

afterEach(() => {
  ctx.terminate()
});

describe("[MiamiCoin Core]", () => {
  //////////////////////////////////////////////////
  // REGISTRATION
  //////////////////////////////////////////////////
  describe("REGISTRATION", () => {
    describe("get-activation-block()", () => {
      it("fails with ERR_CONTRACT_NOT_ACTIVATED if called before contract is activated", () => {
        // act
        const result = core.getActivationBlock().result;

        // assert
        result
          .expectErr()
          .expectUint(MiamiCoinCoreModel.ErrCode.ERR_CONTRACT_NOT_ACTIVATED);
      });
      it("succeeds and returns activation height", () => {
        // arrange
        const user = accounts.get("wallet_4")!;
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(user),
        ]);
        const activationBlockHeight =
          block.height + MiamiCoinCoreModel.ACTIVATION_DELAY - 1;

        // act
        const result = core.getActivationBlock().result;

        // assert
        result.expectOk().expectUint(activationBlockHeight);
      });
    });
    describe("get-activation-delay()", () => {
      it("succeeds and returns activation delay", () => {
        // act
        const result = core.getActivationDelay().result;
        // assert
        result.expectUint(MiamiCoinCoreModel.ACTIVATION_DELAY);
      });
    });
    describe("get-activation-threshold()", () => {
      it("succeeds and returns activation threshold", () => {
        // act
        const result = core.getActivationThreshold().result;
        // assert
        result.expectUint(MiamiCoinCoreModel.ACTIVATION_THRESHOLD);
      });
    });
    describe("get-registered-users-nonce()", () => {
      it("succeeds and returns u0 if no users are registered", () => {
        // act
        const result = core.getRegisteredUsersNonce().result;
        // assert
        result.expectUint(0);
      });
      it("succeeds and returns u1 if one user is registered", () => {
        // arrange
        const user = accounts.get("wallet_5")!;
        chain.mineBlock([
          core.testInitializeCore(core.address),
          core.registerUser(user)
        ]);
        // act
        const result = core.getRegisteredUsersNonce().result;
        // assert
        result.expectUint(1);
      });
    });
    describe("register-user()", () => {
      it("fails with ERR_UNAUTHORIZED if contracts are not initialized", () => {
        // arrange
        const user = accounts.get("wallet_4")!;

        // act
        const receipt = chain.mineBlock([core.registerUser(user)])
          .receipts[0];

        // assert
        receipt.result.expectErr().expectUint(MiamiCoinCoreModel.ErrCode.ERR_UNAUTHORIZED);
      })
      it("succeeds and registers new user and emits print event with memo when supplied", () => {
        // arrange
        const user = accounts.get("wallet_5")!;
        const memo = "hello world";

        // act
        chain.mineBlock([core.testInitializeCore(core.address)])
        const receipt = chain.mineBlock([core.registerUser(user, memo)])
          .receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);
        core.getUserId(user).result.expectSome().expectUint(1);

        assertEquals(receipt.events.length, 1);

        const expectedEvent = {
          type: "contract_event",
          contract_event: {
            contract_identifier: core.address,
            topic: "print",
            value: types.some(types.utf8(memo)),
          },
        };

        assertEquals(receipt.events[0], expectedEvent);
      });

      it("succeeds and registers new user and does not emit any events when memo is not supplied", () => {
        // arrange
        const user = accounts.get("wallet_4")!;

        // act
        chain.mineBlock([core.testInitializeCore(core.address)])
        const receipt = chain.mineBlock([core.registerUser(user)])
          .receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);
        core.getUserId(user).result.expectSome().expectUint(1);

        assertEquals(receipt.events.length, 0);
      });

      it("fails with ERR_USER_ALREADY_REGISTERED while trying to register user a 2nd time", () => {
        // arrange
        const user = accounts.get("wallet_4")!;
        const registerUserTx = core.registerUser(user);
        chain.mineBlock([
          core.testInitializeCore(core.address),
          registerUserTx
        ]);

        // act
        const receipt = chain.mineBlock([registerUserTx]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(MiamiCoinCoreModel.ErrCode.ERR_USER_ALREADY_REGISTERED);
      });

      it("fails with ERR_ACTIVATION_THRESHOLD_REACHED when user wants to register after reaching activation threshold", () => {
        // arrange
        const user1 = accounts.get("wallet_4")!;
        const user2 = accounts.get("wallet_5")!;
        chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(user1),
        ]);

        // act
        const receipt = chain.mineBlock([core.registerUser(user2)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(MiamiCoinCoreModel.ErrCode.ERR_ACTIVATION_THRESHOLD_REACHED);
      });
    });
  });
});

run();
