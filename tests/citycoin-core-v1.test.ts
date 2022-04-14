import { assertEquals, describe, TxReceipt, types, run, Chain, beforeEach, it } from "../deps.ts";
import { CoreModel } from "../models/core.model.ts";
import { TokenModel } from "../models/token.model.ts";
import { Accounts, Context } from "../src/context.ts";


let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let core: CoreModel;
let token: TokenModel;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  core = ctx.models.get(CoreModel);
  token = ctx.models.get(TokenModel);
});

describe("[CityCoin Core]", () => {
  //////////////////////////////////////////////////
  // CITY WALLET MANAGEMENT
  //////////////////////////////////////////////////

  describe("CITY WALLET MANAGEMENT", () => {
    describe("get-city-wallet()", () => {
      it("succeeds and returns current city wallet variable as contract address before initialization", () => {
        // arrange
        const result = core.getCityWallet().result;

        // assert
        result.expectPrincipal(core.address);
      });
      it("succeeds and returns current city wallet variable as city wallet address after initialization", () => {
        // arrange
        const cityWallet = accounts.get("city_wallet")!;
        chain.mineBlock([
          core.testInitializeCore(core.address),
        ]);

        const result = core.getCityWallet().result;

        // assert
        result.expectPrincipal(cityWallet.address);
      });
    });
    describe("set-city-wallet()", () => {
      it("fails with ERR_UNAUTHORIZED when called by non-city wallet", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;

        // act
        const receipt = chain.mineBlock([
          core.setCityWallet(wallet, wallet),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_UNAUTHORIZED);
      });
    });
  });

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
          .expectUint(CoreModel.ErrCode.ERR_CONTRACT_NOT_ACTIVATED);
      });
      it("succeeds and returns activation height", () => {
        // arrange
        const user = accounts.get("wallet_4")!;
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(user),
        ]);
        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;

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
        result.expectUint(CoreModel.ACTIVATION_DELAY);
      });
    });
    describe("get-activation-threshold()", () => {
      it("succeeds and returns activation threshold", () => {
        // act
        const result = core.getActivationThreshold().result;
        // assert
        result.expectUint(CoreModel.ACTIVATION_THRESHOLD);
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
        receipt.result.expectErr().expectUint(CoreModel.ErrCode.ERR_UNAUTHORIZED);
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
          .expectUint(CoreModel.ErrCode.ERR_USER_ALREADY_REGISTERED);
      });

      it("fails with ERR_ACTIVATION_THRESHOLD_REACHED when user wants to register after reaching activation threshold", () => {
        // arrange
        const user1 = accounts.get("wallet_4")!;
        const user2 = accounts.get("wallet_5")!;
        chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(user1),
        ]);

        // act
        const receipt = chain.mineBlock([core.registerUser(user2)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_ACTIVATION_THRESHOLD_REACHED);
      });
    });
  });

  //////////////////////////////////////////////////
  // MINING CONFIGURATION
  //////////////////////////////////////////////////

  describe("MINING CONFIGURATION", () => {
    describe("get-block-winner-id()", () => {
      it("succeeds and returns none if winner is unknown at the block height", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const miner2 = accounts.get("wallet_3")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
          core.registerUser(miner2),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([
          core.mineTokens(amount, miner),
          core.mineTokens(amount * 1000, miner2),
        ]);
        chain.mineEmptyBlock(CoreModel.TOKEN_REWARD_MATURITY);

        // act
        const result = core.getBlockWinnerId(block.height).result;

        // assert
        result.expectNone();
      });
      it("succeeds and returns block winner ID if winner claimed at the block height", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const miner2 = accounts.get("wallet_3")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
          core.registerUser(miner2),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([
          core.mineTokens(amount, miner),
          core.mineTokens(amount * 1000, miner2),
        ]);
        chain.mineEmptyBlock(CoreModel.TOKEN_REWARD_MATURITY);
        chain.mineBlock([
          core.claimMiningReward(block.height - 1, miner2),
        ]);
        // act
        const result = core.getBlockWinnerId(block.height - 1).result;

        // assert
        result.expectSome().expectUint(2);
      });
    });
  });

  //////////////////////////////////////////////////
  // MINING ACTIONS
  //////////////////////////////////////////////////

  describe("MINING ACTIONS", () => {
    describe("mine-tokens()", () => {
      it("fails with ERR_CONTRACT_NOT_ACTIVATED while trying to mine before reaching activation threshold", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amountUstx = 200;

        // act
        const receipt = chain.mineBlock([
          core.mineTokens(amountUstx, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_CONTRACT_NOT_ACTIVATED);
      });

      it("fails with ERR_INSUFFICIENT_COMMITMENT while trying to mine with 0 commitment", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amountUstx = 0;
        chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);

        // act
        const receipt = chain.mineBlock([
          core.mineTokens(amountUstx, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_INSUFFICIENT_COMMITMENT);
      });

      it("fails with ERR_INSUFFICIENT_BALANCE while trying to mine with commitment larger than current balance", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amountUstx = miner.balance + 1;
        chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);

        // act
        const receipt = chain.mineBlock([
          core.mineTokens(amountUstx, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_INSUFFICIENT_BALANCE);
      });

      it("fails with ERR_STACKING_NOT_VAILABLE while trying to mine before the activation period ends", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amountUstx = 200;
        chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);

        // act
        const receipt = chain.mineBlock([
          core.mineTokens(amountUstx, miner),
        ]).receipts[0];

        //assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_STACKING_NOT_AVAILABLE);
      });

      it("succeeds and emits one stx_transfer event to city wallet during first cycle", () => {
        // arrange
        const cityWallet = accounts.get("city_wallet")!;
        const miner = accounts.get("wallet_2")!;
        const amountUstx = 200;
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetCityWallet(cityWallet),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          block.height + CoreModel.ACTIVATION_DELAY - 1
        );

        // act
        const receipt = chain.mineBlock([
          core.mineTokens(amountUstx, miner),
        ]).receipts[0];

        //assert
        receipt.result.expectOk().expectBool(true);
        assertEquals(receipt.events.length, 1);
        receipt.events.expectSTXTransferEvent(
          amountUstx,
          miner.address,
          cityWallet.address
        );
      });

      it("succeeds and emits one stx_transfer event to city wallet and one to stacker while mining in cycle with stackers", () => {
        // arrange
        const cityWallet = accounts.get("city_wallet")!;
        const miner = accounts.get("wallet_2")!;
        const amountUstx = 200;
        const amountTokens = 500;
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetCityWallet(cityWallet),
          token.ftMint(amountTokens, miner),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);

        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        const cycle1FirstBlockHeight =
          activationBlockHeight + CoreModel.REWARD_CYCLE_LENGTH;

        chain.mineEmptyBlockUntil(activationBlockHeight);
        chain.mineBlock([core.stackTokens(amountTokens, 1, miner)]);
        chain.mineEmptyBlockUntil(cycle1FirstBlockHeight);

        // act
        const receipt = chain.mineBlock([
          core.mineTokens(amountUstx, miner),
        ]).receipts[0];

        //assert
        receipt.result.expectOk().expectBool(true);
        assertEquals(receipt.events.length, 2);

        receipt.events.expectSTXTransferEvent(
          amountUstx * CoreModel.SPLIT_CITY_PCT,
          miner.address,
          cityWallet.address
        );

        receipt.events.expectSTXTransferEvent(
          amountUstx * (1 - CoreModel.SPLIT_CITY_PCT),
          miner.address,
          core.address
        );
      });

      it("succeeds and prints memo when supplied", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amountUstx = 200;
        const memo = new TextEncoder().encode("hello world");
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);

        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const receipt = chain.mineBlock([
          core.mineTokens(amountUstx, miner, memo),
        ]).receipts[0];

        //assert
        receipt.result.expectOk().expectBool(true);
        assertEquals(receipt.events.length, 2);

        const expectedEvent = {
          type: "contract_event",
          contract_event: {
            contract_identifier: core.address,
            topic: "print",
            value: types.some(types.buff(memo)),
          },
        };

        assertEquals(receipt.events[0], expectedEvent);
      });

      it("fails with ERR_USER_ALREADY_MINED while trying to mine same block 2nd time", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amountUstx = 200;
        const memo = new TextEncoder().encode("hello world");
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);

        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const mineTokensTx = core.mineTokens(amountUstx, miner, memo);
        const receipts = chain.mineBlock([mineTokensTx, mineTokensTx]).receipts;

        //assert
        receipts[0].result.expectOk().expectBool(true);
        receipts[1].result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_USER_ALREADY_MINED);
      });
    });

    describe("mine-many()", () => {
      it("fails with ERR_CONTRACT_NOT_ACTIVATED while trying to mine before reaching activation threshold", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amounts = [1, 2, 3, 4];

        // act
        const receipt = chain.mineBlock([core.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_CONTRACT_NOT_ACTIVATED);
      });

      it("fails with ERR_STACKING_NOT_AVAILABLE while trying to mine before activation period ends", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [1, 2, 3, 4];
        chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);

        // act
        const receipt = chain.mineBlock([core.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_STACKING_NOT_AVAILABLE);
      });

      it("fails with ERR_INSUFFICIENT_COMMITMENT while providing empty list of amounts", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts: number[] = [];
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1
        );

        // act
        const receipt = chain.mineBlock([core.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_INSUFFICIENT_COMMITMENT);
      });

      it("fails with ERR_INSUFFICIENT_COMMITMENT while providing list of amounts filled with 0", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [0, 0, 0, 0];
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1
        );

        // act
        const receipt = chain.mineBlock([core.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_INSUFFICIENT_COMMITMENT);
      });

      it("fails with ERR_INSUFFICIENT_COMMITMENT while providing list of amounts with one or more 0s", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [1, 2, 3, 4, 0, 5, 6, 7];
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1
        );

        // act
        const receipt = chain.mineBlock([core.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_INSUFFICIENT_COMMITMENT);
      });

      it("fails with ERR_INSUFFICIENT_BALANCE when sum of all commitments > miner balance", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [1, miner.balance];
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1
        );

        // act
        const receipt = chain.mineBlock([core.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_INSUFFICIENT_BALANCE);
      });

      it("fails with ERR_USER_ALREADY_MINED when call overlaps already mined blocks", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [1, 2];
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1
        );
        chain.mineBlock([core.mineMany(amounts, miner)]);

        // act
        const receipt = chain.mineBlock([core.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_USER_ALREADY_MINED);
      });

      it("succeeds and emits one stx_transfer event when amounts list has only one value and there are no stackers", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [1];
        const cityWallet = accounts.get("city_wallet")!;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1
        );

        // act
        const receipt = chain.mineBlock([core.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 2);

        receipt.events.expectSTXTransferEvent(
          amounts.reduce((sum, amount) => sum + amount, 0),
          miner.address,
          cityWallet.address
        );
      });

      it("succeeds and emits one stx_transfer event when amounts list has multiple values and there are no stackers", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [1, 2, 200, 89, 3423];
        const cityWallet = accounts.get("city_wallet")!;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1
        );

        // act
        const receipt = chain.mineBlock([core.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 2);

        receipt.events.expectSTXTransferEvent(
          amounts.reduce((sum, amount) => sum + amount, 0),
          miner.address,
          cityWallet.address
        );
      });

      it("succeeds and emits 2 stx_transfer events when amounts list has only one value and there is at least one stacker", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [10000];
        const cityWallet = accounts.get("city_wallet")!;
        const amountTokens = 500;
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetCityWallet(cityWallet),
          token.ftMint(amountTokens, miner),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);

        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        const cycle1FirstBlockHeight =
          activationBlockHeight + CoreModel.REWARD_CYCLE_LENGTH;

        chain.mineEmptyBlockUntil(activationBlockHeight);
        chain.mineBlock([core.stackTokens(amountTokens, 1, miner)]);
        chain.mineEmptyBlockUntil(cycle1FirstBlockHeight);

        // act
        const receipt = chain.mineBlock([core.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 3);

        const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0);

        receipt.events.expectSTXTransferEvent(
          totalAmount * CoreModel.SPLIT_CITY_PCT,
          miner.address,
          cityWallet.address
        );

        receipt.events.expectSTXTransferEvent(
          totalAmount * (1 - CoreModel.SPLIT_CITY_PCT),
          miner.address,
          core.address
        );
      });

      it("succeeds and emits 2 stx_transfer events when amounts list has multiple values and there is at least one stacker", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [100, 200, 300];
        const cityWallet = accounts.get("city_wallet")!;
        const amountTokens = 500;
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetCityWallet(cityWallet),
          token.ftMint(amountTokens, miner),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);

        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        const cycle1FirstBlockHeight =
          activationBlockHeight + CoreModel.REWARD_CYCLE_LENGTH;

        chain.mineEmptyBlockUntil(activationBlockHeight);
        chain.mineBlock([core.stackTokens(amountTokens, 1, miner)]);
        chain.mineEmptyBlockUntil(cycle1FirstBlockHeight);

        // act
        const receipt = chain.mineBlock([core.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 3);

        const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0);

        receipt.events.expectSTXTransferEvent(
          totalAmount * CoreModel.SPLIT_CITY_PCT,
          miner.address,
          cityWallet.address
        );

        receipt.events.expectSTXTransferEvent(
          totalAmount * (1 - CoreModel.SPLIT_CITY_PCT),
          miner.address,
          core.address
        );
      });

      it("succeeds and saves information that miner mined multiple consecutive blocks", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [1, 2, 200, 89, 3423];
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1
        );

        // act
        const block = chain.mineBlock([core.mineMany(amounts, miner)]);

        // assert
        const userId = 1;

        amounts.forEach((amount, idx) => {
          core
            .hasMinedAtBlock(block.height + idx - 1, userId)
            .result.expectBool(true);
        });
      });

      it("succeeds and prints tuple with firstBlock and lastBlock when mining only one block", () => {
        const miner = accounts.get("wallet_6")!;
        const amounts = [123];
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(setupBlock.height + CoreModel.ACTIVATION_DELAY - 1);

        // act
        const block = chain.mineBlock([core.mineMany(amounts, miner)]);

        // assert
        const firstBlock = block.height - 1;
        const lastBlock = firstBlock + amounts.length - 1;
        const expectedPrintMsg = `{firstBlock: ${types.uint(firstBlock)}, lastBlock: ${types.uint(lastBlock)}}`;

        block.receipts[0].events.expectPrintEvent(core.address, expectedPrintMsg);
      });

      it("succeeds and prints tuple with firstBlock and lastBlock when mining multiple blocks", () => {
        const miner = accounts.get("wallet_6")!;
        const amounts = [1, 2, 5, 60];
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(setupBlock.height + CoreModel.ACTIVATION_DELAY + 145);

        // act
        const block = chain.mineBlock([core.mineMany(amounts, miner)]);

        // assert
        const firstBlock = block.height - 1;
        const lastBlock = firstBlock + amounts.length - 1;
        const expectedPrintMsg = `{firstBlock: ${types.uint(firstBlock)}, lastBlock: ${types.uint(lastBlock)}}`;

        block.receipts[0].events.expectPrintEvent(core.address, expectedPrintMsg);
      });
    });
  });

  //////////////////////////////////////////////////
  // MINING REWARD CLAIM ACTIONS
  //////////////////////////////////////////////////

  describe("MINING REWARD CLAIM ACTIONS", () => {
    describe("claim-mining-reward()", () => {
      it("fails with ERR_USER_NOT_FOUND when called by non-registered user or user who didn't mine at all", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;

        // act
        const receipt = chain.mineBlock([
          core.claimMiningReward(0, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_USER_ID_NOT_FOUND);
      });

      it("fails with ERR_NO_MINERS_AT_BLOCK when called with block height at which nobody decided to mine", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        chain.mineBlock([])
        chain.mineBlock([
          core.testInitializeCore(core.address),
          core.registerUser(miner)
        ]);

        // act
        const receipt = chain.mineBlock([
          core.claimMiningReward(0, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_NO_MINERS_AT_BLOCK);
      });

      it("fails with ERR_USER_DID_NOT_MINE_IN_BLOCK when called by user who didn't mine specific block", () => {
        // arrange
        const otherMiner = accounts.get("wallet_4")!;
        const miner = accounts.get("wallet_2")!;
        const amount = 2000;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([
          core.mineTokens(amount, otherMiner),
        ]);

        // act
        const receipt = chain.mineBlock([
          core.claimMiningReward(block.height - 1, miner),
        ]);

        // assert
        receipt.receipts[0].result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_USER_DID_NOT_MINE_IN_BLOCK);
      });

      it("fails with ERR_CLAIMED_BEFORE_MATURITY when called before maturity window passes", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2000;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([core.mineTokens(amount, miner)]);

        // act
        const receipt = chain.mineBlock([
          core.claimMiningReward(block.height - 1, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_CLAIMED_BEFORE_MATURITY);
      });

      it("fails with ERR_REWARD_ALREADY_CLAIMED when trying to claim rewards a 2nd time", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2000;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(CoreModel.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          core.claimMiningReward(block.height - 1, miner),
          core.claimMiningReward(block.height - 1, miner),
        ]).receipts[1];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_REWARD_ALREADY_CLAIMED);
      });

      it("fails with ERR_MINER_DID_NOT_WIN when trying to claim reward owed to someone else", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const otherMiner = accounts.get("wallet_3")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([
          core.mineTokens(amount, miner),
          core.mineTokens(amount * 10000, otherMiner),
        ]);
        chain.mineEmptyBlock(CoreModel.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          core.claimMiningReward(block.height - 1, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_MINER_DID_NOT_WIN);
      });

      it("succeeds and mints 250000 tokens in 1st issuance cycle, during bonus period", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(CoreModel.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          core.claimMiningReward(block.height - 1, miner),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);

        receipt.events.expectFungibleTokenMintEvent(
          250000,
          miner.address,
          "citycoins"
        );
      });

      it("succeeds and mints 100000 tokens in 1st issuance cycle, after bonus period", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(
          activationBlockHeight + CoreModel.BONUS_PERIOD_LENGTH + 1
        );

        const block = chain.mineBlock([core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(CoreModel.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          core.claimMiningReward(block.height - 1, miner),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);

        receipt.events.expectFungibleTokenMintEvent(
          100000,
          miner.address,
          "citycoins"
        );
      });

      it("succeeds and mints 50000 tokens in 2nd issuance cycle", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(
          activationBlockHeight + CoreModel.TOKEN_HALVING_BLOCKS + 1
        );

        const block = chain.mineBlock([core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(CoreModel.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          core.claimMiningReward(block.height - 1, miner),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);

        receipt.events.expectFungibleTokenMintEvent(
          50000,
          miner.address,
          "citycoins"
        );
      });

      it("succeeds and mints 25000 tokens in 3rd issuance cycle", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(
          activationBlockHeight + CoreModel.TOKEN_HALVING_BLOCKS * 2 + 1
        );

        const block = chain.mineBlock([core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(CoreModel.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          core.claimMiningReward(block.height - 1, miner),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);

        receipt.events.expectFungibleTokenMintEvent(
          25000,
          miner.address,
          "citycoins"
        );
      });

      it("succeeds and mints 12500 tokens in 4th issuance cycle", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(
          activationBlockHeight + CoreModel.TOKEN_HALVING_BLOCKS * 3 + 1
        );

        const block = chain.mineBlock([core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(CoreModel.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          core.claimMiningReward(block.height - 1, miner),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);

        receipt.events.expectFungibleTokenMintEvent(
          12500,
          miner.address,
          "citycoins"
        );
      });

      it("succeeds and mints 6250 tokens in 5th issuance cycle", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(
          activationBlockHeight + CoreModel.TOKEN_HALVING_BLOCKS * 4 + 1
        );

        const block = chain.mineBlock([core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(CoreModel.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          core.claimMiningReward(block.height - 1, miner),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);

        receipt.events.expectFungibleTokenMintEvent(
          6250,
          miner.address,
          "citycoins"
        );
      });

      it("succeeds and mints 3125 tokens in final issuance cycle", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(
          activationBlockHeight + CoreModel.TOKEN_HALVING_BLOCKS * 5 + 1
        );

        const block = chain.mineBlock([core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(CoreModel.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          core.claimMiningReward(block.height - 1, miner),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);

        receipt.events.expectFungibleTokenMintEvent(
          3125,
          miner.address,
          "citycoins"
        );
      });
    });

    describe("is-block-winner()", () => {
      it("succeeds and returns false when user is unknown", () => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const minerBlockHeight = 1;

        // act
        const result = core.isBlockWinner(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
      });

      it("succeeds and returns false when selected block has not been mined by anyone", () => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const minerBlockHeight = 1;
        chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(user),
        ]);

        // act
        const result = core.isBlockWinner(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
      });

      it("succeeds and returns false when user didn't mine selected block", () => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const user2 = accounts.get("wallet_2")!;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight = chain.mineBlock([
          core.mineTokens(200, user2),
        ]).height;

        // act
        const result = core.isBlockWinner(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
      });

      it("succeeds and returns false when user mined selected block, but maturity window has not passed", () => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([core.mineTokens(200, user)]).height - 1;

        // act
        const result = core.isBlockWinner(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
      });

      it("succeeds and returns false when user mined selected block, but another user won it", () => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const user2 = accounts.get("wallet_2")!;

        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([
            core.mineTokens(1, user),
            core.mineTokens(200000, user2),
          ]).height - 1;

        chain.mineEmptyBlockUntil(
          minerBlockHeight + CoreModel.TOKEN_REWARD_MATURITY + 1
        );

        // act
        const result = core.isBlockWinner(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
        core
          .isBlockWinner(user2, minerBlockHeight)
          .result.expectBool(true);
      });

      it("succeeds and returns true when user mined selected block and won it", () => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const user2 = accounts.get("wallet_2")!;

        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([
            core.mineTokens(200000, user),
            core.mineTokens(1, user2),
          ]).height - 1;

        chain.mineEmptyBlockUntil(
          minerBlockHeight + CoreModel.TOKEN_REWARD_MATURITY + 1
        );

        // act
        const result = core.isBlockWinner(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(true);
      });
    });

    describe("can-claim-mining-reward()", () => {
      it("succeeds and returns false when user is unknown", () => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const minerBlockHeight = 1;

        // act
        const result = core.canClaimMiningReward(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
      });

      it("succeeds and returns false when selected block has not been mined by anyone", () => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const minerBlockHeight = 1;
        chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(user),
        ]);

        // act
        const result = core.canClaimMiningReward(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
      });

      it("succeeds and returns false when user didn't mine selected block", () => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const user2 = accounts.get("wallet_2")!;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight = chain.mineBlock([
          core.mineTokens(200, user2),
        ]).height;

        // act
        const result = core.canClaimMiningReward(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
      });

      it("succeeds and returns false when user mined selected block, but maturity window has not passed", () => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([core.mineTokens(200, user)]).height - 1;

        // act
        const result = core.canClaimMiningReward(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
      });

      it("succeeds and returns false when user mined selected block, but another user won it", () => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const user2 = accounts.get("wallet_2")!;

        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([
            core.mineTokens(1, user),
            core.mineTokens(200000, user2),
          ]).height - 1;

        chain.mineEmptyBlockUntil(
          minerBlockHeight + CoreModel.TOKEN_REWARD_MATURITY + 1
        );

        // act
        const result = core.canClaimMiningReward(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
        core
          .canClaimMiningReward(user2, minerBlockHeight)
          .result.expectBool(true);
      });

      it("succeeds and returns false when user mined selected block, won it, but already claimed the reward", () => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const user2 = accounts.get("wallet_2")!;

        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([
            core.mineTokens(200000, user),
            core.mineTokens(1, user2),
          ]).height - 1;

        chain.mineEmptyBlockUntil(
          minerBlockHeight + CoreModel.TOKEN_REWARD_MATURITY + 1
        );
        chain.mineBlock([
          core.claimMiningReward(minerBlockHeight, user),
        ]);

        // act
        const result = core.canClaimMiningReward(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
      });

      it("succeeds and returns true when user mined selected block, won it, and did not claim the reward yet", () => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const user2 = accounts.get("wallet_2")!;

        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([
            core.mineTokens(200000, user),
            core.mineTokens(1, user2),
          ]).height - 1;

        chain.mineEmptyBlockUntil(
          minerBlockHeight + CoreModel.TOKEN_REWARD_MATURITY + 1
        );

        // act
        const result = core.canClaimMiningReward(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(true);
      });
    });
  });

  //////////////////////////////////////////////////
  // STACKING CONFIGURATION
  //////////////////////////////////////////////////

  describe("STACKING CONFIGURATION", () => {
    describe("get-first-stacks-block-in-reward-cycle()", () => {
      it("succeeds and returns the first block in the reward cycle", () => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);
        // act
        const result1 = core.getFirstStacksBlockInRewardCycle(0).result;
        const result2 = core.getFirstStacksBlockInRewardCycle(1).result;
        const result3 = core.getFirstStacksBlockInRewardCycle(2).result;
        // assert
        result1.expectUint(activationBlockHeight);
        result2.expectUint(activationBlockHeight + CoreModel.REWARD_CYCLE_LENGTH);
        result3.expectUint(activationBlockHeight + CoreModel.REWARD_CYCLE_LENGTH * 2);
      });
    });
    describe("get-entitled-stacking-reward()", () => {
      it("succeeds and returns 0 if user did not stack CityCoins", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const stackerId = 1;
        const targetCycle = 1;
        const amountTokens = 200;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(stacker),
          token.ftMint(amountTokens, stacker),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreModel.ACTIVATION_DELAY + 1
        );
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH * 2);
        // act
        const result = core.getStackingReward(stackerId, targetCycle).result;
        // assert
        result.expectUint(0);
      });
      it("succeeds and returns the correct amount of uSTX user can claim", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amountUstx = 1000;
        const stacker = accounts.get("wallet_2")!;
        const stackerId = 1;
        const targetCycle = 1;
        const amountTokens = 200;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(stacker),
          token.ftMint(amountTokens, stacker),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreModel.ACTIVATION_DELAY + 1
        );
        chain.mineBlock([core.stackTokens(amountTokens, 1, stacker)]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        chain.mineBlock([core.mineTokens(amountUstx, miner)]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        // act
        const result = core.getStackingReward(stackerId, targetCycle).result;
        // assert
        result.expectUint(amountUstx * 0.7);
      });
    });
  });

  //////////////////////////////////////////////////
  // STACKING ACTIONS
  //////////////////////////////////////////////////

  describe("STACKING ACTIONS", () => {
    describe("stack-tokens()", () => {
      it("fails with ERR_STACKING_NOT_AVAILABLE when stacking is not available", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 200;
        const lockPeriod = 2;
        chain.mineBlock([token.ftMint(amountTokens, stacker)]);

        // act
        const receipt = chain.mineBlock([
          core.stackTokens(amountTokens, lockPeriod, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_STACKING_NOT_AVAILABLE);
      });

      it("fails with ERR_CANNOT_STACK while trying to stack with lock period = 0", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 200;
        const lockPeriod = 0;
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(stacker),
          token.ftMint(amountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const receipt = chain.mineBlock([
          core.stackTokens(amountTokens, lockPeriod, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_CANNOT_STACK);
      });

      it("fails with ERR_CANNOT_STACK while trying to stack with lock period > 32", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 200;
        const lockPeriod = 33;
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(stacker),
          token.ftMint(amountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const receipt = chain.mineBlock([
          core.stackTokens(amountTokens, lockPeriod, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_CANNOT_STACK);
      });

      it("fails with ERR_CANNOT_STACK while trying to stack with 0 tokens", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 0;
        const lockPeriod = 5;
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(stacker),
          token.ftMint(amountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const receipt = chain.mineBlock([
          core.stackTokens(amountTokens, lockPeriod, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_CANNOT_STACK);
      });

      it("fails with ERR_FT_INSUFFICIENT_BALANCE while trying to stack with amount tokens > user balance", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 20;
        const lockPeriod = 5;
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(stacker),
          token.ftMint(amountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const receipt = chain.mineBlock([
          core.stackTokens(amountTokens + 1, lockPeriod, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_FT_INSUFFICIENT_BALANCE);
      });

      it("succeeds and emits one ft_transfer event to core contract", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 20;
        const lockPeriod = 5;
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(stacker),
          token.ftMint(amountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const receipt = chain.mineBlock([
          core.stackTokens(amountTokens, lockPeriod, stacker),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 2);
        receipt.events.expectFungibleTokenTransferEvent(
          amountTokens,
          stacker.address,
          core.address,
          "citycoins"
        );
      });

      it("succeeds when called more than once", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 20;
        const lockPeriod = 5;
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(stacker),
          token.ftMint(amountTokens * 3, stacker),
        ]);
        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const mineTokensTx = core.stackTokens(
          amountTokens,
          lockPeriod,
          stacker
        );
        const receipts = chain.mineBlock([
          mineTokensTx,
          mineTokensTx,
          mineTokensTx,
        ]).receipts;

        // assert
        receipts.forEach((receipt: TxReceipt) => {
          receipt.result.expectOk().expectBool(true);
          assertEquals(receipt.events.length, 2);

          receipt.events.expectFungibleTokenTransferEvent(
            amountTokens,
            stacker.address,
            core.address,
            "citycoins"
          );
        });
      });

      it("succeeds and returns correct number of tokens when locking period = 1", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 20;
        const lockPeriod = 1;
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(stacker),
          token.ftMint(amountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        chain.mineBlock([
          core.stackTokens(amountTokens, lockPeriod, stacker),
        ]);

        // assert
        const rewardCycle = 1;
        const userId = 1;
        const result = core.getStackerAtCycleOrDefault(
          rewardCycle,
          userId
        ).result;

        assertEquals(result.expectTuple(), {
          amountStacked: types.uint(amountTokens),
          toReturn: types.uint(amountTokens),
        });
      });

      it("succeeds and returns correct number of tokens when locking period > 1", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 20;
        const lockPeriod = 8;
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(stacker),
          token.ftMint(amountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        chain.mineBlock([
          core.stackTokens(amountTokens, lockPeriod, stacker),
        ]);

        // assert
        const userId = 1;

        for (let rewardCycle = 1; rewardCycle <= lockPeriod; rewardCycle++) {
          const result = core.getStackerAtCycleOrDefault(
            rewardCycle,
            userId
          ).result;

          assertEquals(result.expectTuple(), {
            amountStacked: types.uint(amountTokens),
            toReturn: types.uint(rewardCycle === lockPeriod ? amountTokens : 0),
          });
        }
      });

      it("succeeds and returns correct number of tokens when stacking multiple times with different locking periods", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const userId = 1;
        class StackingRecord {
          constructor(
            readonly stackInCycle: number,
            readonly lockPeriod: number,
            readonly amountTokens: number
          ) {}
        }

        const stackingRecords: StackingRecord[] = [
          new StackingRecord(1, 4, 20),
          new StackingRecord(3, 8, 432),
          new StackingRecord(7, 3, 10),
          new StackingRecord(8, 2, 15),
          new StackingRecord(9, 5, 123),
        ];

        const totalAmountTokens = stackingRecords.reduce(
          (sum, record) => sum + record.amountTokens,
          0
        );
        const maxCycle = Math.max.apply(
          Math,
          stackingRecords.map((record) => {
            return record.stackInCycle + 1 + record.lockPeriod;
          })
        );

        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(stacker),
          token.ftMint(totalAmountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        stackingRecords.forEach((record) => {
          // move chain tip to the beginning of specific cycle
          chain.mineEmptyBlockUntil(
            activationBlockHeight +
              record.stackInCycle * CoreModel.REWARD_CYCLE_LENGTH
          );

          chain.mineBlock([
            core.stackTokens(
              record.amountTokens,
              record.lockPeriod,
              stacker
            ),
          ]);
        });

        // assert
        for (let rewardCycle = 0; rewardCycle <= maxCycle; rewardCycle++) {
          let expected = {
            amountStacked: 0,
            toReturn: 0,
          };

          stackingRecords.forEach((record) => {
            let firstCycle = record.stackInCycle + 1;
            let lastCycle = record.stackInCycle + record.lockPeriod;

            if (rewardCycle >= firstCycle && rewardCycle <= lastCycle) {
              expected.amountStacked += record.amountTokens;
            }

            if (rewardCycle == lastCycle) {
              expected.toReturn += record.amountTokens;
            }
          });

          const result = core.getStackerAtCycleOrDefault(
            rewardCycle,
            userId
          ).result;

          console.table({
            cycle: rewardCycle,
            expected: expected,
            actual: result.expectTuple(),
          });

          assertEquals(result.expectTuple(), {
            amountStacked: types.uint(expected.amountStacked),
            toReturn: types.uint(expected.toReturn),
          });
        }
      });

      it("succeeds and prints tuple with firstCycle and lastCycle when stacked only in one cycle", () => {
        // arrange
        const stacker = accounts.get("wallet_7")!;
        const amountTokens = 20;
        const lockPeriod = 1;
        const stackDuringCycle = 3;
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(stacker),
          token.ftMint(amountTokens, stacker),
        ]);
        const activationBlockHeight = block.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight + CoreModel.REWARD_CYCLE_LENGTH * stackDuringCycle);

        // act
        const receipt = chain.mineBlock([core.stackTokens(amountTokens, lockPeriod, stacker)]).receipts[0];

        // assert
        const firstCycle = stackDuringCycle + 1;
        const lastCycle = firstCycle + (lockPeriod - 1);
        const expectedPrintMsg = `{firstCycle: ${types.uint(firstCycle)}, lastCycle: ${types.uint(lastCycle)}}`;

        receipt.events.expectPrintEvent(core.address, expectedPrintMsg);
      });

      it("succeeds and prints tuple with firstCycle and lastCycle when stacked in multiple cycles", () => {
        // arrange
        const stacker = accounts.get("wallet_7")!;
        const amountTokens = 20;
        const lockPeriod = 9;
        const stackDuringCycle = 8;
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(stacker),
          token.ftMint(amountTokens, stacker),
        ]);
        const activationBlockHeight = block.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight + CoreModel.REWARD_CYCLE_LENGTH * stackDuringCycle);

        // act
        const receipt = chain.mineBlock([core.stackTokens(amountTokens, lockPeriod, stacker)]).receipts[0];

        // assert
        const firstCycle = stackDuringCycle + 1;
        const lastCycle = firstCycle + (lockPeriod - 1);
        const expectedPrintMsg = `{firstCycle: ${types.uint(firstCycle)}, lastCycle: ${types.uint(lastCycle)}}`;

        receipt.events.expectPrintEvent(core.address, expectedPrintMsg);
      });
    });
  });

  //////////////////////////////////////////////////
  // STACKING REWARD CLAIMS
  //////////////////////////////////////////////////

  describe("STACKING REWARD CLAIMS", () => {
    describe("claim-stacking-reward()", () => {
      it("fails with ERR_STACKING_NOT_AVAILABLE when stacking is not yet available", () => {
        // arrange
        const stacker = accounts.get("wallet_1")!;
        const targetCycle = 1;

        // act
        const receipt = chain.mineBlock([
          core.claimStackingReward(targetCycle, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_STACKING_NOT_AVAILABLE);
      });

      it("fails with ERR_USER_ID_NOT_FOUND when called by unknown user", () => {
        // arrange
        const stacker = accounts.get("wallet_1")!;
        const otherUser = accounts.get("wallet_2")!;
        const targetCycle = 1;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(otherUser),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1
        );

        // act
        const receipt = chain.mineBlock([
          core.claimStackingReward(targetCycle, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_USER_ID_NOT_FOUND);
      });

      it("fails with ERR_REWARD_CYCLE_NOT_COMPLETED when reward cycle is not completed", () => {
        // arrange
        const stacker = accounts.get("wallet_1")!;
        const targetCycle = 1;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(stacker),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1
        );

        // act
        const receipt = chain.mineBlock([
          core.claimStackingReward(targetCycle, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_REWARD_CYCLE_NOT_COMPLETED);
      });

      it("fails with ERR_NOTHING_TO_REDEEM when stacker didn't stack at all", () => {
        // arrange
        const stacker = accounts.get("wallet_1")!;
        const targetCycle = 1;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(stacker),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height +
            CoreModel.ACTIVATION_DELAY +
            CoreModel.REWARD_CYCLE_LENGTH * 2 -
            1
        );

        // act
        const receipt = chain.mineBlock([
          core.claimStackingReward(targetCycle, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_NOTHING_TO_REDEEM);
      });

      it("fails with ERR_NOTHING_TO_REDEEM when stacker stacked in a cycle but miners did not mine", () => {
        // arrange
        const stacker = accounts.get("wallet_1")!;
        const targetCycle = 1;
        const amount = 200;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(stacker),
          token.ftMint(amount, stacker),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreModel.ACTIVATION_DELAY + 1
        );
        chain.mineBlock([core.stackTokens(amount, 4, stacker)]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH * 2);

        // act
        const receipt = chain.mineBlock([
          core.claimStackingReward(targetCycle, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_NOTHING_TO_REDEEM);
      });

      it("fails with ERR_NOTHING_TO_REDEEM while trying to claim reward 2nd time", () => {
        // arrange
        const stacker = accounts.get("wallet_1")!;
        const targetCycle = 1;
        const amount = 200;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(stacker),
          token.ftMint(amount, stacker),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreModel.ACTIVATION_DELAY + 1
        );
        chain.mineBlock([core.stackTokens(amount, 1, stacker)]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH * 2);

        // act
        const receipt = chain.mineBlock([
          core.claimStackingReward(targetCycle, stacker),
          core.claimStackingReward(targetCycle, stacker),
        ]).receipts[1];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreModel.ErrCode.ERR_NOTHING_TO_REDEEM);
      });

      it("succeeds and emits stx_transfer and ft_transfer events", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amountUstx = 1000;
        const stacker = accounts.get("wallet_2")!;
        const targetCycle = 1;
        const amountTokens = 200;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(stacker),
          token.ftMint(amountTokens, stacker),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreModel.ACTIVATION_DELAY + 1
        );
        chain.mineBlock([core.stackTokens(amountTokens, 1, stacker)]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        chain.mineBlock([core.mineTokens(amountUstx, miner)]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);

        // act
        const receipt = chain.mineBlock([
          core.claimStackingReward(targetCycle, stacker),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);
        assertEquals(receipt.events.length, 2);

        receipt.events.expectFungibleTokenTransferEvent(
          amountTokens,
          core.address,
          stacker.address,
          "citycoins"
        );

        receipt.events.expectSTXTransferEvent(
          amountUstx * 0.7,
          core.address,
          stacker.address
        );
      });

      it("succeeds and emits only a ft_transfer event when there was no STX reward (ie. due to no miners)", () => {
        // arrange
        const stacker = accounts.get("wallet_1")!;
        const amountTokens = 20;
        const targetCycle = 1;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(stacker),
          token.ftMint(amountTokens, stacker),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreModel.ACTIVATION_DELAY + 1
        );
        chain.mineBlock([core.stackTokens(amountTokens, 1, stacker)]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH * 2);

        // act
        const receipt = chain.mineBlock([
          core.claimStackingReward(targetCycle, stacker),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);

        receipt.events.expectFungibleTokenTransferEvent(
          amountTokens,
          core.address,
          stacker.address,
          "citycoins"
        );
      });

      it("succeeds and returns tokens only for last cycle in locked period", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const userId = 1;
        class StackingRecord {
          constructor(
            readonly stackInCycle: number,
            readonly lockPeriod: number,
            readonly amountTokens: number
          ) {}
        }

        const stackingRecords: StackingRecord[] = [
          new StackingRecord(1, 4, 20),
          new StackingRecord(3, 8, 432),
          new StackingRecord(7, 3, 10),
          new StackingRecord(8, 2, 15),
          new StackingRecord(9, 5, 123),
        ];

        const totalAmountTokens = stackingRecords.reduce(
          (sum, record) => sum + record.amountTokens,
          0
        );
        const maxCycle = Math.max.apply(
          Math,
          stackingRecords.map((record) => {
            return record.stackInCycle + 1 + record.lockPeriod;
          })
        );

        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(stacker),
          token.ftMint(totalAmountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        stackingRecords.forEach((record) => {
          // move chain tip to the beginning of specific cycle
          chain.mineEmptyBlockUntil(
            activationBlockHeight +
              record.stackInCycle * CoreModel.REWARD_CYCLE_LENGTH
          );

          chain.mineBlock([
            core.stackTokens(
              record.amountTokens,
              record.lockPeriod,
              stacker
            ),
          ]);
        });

        chain.mineEmptyBlockUntil(
          CoreModel.REWARD_CYCLE_LENGTH * (maxCycle + 1)
        );

        // act + assert
        for (let rewardCycle = 0; rewardCycle <= maxCycle; rewardCycle++) {
          let toReturn = 0;

          stackingRecords.forEach((record) => {
            let lastCycle = record.stackInCycle + record.lockPeriod;

            if (rewardCycle == lastCycle) {
              toReturn += record.amountTokens;
            }
          });

          const receipt = chain.mineBlock([
            core.claimStackingReward(rewardCycle, stacker),
          ]).receipts[0];

          if (toReturn === 0) {
            receipt.result.expectErr();
          } else {
            receipt.result.expectOk().expectBool(true);
            assertEquals(receipt.events.length, 1);

            receipt.events.expectFungibleTokenTransferEvent(
              toReturn,
              core.address,
              stacker.address,
              "citycoins"
            );
          }
        }
      });
    });
  });

  //////////////////////////////////////////////////
  // TOKEN CONFIGURATION
  //////////////////////////////////////////////////

  describe("TOKEN CONFIGURATION", () => {
    describe("get-coinbase-thresholds()", () => {
      it("fails with ERR_CONTRACT_NOT_ACTIVATED if called before activation", () => {
        // act
        const result = core.getCoinbaseThresholds().result;
        // assert
        result.expectErr().expectUint(CoreModel.ErrCode.ERR_CONTRACT_NOT_ACTIVATED);
      });
      it("succeeds and returns coinbase thresholds", () => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(user)
        ]);
        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);
        // act
        const result = core.getCoinbaseThresholds().result;
        // assert
        const expectedResult = {
          coinbaseThreshold1: types.uint(activationBlockHeight + CoreModel.TOKEN_HALVING_BLOCKS),     // 210151
          coinbaseThreshold2: types.uint(activationBlockHeight + CoreModel.TOKEN_HALVING_BLOCKS * 2), // 420151
          coinbaseThreshold3: types.uint(activationBlockHeight + CoreModel.TOKEN_HALVING_BLOCKS * 3), // 630151
          coinbaseThreshold4: types.uint(activationBlockHeight + CoreModel.TOKEN_HALVING_BLOCKS * 4), // 840151
          coinbaseThreshold5: types.uint(activationBlockHeight + CoreModel.TOKEN_HALVING_BLOCKS * 5)  // 1050151
        };
        assertEquals(result.expectOk().expectTuple(), expectedResult);
      });
    });
  });

  //////////////////////////////////////////////////
  // UTILITIES
  //////////////////////////////////////////////////

  // describe("UTILITIES", () => {});
});

run();