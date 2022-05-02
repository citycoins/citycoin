import { assertEquals, describe, run, Chain, beforeEach, it } from "../../../../../deps.ts";
import { Accounts, Context } from "../../../../../src/context.ts";
import { NewYorkCityCoinCoreModel } from "../../../../../models/cities/nyc/newyorkcitycoin-core.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let core: NewYorkCityCoinCoreModel;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  core = ctx.models.get(NewYorkCityCoinCoreModel, "newyorkcitycoin-core-v1");
});

describe("[NewYorkCityCoin Core]", () => {
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
          core.claimMiningReward(0, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModel.ErrCode.ERR_USER_ID_NOT_FOUND);
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
          .expectUint(NewYorkCityCoinCoreModel.ErrCode.ERR_NO_MINERS_AT_BLOCK);
      });

      it("fails with ERR_USER_DID_NOT_MINE_IN_BLOCK when called by user who didn't mine specific block", () => {
        // arrange
        const otherMiner = accounts.get("wallet_4")!;
        const miner = accounts.get("wallet_2")!;
        const amount = 2000;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModel.ACTIVATION_DELAY - 1;

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
          .expectUint(NewYorkCityCoinCoreModel.ErrCode.ERR_USER_DID_NOT_MINE_IN_BLOCK);
      });

      it("fails with ERR_CLAIMED_BEFORE_MATURITY when called before maturity window passes", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2000;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([core.mineTokens(amount, miner)]);

        // act
        const receipt = chain.mineBlock([
          core.claimMiningReward(block.height - 1, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModel.ErrCode.ERR_CLAIMED_BEFORE_MATURITY);
      });

      it("fails with ERR_REWARD_ALREADY_CLAIMED when trying to claim rewards a 2nd time", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2000;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModel.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          core.claimMiningReward(block.height - 1, miner),
          core.claimMiningReward(block.height - 1, miner),
        ]).receipts[1];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModel.ErrCode.ERR_REWARD_ALREADY_CLAIMED);
      });

      it("fails with ERR_MINER_DID_NOT_WIN when trying to claim reward owed to someone else", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const otherMiner = accounts.get("wallet_3")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([
          core.mineTokens(amount, miner),
          core.mineTokens(amount * 10000, otherMiner),
        ]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModel.TOKEN_REWARD_MATURITY);

        // act
        const receipt = chain.mineBlock([
          core.claimMiningReward(block.height - 1, miner),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModel.ErrCode.ERR_MINER_DID_NOT_WIN);
      });

      it("succeeds and mints 250000 tokens in 1st issuance cycle, during bonus period", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const block = chain.mineBlock([core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModel.TOKEN_REWARD_MATURITY);

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
          "newyorkcitycoin"
        );
      });

      it("succeeds and mints 100000 tokens in 1st issuance cycle, after bonus period", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(
          activationBlockHeight + NewYorkCityCoinCoreModel.BONUS_PERIOD_LENGTH + 1
        );

        const block = chain.mineBlock([core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModel.TOKEN_REWARD_MATURITY);

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
          "newyorkcitycoin"
        );
      });

      it("succeeds and mints 50000 tokens in 2nd issuance cycle", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(
          activationBlockHeight + NewYorkCityCoinCoreModel.TOKEN_HALVING_BLOCKS + 1
        );

        const block = chain.mineBlock([core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModel.TOKEN_REWARD_MATURITY);

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
          "newyorkcitycoin"
        );
      });

      it("succeeds and mints 25000 tokens in 3rd issuance cycle", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(
          activationBlockHeight + NewYorkCityCoinCoreModel.TOKEN_HALVING_BLOCKS * 2 + 1
        );

        const block = chain.mineBlock([core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModel.TOKEN_REWARD_MATURITY);

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
          "newyorkcitycoin"
        );
      });

      it("succeeds and mints 12500 tokens in 4th issuance cycle", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(
          activationBlockHeight + NewYorkCityCoinCoreModel.TOKEN_HALVING_BLOCKS * 3 + 1
        );

        const block = chain.mineBlock([core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModel.TOKEN_REWARD_MATURITY);

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
          "newyorkcitycoin"
        );
      });

      it("succeeds and mints 6250 tokens in 5th issuance cycle", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(
          activationBlockHeight + NewYorkCityCoinCoreModel.TOKEN_HALVING_BLOCKS * 4 + 1
        );

        const block = chain.mineBlock([core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModel.TOKEN_REWARD_MATURITY);

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
          "newyorkcitycoin"
        );
      });

      it("succeeds and mints 3125 tokens in final issuance cycle", () => {
        // arrange
        const miner = accounts.get("wallet_2")!;
        const amount = 2;
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(miner),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(
          activationBlockHeight + NewYorkCityCoinCoreModel.TOKEN_HALVING_BLOCKS * 5 + 1
        );

        const block = chain.mineBlock([core.mineTokens(amount, miner)]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModel.TOKEN_REWARD_MATURITY);

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
          core.testSetActivationThreshold(1),
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
          core.testSetActivationThreshold(1),
          core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModel.ACTIVATION_DELAY - 1;

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
          core.testSetActivationThreshold(1),
          core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModel.ACTIVATION_DELAY - 1;

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
          core.testSetActivationThreshold(1),
          core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([
            core.mineTokens(1, user),
            core.mineTokens(200000, user2),
          ]).height - 1;

        chain.mineEmptyBlockUntil(
          minerBlockHeight + NewYorkCityCoinCoreModel.TOKEN_REWARD_MATURITY + 1
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
          core.testSetActivationThreshold(1),
          core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([
            core.mineTokens(200000, user),
            core.mineTokens(1, user2),
          ]).height - 1;

        chain.mineEmptyBlockUntil(
          minerBlockHeight + NewYorkCityCoinCoreModel.TOKEN_REWARD_MATURITY + 1
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
          core.testSetActivationThreshold(1),
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
          core.testSetActivationThreshold(1),
          core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModel.ACTIVATION_DELAY - 1;

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
          core.testSetActivationThreshold(1),
          core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModel.ACTIVATION_DELAY - 1;

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
          core.testSetActivationThreshold(1),
          core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([
            core.mineTokens(1, user),
            core.mineTokens(200000, user2),
          ]).height - 1;

        chain.mineEmptyBlockUntil(
          minerBlockHeight + NewYorkCityCoinCoreModel.TOKEN_REWARD_MATURITY + 1
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
          core.testSetActivationThreshold(1),
          core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([
            core.mineTokens(200000, user),
            core.mineTokens(1, user2),
          ]).height - 1;

        chain.mineEmptyBlockUntil(
          minerBlockHeight + NewYorkCityCoinCoreModel.TOKEN_REWARD_MATURITY + 1
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
          core.testSetActivationThreshold(1),
          core.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + NewYorkCityCoinCoreModel.ACTIVATION_DELAY - 1;

        chain.mineEmptyBlockUntil(activationBlockHeight);

        const minerBlockHeight =
          chain.mineBlock([
            core.mineTokens(200000, user),
            core.mineTokens(1, user2),
          ]).height - 1;

        chain.mineEmptyBlockUntil(
          minerBlockHeight + NewYorkCityCoinCoreModel.TOKEN_REWARD_MATURITY + 1
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
});

run();
