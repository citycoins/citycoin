import {
  describe,
  assertEquals,
  types,
  run,
  Chain,
  it,
  beforeEach,
  afterEach,
  Account,
} from "../../deps.ts";
import { Accounts, Context } from "../../src/context.ts";
import { CoreModel } from "../../models/base/core.model.ts";
import { TokenModel } from "../../models/base/token.model.ts";
import { VoteModelV2 } from "../../models/vote/vote-v2.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let core: CoreModel;
let token: TokenModel;
let vote: VoteModelV2;

const activateCoreThenStack = (
  wallet: Account,
  amountCycle1: number,
  amountCycle2: number,
  lockPeriod = 5
) => {
  // initialize core contract
  const block = chain.mineBlock([
    core.testInitializeCore(core.address),
    core.testSetActivationThreshold(1),
    core.registerUser(wallet),
    token.testMint(amountCycle1 + amountCycle2, wallet),
  ]);
  const activationBlockHeight = block.height + CoreModel.ACTIVATION_DELAY - 1;
  chain.mineEmptyBlockUntil(activationBlockHeight);
  // stack in cycles 2-3
  chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
  chain.mineBlock([core.stackTokens(amountCycle1, lockPeriod, wallet)]);
  chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
  chain.mineBlock([core.stackTokens(amountCycle2, lockPeriod, wallet)]);
  chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);
};

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  core = ctx.models.get(CoreModel);
  token = ctx.models.get(TokenModel);
  vote = ctx.models.get(VoteModelV2);
});

afterEach(() => {
  ctx.terminate();
});

