;; CityCoins Vote V1
;; A voting mechanism inspired by SIP-012 for Stacks,
;; defined in CCIP-011 and used to vote on ratifying
;; CCIP-008, CCIP-009, and CCIP-010.
;;
;; External Link: https://github.com/citycoins/governance

;; ERRORS

(define-constant ERR_USER_NOT_FOUND (err u8000))
(define-constant ERR_STACKER_NOT_FOUND (err u8001))
(define-constant ERR_PROPOSAL_NOT_FOUND (err u8002))
(define-constant ERR_PROPOSAL_NOT_ACTIVE (err u8003))
(define-constant ERR_VOTE_ALREADY_CAST (err u8004))
(define-constant ERR_NOTHING_STACKED (err u8005))
(define-constant ERR_CONTRACT_NOT_INITIALIZED (err u8006))
(define-constant ERR_UNAUTHORIZED (err u8007))

;; CONSTANTS

(define-constant DEPLOYER tx-sender)
(define-constant VOTE_PROPOSAL_ID u0)
(define-constant VOTE_SCALE_FACTOR (pow u10 u16)) ;; 16 decimal places
;; scale MIA votes to make 1 MIA = 1 NYC
;; full calculation available in CCIP-011
(define-constant MIA_SCALE_FACTOR u6987) ;; 0.6987 or 69.87%
(define-constant MIA_SCALE_BASE u10000)

;; VARIABLES

(define-data-var initialized bool false)
(define-data-var voteStartBlock uint u0) ;; u8500 used in tests
(define-data-var voteEndBlock uint u0)   ;; u10600 used in tests

;; PROPOSALS

(define-constant CCIP_008 {
  name: "CityCoins SIP-010 Token v2",
  link: "https://github.com/citycoins/governance/blob/feat/community-upgrade-1/ccips/ccip-008/ccip-008-citycoins-sip-010-token-v2.md",
  hash: "6313738548af393a93f1184f459aa2300fc7a37f"
})

(define-constant CCIP_009 {
  name: "CityCoins VRF v2",
  link: "https://github.com/citycoins/governance/blob/feat/community-upgrade-1/ccips/ccip-009/ccip-009-citycoins-vrf-v2.md",
  hash: "7438ad926d6094e241ea6586eed398378cf09041"
})

(define-constant CCIP_010 {
  name: "CityCoins Auth v2",
  link: "https://github.com/citycoins/governance/blob/feat/community-upgrade-1/ccips/ccip-010/ccip-010-citycoins-auth-v2.md",
  hash: "7438ad926d6094e241ea6586eed398378cf09041"
})

(define-map ProposalVotes
  uint ;; proposalId
  {
    yesCount: uint,
    yesMia: uint,
    yesNyc: uint,
    yesTotal: uint,
    noCount: uint,
    noMia: uint,
    noNyc: uint,
    noTotal: uint
  }
)

;; intialize ProposalVotes
(map-insert ProposalVotes VOTE_PROPOSAL_ID {
  yesCount: u0,
  yesMia: u0,
  yesNyc: u0,
  yesTotal: u0,
  noCount: u0,
  noMia: u0,
  noNyc: u0,
  noTotal: u0
})

;; VOTERS

(define-data-var voterIndex uint u0)

(define-map Voters
  uint
  principal
)

(define-map VoterIds
  principal
  uint
)

(define-map Votes
  uint ;; voter ID
  {
    vote: bool,
    mia: uint,
    nyc: uint,
    total: uint
  }
)

;; obtains the voter ID or creates a new one
(define-private (get-or-create-voter-id (user principal))
  (match (map-get? VoterIds user) value
    value
    (let
      (
        (newId (+ u1 (var-get voterIndex)))
      )
      (map-set Voters newId user)
      (map-set VoterIds user newId)
      (var-set voterIndex newId)
      newId
    )
  )
)

;; INITIALIZATION

;; one-time function to set the start and end
;; block heights for voting
(define-public (initialize-contract (startHeight uint) (endHeight uint))
  (begin
    (asserts! (not (is-initialized)) ERR_UNAUTHORIZED)
    (asserts! (is-deployer) ERR_UNAUTHORIZED)
    (asserts! (and
      (< block-height startHeight)
      (< startHeight endHeight))
      ERR_UNAUTHORIZED
    )
    (var-set voteStartBlock startHeight)
    (var-set voteEndBlock endHeight)
    (var-set initialized true)
    (ok true)
  )
)

;; VOTE FUNCTIONS

