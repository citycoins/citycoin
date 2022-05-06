import { assertEquals, describe, run, Chain, beforeEach, it } from "../../../../../deps.ts";
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
  coreV2 = ctx.models.get(NewYorkCityCoinCoreModelV2, "newyorkcitycoin-core-v2");
  chain.mineEmptyBlock(59000);
});

describe("[NewYorkCityCoin Core v2]", () => {
  //////////////////////////////////////////////////
  // MINING CLAIM ACTIONS
  //////////////////////////////////////////////////
  describe("MINING CLAIM ACTIONS", () => {
    describe("claim-mining-reward()", () => {
      it("fails with ERR_USER_NOT_FOUND when called by non-registered user or user who didn't mine at all", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;

        // act
        const receipt = chain.mineBlock([
          coreV2.claimMiningReward(0, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_USER_ID_NOT_FOUND);
      });

      it("fails with ERR_NO_MINERS_AT_BLOCK when called with block height at which nobody decided to mine", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        chain.mineBlock([])
        chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.registerUser(miner)
        ]);

        // act
        const receipt = chain.mineBlock([
          coreV2.claimMiningReward(0, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_NO_MINERS_AT_BLOCK);
      });

      it("fails with ERR_USER_DID_NOT_MINE_IN_BLOCK when called by user who didn't mine specific block", () => {
        // arrange
        const otherMiner = accounts.get("wallet_4")!;
        const miner = accounts.get("wallet_2")!;
        const amount = 2000;
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([
          coreV2.mineTokens(amount, otherMiner),
        ]);

        // act
        const receipt = chain.mineBlock([
          coreV2.claimMiningReward(block.height - 1, miner),
        ]);

        // assert
        receipt.receipts[0].result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_USER_DID_NOT_MINE_IN_BLOCK);
      });

      it("fails with ERR_CLAIMED_BEFORE_MATURITY when called before maturity window passes", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2000;
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([coreV2.mineTokens(amount, miner)]);

        // act
        const receipt = chain.mineBlock([
          coreV2.claimMiningReward(block.height - 1, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_CLAIMED_BEFORE_MATURITY);
      });

      it("fails with ERR_REWARD_ALREADY_CLAIMED when trying to claim rewards a 2nd time", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2000;
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([coreV2.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModelV2.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          coreV2.claimMiningReward(block.height - 1, miner),
          coreV2.claimMiningReward(block.height - 1, miner),
        ]).receipts[1];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_REWARD_ALREADY_CLAIMED);
      });

      it("fails with ERR_MINER_DID_NOT_WIN when trying to claim reward owed to someone else", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const otherMiner = accounts.get("wallet_3")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([
          coreV2.mineTokens(amount, miner),
          coreV2.mineTokens(amount * 10000, otherMiner),
        ]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModelV2.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          coreV2.claimMiningReward(block.height - 1, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_MINER_DID_NOT_WIN);
      });

      // skipped because contract will be activated based on the
      // original block height and 250,000 bonus period is over
      it.skip("succeeds and mints 250,000,000,000 tokens in 1st issuance cycle, during bonus period", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([coreV2.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModelV2.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          coreV2.claimMiningReward(block.height - 1, miner),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);

        receipt.events.expectFungibleTokenMintEvent(
          250000 * NewYorkCityCoinCoreModelV2.MICRO_CITYCOINS,
          miner.address,
          "newyorkcitycoin"
        );
      });

      it("succeeds and mints 100,000,000,000 tokens in 1st issuance cycle, after bonus period", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([coreV2.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModelV2.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          coreV2.claimMiningReward(block.height - 1, miner),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);

        receipt.events.expectFungibleTokenMintEvent(
          100000 * NewYorkCityCoinCoreModelV2.MICRO_CITYCOINS,
          miner.address,
          "newyorkcitycoin"
        );
      });

      it("succeeds and mints 50,000,000,000 tokens in 2nd issuance cycle", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);

        const targetBlockHeight = NewYorkCityCoinCoreModelV2.NEWYORKCITYCOIN_ACTIVATION_HEIGHT +
          NewYorkCityCoinCoreModelV2.BONUS_PERIOD_LENGTH +
          NewYorkCityCoinCoreModelV2.TOKEN_EPOCH_LENGTH + 1;
        chain.mineEmptyBlockUntil(targetBlockHeight);

        const block = chain.mineBlock([coreV2.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModelV2.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          coreV2.claimMiningReward(block.height - 1, miner),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);

        receipt.events.expectFungibleTokenMintEvent(
          50000 * NewYorkCityCoinCoreModelV2.MICRO_CITYCOINS,
          miner.address,
          "newyorkcitycoin"
        );
      });

      it("succeeds and mints 25,000,000,000 tokens in 3rd issuance cycle", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);

        const targetBlockHeight = NewYorkCityCoinCoreModelV2.NEWYORKCITYCOIN_ACTIVATION_HEIGHT +
          NewYorkCityCoinCoreModelV2.BONUS_PERIOD_LENGTH +
          NewYorkCityCoinCoreModelV2.TOKEN_EPOCH_LENGTH * 3 + 1;
        chain.mineEmptyBlockUntil(targetBlockHeight);

        const block = chain.mineBlock([coreV2.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModelV2.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          coreV2.claimMiningReward(block.height - 1, miner),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);

        receipt.events.expectFungibleTokenMintEvent(
          25000 * NewYorkCityCoinCoreModelV2.MICRO_CITYCOINS,
          miner.address,
          "newyorkcitycoin"
        );
      });

      it("succeeds and mints 12,500,000,000 tokens in 4th issuance cycle", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);

        const targetBlockHeight = NewYorkCityCoinCoreModelV2.NEWYORKCITYCOIN_ACTIVATION_HEIGHT +
          NewYorkCityCoinCoreModelV2.BONUS_PERIOD_LENGTH +
          NewYorkCityCoinCoreModelV2.TOKEN_EPOCH_LENGTH * 7 + 1;
        chain.mineEmptyBlockUntil(targetBlockHeight);

        const block = chain.mineBlock([coreV2.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModelV2.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          coreV2.claimMiningReward(block.height - 1, miner),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);

        receipt.events.expectFungibleTokenMintEvent(
          12500 * NewYorkCityCoinCoreModelV2.MICRO_CITYCOINS,
          miner.address,
          "newyorkcitycoin"
        );
      });

      it("succeeds and mints 6,250,000,000 tokens in 5th issuance cycle", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);

        const targetBlockHeight = NewYorkCityCoinCoreModelV2.NEWYORKCITYCOIN_ACTIVATION_HEIGHT +
          NewYorkCityCoinCoreModelV2.BONUS_PERIOD_LENGTH +
          NewYorkCityCoinCoreModelV2.TOKEN_EPOCH_LENGTH * 15 + 1;
        chain.mineEmptyBlockUntil(targetBlockHeight);

        const block = chain.mineBlock([coreV2.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModelV2.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          coreV2.claimMiningReward(block.height - 1, miner),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);

        receipt.events.expectFungibleTokenMintEvent(
          6250 * NewYorkCityCoinCoreModelV2.MICRO_CITYCOINS,
          miner.address,
          "newyorkcitycoin"
        );
      });

      it("succeeds and mints 3,125,000,000 tokens in final issuance cycle", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(miner),
        ]);

        const targetBlockHeight = NewYorkCityCoinCoreModelV2.NEWYORKCITYCOIN_ACTIVATION_HEIGHT +
          NewYorkCityCoinCoreModelV2.BONUS_PERIOD_LENGTH +
          NewYorkCityCoinCoreModelV2.TOKEN_EPOCH_LENGTH * 31 + 1;
        chain.mineEmptyBlockUntil(targetBlockHeight);

        const block = chain.mineBlock([coreV2.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModelV2.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          coreV2.claimMiningReward(block.height - 1, miner),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);

        receipt.events.expectFungibleTokenMintEvent(
          3125 * NewYorkCityCoinCoreModelV2.MICRO_CITYCOINS,
          miner.address,
          "newyorkcitycoin"
        );
      });
    });

    describe("is-block-winner()", () => {
      it("succeeds and returns false when user is unknown", () => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const minerBlockHeight = 1;

        // act
        const result = coreV2.isBlockWinner(
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
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(user),
        ]);

        // act
        const result = coreV2.isBlockWinner(
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
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight = chain.mineBlock([
          coreV2.mineTokens(200, user2),
        ]).height;

        // act
        const result = coreV2.isBlockWinner(
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
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([coreV2.mineTokens(200, user)]).height - 1;

        // act
        const result = coreV2.isBlockWinner(
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
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([
            coreV2.mineTokens(1, user),
            coreV2.mineTokens(200000, user2),
          ]).height - 1;

        chain.mineEmptyBlockUntil(
          minerBlockHeight + NewYorkCityCoinCoreModelV2.TOKEN_REWARD_MATURITY + 1
        );

        // act
        const result = coreV2.isBlockWinner(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
        coreV2
          .isBlockWinner(user2, minerBlockHeight)
          .result.expectBool(true);
      });

      it("succeeds and returns true when user mined selected block and won it", () => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const user2 = accounts.get("wallet_2")!;

        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([
            coreV2.mineTokens(200000, user),
            coreV2.mineTokens(1, user2),
          ]).height - 1;

        chain.mineEmptyBlockUntil(
          minerBlockHeight + NewYorkCityCoinCoreModelV2.TOKEN_REWARD_MATURITY + 1
        );

        // act
        const result = coreV2.isBlockWinner(
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
        const result = coreV2.canClaimMiningReward(
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
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(user),
        ]);

        // act
        const result = coreV2.canClaimMiningReward(
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
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight = chain.mineBlock([
          coreV2.mineTokens(200, user2),
        ]).height;

        // act
        const result = coreV2.canClaimMiningReward(
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
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([coreV2.mineTokens(200, user)]).height - 1;

        // act
        const result = coreV2.canClaimMiningReward(
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
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([
            coreV2.mineTokens(1, user),
            coreV2.mineTokens(200000, user2),
          ]).height - 1;

        chain.mineEmptyBlockUntil(
          minerBlockHeight + NewYorkCityCoinCoreModelV2.TOKEN_REWARD_MATURITY + 1
        );

        // act
        const result = coreV2.canClaimMiningReward(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(false);
        coreV2
          .canClaimMiningReward(user2, minerBlockHeight)
          .result.expectBool(true);
      });

      it("succeeds and returns false when user mined selected block, won it, but already claimed the reward", () => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const user2 = accounts.get("wallet_2")!;

        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([
            coreV2.mineTokens(200000, user),
            coreV2.mineTokens(1, user2),
          ]).height - 1;

        chain.mineEmptyBlockUntil(
          minerBlockHeight + NewYorkCityCoinCoreModelV2.TOKEN_REWARD_MATURITY + 1
        );
        chain.mineBlock([
          coreV2.claimMiningReward(minerBlockHeight, user),
        ]);

        // act
        const result = coreV2.canClaimMiningReward(
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
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([
            coreV2.mineTokens(200000, user),
            coreV2.mineTokens(1, user2),
          ]).height - 1;

        chain.mineEmptyBlockUntil(
          minerBlockHeight + NewYorkCityCoinCoreModelV2.TOKEN_REWARD_MATURITY + 1
        );

        // act
        const result = coreV2.canClaimMiningReward(
          user,
          minerBlockHeight
        ).result;

        // assert
        result.expectBool(true);
      });
    });
  });
});

run();
