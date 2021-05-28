import { Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.6.0/index.ts';
import { assertEquals, assert } from "https://deno.land/std@0.93.0/testing/asserts.ts";

import {
  afterEach,
  beforeEach,
  beforeAll,
  describe,
  it,
} from "https://deno.land/x/test_suite@v0.7.0/mod.ts";

import {
  CityCoinClient,
  MinersList,
  MinersRec,
  ErrCode,
  FIRST_STACKING_BLOCK,
  REWARD_CYCLE_LENGTH,
  MINING_ACTIVATION_DELAY,
  MINING_HALVING_BLOCKS,
  SPLIT_STACKER_PERCENTAGE,
  SPLIT_CITY_PERCENTAGE
} from "../src/citycoin-client.ts"

describe('[CityCoin]', () => {
  let chain: Chain;
  let accounts: Map<string, Account>;
  let client: CityCoinClient;
  let deployer: Account;
  let wallet_1: Account;
  let wallet_2: Account;
  let wallet_3: Account;
  let wallet_4: Account;
  let wallet_5: Account;
  let wallet_6: Account;

  function setupCleanEnv() {
    (Deno as any).core.ops();
    let transactions: Array<Tx> = [];
    let result = (Deno as any).core.jsonOpSync("setup_chain", {
      transactions: transactions,
    });

    chain = new Chain(result['session_id']);
    accounts = new Map();

    for (let account of result['accounts']) {
      accounts.set(account.name, account);
    }

    deployer = accounts.get('deployer')!;
    wallet_1 = accounts.get('wallet_1')!;
    wallet_2 = accounts.get('wallet_2')!;
    wallet_3 = accounts.get('wallet_3')!;
    wallet_4 = accounts.get('wallet_4')!;
    wallet_5 = accounts.get('wallet_5')!;
    wallet_6 = accounts.get('wallet_6')!;

    client = new CityCoinClient(chain, deployer);
  }

  describe("SIP-010 api:", () => {
    setupCleanEnv();

    describe("transfer()", () => {
      it("should fail with u3 when token sender is different than transaction sender", () => {
        const from = wallet_1;
        const to = wallet_2;

        const block = chain.mineBlock([
          client.transfer(10, from, to, to)
        ]);

        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectErr().expectUint(3);
      });
    });

    describe("get-name()", () => {
      it("should return 'citycoins'", () => {
        const result = client.getName().result;

        result.expectOk().expectAscii("citycoins");
      });
    });

    describe("get-symbol()", () => {
      it("should return 'CYCN'", () => {
        const result = client.getSymbol().result;

        result.expectOk().expectAscii("CYCN");
      });
    });

    describe("get-decimals()", () => {
      it("should return 0", () => {
        const result = client.getDecimals().result;

        result.expectOk().expectUint(0);
      });
    });

    describe("get-balance-of()", () => {
      it("should return 0", () => {
        const result = client.getBalanceOf(wallet_1).result;

        result.expectOk().expectUint(0);
      });

      it("should return 100", () => {
        chain.mineBlock([
          client.ftMint(100, wallet_1)
        ]);

        const result = client.getBalanceOf(wallet_1).result;

        result.expectOk().expectUint(100);
      });
    });

    describe("get-total-supply()", () => {
      beforeEach(() => {
        setupCleanEnv();
      })

      it("should return 0 if nobody mined", () => {
        const result = client.getTotalSupply().result;

        result.expectOk().expectUint(0);
      });

      it("should return 0 if stackers are not stacking", () => {
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1)
        ]);

        // skip mining activation delay period
        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY)

        chain.mineBlock([
          client.mineTokens(100, wallet_1)
        ]);

        const result = client.getTotalSupply().result;

        result.expectOk().expectUint(0);
      });

      // returns 70% of commitment when stackers are stacking
      it("should return 100 * SPLIT_STACKER_PERCENTAGE when stackers are stacking", () => {
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1)
        ]);
        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
        const startStacksHeight = 105;

        chain.mineBlock([
          client.ftMint(100, wallet_1),
          client.stackTokens(100, startStacksHeight, 1, wallet_1)
        ]);

        chain.mineBlock([
          client.stackTokens(100, startStacksHeight, 1, wallet_1)
        ]);

        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH + 1)

        chain.mineBlock([
          client.mineTokens(100, wallet_1)
        ]);

        const result = client.getTotalSupply().result;

        result.expectOk().expectUint(100 * SPLIT_STACKER_PERCENTAGE);
      });
    });

    describe("get-token-uri()", () => {
      it("should return none", () => {
        const result = client.getTokenUri().result;

        result.expectOk().expectNone();
      });
    });
  });

  describe("Read only functions:", () => {
    setupCleanEnv();

    describe("get-coinbase-amount()", () => {

      it("returns correct coinbase amount based on Stacks block height", () => {
        setupCleanEnv();

        // activate mining
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3)
        ]);

        // advance chain to block where mining is active
        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
        const startHeight = block.block_height - 1;

        const testData = [
          {blockHeight: startHeight - 1, reward: 0},          // prior to mining activation (no reward)
          {blockHeight: startHeight, reward: 250000},         // at mining activation (bonus reward)
          {blockHeight: startHeight + 1, reward: 250000},     // first block after mining activation block (bonus reward)
          {blockHeight: startHeight + 10000, reward: 250000}, // 1000th block after mining activation block (last bonus reward)
          {blockHeight: startHeight + 10001, reward: 100000}, // 1001st block after mining activation block (first standard reward)
          {blockHeight: startHeight + MINING_HALVING_BLOCKS, reward: 100000},              // 1st halving
          {blockHeight: startHeight + MINING_HALVING_BLOCKS + 1, reward: 50000},           // after 1st halving
          {blockHeight: startHeight + (MINING_HALVING_BLOCKS * 2), reward: 50000},         // 2nd halving
          {blockHeight: startHeight + (MINING_HALVING_BLOCKS * 2) + 1, reward: 25000},     // after 2nd halving
          {blockHeight: startHeight + (MINING_HALVING_BLOCKS * 3), reward: 25000},         // 3rd halving
          {blockHeight: startHeight + (MINING_HALVING_BLOCKS * 3) + 1, reward: 12500},     // after 3rd halving
          {blockHeight: startHeight + (MINING_HALVING_BLOCKS * 4), reward: 12500},         // 4th halving
          {blockHeight: startHeight + (MINING_HALVING_BLOCKS * 4) + 1, reward: 6250},      // after 4th halving
          {blockHeight: startHeight + (MINING_HALVING_BLOCKS * 5), reward: 6250},          // 5th halving
          {blockHeight: startHeight + (MINING_HALVING_BLOCKS * 5) + 1, reward: 3125},      // after 5th halving
          {blockHeight: startHeight + (MINING_HALVING_BLOCKS * 5) + 1234, reward: 3125},   // after 5th halving
        ]

        console.log(`\n  mining activated at block ${startHeight}`)

        testData.forEach(t => {
          let result = client.getCoinbaseAmount(t.blockHeight).result;
          
          try {
            result.expectUint(t.reward);
            console.log(`  success at block ${t.blockHeight} with reward ${t.reward}`)
          } catch (error) {
            throw new Error(`Failed to return correct coinbase amount at block ${t.blockHeight}\n${error}`);
          }
        });

      });
    });

    describe("get-block-commit-total()", () => {
      beforeAll(() => {
        setupCleanEnv();
      });

      it("should return 0 when miners list is empty", () => {
        const result = client.getBlockCommitTotal(1).result;
        result.expectUint(0);
      })

      it("should return 100", () => {
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1)
        ]);
        
        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
        
        chain.mineBlock([
          client.mineTokens(30, wallet_1),
          client.mineTokens(70, wallet_2)
        ]);

        const result = client.getBlockCommitTotal(block.block_height).result;

        result.expectUint(100);
      });
    });

    describe("get-block-commit-to-stackers()", () => {
      beforeEach(() => {
        setupCleanEnv();
      });

      it("should return 0 when miners list is empty", () => {
        const result = client.getBlockCommitToStackers(1).result;
        result.expectUint(0);
      })

      it("should return 0 when no stackers are stacking", () => {
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1)
        ]);
        
        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
        
        chain.mineBlock([
          client.mineTokens(30, wallet_1),
          client.mineTokens(70, wallet_2)
        ]);

        const result = client.getBlockCommitToStackers(block.block_height).result;

        result.expectUint(0);
      });

      it("should return 100 * SPLIT_STACKER_PERCENTAGE when stackers are stacking", () => {

        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1)
        ]);

        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        // stack in cycle 1 while cycle 0 is active
        chain.mineBlock([
          client.ftMint(100, wallet_2),
          client.stackTokens(100, 105, 1, wallet_2)
        ]);

        // progress into reward cycle 1
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        // mine during cycle 1, which will be split
        const block = chain.mineBlock([
          client.mineTokens(30, wallet_1),
          client.mineTokens(70, wallet_2)
        ]);

        // check that split stacker commit was stored correctly in map
        const result = client.getBlockCommitToStackers(block.height - 1).result;

        result.expectUint(100 * SPLIT_STACKER_PERCENTAGE);
      });

    });

    describe("get-block-commit-to-city()", () => {
      beforeEach(() => {
        setupCleanEnv();
      });

      it("should return 0 when miners list is empty", () => {
        const result = client.getBlockCommitToCity(1).result;
        result.expectUint(0);
      })

      it("should return 100 when no stackers are stacking", () => {
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1)
        ]);
        
        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
        
        chain.mineBlock([
          client.mineTokens(30, wallet_1),
          client.mineTokens(70, wallet_2)
        ]);

        const result = client.getBlockCommitToCity(block.block_height).result;

        result.expectUint(100);
      });

      it("should return 100 * SPLIT_CITY_PERCENTAGE when stackers are stacking", () => {

        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1)
        ]);

        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        // stack in cycle 1 while cycle 0 is active
        chain.mineBlock([
          client.ftMint(100, wallet_2),
          client.stackTokens(100, 105, 1, wallet_2)
        ]);

        // progress into reward cycle 1
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        // mine during cycle 1, which will be split
        const block = chain.mineBlock([
          client.mineTokens(30, wallet_1),
          client.mineTokens(70, wallet_2)
        ]);

        // check that split stacker commit was stored correctly in map
        const result = client.getBlockCommitToCity(block.height - 1).result;

        result.expectUint(100 * SPLIT_CITY_PERCENTAGE);
      });

    });

    describe("getBlockWinner()", () => {
      it("should select correct winner", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3)
        ]);
        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        const miners = new MinersList();
        miners.push(
          { miner: wallet_1, minerId: 1, amountUstx: 1 },
          { miner: wallet_2, minerId: 2, amountUstx: 2 },
          { miner: wallet_3, minerId: 3, amountUstx: 3 },
        );
        
        chain.mineBlock([
          client.mineTokens(miners[0].amountUstx, miners[0].miner),
          client.mineTokens(miners[1].amountUstx, miners[1].miner),
          client.mineTokens(miners[2].amountUstx, miners[2].miner),
        ]);

        chain.mineEmptyBlock(500)

        const known_rnd_winners = [0, 1, 1, 2, 2, 2, 0, 1, 1, 2, 2, 2, 0]

        known_rnd_winners.forEach((e, i) => {
          let result = client.getBlockWinner(block.block_height, i, miners).result;
          let winner = result.expectSome().expectTuple();
          let expectedWinner = miners.getFormatted(e)

          assertEquals(winner, expectedWinner);
        });
      });

      it("should return no winner if there are no miners", () => {
        const result = client.getBlockWinner(200, 0, new MinersList()).result;

        result.expectNone();
      });
    });

    describe("has-mined()", () => {
      
    
      it("returns true if miner mined selected block", () => {
        setupCleanEnv();
      
        // activate mining
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3)
        ]);

        // advance chain to block where mining is active
        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
        const blockHeight = block.block_height;
        
        chain.mineBlock([
          client.mineTokens(200, wallet_1)
        ]);
        
        const result = client.hasMined(wallet_1, blockHeight).result;

        result.expectBool(true);
      })

      it("returns false if miner didn't mine selected block", () => {
        setupCleanEnv();
        const result = client.hasMined(wallet_2, 800).result;

        result.expectBool(false);
      });
    });

    describe("can-claim-tokens()", () => {
      const miners = new MinersList();
      miners.push(
        { miner: wallet_1, minerId: 1, amountUstx: 1 },
        { miner: wallet_2, minerId: 2, amountUstx: 2 },
        { miner: wallet_3, minerId: 3, amountUstx: 3 },
      );

      let txs = new Array(); 
      miners.forEach((r) => {
        txs.push(client.mineTokens(r.amountUstx, r.miner));
      });
      
      const claimedRec = new MinersRec(miners, true, miners[0]);
      const unclaimedRec = new MinersRec(miners, false, undefined);
      const tokenRewardMaturity = 100;


      it("returns true", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1)
        ]);
        let block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
        chain.mineBlock(txs);

        const claimerStacksBlockHeight = block.block_height;
        const currentStacksBlock = block.block_height + tokenRewardMaturity + 1;

        const results = [
          client.canClaimTokens(wallet_1, claimerStacksBlockHeight, 0, unclaimedRec, currentStacksBlock).result,
          client.canClaimTokens(wallet_2, claimerStacksBlockHeight, 1, unclaimedRec, currentStacksBlock).result,
          client.canClaimTokens(wallet_2, claimerStacksBlockHeight, 2, unclaimedRec, currentStacksBlock).result,
          client.canClaimTokens(wallet_3, claimerStacksBlockHeight, 3, unclaimedRec, currentStacksBlock).result,
          client.canClaimTokens(wallet_3, claimerStacksBlockHeight, 4, unclaimedRec, currentStacksBlock).result,
          client.canClaimTokens(wallet_3, claimerStacksBlockHeight, 5, unclaimedRec, currentStacksBlock).result,
          client.canClaimTokens(wallet_1, claimerStacksBlockHeight, 6, unclaimedRec, currentStacksBlock).result,
        ];

        results.forEach((result) => {
          result.expectOk().expectBool(true);
        });
      });

      it("throws ERR_MINER_ID_NOT_FOUND error", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1)
        ]);
        let block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
        chain.mineBlock(txs);

        const claimerStacksBlockHeight = block.block_height;
        const currentStacksBlock = block.block_height + tokenRewardMaturity + 1;

        const results = [
          client.canClaimTokens(wallet_4, claimerStacksBlockHeight, 0, unclaimedRec, currentStacksBlock).result,
          client.canClaimTokens(wallet_5, claimerStacksBlockHeight, 1, unclaimedRec, currentStacksBlock).result,
          client.canClaimTokens(wallet_6, claimerStacksBlockHeight, 2, unclaimedRec, currentStacksBlock).result,
        ]

        results.forEach((result) => {
          result.expectErr().expectUint(ErrCode.ERR_MINER_ID_NOT_FOUND);
        });
      });

      it("throws ERR_IMMATURE_TOKEN_REWARD", () => {
        const result = client.canClaimTokens(wallet_1, 0, 0, unclaimedRec, tokenRewardMaturity).result;

        result.expectErr().expectUint(ErrCode.ERR_IMMATURE_TOKEN_REWARD);
      });

      it("throws ERR_ALREADY_CLAIMED error", () => {
        const currentStacksBlock = tokenRewardMaturity + 1;
        const result = client.canClaimTokens(wallet_1, 0, 0, claimedRec, currentStacksBlock).result;

        result.expectErr().expectUint(ErrCode.ERR_ALREADY_CLAIMED);
      });
    });

    describe("can-mine-tokens()", () => {
      it("returns true", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
          client.generateMinerId(wallet_3)
        ]);
        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
        const minerId = client.getMinerId(wallet_3);

        const result = client.canMineTokens(wallet_3, minerId, block.block_height, 10).result;

        result.expectOk().expectBool(true);
      });

      it("throws ERR_STACKING_NOT_AVAILABLE error", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.generateMinerId(wallet_3)
        ]);
        const minerId = client.getMinerId(wallet_3)

        const result = client.canMineTokens(wallet_3, minerId, 0, 10).result;

        result.expectErr().expectUint(ErrCode.ERR_STACKING_NOT_AVAILABLE);
      });

      it("throws ERR_ALREADY_MINED error", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
          client.generateMinerId(wallet_1)
        ]);
        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        const block = chain.mineBlock([client.mineTokens(200, wallet_1)]);
        const minerId = client.getMinerId(wallet_1);

        const result = client.canMineTokens(wallet_1, minerId, block.height-1, 10).result;

        result.expectErr().expectUint(ErrCode.ERR_ALREADY_MINED);
      });

      it("throws ERR_CANNOT_MINE error", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
          client.generateMinerId(wallet_3)
        ]);
        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        const result = client.canMineTokens(wallet_3, 1, block.block_height, 0).result;

        result.expectErr().expectUint(ErrCode.ERR_CANNOT_MINE);
      });

      it("throws ERR_INSUFFICIENT_BALANCE error", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
          client.generateMinerId(wallet_3)
        ]);
        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
        const minerId = client.getMinerId(wallet_3);
      
        const result = client.canMineTokens(wallet_3, 1, block.block_height, wallet_3.balance + 1).result;

        result.expectErr().expectUint(ErrCode.ERR_INSUFFICIENT_BALANCE);
      });

      it("throws ERR_TOO_SMALL_COMMITMENT error", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
          client.generateMinerId(wallet_1)
        ]);
        
        const minerId = client.getMinerId(wallet_1);
        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        // fill miners list with 128 fake miners with commitment as low as 2uSTX
        chain.mineBlock([
          Tx.contractCall("citycoin", "setup-32-miners-1", [], deployer.address),
          Tx.contractCall("citycoin", "setup-32-miners-2", [], deployer.address),
          Tx.contractCall("citycoin", "setup-32-miners-3", [], deployer.address),
          Tx.contractCall("citycoin", "setup-32-miners-4", [], deployer.address),
        ]); 
        
        const result = client.canMineTokens(wallet_1, minerId, block.block_height, 1).result;
        
        result.expectErr().expectUint(ErrCode.ERR_TOO_SMALL_COMMITMENT)
      });
    });

    describe("can-stack-tokens()", () => {
      it("throws ERR_CANNOT_STACK error if nowStacksHeight < startStacksHeight", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3)
        ]);

        const nowStacksHeight = 103;
        const startStacksHeight = 102;

        const result = client.canStackTokens(wallet_1, 100, nowStacksHeight, startStacksHeight, 1).result;

        result.expectErr().expectUint(ErrCode.ERR_CANNOT_STACK);
      });

      it("throws ERR_CANNOT_STACK error if lockPeriod=0 or lockPeriod > max-reward-cycles (32)", () => {
        const nowStacksHeight = 502;
        const startStacksHeight = 510;

        const results = [
          client.canStackTokens(wallet_1, 100, nowStacksHeight, startStacksHeight, 0).result,
          client.canStackTokens(wallet_1, 100, nowStacksHeight, startStacksHeight, 33).result,
        ]

        results.forEach((result) => {
          result.expectErr().expectUint(ErrCode.ERR_CANNOT_STACK);
        })
      });

      it("throws ERR_CANNOT_STACK error if amountToken = 0", () => {
        const nowStacksHeight = 502;
        const startStacksHeight = 510;
        const amountToken = 0;

        const result = client.canStackTokens(wallet_1, amountToken, nowStacksHeight, startStacksHeight, 1).result;

        result.expectErr().expectUint(ErrCode.ERR_CANNOT_STACK);
      });

      it("throws ERR_INSUFFICIENT_BALANCE if stacker doesn't have enough tokens", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3)
        ]);

        const nowStacksHeight = 102;
        const startStacksHeight = 103;
        const amountToken = 100000;

        const result = client.canStackTokens(wallet_1, amountToken, nowStacksHeight, startStacksHeight, 1).result;

        result.expectErr().expectUint(ErrCode.ERR_INSUFFICIENT_BALANCE);
      });
    });

    describe("get-entitled-stacking-reward()", () => {

      it("returns 0", () => {
        setupCleanEnv();
        const stacker = wallet_1;
        const targetRewardCycle = 0
        const currentBlockHeight = 0;

        const result = client.getEntitledStackingReward(stacker, targetRewardCycle, currentBlockHeight).result;

        result.expectUint(0);
      });

      it("returns 1000 * SPLIT_STACKER_PERCENTAGE if miners committed only 1000ustx and there is only one stacker", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3)
        ]);
        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        const stacker = wallet_1;
        const miner = wallet_2;
        const minerCommitment = 1000;
        const targetRewardCycle = 1;

        // add tokens and stack them at the next cycle
        chain.mineBlock([
          client.ftMint(5000, stacker),
          client.stackTokens(5000, 105, targetRewardCycle, stacker),
        ]);

        // move chain forward to jump into 1st stacking cycle (skip mining activation delay period)
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        // mine some tokens
        chain.mineBlock([
          client.mineTokens(minerCommitment, miner)
        ]);

        // move chain forward to jump into 2nd stacking cycle
        const block = chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        const result = client.getEntitledStackingReward(stacker, targetRewardCycle, block.block_height).result;

        result.expectUint(minerCommitment * SPLIT_STACKER_PERCENTAGE);
      });
    });

    describe("get-reward-cycle()", () => {
      it("returns None if stacksBlockHeight is equal 0", () => {
        const result = client.getRewardCycle(0).result;

        result.expectNone()
      });

      it("returns Some with correct value when stacksBlockHeight > 100", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3)
        ]);

        const blockHeights = [101, 105, 499, 500, 501, 1001];

        blockHeights.forEach((stacksBlockHeight) => {
          const expectedValue = Math.floor((stacksBlockHeight - FIRST_STACKING_BLOCK) / REWARD_CYCLE_LENGTH);

          const result = client.getRewardCycle(stacksBlockHeight).result;

          result.expectSome().expectUint(expectedValue);
        });
      });
    });

    describe("get-first-block-height-in-reward-cycle", () => {
      it("returns correct value", () => {
        const rewardCycles = [0, 1, 2, 3, 5, 15, 24, 44, 890];

        rewardCycles.forEach((rewardCycle) => {
          const expectedValue = FIRST_STACKING_BLOCK + (REWARD_CYCLE_LENGTH * rewardCycle);

          const result = client.getFirstBlockHeightInRewardCycle(rewardCycle).result;

          result.expectUint(expectedValue);
        });
      });
    })
  });

  describe("Public functions:", () => {
    describe("stack-tokens()", () => {
      beforeEach(() => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3)
        ]);
      })

      it("throws ERR_STACKING_NOT_AVAILABLE error", () => {
        const block = chain.mineBlock([
          client.stackTokens(100, 0, 1, wallet_1)
        ]);

        block.receipts[0].result.expectErr().expectUint(ErrCode.ERR_STACKING_NOT_AVAILABLE);
        assertEquals(block.receipts[0].events.length, 0);
      });

      it("throws ERR_INSUFFICIENT_BALANCE error", () => {
        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        const startStacksHeight = 105;

        const block = chain.mineBlock([
          client.stackTokens(100, startStacksHeight, 1, wallet_1)
        ]);

        block.receipts[0].result.expectErr().expectUint(ErrCode.ERR_INSUFFICIENT_BALANCE);
        assertEquals(block.receipts[0].events.length, 0);
      });

      it("succeeds and causes one ft_transfer_event", () => {
        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
        const startStacksHeight = 105;

        const block = chain.mineBlock([
          client.ftMint(100, wallet_1),
          client.stackTokens(100, startStacksHeight, 1, wallet_1)
        ]);

        // check return value
        block.receipts[1].result.expectOk().expectBool(true);

        // check number of events 
        assertEquals(block.receipts[0].events.length, 1);

        // check events
        block.receipts[1].events.expectFungibleTokenTransferEvent(
          100,
          wallet_1.address,
          client.getContractAddress(),
          "citycoins"
        );

      });
    });

    describe("mine-tokens()", () => {
      beforeEach(() => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3)
        ]);
        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
      });

      it("throws ERR_CANNOT_MINE error when miner wants to commit 0 ustx", () => {
        const block = chain.mineBlock([
          client.mineTokens(0, wallet_1)
        ]);

        const receipt = block.receipts[0];

        receipt.result.expectErr().expectUint(ErrCode.ERR_CANNOT_MINE);

        assertEquals(receipt.events.length, 0)
      });

      it("throws ERR_INSUFFICIENT_BALANCE error when miner wants to commit more than they have", () => {
        const block = chain.mineBlock([
          client.mineTokens(wallet_1.balance + 1, wallet_1)
        ]);

        const receipt = block.receipts[0];

        receipt.result.expectErr().expectUint(ErrCode.ERR_INSUFFICIENT_BALANCE);

        assertEquals(receipt.events.length, 0)
      })

      it("throws ERR_ALREADY_MINED error when miner wants mine twice at the same block", () => {
        const block = chain.mineBlock([
          client.mineTokens(10, wallet_1),
          client.mineTokens(10, wallet_1),
        ]);

        const receipt_err = block.receipts[1];

        receipt_err.result.expectErr().expectUint(ErrCode.ERR_ALREADY_MINED);
        assertEquals(receipt_err.events.length, 0)
      })

      it("succeeds and causes one stx_transfer_event to city-wallet if no stackers stacking", () => {
        const amount = 20000;

        chain.mineBlock([
          client.setCityWallet(wallet_6)
        ])

        const block = chain.mineBlock([
          client.mineTokens(amount, wallet_1)
        ]);

        // check return value
        block.receipts[0].result.expectOk().expectBool(true);

        // check number of events
        assertEquals(block.receipts[0].events.length, 1)

        // check event details
        block.receipts[0].events.expectSTXTransferEvent(
          amount,
          wallet_1.address,
          wallet_6.address
        );
      });

      // modified to two events since 70% to stackers, 30% to city
      it("succeeds and causes two stx_transfer_events if stackers are stacking, one to stackers, one to city", () => {      

        const amount = 20000;
        const startStacksHeight = 105;

        chain.mineBlock([
          client.setCityWallet(wallet_6)
        ])

        chain.mineBlock([
          client.ftMint(100, wallet_1),
          client.stackTokens(100, startStacksHeight, 1, wallet_1)
        ]);

        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH + 1)

        const block = chain.mineBlock([
          client.mineTokens(amount, wallet_1)
        ]);

        // check return value
        block.receipts[0].result.expectOk().expectBool(true);

        // check number of events
        assertEquals(block.receipts[0].events.length, 2)

        // check event details
        const events = block.receipts[0].events;
        events.expectSTXTransferEvent(
          amount * SPLIT_STACKER_PERCENTAGE,
          wallet_1.address,
          client.getContractAddress()
        );
        events.expectSTXTransferEvent(
          amount * SPLIT_CITY_PERCENTAGE,
          wallet_1.address,
          wallet_6.address
        );
      });
    });

    describe("claim-stacking-reward()", () => {
      beforeEach(() => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3)
        ]);
        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
      });

      it("throws ERR_NOTHING_TO_REDEEM error when stacker didn't stack at all", () => {
        const block = chain.mineBlock([
          client.claimStackingReward(0, wallet_1)
        ]);

        const receipt = block.receipts[0];

        receipt.result.expectErr().expectUint(ErrCode.ERR_NOTHING_TO_REDEEM);
        assertEquals(receipt.events.length, 0);
      });

      it("throws ERR_NOTHING_TO_REDEEM error, when stacker want to redeem same reward second time", () => {
        const miner = wallet_1;
        const stacker = wallet_2;

        // add tokens and stack them at the next cycle
        chain.mineBlock([
          client.ftMint(5000, stacker),
          client.stackTokens(5000, 5, 1, stacker),
        ]);

        // advance chain forward to jump into 1st stacking cycle
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        // mine some tokens
        chain.mineBlock([
          client.mineTokens(50000, miner),
        ]);

        // advance chain forward to jump into 2nd stacking cycle
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        // claim first time
        chain.mineBlock([
          client.claimStackingReward(1, stacker),
        ]);

        // try to claim second time
        const block = chain.mineBlock([
          client.claimStackingReward(1, stacker),
        ]);

        const receipt = block.receipts[0];

        receipt.result.expectErr().expectUint(ErrCode.ERR_NOTHING_TO_REDEEM);
        assertEquals(receipt.events.length, 0);
      });


      it("succeeds and causes one stx_transfer_event event", () => {
        const miner_1 = wallet_1;
        const miner_2 = wallet_2
        const stacker = wallet_3;
        const minerCommitment = 2000;

        // add tokens and stack them at the next cycle
        chain.mineBlock([
          client.ftMint(5000, stacker),
          client.stackTokens(5000, 105, 1, stacker),
        ]);

        // advance chain forward to jump into 1st stacking cycle
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        // mine some tokens
        chain.mineBlock([
          client.mineTokens(minerCommitment, miner_1),
          client.mineTokens(minerCommitment, miner_2)
        ]);

        // advance chain forward to jump into 2nd stacking cycle
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        const block = chain.mineBlock([
          client.claimStackingReward(1, stacker)
        ]);

        const receipt = block.receipts[0];

        // check return value
        receipt.result.expectOk().expectBool(true);

        // check events count
        assertEquals(receipt.events.length, 1);

        // check event details
        receipt.events.expectSTXTransferEvent(
          minerCommitment * 2 * SPLIT_STACKER_PERCENTAGE,
          client.getContractAddress(),
          stacker.address
        )
      })
    });

    describe("register-miner", () => {
      it("succeeds with (ok true)", () => {
        setupCleanEnv();

        const block = chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1)
        ]);

        const receipt = block.receipts[0];

        receipt.result.expectOk().expectBool(true);
        assertEquals(receipt.events.length, 0);
      });

      it("fails with ERR_MINER_ALREADY_REGISTERED error when miner wants to register second time", () => {
        setupCleanEnv();

        const block = chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
          client.registerMiner(wallet_1)
        ]);

        const receipt = block.receipts[2];

        receipt.result.expectErr().expectUint(ErrCode.ERR_MINER_ALREADY_REGISTERED);
        assertEquals(receipt.events.length, 0);
      });

      it("fails with ERR_MINING_ACTIVATION_THRESHOLD_REACHED error when miner wants to register after reaching activation threshold", () => {
        setupCleanEnv();

        const block = chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
          client.registerMiner(wallet_2)
        ]);

        const receipt = block.receipts[2];

        receipt.result.expectErr().expectUint(ErrCode.ERR_MINING_ACTIVATION_THRESHOLD_REACHED);
        assertEquals(receipt.events.length, 0);
      })
    });
  });
});