(define-public (vote-on-proposal (vote bool))
  (let
    (
      (voterId (get-or-create-voter-id tx-sender))
      (voterRecord (map-get? Votes voterId))
      (proposalRecord (unwrap! (get-proposal-votes) ERR_PROPOSAL_NOT_FOUND))
    )
    ;; assert proposal is active
    (asserts! (is-initialized) ERR_UNAUTHORIZED)
    (asserts! (and 
      (>= block-height (var-get voteStartBlock))
      (<= block-height (var-get voteEndBlock)))
      ERR_PROPOSAL_NOT_ACTIVE)
    ;; determine if vote record exists already
    (match voterRecord record
      ;; vote record exists
      (begin
        ;; check if vote is the same as what's recorded
        (asserts! (not (is-eq (get vote record) vote)) ERR_VOTE_ALREADY_CAST)
        ;; record the new vote
        (map-set Votes voterId
          (merge record { vote: vote })
        )
        ;; update the vote totals
        (if vote
          (map-set ProposalVotes VOTE_PROPOSAL_ID
            (merge proposalRecord {
              yesCount: (+ (get yesCount proposalRecord) u1),
              yesMia: (+ (get yesMia proposalRecord) (get mia record)),
              yesNyc: (+ (get yesNyc proposalRecord) (get nyc record)),
              yesTotal: (+ (get yesTotal proposalRecord) (get total record)),
              noCount: (- (get noCount proposalRecord) u1),
              noMia: (- (get noMia proposalRecord) (get mia record)),
              noNyc: (- (get noNyc proposalRecord) (get nyc record)),
              noTotal: (- (get noTotal proposalRecord) (get total record))
            })
          )
          (map-set ProposalVotes VOTE_PROPOSAL_ID
            (merge proposalRecord {
              yesCount: (- (get yesCount proposalRecord) u1),
              yesMia: (- (get yesMia proposalRecord) (get mia record)),
              yesNyc: (- (get yesNyc proposalRecord) (get nyc record)),
              yesTotal: (- (get yesTotal proposalRecord) (get total record)),
              noCount: (+ (get noCount proposalRecord) u1),
              noMia: (+ (get noMia proposalRecord) (get mia record)),
              noNyc: (+ (get noNyc proposalRecord) (get nyc record)),
              noTotal: (+ (get noTotal proposalRecord) (get total record))
            })
          )
          
        )
      )
      ;; vote record doesn't exist
      (let
        (
          (scaledVoteMia (default-to u0 (get-mia-vote-amount tx-sender voterId)))
          (scaledVoteNyc (default-to u0 (get-nyc-vote-amount tx-sender voterId)))
          (scaledVoteTotal (/ (+ scaledVoteMia scaledVoteNyc) u2))
          (voteMia (scale-down scaledVoteMia))
          (voteNyc (scale-down scaledVoteNyc))
          (voteTotal (+ voteMia voteNyc))
        )
        ;; make sure there is a positive value
        (asserts! (or (> scaledVoteMia u0) (> scaledVoteNyc u0)) ERR_NOTHING_STACKED)
        ;; update the voter record
        (map-insert Votes voterId {
          vote: vote,
          mia: voteMia,
          nyc: voteNyc,
          total: voteTotal
        })
        ;; update the proposal record
        (if vote
          (map-set ProposalVotes VOTE_PROPOSAL_ID
            (merge proposalRecord {
              yesCount: (+ (get yesCount proposalRecord) u1),
              yesMia: (+ (get yesMia proposalRecord) voteMia),
              yesNyc: (+ (get yesNyc proposalRecord) voteNyc),
              yesTotal: (+ (get yesTotal proposalRecord) voteTotal),
            })
          )
          (map-set ProposalVotes VOTE_PROPOSAL_ID
            (merge proposalRecord {
              noCount: (+ (get noCount proposalRecord) u1),
              noMia: (+ (get noMia proposalRecord) voteMia),
              noNyc: (+ (get noNyc proposalRecord) voteNyc),
              noTotal: (+ (get noTotal proposalRecord) voteTotal)
            })
          )
        )
      )
    )
    (print (map-get? ProposalVotes VOTE_PROPOSAL_ID))
    (print (map-get? Votes voterId))
    (ok true)
  )
)

