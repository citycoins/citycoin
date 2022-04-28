import { assertEquals, describe, types, run, Chain, beforeEach, it } from "../../../../../deps.ts";
import { Accounts, Context } from "../../../../../src/context.ts";
import { NewYorkCityCoinCoreModelV2 } from "../../../../../models/cities/nyc/newyorkcitycoin-core-v2.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let coreV2: NewYorkCityCoinCoreModelV2;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  coreV2 = ctx.models.get(NewYorkCityCoinCoreModelV2);
});

describe("[NewYorkCityCoin Core v2]", () => {
  //////////////////////////////////////////////////
  // REGISTRATION
  //////////////////////////////////////////////////
  describe("REGISTRATION", () => {
    describe("get-activation-block()", () => {
      it("fails with ERR_CONTRACT_NOT_ACTIVATED if called before contract is activated", () => {
        // act
        const result = coreV2.getActivationBlock().result;

        // assert
        result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_CONTRACT_NOT_ACTIVATED);
      });
      it("succeeds and returns activation height", () => {
        // arrange
        const user = accounts.get("wallet_4")!;
        const block = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(user),
        ]);
        const activationBlockHeight =
          block.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY - 1;
        // act
        const result = coreV2.getActivationBlock().result;
        // assert
        result.expectOk().expectUint(activationBlockHeight);
      });
    });
    describe("get-activation-delay()", () => {
      it("succeeds and returns activation delay", () => {
        // act
        const result = coreV2.getActivationDelay().result;
        // assert
        result.expectUint(NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY);
      });
    });
    describe("get-activation-threshold()", () => {
      it("succeeds and returns activation threshold", () => {
        // act
        const result = coreV2.getActivationThreshold().result;
        // assert
        result.expectUint(NewYorkCityCoinCoreModelV2.ACTIVATION_THRESHOLD);
      });
    });
    describe("get-registered-users-nonce()", () => {
      it("succeeds and returns u0 if no users are registered", () => {
        // act
        const result = coreV2.getRegisteredUsersNonce().result;
        // assert
        result.expectUint(0);
      });
      it("succeeds and returns u1 if one user is registered", () => {
        // arrange
        const user = accounts.get("wallet_5")!;
        chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.registerUser(user)
        ]);
        // act
        const result = coreV2.getRegisteredUsersNonce().result;
        // assert
        result.expectUint(1);
      });
    });
    describe("register-user()", () => {
      it("fails with ERR_UNAUTHORIZED if contracts are not initialized", () => {
        // arrange
        const user = accounts.get("wallet_4")!;

        // act
        const receipt = chain.mineBlock([coreV2.registerUser(user)])
          .receipts[0];

        // assert
        receipt.result.expectErr().expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_UNAUTHORIZED);
      })
      it("succeeds and registers new user and emits print event with memo when supplied", () => {
        // arrange
        const user = accounts.get("wallet_5")!;
        const memo = "hello world";

        // act
        chain.mineBlock([coreV2.testInitializeCore(coreV2.address)])
        const receipt = chain.mineBlock([coreV2.registerUser(user, memo)])
          .receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);
        coreV2.getUserId(user).result.expectSome().expectUint(1);

        assertEquals(receipt.events.length, 4);

        const expectedEvent = {
          type: "contract_event",
          contract_event: {
            contract_identifier: coreV2.address,
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
        chain.mineBlock([coreV2.testInitializeCore(coreV2.address)])
        const receipt = chain.mineBlock([coreV2.registerUser(user)])
          .receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);
        coreV2.getUserId(user).result.expectSome().expectUint(1);

        assertEquals(receipt.events.length, 3);
      });

      it("fails with ERR_USER_ALREADY_REGISTERED while trying to register user a 2nd time", () => {
        // arrange
        const user = accounts.get("wallet_4")!;
        const registerUserTx = coreV2.registerUser(user);
        chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          registerUserTx
        ]);

        // act
        const receipt = chain.mineBlock([registerUserTx]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_USER_ALREADY_REGISTERED);
      });

      it("fails with ERR_ACTIVATION_THRESHOLD_REACHED when user wants to register after reaching activation threshold", () => {
        // arrange
        const user1 = accounts.get("wallet_4")!;
        const user2 = accounts.get("wallet_5")!;
        chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(user1),
        ]);

        // act
        const receipt = chain.mineBlock([coreV2.registerUser(user2)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_ACTIVATION_THRESHOLD_REACHED);
      });
    });
  });
});

run();
