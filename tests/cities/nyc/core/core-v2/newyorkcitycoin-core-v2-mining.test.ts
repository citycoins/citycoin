import { assertEquals, describe, types, run, Chain, beforeEach, it } from "../../../../../deps.ts";
import { Accounts, Context } from "../../../../../src/context.ts";
import { NewYorkCityCoinCoreModelV2 } from "../../../../../models/cities/nyc/newyorkcitycoin-core-v2.model.ts";
import { NewYorkCityCoinTokenModelV2 } from "../../../../../models/cities/nyc/newyorkcitycoin-token-v2.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let coreV2: NewYorkCityCoinCoreModelV2;
let tokenV2: NewYorkCityCoinTokenModelV2;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  coreV2 = ctx.models.get(NewYorkCityCoinCoreModelV2, "newyorkcitycoin-core-v2");
  tokenV2 = ctx.models.get(NewYorkCityCoinTokenModelV2, "newyorkcitycoin-token-v2");
  chain.mineEmptyBlock(59000);
});

describe("[NewYorkCityCoin Core v2]", () => {
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
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
          coreV2.registerUser(miner2),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([
          coreV2.mineTokens(amount, miner),
          coreV2.mineTokens(amount * 1000, miner2),
        ]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModelV2.TOKEN_REWARD_MATURITY);

        // act
        const result = coreV2.getBlockWinnerId(block.height).result;

        // assert
        result.expectNone();
      });
      it("succeeds and returns block winner ID if winner claimed at the block height", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const miner2 = accounts.get("wallet_3")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
          coreV2.registerUser(miner2),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([
          coreV2.mineTokens(amount, miner),
          coreV2.mineTokens(amount * 1000, miner2),
        ]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModelV2.TOKEN_REWARD_MATURITY);
        chain.mineBlock([
          coreV2.claimMiningReward(block.height - 1, miner2),
        ]);
        // act
        const result = coreV2.getBlockWinnerId(block.height - 1).result;

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
      it("fails with ERR_CONTRACT_NOT_ACTIVATED while trying to mine before the contract is initialized", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amountUstx = 200;

        // act
        const receipt = chain.mineBlock([
          coreV2.mineTokens(amountUstx, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_CONTRACT_NOT_ACTIVATED);
      });
      it.skip("fails with ERR_CONTRACT_NOT_ACTIVATED while trying to mine before the activation target is reached", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amountUstx = 200;
        chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);

        // act
        const receipt = chain.mineBlock([
          coreV2.mineTokens(amountUstx, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_CONTRACT_NOT_ACTIVATED);
      });

      it("fails with ERR_INSUFFICIENT_COMMITMENT while trying to mine with 0 commitment", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amountUstx = 0;
        const block = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);
        const activationBlockHeight =
          block.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;
        chain.mineEmptyBlock(activationBlockHeight);

        // act
        const receipt = chain.mineBlock([
          coreV2.mineTokens(amountUstx, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_INSUFFICIENT_COMMITMENT);
      });

      it("fails with ERR_INSUFFICIENT_BALANCE while trying to mine with commitment larger than current balance", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amountUstx = miner.balance + 1;
        const block = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);
        const activationBlockHeight =
          block.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;
        chain.mineEmptyBlock(activationBlockHeight);

        // act
        const receipt = chain.mineBlock([
          coreV2.mineTokens(amountUstx, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_INSUFFICIENT_BALANCE);
      });

      it("succeeds and emits one stx_transfer event to city wallet during first cycle", () => {
        // arrange
        const cityWallet = accounts.get("nyc_wallet")!;
        const miner = accounts.get("wallet_2")!;
        const amountUstx = 200;
        const block = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetCityWallet(cityWallet),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          block.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY
        );

        // act
        const receipt = chain.mineBlock([
          coreV2.mineTokens(amountUstx, miner),
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
        const cityWallet = accounts.get("nyc_wallet")!;
        const miner = accounts.get("wallet_2")!;
        const amountUstx = 200;
        const amountTokens = 500;
        const block = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetCityWallet(cityWallet),
          tokenV2.testMint(amountTokens, miner),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);

        const activationBlockHeight =
          block.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;
        const cycle1FirstBlockHeight =
          activationBlockHeight + NewYorkCityCoinCoreModelV2.REWARD_CYCLE_LENGTH;

        chain.mineEmptyBlockUntil(activationBlockHeight);
        chain.mineBlock([coreV2.stackTokens(amountTokens, 1, miner)]);
        chain.mineEmptyBlockUntil(cycle1FirstBlockHeight);

        // act
        const receipt = chain.mineBlock([
          coreV2.mineTokens(amountUstx, miner),
        ]).receipts[0];

        //assert
        receipt.result.expectOk().expectBool(true);
        assertEquals(receipt.events.length, 2);

        receipt.events.expectSTXTransferEvent(
          amountUstx * NewYorkCityCoinCoreModelV2.SPLIT_CITY_PCT,
          miner.address,
          cityWallet.address
        );

        receipt.events.expectSTXTransferEvent(
          amountUstx * (1 - NewYorkCityCoinCoreModelV2.SPLIT_CITY_PCT),
          miner.address,
          coreV2.address
        );
      });

      it("succeeds and prints memo when supplied", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amountUstx = 200;
        const memo = new TextEncoder().encode("hello world");
        const block = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);

        const activationBlockHeight =
          block.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const receipt = chain.mineBlock([
          coreV2.mineTokens(amountUstx, miner, memo),
        ]).receipts[0];

        //assert
        receipt.result.expectOk().expectBool(true);
        assertEquals(receipt.events.length, 2);

        const expectedEvent = {
          type: "contract_event",
          contract_event: {
            contract_identifier: coreV2.address,
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
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);

        const activationBlockHeight =
          block.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const mineTokensTx = coreV2.mineTokens(amountUstx, miner, memo);
        const receipts = chain.mineBlock([mineTokensTx, mineTokensTx]).receipts;

        //assert
        receipts[0].result.expectOk().expectBool(true);
        receipts[1].result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_USER_ALREADY_MINED);
      });
    });

    describe("mine-many()", () => {
      it("fails with ERR_CONTRACT_NOT_ACTIVATED while trying to mine the before the contract is initialized", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amounts = [1, 2, 3, 4];

        // act
        const receipt = chain.mineBlock([coreV2.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_CONTRACT_NOT_ACTIVATED);
      });
      it.skip("fails with ERR_CONTRACT_NOT_ACTIVATED while trying to mine before the activation target is reached", () => {
        // skipped because upgraded deployment will have 0 blocks
        // for the activation delay (target = same as upgrade block)
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amounts = [1, 2, 3, 4];
        chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);
        
        // act
        const receipt = chain.mineBlock([coreV2.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_CONTRACT_NOT_ACTIVATED);
      });

      it("fails with ERR_INSUFFICIENT_COMMITMENT while providing empty list of amounts", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts: number[] = [];
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY
        );

        // act
        const receipt = chain.mineBlock([coreV2.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_INSUFFICIENT_COMMITMENT);
      });

      it("fails with ERR_INSUFFICIENT_COMMITMENT while providing list of amounts filled with 0", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [0, 0, 0, 0];
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY
        );

        // act
        const receipt = chain.mineBlock([coreV2.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_INSUFFICIENT_COMMITMENT);
      });

      it("fails with ERR_INSUFFICIENT_COMMITMENT while providing list of amounts with one or more 0s", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [1, 2, 3, 4, 0, 5, 6, 7];
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY
        );

        // act
        const receipt = chain.mineBlock([coreV2.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_INSUFFICIENT_COMMITMENT);
      });

      it("fails with ERR_INSUFFICIENT_BALANCE when sum of all commitments > miner balance", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [1, miner.balance];
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY
        );

        // act
        const receipt = chain.mineBlock([coreV2.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_INSUFFICIENT_BALANCE);
      });

      it("fails with ERR_USER_ALREADY_MINED when call overlaps already mined blocks", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [1, 2];
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY
        );
        chain.mineBlock([coreV2.mineMany(amounts, miner)]);

        // act
        const receipt = chain.mineBlock([coreV2.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_USER_ALREADY_MINED);
      });

      it("succeeds and emits one stx_transfer event when amounts list has only one value and there are no stackers", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [1];
        const cityWallet = accounts.get("nyc_wallet")!;
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY
        );

        // act
        const receipt = chain.mineBlock([coreV2.mineMany(amounts, miner)])
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
        const cityWallet = accounts.get("nyc_wallet")!;
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY
        );

        // act
        const receipt = chain.mineBlock([
          coreV2.mineMany(amounts, miner)
        ]).receipts[0];

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
        const cityWallet = accounts.get("nyc_wallet")!;
        const amountTokens = 500;
        const block = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetCityWallet(cityWallet),
          tokenV2.testMint(amountTokens, miner),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);

        const activationBlockHeight =
          block.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;
        const cycle1FirstBlockHeight =
          activationBlockHeight + NewYorkCityCoinCoreModelV2.REWARD_CYCLE_LENGTH;

        chain.mineEmptyBlockUntil(activationBlockHeight);
        chain.mineBlock([coreV2.stackTokens(amountTokens, 1, miner)]);
        chain.mineEmptyBlockUntil(cycle1FirstBlockHeight);

        // act
        const receipt = chain.mineBlock([coreV2.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 3);

        const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0);

        receipt.events.expectSTXTransferEvent(
          totalAmount * NewYorkCityCoinCoreModelV2.SPLIT_CITY_PCT,
          miner.address,
          cityWallet.address
        );

        receipt.events.expectSTXTransferEvent(
          totalAmount * (1 - NewYorkCityCoinCoreModelV2.SPLIT_CITY_PCT),
          miner.address,
          coreV2.address
        );
      });

      it("succeeds and emits 2 stx_transfer events when amounts list has multiple values and there is at least one stacker", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [100, 200, 300];
        const cityWallet = accounts.get("nyc_wallet")!;
        const amountTokens = 500;
        const block = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetCityWallet(cityWallet),
          tokenV2.testMint(amountTokens, miner),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);

        const activationBlockHeight =
          block.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;
        const cycle1FirstBlockHeight =
          activationBlockHeight + NewYorkCityCoinCoreModelV2.REWARD_CYCLE_LENGTH;

        chain.mineEmptyBlockUntil(activationBlockHeight);
        chain.mineBlock([coreV2.stackTokens(amountTokens, 1, miner)]);
        chain.mineEmptyBlockUntil(cycle1FirstBlockHeight);

        // act
        const receipt = chain.mineBlock([coreV2.mineMany(amounts, miner)])
          .receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 3);

        const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0);

        receipt.events.expectSTXTransferEvent(
          totalAmount * NewYorkCityCoinCoreModelV2.SPLIT_CITY_PCT,
          miner.address,
          cityWallet.address
        );

        receipt.events.expectSTXTransferEvent(
          totalAmount * (1 - NewYorkCityCoinCoreModelV2.SPLIT_CITY_PCT),
          miner.address,
          coreV2.address
        );
      });

      it("succeeds and saves information that miner mined multiple consecutive blocks", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amounts = [1, 2, 200, 89, 3423];
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY
        );

        // act
        const block = chain.mineBlock([coreV2.mineMany(amounts, miner)]);

        // assert
        const userId = 1;

        amounts.forEach((amount, idx) => {
          coreV2
            .hasMinedAtBlock(block.height + idx - 1, userId)
            .result.expectBool(true);
        });
      });

      it("succeeds and prints tuple with firstBlock and lastBlock when mining only one block", () => {
        const miner = accounts.get("wallet_6")!;
        const amounts = [123];
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY);

        // act
        const block = chain.mineBlock([coreV2.mineMany(amounts, miner)]);

        // assert
        const firstBlock = block.height - 1;
        const lastBlock = firstBlock + amounts.length - 1;
        const expectedPrintMsg = `{firstBlock: ${types.uint(firstBlock)}, lastBlock: ${types.uint(lastBlock)}}`;

        block.receipts[0].events.expectPrintEvent(coreV2.address, expectedPrintMsg);
      });

      it("succeeds and prints tuple with firstBlock and lastBlock when mining multiple blocks", () => {
        const miner = accounts.get("wallet_6")!;
        const amounts = [1, 2, 5, 60];
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);
        chain.mineEmptyBlockUntil(setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY + 145);

        // act
        const block = chain.mineBlock([coreV2.mineMany(amounts, miner)]);

        // assert
        const firstBlock = block.height - 1;
        const lastBlock = firstBlock + amounts.length - 1;
        const expectedPrintMsg = `{firstBlock: ${types.uint(firstBlock)}, lastBlock: ${types.uint(lastBlock)}}`;

        block.receipts[0].events.expectPrintEvent(coreV2.address, expectedPrintMsg);
      });
    });
  });
});

run();
