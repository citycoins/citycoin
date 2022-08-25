import { Account, ReadOnlyFn, Tx, types } from "../../deps.ts";
import { Model } from "../../src/model.ts";

enum ErrCode {
  ERR_USER_NOT_FOUND = 8000,
  ERR_PROPOSAL_NOT_FOUND = 8002,
  ERR_PROPOSAL_NOT_ACTIVE,
  ERR_VOTE_ALREADY_CAST,
  ERR_NOTHING_STACKED,
  ERR_CONTRACT_NOT_INITIALIZED,
  ERR_UNAUTHORIZED,
}

export class VoteModelV2 extends Model {
  name = "citycoin-vote-v2";
  static readonly ErrCode = ErrCode;
  static readonly VOTE_START_BLOCK = 8500;
  static readonly VOTE_END_BLOCK = 10600;
  static readonly VOTE_PROPOSAL_ID = 0;
  static readonly VOTE_SCALE_FACTOR = 10 ** 16; // 16 decimal places
  static readonly MIA_SCALE_FACTOR = 0.8605; // 0.8605 or 86.05%

  initializeContract(
    startHeight: number,
    endHeight: number,
    sender: Account
  ): Tx {
    return this.callPublic(
      "initialize-contract",
      [types.uint(startHeight), types.uint(endHeight)],
      sender.address
    );
  }

  voteOnProposal(vote: boolean, sender: Account): Tx {
    return this.callPublic(
      "vote-on-proposal",
      [types.bool(vote)],
      sender.address
    );
  }

  getMiaVoteAmount(voter: Account, scaled: boolean): ReadOnlyFn {
    return this.callReadOnly("get-mia-vote-amount", [
      types.principal(voter.address),
      types.bool(scaled),
    ]);
  }

  getNycVoteAmount(voter: Account, scaled: boolean): ReadOnlyFn {
    return this.callReadOnly("get-nyc-vote-amount", [
      types.principal(voter.address),
      types.bool(scaled),
    ]);
  }

  getProposals(): ReadOnlyFn {
    return this.callReadOnly("get-proposals");
  }

  getVoteBlocks(): ReadOnlyFn {
    return this.callReadOnly("get-vote-blocks");
  }

  getProposalVotes(): ReadOnlyFn {
    return this.callReadOnly("get-proposal-votes");
  }

  getVoterIndex(): ReadOnlyFn {
    return this.callReadOnly("get-voter-index");
  }

  getVoter(voterId: number): ReadOnlyFn {
    return this.callReadOnly("get-voter", [types.uint(voterId)]);
  }

  getVoterId(voter: Account): ReadOnlyFn {
    return this.callReadOnly("get-voter-id", [types.principal(voter.address)]);
  }

  getVoterInfo(voter: Account): ReadOnlyFn {
    return this.callReadOnly("get-voter-info", [
      types.principal(voter.address),
    ]);
  }
}