describe("[CityCoin Vote v2]", () => {
  describe("VOTE ACTIONS", () => {
    describe("intialize-contract()", () => {
      it("fails with ERR_UNAUTHORIZED if the contract is already initialized", () => {
        // arrange
        const wallet = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        // act
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, wallet),
        ]);
        const receipt = chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, wallet),
        ]).receipts[0];
        // assert
        receipt.result
          .expectErr()
          .expectUint(VoteModelV2.ErrCode.ERR_UNAUTHORIZED);
      });
      it("fails with ERR_UNAUTHORIZED if the sender is not the deployer", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;
        const startHeight = 8500;
        const endHeight = 10600;
        // act
        const receipt = chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, wallet),
        ]).receipts[0];
        // assert
        receipt.result
          .expectErr()
          .expectUint(VoteModelV2.ErrCode.ERR_UNAUTHORIZED);
      });
      it("fails with ERR_UNAUTHORIZED if the start height is before the current height", () => {
        // arrange
        const wallet = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        // act
        chain.mineEmptyBlockUntil(startHeight + 1);
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, wallet),
        ]);
        const receipt = chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, wallet),
        ]).receipts[0];
        // assert
        receipt.result
          .expectErr()
          .expectUint(VoteModelV2.ErrCode.ERR_UNAUTHORIZED);
      });
      it("fails with ERR_UNAUTHORIZED if the end height is before the start height", () => {
        // arrange
        const wallet = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 8400;
        // act
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, wallet),
        ]);
        const receipt = chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, wallet),
        ]).receipts[0];
        // assert
        receipt.result
          .expectErr()
          .expectUint(VoteModelV2.ErrCode.ERR_UNAUTHORIZED);
      });
      it("succeeds and updates the start and end block height variables", () => {
        // arrange
        const wallet = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        // act
        const receipt = chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, wallet),
        ]).receipts[0];
        // assert
        receipt.result.expectOk();
      });
    });
    describe("vote-on-proposal()", () => {
      it("fails with ERR_PROPOSAL_NOT_ACTIVE when called before proposal is active", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer),
        ]);
        // act
        const receipt = chain.mineBlock([vote.voteOnProposal(true, wallet)])
          .receipts[0];
        // assert
        receipt.result
          .expectErr()
          .expectUint(VoteModelV2.ErrCode.ERR_PROPOSAL_NOT_ACTIVE);
      });
      it("fails with ERR_PROPOSAL_NOT_ACTIVE when called after proposal is active", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer),
        ]);
        chain.mineEmptyBlockUntil(VoteModelV2.VOTE_END_BLOCK + 1);
        // act
        const receipt = chain.mineBlock([vote.voteOnProposal(true, wallet)])
          .receipts[0];
        // assert
        receipt.result
          .expectErr()
          .expectUint(VoteModelV2.ErrCode.ERR_PROPOSAL_NOT_ACTIVE);
      });
      it("fails with ERR_NOTHING_STACKED when sender has no stacked tokens", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer),
        ]);
        chain.mineEmptyBlock(VoteModelV2.VOTE_START_BLOCK + 1);
        // act
        const receipt = chain.mineBlock([vote.voteOnProposal(true, wallet)])
          .receipts[0];
        // assert
        receipt.result
          .expectErr()
          .expectUint(VoteModelV2.ErrCode.ERR_NOTHING_STACKED);
      });
      it("succeeds with one yes vote when called by a new voter", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;
        const amountCycle1 = 1000;
        const amountCycle2 = 2000;
        const miaVote = Math.round(
          ((amountCycle1 * 2 + amountCycle2) / 2) * VoteModelV2.MIA_SCALE_FACTOR
        );
        const nycVote = (amountCycle1 * 2 + amountCycle2) / 2;

        activateCoreThenStack(wallet, amountCycle1, amountCycle2);

        // initialize the vote contract
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer),
        ]);

        chain.mineEmptyBlockUntil(VoteModelV2.VOTE_START_BLOCK + 1);

        // act
        const receipt = chain.mineBlock([vote.voteOnProposal(true, wallet)])
          .receipts[0];

        // set vote information to verify
        const expectedProposalRecord = {
          noCount: types.uint(0),
          noTotal: types.uint(0),
          yesCount: types.uint(1),
          yesTotal: types.uint(miaVote + nycVote),
        };

        // set voter information to verify
        const expectedVoterRecord = {
          total: types.uint(miaVote + nycVote),
          vote: types.bool(true),
        };

        const proposalRecord = vote.getProposalVotes().result;
        const voterRecord = vote.getVoterInfo(wallet).result;

        // assert
        receipt.result.expectOk();
        assertEquals(
          proposalRecord.expectSome().expectTuple(),
          expectedProposalRecord
        );
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
          ((amountCycle1 * 2 + amountCycle2) / 2) * VoteModelV2.MIA_SCALE_FACTOR
        );
        const nycVote = (amountCycle1 * 2 + amountCycle2) / 2;

        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(wallet_1),
          token.testMint(amountCycle1 + amountCycle2, wallet_1),
          token.testMint(amountCycle1 + amountCycle2, wallet_2),
          token.testMint(amountCycle1 + amountCycle2, wallet_3),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // initialize the vote contract
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer),
        ]);

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
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);

        chain.mineEmptyBlockUntil(VoteModelV2.VOTE_START_BLOCK + 1);

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
          noTotal: types.uint(miaVote + nycVote),
          yesCount: types.uint(2),
          yesTotal: types.uint((miaVote + nycVote) * 2),
        };

        // set voter information to verify
        const expectedVoterRecord_1 = {
          total: types.uint(miaVote + nycVote),
          vote: types.bool(true),
        };
        const expectedVoterRecord_2 = {
          total: types.uint(miaVote + nycVote),
          vote: types.bool(true),
        };
        const expectedVoterRecord_3 = {
          total: types.uint(miaVote + nycVote),
          vote: types.bool(false),
        };

        // get records to review
        const proposalRecord = vote.getProposalVotes().result;
        const voterRecord_1 = vote.getVoterInfo(wallet_1).result;
        const voterRecord_2 = vote.getVoterInfo(wallet_2).result;
        const voterRecord_3 = vote.getVoterInfo(wallet_3).result;

        // assert
        voterReceipt_1.result.expectOk();
        voterReceipt_2.result.expectOk();
        voterReceipt_3.result.expectOk();
        assertEquals(
          proposalRecord.expectSome().expectTuple(),
          expectedProposalRecord
        );
        assertEquals(
          voterRecord_1.expectOk().expectTuple(),
          expectedVoterRecord_1
        );
        assertEquals(
          voterRecord_2.expectOk().expectTuple(),
          expectedVoterRecord_2
        );
        assertEquals(
          voterRecord_3.expectOk().expectTuple(),
          expectedVoterRecord_3
        );
      });
      it("fails with ERR_VOTE_ALREADY_CAST when called by an existing voter with the same vote", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;

        // setup stacking
        activateCoreThenStack(wallet, 2000, 1000);

        // initialize the vote contract
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer),
        ]);

        chain.mineEmptyBlockUntil(VoteModelV2.VOTE_START_BLOCK + 1);

        // act

        // vote no
        chain.mineBlock([vote.voteOnProposal(false, wallet)]);

        // vote no again
        const receipt = chain.mineBlock([vote.voteOnProposal(false, wallet)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(VoteModelV2.ErrCode.ERR_VOTE_ALREADY_CAST);
      });
      it("succeeds when called by an existing voter with the a different vote", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;
        const amountCycle1 = 1000;
        const amountCycle2 = 2000;
        const miaVote = Math.round(
          ((amountCycle1 * 2 + amountCycle2) / 2) * VoteModelV2.MIA_SCALE_FACTOR
        );
        const nycVote = (amountCycle1 * 2 + amountCycle2) / 2;

        // setup stacking
        activateCoreThenStack(wallet, amountCycle1, amountCycle2);

        // initialize the vote contract
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer),
        ]);

        chain.mineEmptyBlockUntil(VoteModelV2.VOTE_START_BLOCK + 1);

        // act

        // vote no
        chain.mineBlock([vote.voteOnProposal(false, wallet)]);

        // switch vote to yes
        const receipt = chain.mineBlock([vote.voteOnProposal(true, wallet)])
          .receipts[0];

        // set vote information to verify
        const expectedProposalRecord = {
          noCount: types.uint(0),
          noTotal: types.uint(0),
          yesCount: types.uint(1),
          yesTotal: types.uint(miaVote + nycVote),
        };

        // set voter information to verify
        const expectedVoterRecord = {
          total: types.uint(miaVote + nycVote),
          vote: types.bool(true),
        };

        // assert
        const proposalRecord = vote.getProposalVotes().result;
        const voterRecord = vote.getVoterInfo(wallet).result;

        // assert
        receipt.result.expectOk();
        assertEquals(
          proposalRecord.expectSome().expectTuple(),
          expectedProposalRecord
        );
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
          ((amountCycle1 * 2 + amountCycle2) / 2) * VoteModelV2.MIA_SCALE_FACTOR
        );
        const nycVote = (amountCycle1 * 2 + amountCycle2) / 2;

        const setupBlock = chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(wallet_1),
          token.testMint(amountCycle1 + amountCycle2, wallet_1),
          token.testMint(amountCycle1 + amountCycle2, wallet_2),
          token.testMint(amountCycle1 + amountCycle2, wallet_3),
        ]);
        const activationBlockHeight =
          setupBlock.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // initialize the vote contract
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer),
        ]);

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
        chain.mineEmptyBlock(CoreModel.REWARD_CYCLE_LENGTH);

        chain.mineEmptyBlockUntil(VoteModelV2.VOTE_START_BLOCK + 1);

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
          noTotal: types.uint(miaVote + nycVote),
          yesCount: types.uint(2),
          yesTotal: types.uint((miaVote + nycVote) * 2),
        };

        // set voter information to verify
        const expectedVoterRecord_1 = {
          total: types.uint(miaVote + nycVote),
          vote: types.bool(true),
        };
        const expectedVoterRecord_2 = {
          total: types.uint(miaVote + nycVote),
          vote: types.bool(true),
        };
        const expectedVoterRecord_3 = {
          total: types.uint(miaVote + nycVote),
          vote: types.bool(false),
        };

        // get records to review
        const proposalRecord = vote.getProposalVotes().result;
        const voterRecord_1 = vote.getVoterInfo(wallet_1).result;
        const voterRecord_2 = vote.getVoterInfo(wallet_2).result;
        const voterRecord_3 = vote.getVoterInfo(wallet_3).result;

        // assert
        voterReceipt_1.result.expectOk();
        voterReceipt_2.result.expectOk();
        voterReceipt_3.result.expectOk();
        assertEquals(
          proposalRecord.expectSome().expectTuple(),
          expectedProposalRecord
        );
        assertEquals(
          voterRecord_1.expectOk().expectTuple(),
          expectedVoterRecord_1
        );
        assertEquals(
          voterRecord_2.expectOk().expectTuple(),
          expectedVoterRecord_2
        );
        assertEquals(
          voterRecord_3.expectOk().expectTuple(),
          expectedVoterRecord_3
        );
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
          vote.initializeContract(startHeight, endHeight, deployer),
        ]);
        const expectedResult =
          '{hash: "TODO", link: "https://github.com/citycoins/governance/blob/feat/stabilize-protocol/ccips/ccip-012/ccip-012-stabilize-emissions-and-treasuries.md", name: "Stabilize Emissions and Treasuries"}';
        // act
        const result = vote.getProposals().result;
        // assert
        assertEquals(result.expectOk(), expectedResult);
      });
    });

    describe("get-vote-blocks()", () => {
      it("succeeds and returns none if called before the contract is initialized", () => {
        // act
        const result = vote.getVoteBlocks().result;
        // assert
        result.expectNone();
      });
      it("succeeds and returns the starting and ending Stacks block for the vote", () => {
        // arrange
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        const expectedResult = {
          startBlock: types.uint(startHeight),
          endBlock: types.uint(endHeight),
        };
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer),
        ]);
        // act
        const result = vote.getVoteBlocks().result;
        // assert
        assertEquals(result.expectSome().expectTuple(), expectedResult);
      });
    });

    describe("get-mia-vote-amount()", () => {
      it("succeeds and returns none if voter ID is not found", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;
        // act
        const result = vote.getMiaVoteAmount(wallet, false).result;
        // assert
        result.expectNone();
      });
      it("succeeds and returns scaled MIA vote when set true", () => {
        // arrange
        const deployer = accounts.get("deployer")!;
        const wallet = accounts.get("wallet_1")!;
        const amountCycle1 = 1000;
        const amountCycle2 = 2000;
        const startHeight = 8500;
        const endHeight = 10600;
        const miaVote = Math.round(
          ((amountCycle1 * 2 + amountCycle2) / 2) * VoteModelV2.MIA_SCALE_FACTOR
        );

        // setup stacking
        activateCoreThenStack(wallet, amountCycle1, amountCycle2);

        // initialize the vote contract
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer),
        ]);
        chain.mineEmptyBlockUntil(VoteModelV2.VOTE_START_BLOCK + 1);

        // act
        const result = vote.getMiaVoteAmount(wallet, true).result;
        // assert
        const expectedResult = types.uint(miaVote * 10 ** 16);
        assertEquals(result.expectSome(), expectedResult);
      });
      it("succeeds and returns unscaled MIA vote when set false", () => {
        // arrange
        const deployer = accounts.get("deployer")!;
        const wallet = accounts.get("wallet_1")!;
        const amountCycle1 = 1000;
        const amountCycle2 = 2000;
        const startHeight = 8500;
        const endHeight = 10600;
        const miaVote = Math.round(
          ((amountCycle1 * 2 + amountCycle2) / 2) * VoteModelV2.MIA_SCALE_FACTOR
        );

        // setup stacking
        activateCoreThenStack(wallet, amountCycle1, amountCycle2);

        // initialize the vote contract
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer),
        ]);
        chain.mineEmptyBlockUntil(VoteModelV2.VOTE_START_BLOCK + 1);

        // act
        const result = vote.getMiaVoteAmount(wallet, false).result;
        // assert
        const expectedResult = types.uint(miaVote);
        assertEquals(result.expectSome(), expectedResult);
      });
    });

    describe("get-vote-amount-nyc()", () => {
      it("succeeds and returns none if voter ID is not found", () => {
        // arrange
        const wallet = accounts.get("wallet_1")!;
        // act
        const result = vote.getNycVoteAmount(wallet, false).result;
        // assert
        result.expectNone();
      });
      it("succeeds and returns scaled NYC vote when set true", () => {
        // arrange
        const deployer = accounts.get("deployer")!;
        const wallet = accounts.get("wallet_1")!;
        const amountCycle1 = 1000;
        const amountCycle2 = 2000;
        const startHeight = 8500;
        const endHeight = 10600;
        const nycVote = (amountCycle1 * 2 + amountCycle2) / 2;

        // setup stacking
        activateCoreThenStack(wallet, amountCycle1, amountCycle2);

        // initialize the vote contract
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer),
        ]);
        chain.mineEmptyBlockUntil(VoteModelV2.VOTE_START_BLOCK + 1);

        // act
        const result = vote.getNycVoteAmount(wallet, true).result;
        // assert
        const expectedResult = types.uint(nycVote * 10 ** 16);
        assertEquals(result.expectSome(), expectedResult);
      });
      it("succeeds and returns unscaled NYC vote when set false", () => {
        // arrange
        const deployer = accounts.get("deployer")!;
        const wallet = accounts.get("wallet_1")!;
        const amountCycle1 = 1000;
        const amountCycle2 = 2000;
        const startHeight = 8500;
        const endHeight = 10600;
        const nycVote = (amountCycle1 * 2 + amountCycle2) / 2;

        // setup stacking
        activateCoreThenStack(wallet, amountCycle1, amountCycle2);

        // initialize the vote contract
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer),
        ]);
        chain.mineEmptyBlockUntil(VoteModelV2.VOTE_START_BLOCK + 1);

        // act
        const result = vote.getNycVoteAmount(wallet, false).result;
        // assert
        const expectedResult = types.uint(nycVote);
        assertEquals(result.expectSome(), expectedResult);
      });
    });

    describe("get-proposal-votes()", () => {
      it("succeeds and returns base proposal record with no voters", () => {
        // arrange
        const result = vote.getProposalVotes().result;
        const expected = {
          noCount: 0,
          noTotal: 0,
          yesCount: 0,
          yesTotal: 0,
        };
        // assert
        assertEquals(result.expectSome().expectTuple(), {
          noCount: types.uint(expected.noCount),
          noTotal: types.uint(expected.noTotal),
          yesCount: types.uint(expected.yesCount),
          yesTotal: types.uint(expected.yesTotal),
        });
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
          core.testSetActivationThreshold(1),
          core.registerUser(wallet_1),
          token.testMint(amountCycle1 + amountCycle2, wallet_1),
          token.testMint(amountCycle1 + amountCycle2, wallet_2),
          token.testMint(amountCycle1 + amountCycle2, wallet_3),
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
          vote.initializeContract(startHeight, endHeight, deployer),
        ]);
        // register voters
        chain.mineEmptyBlockUntil(VoteModelV2.VOTE_START_BLOCK + 1);
        chain.mineBlock([
          vote.voteOnProposal(true, wallet_1),
          vote.voteOnProposal(false, wallet_2),
          vote.voteOnProposal(true, wallet_3),
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
          core.testSetActivationThreshold(1),
          core.registerUser(wallet),
          token.testMint(amountTokens, wallet),
        ]);
        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // initialize the vote contract
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer),
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

        chain.mineEmptyBlockUntil(VoteModelV2.VOTE_START_BLOCK + 1);

        // vote yes
        chain.mineBlock([vote.voteOnProposal(true, wallet)]);

        const result = vote.getVoter(expectedId).result;

        result.expectSome().expectPrincipal(wallet.address);
      });
    });

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
          core.testSetActivationThreshold(1),
          core.registerUser(wallet),
          token.testMint(amountTokens, wallet),
        ]);
        const activationBlockHeight =
          block.height + CoreModel.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // initialize the vote contract
        const deployer = accounts.get("deployer")!;
        const startHeight = 8500;
        const endHeight = 10600;
        chain.mineBlock([
          vote.initializeContract(startHeight, endHeight, deployer),
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

        chain.mineEmptyBlockUntil(VoteModelV2.VOTE_START_BLOCK + 1);

        // vote yes
        chain.mineBlock([vote.voteOnProposal(true, wallet)]);

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
        result.expectErr().expectUint(VoteModelV2.ErrCode.ERR_USER_NOT_FOUND);
      });
    });
  });
});

run();
