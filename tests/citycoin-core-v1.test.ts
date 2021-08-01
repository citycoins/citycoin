import { assertEquals, describe, Tx, TxReceipt, types } from "../deps.ts";
import { CoreClient } from "../src/core-client.ts";
import { it } from "../src/testutil.ts";

describe("[CityCoin Core]", () => {
  //////////////////////////////////////////////////
  // CITY WALLET MANAGEMENT
  //////////////////////////////////////////////////

  describe("CITY WALLET MANAGEMENT", () => {
    describe("get-city-wallet()", () => {
      it("returns current city wallet variable as contract address before initialization", (chain, accounts, clients) => {
        // arrange
        const result = clients.core.getCityWallet().result;

        // assert
        result.expectPrincipal(clients.core.getContractAddress());
      });
      it("returns current city wallet variable as city wallet address after initialization", (chain, accounts, clients) => {
        // arrange
        const cityWallet = accounts.get("city_wallet")!;
        chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
        ]);

        const result = clients.core.getCityWallet().result;

        // assert
        result.expectPrincipal(cityWallet.address);
      });
    });
    describe("set-city-wallet()", () => {
      it("throws ERR_UNAUTHORIZED when called by non-city wallet", (chain, accounts, clients) => {
        // arrange
        const wallet = accounts.get("wallet_1")!;

        // act
        const receipt = chain.mineBlock([
          clients.core.setCityWallet(wallet, wallet),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_UNAUTHORIZED);
      });
    });
  });

  //////////////////////////////////////////////////
  // REGISTRATION
  //////////////////////////////////////////////////

  describe("REGISTRATION", () => {
    describe("get-activation-block()", () => {
      it("throws ERR_CONTRACT_NOT_ACTIVATED if called before contract is activated", (chain, accounts, clients) => {
        // act
        const result = clients.core.getActivationBlock().result;

        // assert
        result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_CONTRACT_NOT_ACTIVATED);
      });
      it("succeeds and returns activation height", (chain, accounts, clients) => {
        // arrange
        const user = accounts.get("wallet_4")!;
        const block = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(user),
        ]);
        const activationBlockHeight =
          block.height + CoreClient.ACTIVATION_DELAY - 1;

        // act
        const result = clients.core.getActivationBlock().result;

        // assert
        result.expectOk().expectUint(activationBlockHeight);
      });
    });
    describe("get-activation-delay()", () => {
      it("succeeds and returns activation delay", (chain, accounts, clients) => {
        // act
        const result = clients.core.getActivationDelay().result;
        // assert
        result.expectUint(CoreClient.ACTIVATION_DELAY);
      });
    });
    describe("get-activation-threshold()", () => {
      it("succeeds and returns activation threshold", (chain, accounts, clients) => {
        // act
        const result = clients.core.getActivationThreshold().result;
        // assert
        result.expectUint(CoreClient.ACTIVATION_THRESHOLD);
      });
    });
    describe("get-registered-users-nonce()", () => {
      it("succeeds and returns u0 if no users are registered", (chain, accounts, clients) => {
        // act
        const result = clients.core.getRegisteredUsersNonce().result;
        // assert
        result.expectUint(0);
      });
      it("succeeds and returns u1 if one user is registered", (chain, accounts, clients) => {
        // arrange
        const user = accounts.get("wallet_5")!;
        chain.mineBlock([clients.core.registerUser(user)]);
        // act
        const result = clients.core.getRegisteredUsersNonce().result;
        // assert
        result.expectUint(1);
      });
    });
    describe("register-user()", () => {
      it("successfully register new user and emits print event with memo when supplied", (chain, accounts, clients) => {
        // arrange
        const user = accounts.get("wallet_5")!;
        const memo = "hello world";

        // act
        const receipt = chain.mineBlock([clients.core.registerUser(user, memo)])
          .receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);
        clients.core.getUserId(user).result.expectSome().expectUint(1);

        assertEquals(receipt.events.length, 1);

        const expectedEvent = {
          type: "contract_event",
          contract_event: {
            contract_identifier: clients.core.getContractAddress(),
            topic: "print",
            value: types.some(types.utf8(memo)),
          },
        };

        assertEquals(receipt.events[0], expectedEvent);
      });

      it("successfully register new user and do not emit any events when memo is not supplied", (chain, accounts, clients) => {
        // arrange
        const user = accounts.get("wallet_4")!;

        // act
        const receipt = chain.mineBlock([clients.core.registerUser(user)])
          .receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);
        clients.core.getUserId(user).result.expectSome().expectUint(1);

        assertEquals(receipt.events.length, 0);
      });

      it("throws ERR_USER_ALREADY_REGISTERED while trying to register user 2nd time", (chain, accounts, clients) => {
        // arrange
        const user = accounts.get("wallet_4")!;
        const registerUserTx = clients.core.registerUser(user);
        chain.mineBlock([registerUserTx]);

        // act
        const receipt = chain.mineBlock([registerUserTx]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_USER_ALREADY_REGISTERED);
      });

      it("throws ERR_ACTIVATION_THRESHOLD_REACHED error when user wants to register after reaching activation threshold", (chain, accounts, clients) => {
        // arrange
        const user1 = accounts.get("wallet_4")!;
        const user2 = accounts.get("wallet_5")!;
        chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(user1),
        ]);

        // act
        const receipt = chain.mineBlock([clients.core.registerUser(user2)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_ACTIVATION_THRESHOLD_REACHED);
      });
    });
  });

  //////////////////////////////////////////////////
  // MINING CONFIGURATION
  //////////////////////////////////////////////////

  describe("MINING CONFIGURATION", () => {
    describe("get-block-winner-id()", () => {
      it("succeeds and returns none if winner is unknown at the block height", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const miner2 = accounts.get("wallet_3")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
          clients.core.registerUser(miner2),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([
          clients.core.mineTokens(amount, miner),
          clients.core.mineTokens(amount * 1000, miner2),
        ]);
        chain.mineEmptyBlock(CoreClient.TOKEN_REWARD_MATURITY);

        // act
        const result = clients.core.getBlockWinnerId(block.height).result;

        // assert
        result.expectNone();
      });
      it("succeeds and returns block winner ID if winner claimed at the block height", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const miner2 = accounts.get("wallet_3")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
          clients.core.registerUser(miner2),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([
          clients.core.mineTokens(amount, miner),
          clients.core.mineTokens(amount * 1000, miner2),
        ]);
        chain.mineEmptyBlock(CoreClient.TOKEN_REWARD_MATURITY);
        chain.mineBlock([
          clients.core.claimMiningReward(block.height - 1, miner2),
        ]);
        // act
        const result = clients.core.getBlockWinnerId(block.height - 1).result;

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
      it("throws ERR_CONTRACT_NOT_ACTIVATED while trying to mine before reaching activation threshold", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amountUstx = 200;

        // act
        const receipt = chain.mineBlock([
          clients.core.mineTokens(amountUstx, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_CONTRACT_NOT_ACTIVATED);
      });

      it("throws ERR_INSUFFICIENT_COMMITMENT while trying to mine with 0 commitment", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amountUstx = 0;
        chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);

        // act
        const receipt = chain.mineBlock([
          clients.core.mineTokens(amountUstx, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_INSUFFICIENT_COMMITMENT);
      });

      it("throws ERR_INSUFFICIENT_BALANCE while trying to mine with commitment larger than current balance", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amountUstx = miner.balance + 1;
        chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);

        // act
        const receipt = chain.mineBlock([
          clients.core.mineTokens(amountUstx, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_INSUFFICIENT_BALANCE);
      });

      it("throws ERR_STACKING_NOT_AVAILABLE while trying to mine before activation period end", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amountUstx = 200;
        chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);

        // act
        const receipt = chain.mineBlock([
          clients.core.mineTokens(amountUstx, miner),
        ]).receipts[0];

        //assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_STACKING_NOT_AVAILABLE);
      });

      it("succeeds and cause one stx_transfer_event to city-wallet during first cycle", (chain, accounts, clients) => {
        // arrange
        const cityWallet = accounts.get("city_wallet")!;
        const miner = accounts.get("wallet_2")!;
        const amountUstx = 200;
        const block = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetCityWallet(cityWallet),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          block.height + CoreClient.ACTIVATION_DELAY - 1
        );

        // act
        const receipt = chain.mineBlock([
          clients.core.mineTokens(amountUstx, miner),
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

      it("succeeds and cause one stx_transfer event to city-wallet and one to stacker while mining in cycle with stackers", (chain, accounts, clients) => {
        // arrange
        const cityWallet = accounts.get("city_wallet")!;
        const miner = accounts.get("wallet_2")!;
        const amountUstx = 200;
        const amountTokens = 500;
        const block = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetCityWallet(cityWallet),
          clients.token.ftMint(amountTokens, miner),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);

        const activationBlockHeight =
          block.height + CoreClient.ACTIVATION_DELAY - 1;
        const cycle1FirstBlockHeight =
          activationBlockHeight + CoreClient.REWARD_CYCLE_LENGTH;

        chain.mineEmptyBlockUntil(activationBlockHeight);
        chain.mineBlock([clients.core.stackTokens(amountTokens, 1, miner)]);
        chain.mineEmptyBlockUntil(cycle1FirstBlockHeight);

        // act
        const receipt = chain.mineBlock([
          clients.core.mineTokens(amountUstx, miner),
        ]).receipts[0];

        //assert
        receipt.result.expectOk().expectBool(true);
        assertEquals(receipt.events.length, 2);

        receipt.events.expectSTXTransferEvent(
          amountUstx * CoreClient.SPLIT_CITY_PCT,
          miner.address,
          cityWallet.address
        );

        receipt.events.expectSTXTransferEvent(
          amountUstx * (1 - CoreClient.SPLIT_CITY_PCT),
          miner.address,
          clients.core.getContractAddress()
        );
      });

      it("succeeds and prints memo when supplied", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amountUstx = 200;
        const memo = new TextEncoder().encode("hello world");
        const block = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);

        const activationBlockHeight =
          block.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const receipt = chain.mineBlock([
          clients.core.mineTokens(amountUstx, miner, memo),
        ]).receipts[0];

        //assert
        receipt.result.expectOk().expectBool(true);
        assertEquals(receipt.events.length, 2);

        const expectedEvent = {
          type: "contract_event",
          contract_event: {
            contract_identifier: clients.core.getContractAddress(),
            topic: "print",
            value: types.some(types.buff(memo)),
          },
        };

        assertEquals(receipt.events[0], expectedEvent);
      });

      it("throws ERR_USER_ALREADY_MINED while trying to mine same block 2nd time", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amountUstx = 200;
        const memo = new TextEncoder().encode("hello world");
        const block = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);

        const activationBlockHeight =
          block.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const mineTokensTx = clients.core.mineTokens(amountUstx, miner, memo);
        const receipts = chain.mineBlock([mineTokensTx, mineTokensTx]).receipts;

        //assert
        receipts[0].result.expectOk().expectBool(true);
        receipts[1].result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_USER_ALREADY_MINED);
      });
    });

    describe("mine-many()", () => {
      it("throws ERR_CONTRACT_NOT_ACTIVATED while trying to mine before reaching activation threshold", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amounts = [1, 2, 3, 4];

        // act
        const receipt = chain.mineBlock([clients.core.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_CONTRACT_NOT_ACTIVATED);
      });

      it("throws ERR_STACKING_NOT_AVAILABLE while trying to mine before activation period end", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [1, 2, 3, 4];
        chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);

        // act
        const receipt = chain.mineBlock([clients.core.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_STACKING_NOT_AVAILABLE);
      });

      it("throws ERR_INSUFFICIENT_COMMITMENT while providing empty list of amounts", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts: number[] = [];
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1
        );

        // act
        const receipt = chain.mineBlock([clients.core.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_INSUFFICIENT_COMMITMENT);
      });

      it("throws ERR_INSUFFICIENT_COMMITMENT while providing list of amounts filled with 0", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [0, 0, 0, 0];
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1
        );

        // act
        const receipt = chain.mineBlock([clients.core.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_INSUFFICIENT_COMMITMENT);
      });

      it("throws ERR_INSUFFICIENT_COMMITMENT while providing list of amounts with one or more 0s", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [1, 2, 3, 4, 0, 5, 6, 7];
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1
        );

        // act
        const receipt = chain.mineBlock([clients.core.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_INSUFFICIENT_COMMITMENT);
      });

      it("throws ERR_INSUFFICIENT_BALANCE when sum of all commitments > miner balance", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [1, miner.balance];
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1
        );

        // act
        const receipt = chain.mineBlock([clients.core.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_INSUFFICIENT_BALANCE);
      });

      it("throws ERR_USER_ALREADY_MINED when call overlaps already mined blocks", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [1, 2];
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1
        );
        chain.mineBlock([clients.core.mineMany(amounts, miner)]);

        // act
        const receipt = chain.mineBlock([clients.core.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_USER_ALREADY_MINED);
      });

      it("succeeds and cause one STX transfer event when amounts list have only one value and there are no stackers", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [1];
        const cityWallet = accounts.get("city_wallet")!;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1
        );

        // act
        const receipt = chain.mineBlock([clients.core.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);

        receipt.events.expectSTXTransferEvent(
          amounts.reduce((sum, amount) => sum + amount, 0),
          miner.address,
          cityWallet.address
        );
      });

      it("succeeds and cause one STX transfer event when amounts list have multiple values and there are no stackers", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [1, 2, 200, 89, 3423];
        const cityWallet = accounts.get("city_wallet")!;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1
        );

        // act
        const receipt = chain.mineBlock([clients.core.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);

        receipt.events.expectSTXTransferEvent(
          amounts.reduce((sum, amount) => sum + amount, 0),
          miner.address,
          cityWallet.address
        );
      });

      it("succeeds and cause 2 stx transfers when amounts list have only one value and there is at least one stacker", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [10000];
        const cityWallet = accounts.get("city_wallet")!;
        const amountTokens = 500;
        const block = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetCityWallet(cityWallet),
          clients.token.ftMint(amountTokens, miner),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);

        const activationBlockHeight =
          block.height + CoreClient.ACTIVATION_DELAY - 1;
        const cycle1FirstBlockHeight =
          activationBlockHeight + CoreClient.REWARD_CYCLE_LENGTH;

        chain.mineEmptyBlockUntil(activationBlockHeight);
        chain.mineBlock([clients.core.stackTokens(amountTokens, 1, miner)]);
        chain.mineEmptyBlockUntil(cycle1FirstBlockHeight);

        // act
        const receipt = chain.mineBlock([clients.core.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 2);

        const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0);

        receipt.events.expectSTXTransferEvent(
          totalAmount * CoreClient.SPLIT_CITY_PCT,
          miner.address,
          cityWallet.address
        );

        receipt.events.expectSTXTransferEvent(
          totalAmount * (1 - CoreClient.SPLIT_CITY_PCT),
          miner.address,
          clients.core.getContractAddress()
        );
      });

      it("succeeds and cause 2 stx transfers when amounts list have multiple values and there is at least one stacker", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [100, 200, 300];
        const cityWallet = accounts.get("city_wallet")!;
        const amountTokens = 500;
        const block = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetCityWallet(cityWallet),
          clients.token.ftMint(amountTokens, miner),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);

        const activationBlockHeight =
          block.height + CoreClient.ACTIVATION_DELAY - 1;
        const cycle1FirstBlockHeight =
          activationBlockHeight + CoreClient.REWARD_CYCLE_LENGTH;

        chain.mineEmptyBlockUntil(activationBlockHeight);
        chain.mineBlock([clients.core.stackTokens(amountTokens, 1, miner)]);
        chain.mineEmptyBlockUntil(cycle1FirstBlockHeight);

        // act
        const receipt = chain.mineBlock([clients.core.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 2);

        const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0);

        receipt.events.expectSTXTransferEvent(
          totalAmount * CoreClient.SPLIT_CITY_PCT,
          miner.address,
          cityWallet.address
        );

        receipt.events.expectSTXTransferEvent(
          totalAmount * (1 - CoreClient.SPLIT_CITY_PCT),
          miner.address,
          clients.core.getContractAddress()
        );
      });

      it("saves information that miner mined multiple consecutive blocks", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [1, 2, 200, 89, 3423];
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1
        );

        // act
        const block = chain.mineBlock([clients.core.mineMany(amounts, miner)]);

        // assert
        const userId = 1;

        amounts.forEach((amount, idx) => {
          clients.core
            .hasMinedAtBlock(block.height + idx - 1, userId)
            .result.expectBool(true);
        });
      });
    });
  });

  //////////////////////////////////////////////////
  // MINING REWARD CLAIM ACTIONS
  //////////////////////////////////////////////////

  describe("MINING REWARD CLAIM ACTIONS", () => {
    describe("claim-mining-reward()", () => {
      it("throws ERR_USER_NOT_FOUND when called by non-registered user or user who didn't mine at all", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_2")!;

        // act
        const receipt = chain.mineBlock([
          clients.core.claimMiningReward(0, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_USER_ID_NOT_FOUND);
      });

      it("throws ERR_NO_MINERS_AT_BLOCK when called with block-height at which nobody decided to mine", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        chain.mineBlock([clients.core.registerUser(miner)]);

        // act
        const receipt = chain.mineBlock([
          clients.core.claimMiningReward(0, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_NO_MINERS_AT_BLOCK);
      });

      it("throws ERR_USER_DID_NOT_MINE_IN_BLOCK when called by user who didn't mine specific block", (chain, accounts, clients) => {
        // arrange
        const otherMiner = accounts.get("wallet_4")!;
        const miner = accounts.get("wallet_2")!;
        const amount = 2000;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([
          clients.core.mineTokens(amount, otherMiner),
        ]);

        // act
        const receipt = chain.mineBlock([
          clients.core.claimMiningReward(block.height - 1, miner),
        ]);

        // assert
        receipt.receipts[0].result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_USER_DID_NOT_MINE_IN_BLOCK);
      });

      it("throws ERR_CLAIMED_BEFORE_MATURITY when called before reward was mature to be claimed", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2000;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([clients.core.mineTokens(amount, miner)]);

        // act
        const receipt = chain.mineBlock([
          clients.core.claimMiningReward(block.height - 1, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_CLAIMED_BEFORE_MATURITY);
      });

      it("throws ERR_REWARD_ALREADY_CLAIMED when trying to claim reward 2nd time", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2000;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([clients.core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(CoreClient.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          clients.core.claimMiningReward(block.height - 1, miner),
          clients.core.claimMiningReward(block.height - 1, miner),
        ]).receipts[1];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_REWARD_ALREADY_CLAIMED);
      });

      it("throws ERR_MINER_DID_NOT_WIN when trying to claim reward owed to someone else", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const otherMiner = accounts.get("wallet_3")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([
          clients.core.mineTokens(amount, miner),
          clients.core.mineTokens(amount * 10000, otherMiner),
        ]);
        chain.mineEmptyBlock(CoreClient.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          clients.core.claimMiningReward(block.height - 1, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_MINER_DID_NOT_WIN);
      });

      it("succeeds and mints 250000 tokens in 1st issuance cycle, during bonus period", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([clients.core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(CoreClient.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          clients.core.claimMiningReward(block.height - 1, miner),
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

      it("succeeds and mints 100000 tokens in 1st issuance cycle, after bonus period", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(
          activationBlockHeight + CoreClient.BONUS_PERIOD_LENGTH + 1
        );

        const block = chain.mineBlock([clients.core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(CoreClient.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          clients.core.claimMiningReward(block.height - 1, miner),
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

      it("succeeds and mints 50000 tokens in 2nd issuance cycle", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(
          activationBlockHeight + CoreClient.TOKEN_HALVING_BLOCKS + 1
        );

        const block = chain.mineBlock([clients.core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(CoreClient.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          clients.core.claimMiningReward(block.height - 1, miner),
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

      it("succeeds and mints 25000 tokens in 3rd issuance cycle", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(
          activationBlockHeight + CoreClient.TOKEN_HALVING_BLOCKS * 2 + 1
        );

        const block = chain.mineBlock([clients.core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(CoreClient.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          clients.core.claimMiningReward(block.height - 1, miner),
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

      it("succeeds and mints 12500 tokens in 4th issuance cycle", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(
          activationBlockHeight + CoreClient.TOKEN_HALVING_BLOCKS * 3 + 1
        );

        const block = chain.mineBlock([clients.core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(CoreClient.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          clients.core.claimMiningReward(block.height - 1, miner),
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

      it("succeeds and mints 6250 tokens in 5th issuance cycle", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(
          activationBlockHeight + CoreClient.TOKEN_HALVING_BLOCKS * 4 + 1
        );

        const block = chain.mineBlock([clients.core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(CoreClient.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          clients.core.claimMiningReward(block.height - 1, miner),
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

      it("succeeds and mints 3125 tokens in final issuance cycle", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(
          activationBlockHeight + CoreClient.TOKEN_HALVING_BLOCKS * 5 + 1
        );

        const block = chain.mineBlock([clients.core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(CoreClient.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          clients.core.claimMiningReward(block.height - 1, miner),
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
      it("returns false when user is unknown", (chain, accounts, clients) => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const minerBlockHeight = 1;

        // act
        const result = clients.core.isBlockWinner(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
      });

      it("returns false when selected block has not been mined by anyone", (chain, accounts, clients) => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const minerBlockHeight = 1;
        chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(user),
        ]);

        // act
        const result = clients.core.isBlockWinner(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
      });

      it("returns false when user didn't mine selected block", (chain, accounts, clients) => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const user2 = accounts.get("wallet_2")!;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight = chain.mineBlock([
          clients.core.mineTokens(200, user2),
        ]).height;

        // act
        const result = clients.core.isBlockWinner(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
      });

      it("returns false when user mined selected block, but block is not mature", (chain, accounts, clients) => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([clients.core.mineTokens(200, user)]).height - 1;

        // act
        const result = clients.core.isBlockWinner(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
      });

      it("returns false when user mined selected block, but other user won it", (chain, accounts, clients) => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const user2 = accounts.get("wallet_2")!;

        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([
            clients.core.mineTokens(1, user),
            clients.core.mineTokens(200000, user2),
          ]).height - 1;

        chain.mineEmptyBlockUntil(
          minerBlockHeight + CoreClient.TOKEN_REWARD_MATURITY + 1
        );

        // act
        const result = clients.core.isBlockWinner(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
        clients.core
          .isBlockWinner(user2, minerBlockHeight)
          .result.expectBool(true);
      });

      it("returns true when user mined selected block and won it", (chain, accounts, clients) => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const user2 = accounts.get("wallet_2")!;

        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([
            clients.core.mineTokens(200000, user),
            clients.core.mineTokens(1, user2),
          ]).height - 1;

        chain.mineEmptyBlockUntil(
          minerBlockHeight + CoreClient.TOKEN_REWARD_MATURITY + 1
        );

        // act
        const result = clients.core.isBlockWinner(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(true);
      });
    });

    describe("can-claim-mining-reward()", () => {
      it("returns false when user is unknown", (chain, accounts, clients) => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const minerBlockHeight = 1;

        // act
        const result = clients.core.canClaimMiningReward(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
      });

      it("returns false when selected block has not been mined by anyone", (chain, accounts, clients) => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const minerBlockHeight = 1;
        chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(user),
        ]);

        // act
        const result = clients.core.canClaimMiningReward(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
      });

      it("returns false when user didn't mine selected block", (chain, accounts, clients) => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const user2 = accounts.get("wallet_2")!;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight = chain.mineBlock([
          clients.core.mineTokens(200, user2),
        ]).height;

        // act
        const result = clients.core.canClaimMiningReward(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
      });

      it("returns false when user mined selected block, but block is not mature", (chain, accounts, clients) => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([clients.core.mineTokens(200, user)]).height - 1;

        // act
        const result = clients.core.canClaimMiningReward(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
      });

      it("returns false when user mined selected block, but other user won it", (chain, accounts, clients) => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const user2 = accounts.get("wallet_2")!;

        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([
            clients.core.mineTokens(1, user),
            clients.core.mineTokens(200000, user2),
          ]).height - 1;

        chain.mineEmptyBlockUntil(
          minerBlockHeight + CoreClient.TOKEN_REWARD_MATURITY + 1
        );

        // act
        const result = clients.core.canClaimMiningReward(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
        clients.core
          .canClaimMiningReward(user2, minerBlockHeight)
          .result.expectBool(true);
      });

      it("returns false when user mined selected block, won it but already claimed the reward", (chain, accounts, clients) => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const user2 = accounts.get("wallet_2")!;

        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([
            clients.core.mineTokens(200000, user),
            clients.core.mineTokens(1, user2),
          ]).height - 1;

        chain.mineEmptyBlockUntil(
          minerBlockHeight + CoreClient.TOKEN_REWARD_MATURITY + 1
        );
        chain.mineBlock([
          clients.core.claimMiningReward(minerBlockHeight, user),
        ]);

        // act
        const result = clients.core.canClaimMiningReward(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
      });

      it("returns true when user mined selected block, won it and did not claim the reward yet", (chain, accounts, clients) => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const user2 = accounts.get("wallet_2")!;

        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([
            clients.core.mineTokens(200000, user),
            clients.core.mineTokens(1, user2),
          ]).height - 1;

        chain.mineEmptyBlockUntil(
          minerBlockHeight + CoreClient.TOKEN_REWARD_MATURITY + 1
        );

        // act
        const result = clients.core.canClaimMiningReward(
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

  // describe("STACKING CONFIGURATION", () => {});

  //////////////////////////////////////////////////
  // STACKING ACTIONS
  //////////////////////////////////////////////////

  describe("STACKING ACTIONS", () => {
    describe("stack-tokens()", () => {
      it("throws ERR_STACKING_NOT_AVAILABLE when stacking is not available", (chain, accounts, clients) => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 200;
        const lockPeriod = 2;
        chain.mineBlock([clients.token.ftMint(amountTokens, stacker)]);

        // act
        const receipt = chain.mineBlock([
          clients.core.stackTokens(amountTokens, lockPeriod, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_STACKING_NOT_AVAILABLE);
      });

      it("throws ERR_CANNOT_STACK while trying to stack with lock period = 0", (chain, accounts, clients) => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 200;
        const lockPeriod = 0;
        const block = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(stacker),
          clients.token.ftMint(amountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + CoreClient.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const receipt = chain.mineBlock([
          clients.core.stackTokens(amountTokens, lockPeriod, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_CANNOT_STACK);
      });

      it("throws ERR_CANNOT_STACK while trying to stack with lock period > 32", (chain, accounts, clients) => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 200;
        const lockPeriod = 33;
        const block = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(stacker),
          clients.token.ftMint(amountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + CoreClient.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const receipt = chain.mineBlock([
          clients.core.stackTokens(amountTokens, lockPeriod, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_CANNOT_STACK);
      });

      it("throws ERR_CANNOT_STACK while trying to stack with amount tokens = 0", (chain, accounts, clients) => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 0;
        const lockPeriod = 5;
        const block = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(stacker),
          clients.token.ftMint(amountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + CoreClient.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const receipt = chain.mineBlock([
          clients.core.stackTokens(amountTokens, lockPeriod, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_CANNOT_STACK);
      });

      it("throws ERR_FT_INSUFFICIENT_BALANCE while trying to stack with amount tokens > user balance", (chain, accounts, clients) => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 20;
        const lockPeriod = 5;
        const block = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(stacker),
          clients.token.ftMint(amountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + CoreClient.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const receipt = chain.mineBlock([
          clients.core.stackTokens(amountTokens + 1, lockPeriod, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_FT_INSUFFICIENT_BALANCE);
      });

      it("succeeds and cause one ft_transfer_event to core contract", (chain, accounts, clients) => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 20;
        const lockPeriod = 5;
        const block = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(stacker),
          clients.token.ftMint(amountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + CoreClient.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const receipt = chain.mineBlock([
          clients.core.stackTokens(amountTokens, lockPeriod, stacker),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);
        receipt.events.expectFungibleTokenTransferEvent(
          amountTokens,
          stacker.address,
          clients.core.getContractAddress(),
          "citycoins"
        );
      });

      it("succeeds when called more than once", (chain, accounts, clients) => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 20;
        const lockPeriod = 5;
        const block = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(stacker),
          clients.token.ftMint(amountTokens * 3, stacker),
        ]);
        const activationBlockHeight =
          block.height + CoreClient.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const mineTokensTx = clients.core.stackTokens(
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
          assertEquals(receipt.events.length, 1);

          receipt.events.expectFungibleTokenTransferEvent(
            amountTokens,
            stacker.address,
            clients.core.getContractAddress(),
            "citycoins"
          );
        });
      });

      it("remembers when tokens should be returned when locking period = 1", (chain, accounts, clients) => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 20;
        const lockPeriod = 1;
        const block = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(stacker),
          clients.token.ftMint(amountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + CoreClient.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        chain.mineBlock([
          clients.core.stackTokens(amountTokens, lockPeriod, stacker),
        ]);

        // assert
        const rewardCycle = 1;
        const userId = 1;
        const result = clients.core.getStackerAtCycleOrDefault(
          rewardCycle,
          userId
        ).result;

        assertEquals(result.expectTuple(), {
          amountStacked: types.uint(amountTokens),
          toReturn: types.uint(amountTokens),
        });
      });

      it("remembers when tokens should be returned when locking period > 1", (chain, accounts, clients) => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 20;
        const lockPeriod = 8;
        const block = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(stacker),
          clients.token.ftMint(amountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + CoreClient.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        chain.mineBlock([
          clients.core.stackTokens(amountTokens, lockPeriod, stacker),
        ]);

        // assert
        const userId = 1;

        for (let rewardCycle = 1; rewardCycle <= lockPeriod; rewardCycle++) {
          const result = clients.core.getStackerAtCycleOrDefault(
            rewardCycle,
            userId
          ).result;

          assertEquals(result.expectTuple(), {
            amountStacked: types.uint(amountTokens),
            toReturn: types.uint(rewardCycle === lockPeriod ? amountTokens : 0),
          });
        }
      });

      it("remembers when tokens should be returned when stacking multiple times with different locking periods", (chain, accounts, clients) => {
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
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(stacker),
          clients.token.ftMint(totalAmountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + CoreClient.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        stackingRecords.forEach((record) => {
          // move chain tip to the beginning of specific cycle
          chain.mineEmptyBlockUntil(
            activationBlockHeight +
              record.stackInCycle * CoreClient.REWARD_CYCLE_LENGTH
          );

          chain.mineBlock([
            clients.core.stackTokens(
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

          const result = clients.core.getStackerAtCycleOrDefault(
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
    });
  });

  //////////////////////////////////////////////////
  // STACKING REWARD CLAIMS
  //////////////////////////////////////////////////

  describe("STACKING REWARD CLAIMS", () => {
    describe("claim-stacking-reward()", () => {
      it("throws ERR_STACKING_NOT_AVAILABLE when stacking is not yet available", (chain, accounts, clients) => {
        // arrange
        const stacker = accounts.get("wallet_1")!;
        const targetCycle = 1;

        // act
        const receipt = chain.mineBlock([
          clients.core.claimStackingReward(targetCycle, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_STACKING_NOT_AVAILABLE);
      });

      it("throws ERR_USER_ID_NOT_FOUND when called by unknown user", (chain, accounts, clients) => {
        // arrange
        const stacker = accounts.get("wallet_1")!;
        const otherUser = accounts.get("wallet_2")!;
        const targetCycle = 1;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(otherUser),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1
        );

        // act
        const receipt = chain.mineBlock([
          clients.core.claimStackingReward(targetCycle, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_USER_ID_NOT_FOUND);
      });

      it("throws ERR_REWARD_CYCLE_NOT_COMPLETED when reward cycle is not completed", (chain, accounts, clients) => {
        // arrange
        const stacker = accounts.get("wallet_1")!;
        const targetCycle = 1;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(stacker),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreClient.ACTIVATION_DELAY - 1
        );

        // act
        const receipt = chain.mineBlock([
          clients.core.claimStackingReward(targetCycle, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_REWARD_CYCLE_NOT_COMPLETED);
      });

      it("throws ERR_NOTHING_TO_REDEEM when stacker didn't stack at all", (chain, accounts, clients) => {
        // arrange
        const stacker = accounts.get("wallet_1")!;
        const targetCycle = 1;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(stacker),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height +
            CoreClient.ACTIVATION_DELAY +
            CoreClient.REWARD_CYCLE_LENGTH * 2 -
            1
        );

        // act
        const receipt = chain.mineBlock([
          clients.core.claimStackingReward(targetCycle, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_NOTHING_TO_REDEEM);
      });

      it("throws ERR_NOTHING_TO_REDEEM when stacker stacked in a cycle but miners did not mine", (chain, accounts, clients) => {
        // arrange
        const stacker = accounts.get("wallet_1")!;
        const targetCycle = 1;
        const amount = 200;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(stacker),
          clients.token.ftMint(amount, stacker),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreClient.ACTIVATION_DELAY + 1
        );
        chain.mineBlock([clients.core.stackTokens(amount, 4, stacker)]);
        chain.mineEmptyBlock(CoreClient.REWARD_CYCLE_LENGTH * 2);

        // act
        const receipt = chain.mineBlock([
          clients.core.claimStackingReward(targetCycle, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_NOTHING_TO_REDEEM);
      });

      it("throws ERR_NOTHING_TO_REDEEM while trying to claim reward 2nd time", (chain, accounts, clients) => {
        // arrange
        const stacker = accounts.get("wallet_1")!;
        const targetCycle = 1;
        const amount = 200;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(stacker),
          clients.token.ftMint(amount, stacker),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreClient.ACTIVATION_DELAY + 1
        );
        chain.mineBlock([clients.core.stackTokens(amount, 1, stacker)]);
        chain.mineEmptyBlock(CoreClient.REWARD_CYCLE_LENGTH * 2);

        // act
        const receipt = chain.mineBlock([
          clients.core.claimStackingReward(targetCycle, stacker),
          clients.core.claimStackingReward(targetCycle, stacker),
        ]).receipts[1];

        // assert
        receipt.result
          .expectErr()
          .expectUint(CoreClient.ErrCode.ERR_NOTHING_TO_REDEEM);
      });

      it("succeeds and cause stx_transfer and ft_transfer events", (chain, accounts, clients) => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amountUstx = 1000;
        const stacker = accounts.get("wallet_2")!;
        const targetCycle = 1;
        const amountTokens = 200;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(stacker),
          clients.token.ftMint(amountTokens, stacker),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreClient.ACTIVATION_DELAY + 1
        );
        chain.mineBlock([clients.core.stackTokens(amountTokens, 1, stacker)]);
        chain.mineEmptyBlock(CoreClient.REWARD_CYCLE_LENGTH);
        chain.mineBlock([clients.core.mineTokens(amountUstx, miner)]);
        chain.mineEmptyBlock(CoreClient.REWARD_CYCLE_LENGTH);

        // act
        const receipt = chain.mineBlock([
          clients.core.claimStackingReward(targetCycle, stacker),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);
        assertEquals(receipt.events.length, 2);

        receipt.events.expectFungibleTokenTransferEvent(
          amountTokens,
          clients.core.getContractAddress(),
          stacker.address,
          "citycoins"
        );

        receipt.events.expectSTXTransferEvent(
          amountUstx * 0.7,
          clients.core.getContractAddress(),
          stacker.address
        );
      });

      it("succeeds and cause only ft_transfer event when there was no STX reward (ie. due to no miners)", (chain, accounts, clients) => {
        // arrange
        const stacker = accounts.get("wallet_1")!;
        const amountTokens = 20;
        const targetCycle = 1;
        const setupBlock = chain.mineBlock([
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(stacker),
          clients.token.ftMint(amountTokens, stacker),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + CoreClient.ACTIVATION_DELAY + 1
        );
        chain.mineBlock([clients.core.stackTokens(amountTokens, 1, stacker)]);
        chain.mineEmptyBlock(CoreClient.REWARD_CYCLE_LENGTH * 2);

        // act
        const receipt = chain.mineBlock([
          clients.core.claimStackingReward(targetCycle, stacker),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);

        receipt.events.expectFungibleTokenTransferEvent(
          amountTokens,
          clients.core.getContractAddress(),
          stacker.address,
          "citycoins"
        );
      });

      it("succeeds and release tokens only for last cycle in locked period", (chain, accounts, clients) => {
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
          clients.core.testInitializeCore(clients.core.getContractAddress()),
          clients.core.unsafeSetActivationThreshold(1),
          clients.core.registerUser(stacker),
          clients.token.ftMint(totalAmountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + CoreClient.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        stackingRecords.forEach((record) => {
          // move chain tip to the beginning of specific cycle
          chain.mineEmptyBlockUntil(
            activationBlockHeight +
              record.stackInCycle * CoreClient.REWARD_CYCLE_LENGTH
          );

          chain.mineBlock([
            clients.core.stackTokens(
              record.amountTokens,
              record.lockPeriod,
              stacker
            ),
          ]);
        });

        chain.mineEmptyBlockUntil(
          CoreClient.REWARD_CYCLE_LENGTH * (maxCycle + 1)
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
            clients.core.claimStackingReward(rewardCycle, stacker),
          ]).receipts[0];

          if (toReturn === 0) {
            receipt.result.expectErr();
          } else {
            receipt.result.expectOk().expectBool(true);
            assertEquals(receipt.events.length, 1);

            receipt.events.expectFungibleTokenTransferEvent(
              toReturn,
              clients.core.getContractAddress(),
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

  // describe("TOKEN CONFIGURATION", () => {});

  //////////////////////////////////////////////////
  // UTILITIES
  //////////////////////////////////////////////////

  // describe("UTILITIES", () => {});
});