;; MIA HELPER
;; returns (some uint) or (none)
(define-private (get-mia-vote-amount (user principal) (voterId uint))
  (let
    (
      ;; TODO: update to mainnet block heights
      (userCycle12 (try! (contract-call? .citycoin-tardis-v2 get-historical-stacker-stats-or-default u4500 user)))
      (stackedCycle12 (get amountStacked userCycle12))
      (userCycle13 (try! (contract-call? .citycoin-tardis-v2 get-historical-stacker-stats-or-default u6600 user)))
      (stackedCycle13 (get amountStacked userCycle13))
      (avgStackedMia (/ (+ (scale-up stackedCycle12) (scale-up stackedCycle13)) u2))
      (scaledMiaVote (/ (* avgStackedMia MIA_SCALE_FACTOR) MIA_SCALE_BASE))
    )
    ;; check if there is a positive value
    (asserts! (or (>= stackedCycle12 u0) (>= stackedCycle13 u0)) none)
    ;; return the value
    (some scaledMiaVote)
  )
)

;; NYC HELPER
;; returns (some uint) or (none)
(define-private (get-nyc-vote-amount (user principal) (voterId uint))
  (let
    (
      ;; TODO: update to mainnet block heights
      (userCycle6 (try! (contract-call? .citycoin-tardis-v2 get-historical-stacker-stats-or-default u4500 user)))
      (stackedCycle6 (get amountStacked userCycle6))
      (userCycle7 (try! (contract-call? .citycoin-tardis-v2 get-historical-stacker-stats-or-default u6600 user)))
      (stackedCycle7 (get amountStacked userCycle7))
      (nycVote (/ (+ (scale-up stackedCycle6) (scale-up stackedCycle7)) u2))
    )
    ;; check if there is a positive value
    (asserts! (or (>= stackedCycle6 u0) (>= stackedCycle7 u0)) none)
    ;; return the value
    (some nycVote)
  )
)

;; GETTERS

;; returns if the start/end block heights are set
(define-read-only (is-initialized)
  (var-get initialized)
)

;; returns the list of proposals being voted on
(define-read-only (get-proposals)
  (ok {
    CCIP_008: CCIP_008,
    CCIP_009: CCIP_009,
    CCIP_010: CCIP_010
  })
)

;; returns the start/end block heights, if set
(define-read-only (get-vote-blocks)
  (begin
    (asserts! (is-initialized) ERR_CONTRACT_NOT_INITIALIZED)
    (ok {
      startBlock: (var-get voteStartBlock),
      endBlock: (var-get voteEndBlock)
    })
  )
)

;; returns the start block height, if set
(define-read-only (get-vote-start-block)
  (begin
    (asserts! (is-initialized) ERR_CONTRACT_NOT_INITIALIZED)
    (ok (var-get voteStartBlock))
  )
)

;; returns the end block height, if set
(define-read-only (get-vote-end-block)
  (begin
    (asserts! (is-initialized) ERR_CONTRACT_NOT_INITIALIZED)
    (ok (var-get voteEndBlock))
  )
)

;; returns the total vote for a given principal
(define-read-only (get-vote-amount (voter principal))
  (let
    (
      (voterId (default-to u0 (get-voter-id voter)))
      (scaledVoteMia (default-to u0 (get-mia-vote-amount voter voterId)))
      (scaledVoteNyc (default-to u0 (get-nyc-vote-amount voter voterId)))
      (scaledVoteTotal (/ (+ scaledVoteMia scaledVoteNyc) u2))
      (voteMia (scale-down scaledVoteMia))
      (voteNyc (scale-down scaledVoteNyc))
      (voteTotal (+ voteMia voteNyc))
    )
    voteTotal
  )
)

;; returns the vote totals for the proposal
(define-read-only (get-proposal-votes)
  (map-get? ProposalVotes VOTE_PROPOSAL_ID)
)

;; returns the voter index for assigning voter IDs
(define-read-only (get-voter-index)
  (var-get voterIndex)
)

;; returns the voter principal for a given voter ID
(define-read-only (get-voter (voterId uint))
  (map-get? Voters voterId)
)

;; returns the voter ID for a given principal
(define-read-only (get-voter-id (voter principal))
  (map-get? VoterIds voter)
)

;; returns the vote totals for a given principal
(define-read-only (get-voter-info (voter principal))
  (ok (unwrap!
    (map-get? Votes (unwrap! (get-voter-id voter) ERR_USER_NOT_FOUND))
    ERR_USER_NOT_FOUND
  ))
)

;; UTILITIES
;; CREDIT: math functions taken from Alex math-fixed-point-16.clar

(define-private (scale-up (a uint))
  (* a VOTE_SCALE_FACTOR)
)

(define-private (scale-down (a uint))
  (/ a VOTE_SCALE_FACTOR)
)

(define-private (is-deployer)
  (is-eq contract-caller DEPLOYER)
)
