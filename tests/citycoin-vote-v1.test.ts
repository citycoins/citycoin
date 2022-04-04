import { describe, assertEquals, types, Account, run, Chain, it, beforeEach} from "../deps.ts";
import { CoreModel } from "../models/core.model.ts";
import { TokenModel } from "../models/token.model.ts";
import { VoteModel } from "../models/vote.model.ts";
import { Accounts, Context } from "../src/context.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let core: CoreModel;
let token: TokenModel;
let vote: VoteModel;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  core = ctx.models.get(CoreModel);
  token = ctx.models.get(TokenModel);
  vote = ctx.models.get(VoteModel);
})

describe("[CityCoin Vote]", () => {
  describe("VOTE ACTIONS", () => {
    describe("intialize-contract()", () => {
      it("fails with ERR_UNAUTHORIZED if the contract is already initialized", () => {
        // arrange
        const wallet = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        // act
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, wallet)
        ]);
        const receipt = chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, wallet)
        ]).receipts[0];
        // assert
        receipt.result.expectErr().expectUint(VoteModel.ErrCode.ERR_UNAUTHORIZED);
      });
      it("fails with ERR_UNAUTHORIZED if the sender is not the deployer", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;
        const startHeight = 8500;
        const endHeight = 10600;
        // act
        const receipt = chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, wallet)
        ]).receipts[0];
        // assert
        receipt.result.expectErr().expectUint(VoteModel.ErrCode.ERR_UNAUTHORIZED);
      });
      it("fails with ERR_UNAUTHORIZED if the start height is before the current height", () => {
        // arrange
        const wallet = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        // act
        chain.mineEmptyBlockUntil(startHeight + 1);
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, wallet)
        ]);
        const receipt = chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, wallet)
        ]).receipts[0];
        // assert
        receipt.result.expectErr().expectUint(VoteModel.ErrCode.ERR_UNAUTHORIZED);
      });
      it("fails with ERR_UNAUTHORIZED if the end height is before the start height", () => {
        // arrange
        const wallet = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 8400;
        // act
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, wallet)
        ]);
        const receipt = chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, wallet)
        ]).receipts[0];
        // assert
        receipt.result.expectErr().expectUint(VoteModel.ErrCode.ERR_UNAUTHORIZED);
      });
      it("succeeds and updates the start and end block height variables", () => {
        // arrange
        const wallet = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        // act
        const receipt = chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, wallet)
        ]).receipts[0];
        // assert
        receipt.result.expectOk();
      });
    })
    describe("vote-on-proposal()", () => {
      it("fails with ERR_PROPOSAL_NOT_ACTIVE when called before proposal is active", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer)
        ]);
        // act
        const receipt = chain.mineBlock([
          vote.voteOnProposal(true, wallet)
        ]).receipts[0];
        // assert
        receipt.result.expectErr().expectUint(VoteModel.ErrCode.ERR_PROPOSAL_NOT_ACTIVE);
      });
      it("fails with ERR_PROPOSAL_NOT_ACTIVE when called after proposal is active", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer)
        ]);
        chain.mineEmptyBlockUntil(VoteModel.VOTE_END_BLOCK + 1);
        // act
        const receipt = chain.mineBlock([
          vote.voteOnProposal(true, wallet)
        ]).receipts[0];
        // assert
        receipt.result.expectErr().expectUint(VoteModel.ErrCode.ERR_PROPOSAL_NOT_ACTIVE);
      });
      it("fails with ERR_NOTHING_STACKED when sender has no stacked tokens", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer)
        ]);
        chain.mineEmptyBlock(VoteModel.VOTE_START_BLOCK + 1);
        // act
        const receipt = chain.mineBlock([
          vote.voteOnProposal(true, wallet)
        ]).receipts[0];
        // assert
        receipt.result.expectErr().expectUint(VoteModel.ErrCode.ERR_NOTHING_STACKED);
      });
      it("succeeds with one yes vote when called by a new voter", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;
        const amountCycle1 = 1000;
        const amountCycle2 = 2000;
        const lockPeriod = 5;
        const miaVote = Math.round(
          ((amountCycle1 * 2 + amountCycle2) / 2) * VoteModel.MIA_SCALE_FACTOR
        );
        const nycVote = (amountCycle1 * 2 + amountCycle2) / 2;
        
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(wallet),
          token.ftMint(amountCycle1 + amountCycle2, wallet),
        ]);
        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // initialize the vote contract
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer)
        ]);
  
        // stack in cycles 2-3
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        const stack1 = chain.mineBlock([
          core.stackTokens(amountCycle1, lockPeriod, wallet),
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        const stack2 = chain.mineBlock([
          core.stackTokens(amountCycle2, lockPeriod, wallet),
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
  
        chain.mineEmptyBlockUntil(VoteModel.VOTE_START_BLOCK + 1);
  
        // act
        const receipt = chain.mineBlock([
          vote.voteOnProposal(true, wallet)
        ]).receipts[0];
  
        // set vote information to verify
        const expectedProposalRecord = {
          noCount: types.uint(0),
          noMia: types.uint(0),
          noNyc: types.uint(0),
          noTotal: types.uint(0),
          yesCount: types.uint(1),
          yesMia: types.uint(miaVote),
          yesNyc: types.uint(nycVote),
          yesTotal: types.uint(miaVote + nycVote)
        }
  
        // set voter information to verify
        const expectedVoterRecord = {
          mia: types.uint(miaVote),
          nyc: types.uint(nycVote),
          total: types.uint(miaVote + nycVote),
          vote: types.bool(true)
        }
  
        const proposalRecord = vote.getProposalVotes().result;
        const voterRecord = vote.getVoterInfo(wallet).result;
  
        // assert
        receipt.result.expectOk();
        assertEquals(proposalRecord.expectSome().expectTuple(), expectedProposalRecord);
        assertEquals(voterRecord.expectOk().expectTuple(), expectedVoterRecord);
      });
      it("succeeds with two yes votes and one no vote when called by a three new voters", () => {
        // arrange
        const wallet_1 = accounts.get("wallet_1")!;
        const wallet_2 = accounts.get("wallet_2")!;
        const wallet_3 = accounts.get("wallet_3")!;
        const amountCycle1 = 1000;
        const amountCycle2 = 2000;
        const lockPeriod = 5;
        const miaVote = Math.round(
          ((amountCycle1 * 2 + amountCycle2) / 2) * VoteModel.MIA_SCALE_FACTOR
        );
        const nycVote = (amountCycle1 * 2 + amountCycle2) / 2;
        
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(wallet_1),
          token.ftMint(amountCycle1 + amountCycle2, wallet_1),
          token.ftMint(amountCycle1 + amountCycle2, wallet_2),
          token.ftMint(amountCycle1 + amountCycle2, wallet_3)
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // initialize the vote contract
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer)
        ]);
  
        // stack in cycles 2-3
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        chain.mineBlock([
          core.stackTokens(amountCycle1, lockPeriod, wallet_1),
          core.stackTokens(amountCycle1, lockPeriod, wallet_2),
          core.stackTokens(amountCycle1, lockPeriod, wallet_3)
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        chain.mineBlock([
          core.stackTokens(amountCycle2, lockPeriod, wallet_1),
          core.stackTokens(amountCycle2, lockPeriod, wallet_2),
          core.stackTokens(amountCycle2, lockPeriod, wallet_3)
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
  
        chain.mineEmptyBlockUntil(VoteModel.VOTE_START_BLOCK + 1);
  
        // act
        const block = chain.mineBlock([
          vote.voteOnProposal(true, wallet_1),
          vote.voteOnProposal(true, wallet_2),
          vote.voteOnProposal(false, wallet_3),
        ]);
  
        const voterReceipt_1 = block.receipts[0];
        const voterReceipt_2 = block.receipts[1];
        const voterReceipt_3 = block.receipts[2];
  
        // set vote information to verify
        const expectedProposalRecord = {
          noCount: types.uint(1),
          noMia: types.uint(miaVote),
          noNyc: types.uint(nycVote),
          noTotal: types.uint(miaVote + nycVote),
          yesCount: types.uint(2),
          yesMia: types.uint(miaVote * 2),
          yesNyc: types.uint(nycVote * 2),
          yesTotal: types.uint((miaVote + nycVote) * 2)
        }
  
        // set voter information to verify
        const expectedVoterRecord_1 = {
          mia: types.uint(miaVote),
          nyc: types.uint(nycVote),
          total: types.uint(miaVote + nycVote),
          vote: types.bool(true)
        }
        const expectedVoterRecord_2 = {
          mia: types.uint(miaVote),
          nyc: types.uint(nycVote),
          total: types.uint(miaVote + nycVote),
          vote: types.bool(true)
        }
        const expectedVoterRecord_3 = {
          mia: types.uint(miaVote),
          nyc: types.uint(nycVote),
          total: types.uint(miaVote + nycVote),
          vote: types.bool(false)
        }
  
        // get records to review
        const proposalRecord = vote.getProposalVotes().result;
        const voterRecord_1 = vote.getVoterInfo(wallet_1).result;
        const voterRecord_2 = vote.getVoterInfo(wallet_2).result;
        const voterRecord_3 = vote.getVoterInfo(wallet_3).result;
  
        // assert
        voterReceipt_1.result.expectOk();
        voterReceipt_2.result.expectOk();
        voterReceipt_3.result.expectOk();
        assertEquals(proposalRecord.expectSome().expectTuple(), expectedProposalRecord);
        assertEquals(voterRecord_1.expectOk().expectTuple(), expectedVoterRecord_1);
        assertEquals(voterRecord_2.expectOk().expectTuple(), expectedVoterRecord_2);
        assertEquals(voterRecord_3.expectOk().expectTuple(), expectedVoterRecord_3);
      });
      it("fails with ERR_VOTE_ALREADY_CAST when called by an existing voter with the same vote", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;
        const amountCycle1 = 1000;
        const amountCycle2 = 2000;
        const lockPeriod = 5;

        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(wallet),
          token.ftMint(amountCycle1 + amountCycle2, wallet),
        ]);
        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // initialize the vote contract
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer)
        ]);
  
        // stack in cycles 2-3
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        chain.mineBlock([
          core.stackTokens(amountCycle1, lockPeriod, wallet),
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        chain.mineBlock([
          core.stackTokens(amountCycle2, lockPeriod, wallet),
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
  
        chain.mineEmptyBlockUntil(VoteModel.VOTE_START_BLOCK + 1);
  
        // act
  
        // vote no
        chain.mineBlock([
          vote.voteOnProposal(false, wallet)
        ]);
  
        // vote no again
        const receipt = chain.mineBlock([
          vote.voteOnProposal(false, wallet)
        ]).receipts[0];
  
        // assert
        receipt.result.expectErr().expectUint(VoteModel.ErrCode.ERR_VOTE_ALREADY_CAST)
      });
      it("succeeds when called by an existing voter with the a different vote", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;
        const amountCycle1 = 1000;
        const amountCycle2 = 2000;
        const lockPeriod = 5;
        const miaVote = Math.round(
          ((amountCycle1 * 2 + amountCycle2) / 2) * VoteModel.MIA_SCALE_FACTOR
        );
        const nycVote = (amountCycle1 * 2 + amountCycle2) / 2;

        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(wallet),
          token.ftMint(amountCycle1 + amountCycle2, wallet),
        ]);
        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // initialize the vote contract
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer)
        ]);
  
        // stack in cycles 2-3
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        chain.mineBlock([
          core.stackTokens(amountCycle1, lockPeriod, wallet),
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        chain.mineBlock([
          core.stackTokens(amountCycle2, lockPeriod, wallet),
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
  
        chain.mineEmptyBlockUntil(VoteModel.VOTE_START_BLOCK + 1);
  
        // act
  
        // vote no
        chain.mineBlock([
          vote.voteOnProposal(false, wallet)
        ]);
  
        // switch vote to yes
        const receipt = chain.mineBlock([
          vote.voteOnProposal(true, wallet)
        ]).receipts[0];
  
        // set vote information to verify
        const expectedProposalRecord = {
          noCount: types.uint(0),
          noMia: types.uint(0),
          noNyc: types.uint(0),
          noTotal: types.uint(0),
          yesCount: types.uint(1),
          yesMia: types.uint(miaVote),
          yesNyc: types.uint(nycVote),
          yesTotal: types.uint(miaVote + nycVote)
        }
  
        // set voter information to verify
        const expectedVoterRecord = {
          mia: types.uint(miaVote),
          nyc: types.uint(nycVote),
          total: types.uint(miaVote + nycVote),
          vote: types.bool(true)
        }
  
        // assert
        const proposalRecord = vote.getProposalVotes().result;
        const voterRecord = vote.getVoterInfo(wallet).result;
  
        // assert
        receipt.result.expectOk();
        assertEquals(proposalRecord.expectSome().expectTuple(), expectedProposalRecord);
        assertEquals(voterRecord.expectOk().expectTuple(), expectedVoterRecord);
      });
      it("succeeds with two yes votes and one no vote when called by a three existing voters that change votes", () => {
        // arrange
        const wallet_1 = accounts.get("wallet_1")!;
        const wallet_2 = accounts.get("wallet_2")!;
        const wallet_3 = accounts.get("wallet_3")!;
        const amountCycle1 = 1000;
        const amountCycle2 = 2000;
        const lockPeriod = 5;
        const miaVote = Math.round(
          ((amountCycle1 * 2 + amountCycle2) / 2) * VoteModel.MIA_SCALE_FACTOR
        );
        const nycVote = (amountCycle1 * 2 + amountCycle2) / 2;
        
        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(wallet_1),
          token.ftMint(amountCycle1 + amountCycle2, wallet_1),
          token.ftMint(amountCycle1 + amountCycle2, wallet_2),
          token.ftMint(amountCycle1 + amountCycle2, wallet_3)
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // initialize the vote contract
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer)
        ]);
  
        // stack in cycles 2-3
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        chain.mineBlock([
          core.stackTokens(amountCycle1, lockPeriod, wallet_1),
          core.stackTokens(amountCycle1, lockPeriod, wallet_2),
          core.stackTokens(amountCycle1, lockPeriod, wallet_3)
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        chain.mineBlock([
          core.stackTokens(amountCycle2, lockPeriod, wallet_1),
          core.stackTokens(amountCycle2, lockPeriod, wallet_2),
          core.stackTokens(amountCycle2, lockPeriod, wallet_3)
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
  
        chain.mineEmptyBlockUntil(VoteModel.VOTE_START_BLOCK + 1);
  
        // act
  
        // vote the opposite way
        chain.mineBlock([
          vote.voteOnProposal(false, wallet_1),
          vote.voteOnProposal(false, wallet_2),
          vote.voteOnProposal(true, wallet_3),
        ]);
  
        // reverse the votes
        const block = chain.mineBlock([
          vote.voteOnProposal(true, wallet_1),
          vote.voteOnProposal(true, wallet_2),
          vote.voteOnProposal(false, wallet_3),
        ]);
  
        const voterReceipt_1 = block.receipts[0];
        const voterReceipt_2 = block.receipts[1];
        const voterReceipt_3 = block.receipts[2];
  
        // set vote information to verify
        const expectedProposalRecord = {
          noCount: types.uint(1),
          noMia: types.uint(miaVote),
          noNyc: types.uint(nycVote),
          noTotal: types.uint(miaVote + nycVote),
          yesCount: types.uint(2),
          yesMia: types.uint(miaVote * 2),
          yesNyc: types.uint(nycVote * 2),
          yesTotal: types.uint((miaVote + nycVote) * 2)
        }
  
        // set voter information to verify
        const expectedVoterRecord_1 = {
          mia: types.uint(miaVote),
          nyc: types.uint(nycVote),
          total: types.uint(miaVote + nycVote),
          vote: types.bool(true)
        }
        const expectedVoterRecord_2 = {
          mia: types.uint(miaVote),
          nyc: types.uint(nycVote),
          total: types.uint(miaVote + nycVote),
          vote: types.bool(true)
        }
        const expectedVoterRecord_3 = {
          mia: types.uint(miaVote),
          nyc: types.uint(nycVote),
          total: types.uint(miaVote + nycVote),
          vote: types.bool(false)
        }
  
        // get records to review
        const proposalRecord = vote.getProposalVotes().result;
        const voterRecord_1 = vote.getVoterInfo(wallet_1).result;
        const voterRecord_2 = vote.getVoterInfo(wallet_2).result;
        const voterRecord_3 = vote.getVoterInfo(wallet_3).result;
  
        // assert
        voterReceipt_1.result.expectOk();
        voterReceipt_2.result.expectOk();
        voterReceipt_3.result.expectOk();
        assertEquals(proposalRecord.expectSome().expectTuple(), expectedProposalRecord);
        assertEquals(voterRecord_1.expectOk().expectTuple(), expectedVoterRecord_1);
        assertEquals(voterRecord_2.expectOk().expectTuple(), expectedVoterRecord_2);
        assertEquals(voterRecord_3.expectOk().expectTuple(), expectedVoterRecord_3);
      });
    });
  });

  describe("VOTE INFO", () => {
    describe("get-proposals()", () => {
      it("succeeds and returns the proposed CCIPs being voted on", () => {
        // arrange
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer)
        ]);
        const expectedResult = {
          CCIP_008: '{hash: "6313738548af393a93f1184f459aa2300fc7a37f", link: "https://github.com/citycoins/governance/blob/feat/community-upgrade-1/ccips/ccip-008/ccip-008-citycoins-sip-010-token-v2.md", name: "CityCoins SIP-010 Token v2"}',
          CCIP_009: '{hash: "7438ad926d6094e241ea6586eed398378cf09041", link: "https://github.com/citycoins/governance/blob/feat/community-upgrade-1/ccips/ccip-009/ccip-009-citycoins-vrf-v2.md", name: "CityCoins VRF v2"}',
          CCIP_010: '{hash: "7438ad926d6094e241ea6586eed398378cf09041", link: "https://github.com/citycoins/governance/blob/feat/community-upgrade-1/ccips/ccip-010/ccip-010-citycoins-auth-v2.md", name: "CityCoins Auth v2"}'
        }
        // act
        const result = vote.getProposals().result;
        // assert
        assertEquals(result.expectOk().expectTuple(), expectedResult);
      });
    });

    describe("get-vote-blocks()", () => {
      it("fails with ERR_CONTRACT_NOT_INITIALIZED if called before contract is initialized", () => {
        // act
        const result = vote.getVoteBlocks().result;
        // assert
        result.expectErr().expectUint(VoteModel.ErrCode.ERR_CONTRACT_NOT_INITIALIZED);
      })
      it("succeeds and returns the starting Stacks block for the vote", () => {
        // arrange
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        const expectedResult = {
          startBlock: types.uint(startHeight),
          endBlock: types.uint(endHeight)
        }
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer)
        ]);
        // act
        const result = vote.getVoteBlocks().result;
        // assert
        assertEquals(result.expectOk().expectTuple(), expectedResult);
      });
    });

    describe("get-vote-start-block()", () => {
      it("fails with ERR_CONTRACT_NOT_INITIALIZED if called before contract is initialized", () => {
        // act
        const result = vote.getVoteStartBlock().result;
        // assert
        result.expectErr().expectUint(VoteModel.ErrCode.ERR_CONTRACT_NOT_INITIALIZED);
      })
      it("succeeds and returns the starting Stacks block for the vote", () => {
        // arrange
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer)
        ]);
        // act
        const result = vote.getVoteStartBlock().result;
        // assert
        result.expectOk().expectUint(VoteModel.VOTE_START_BLOCK);
      });
    });

    describe("get-vote-end-block()", () => {
      it("succeeds and returns the ending Stacks block for the vote", () => {
        // arrange
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer)
        ]);
        // act
        const result = vote.getVoteEndBlock().result;
        // assert
        result.expectOk().expectUint(VoteModel.VOTE_END_BLOCK);
      });
    });

    describe("get-vote-amount()", () => {
      it("succeeds and returns u0 if voter ID is not found", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;
        // act
        const result = vote.getVoteAmount(wallet).result;
        // assert
        result.expectUint(0);
      });
      it("succeeds and returns correct vote amount for stacked MIA and NYC", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;
        const amountCycle1 = 1000;
        const amountCycle2 = 2000;
        const lockPeriod = 5;
        const miaVote = Math.round(
          ((amountCycle1 * 2 + amountCycle2) / 2) * VoteModel.MIA_SCALE_FACTOR
        );
        const nycVote = (amountCycle1 * 2 + amountCycle2) / 2;
        const totalVote = miaVote + nycVote;
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(wallet),
          token.ftMint(amountCycle1 + amountCycle2, wallet),
        ]);
        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);
  
        // stack in cycles 2-3
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        chain.mineBlock([
          core.stackTokens(amountCycle1, lockPeriod, wallet),
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        chain.mineBlock([
          core.stackTokens(amountCycle2, lockPeriod, wallet),
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
  
        chain.mineEmptyBlockUntil(VoteModel.VOTE_START_BLOCK + 1);

        // act
        const result = vote.getVoteAmount(wallet).result;

        // assert
        result.expectUint(totalVote);
      });
    });

    describe("get-proposal-votes()", () => {
      it("succeeds and returns base proposal record with no voters", () => {
        // arrange
        const result = vote.getProposalVotes().result;
        // TODO: refine like SendManyRecord in token model
        const expected = {
          noCount: 0,
          noMia: 0,
          noNyc: 0,
          noTotal: 0,
          yesCount: 0,
          yesMia: 0,
          yesNyc: 0,
          yesTotal: 0
        }
        // assert
        assertEquals(result.expectSome().expectTuple(), {
          noCount: types.uint(expected.noCount),
          noMia: types.uint(expected.noMia),
          noNyc: types.uint(expected.noNyc),
          noTotal: types.uint(expected.noTotal),
          yesCount: types.uint(expected.yesCount),
          yesMia: types.uint(expected.yesMia),
          yesNyc: types.uint(expected.yesNyc),
          yesTotal: types.uint(expected.yesTotal)
        })
      });
    });

    describe("get-voter-index()", () => {
      it("succeeds and returns the voter index", () => {
        // arrange
        const wallet_1 = accounts.get("wallet_1")!;
        const wallet_2 = accounts.get("wallet_2")!;
        const wallet_3 = accounts.get("wallet_3")!;
        // initialize the vote contract
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        const amountCycle1 = 1000;
        const amountCycle2 = 2000;
        const lockPeriod = 5;
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(wallet_1),
          token.ftMint(amountCycle1 + amountCycle2, wallet_1),
          token.ftMint(amountCycle1 + amountCycle2, wallet_2),
          token.ftMint(amountCycle1 + amountCycle2, wallet_3),
        ]);
        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);
  
        // stack in cycles 2-3
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        chain.mineBlock([
          core.stackTokens(amountCycle1, lockPeriod, wallet_1),
          core.stackTokens(amountCycle1, lockPeriod, wallet_2),
          core.stackTokens(amountCycle1, lockPeriod, wallet_3),
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        chain.mineBlock([
          core.stackTokens(amountCycle2, lockPeriod, wallet_1),
          core.stackTokens(amountCycle2, lockPeriod, wallet_2),
          core.stackTokens(amountCycle2, lockPeriod, wallet_3),
        ]);
        // initialize voting contract
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer)
        ]);
        // register voters
        chain.mineEmptyBlockUntil(VoteModel.VOTE_START_BLOCK + 1);
        chain.mineBlock([
          vote.voteOnProposal(true, wallet_1),
          vote.voteOnProposal(false, wallet_2),
          vote.voteOnProposal(true, wallet_3)
        ]);
        // act
        const result = vote.getVoterIndex().result;
        // assert
        result.expectUint(3);
      });
    });
  
    describe("get-voter()", () => {
      it("succeeds and returns none if voter not found", () => {
        // arrange
        const result = vote.getVoter(100).result;
        // assert
        result.expectNone();
      });
      it("succeeds and returns some principal if voter is found", () => {
        const wallet = accounts.get("wallet_1")!;
        const amountTokens = 1000;
        const lockPeriod = 5;
        const expectedId = 1;
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(wallet),
          token.ftMint(amountTokens, wallet),
        ]);
        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // initialize the vote contract
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer)
        ]);
  
        // stack in cycles 2-3
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        chain.mineBlock([
          core.stackTokens(amountTokens / 2, lockPeriod, wallet),
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        chain.mineBlock([
          core.stackTokens(amountTokens / 2, lockPeriod, wallet),
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
  
        chain.mineEmptyBlockUntil(VoteModel.VOTE_START_BLOCK + 1);
  
        // vote yes
        chain.mineBlock([
          vote.voteOnProposal(true, wallet)
        ]);
  
        const result = vote.getVoter(expectedId).result;
  
        result.expectSome().expectPrincipal(wallet.address);
      });
    })
  
    describe("get-voter-id()", () => {
      it("succeeds and returns none if voter ID not found", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;
        const result = vote.getVoterId(wallet).result;
        // assert
        result.expectNone();
      });
      it("succeeds and returns some id if voter ID is found", () => {
        const wallet = accounts.get("wallet_1")!;
        const amountTokens = 1000;
        const lockPeriod = 5;
        const expectedId = 1;
        const block = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.unsafeSetActivationThreshold(1),
          core.registerUser(wallet),
          token.ftMint(amountTokens, wallet),
        ]);
        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // initialize the vote contract
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer)
        ]);
  
        // stack in cycles 2-3
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        chain.mineBlock([
          core.stackTokens(amountTokens / 2, lockPeriod, wallet),
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
        chain.mineBlock([
          core.stackTokens(amountTokens / 2, lockPeriod, wallet),
        ]);
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
  
        chain.mineEmptyBlockUntil(VoteModel.VOTE_START_BLOCK + 1);
  
        // vote yes
        chain.mineBlock([
          vote.voteOnProposal(true, wallet)
        ]);
  
        const result = vote.getVoterId(wallet).result;
  
        result.expectSome().expectUint(expectedId);
      });
    });
  
    describe("get-voter-info()", () => {
      it("fails with ERR_USER_NOT_FOUND if voter not found", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;
        const result = vote.getVoterInfo(wallet).result;
        // assert
        result.expectErr().expectUint(VoteModel.ErrCode.ERR_USER_NOT_FOUND);
      });
    });
  })
});

run();