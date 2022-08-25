;; CityCoins Vote V2
;; A voting mechanism inspired by SIP-012 for Stacks,
;; defined in CCIP-011 and used to vote on ratifying
;; CCIP-012.
;;
;; External Link: https://github.com/citycoins/governance

;; ERRORS

(define-constant ERR_USER_NOT_FOUND (err u8000))
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
(define-constant MIA_SCALE_FACTOR u8605) ;; 0.8605 or 86.05%
(define-constant MIA_SCALE_BASE u10000)

;; VARIABLES

(define-data-var initialized bool false)
(define-data-var voteStartBlock uint u0)
(define-data-var voteEndBlock uint u0)

;; PROPOSALS

(define-constant CCIP_012 {
  name: "Stabilize Emissions and Treasuries",
  link: "TODO",
  hash: "TODO"
})

(define-map ProposalVotes
  uint ;; proposalId
  {
    yesCount: uint,
    yesTotal: uint,
    noCount: uint,
    noTotal: uint
  }
)

;; intialize ProposalVotes
(map-insert ProposalVotes VOTE_PROPOSAL_ID {
  yesCount: u0,
  yesTotal: u0,
  noCount: u0,
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
              yesTotal: (+ (get yesTotal proposalRecord) (get total record)),
              noCount: (- (get noCount proposalRecord) u1),
              noTotal: (- (get noTotal proposalRecord) (get total record))
            })
          )
          (map-set ProposalVotes VOTE_PROPOSAL_ID
            (merge proposalRecord {
              yesCount: (- (get yesCount proposalRecord) u1),
              yesTotal: (- (get yesTotal proposalRecord) (get total record)),
              noCount: (+ (get noCount proposalRecord) u1),
              noTotal: (+ (get noTotal proposalRecord) (get total record))
            })
          )
        )
      )
      ;; vote record doesn't exist
      (let
        (
          (scaledVoteMia (default-to u0 (get-mia-vote-amount tx-sender true)))
          (scaledVoteNyc (default-to u0 (get-nyc-vote-amount tx-sender true)))
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
          total: voteTotal
        })
        ;; update the proposal record
        (if vote
          (map-set ProposalVotes VOTE_PROPOSAL_ID
            (merge proposalRecord {
              yesCount: (+ (get yesCount proposalRecord) u1),
              yesTotal: (+ (get yesTotal proposalRecord) voteTotal),
            })
          )
          (map-set ProposalVotes VOTE_PROPOSAL_ID
            (merge proposalRecord {
              noCount: (+ (get noCount proposalRecord) u1),
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
;; optionally scaled by VOTE_SCALE_FACTOR (10^6)
(define-read-only (get-mia-vote-amount (user principal) (scaled bool))
  (let
    (
      ;; MIA Cycle 21
      ;; first block: 68,597
      ;; target block: 68,600
      ;; mainnet: 'SP2NS7CNBBN3S9J6M4JJHT7WNBETRSBZ9KPVRENBJ.citycoin-tardis-v3
      (userCycle21 (try! (contract-call? .citycoin-tardis-v3 get-stacker-stats-mia u4500 user)))
      (stackedCycle21 (get amountStacked userCycle21))
      ;; MIA Cycle 22
      ;; first block: 70,697
      ;; target block: 70,700
      ;; mainnet: 'SP2NS7CNBBN3S9J6M4JJHT7WNBETRSBZ9KPVRENBJ.citycoin-tardis-v3
      (userCycle22 (try! (contract-call? .citycoin-tardis-v3 get-stacker-stats-mia u6600 user)))
      (stackedCycle22 (get amountStacked userCycle22))
      ;; MIA vote calculation
      (avgStackedMia (/ (+ (scale-up stackedCycle21) (scale-up stackedCycle22)) u2))
      (scaledMiaVote (/ (* avgStackedMia MIA_SCALE_FACTOR) MIA_SCALE_BASE))
    )
    ;; check if there is a positive value
    (asserts! (or (>= stackedCycle21 u0) (>= stackedCycle22 u0)) none)
    ;; return the value
    (if scaled
      (some scaledMiaVote)
      (some (/ scaledMiaVote VOTE_SCALE_FACTOR))
    )
  )
)

;; NYC HELPER
;; returns (some uint) or (none)
;; optionally scaled by VOTE_SCALE_FACTOR (10^6)
(define-read-only (get-nyc-vote-amount (user principal) (scaled bool))
  (let
    (
      ;; NYC Cycle 15
      ;; first block: 68,949
      ;; target block: 69,000
      ;; mainnet: 'SP2NS7CNBBN3S9J6M4JJHT7WNBETRSBZ9KPVRENBJ.citycoin-tardis-v3
      (userCycle15 (try! (contract-call? .citycoin-tardis-v3 get-stacker-stats-nyc u4500 user)))
      (stackedCycle15 (get amountStacked userCycle15))
      ;; NYC Cycle 16
      ;; first block: 71,049
      ;; target block: 71,100
      ;; mainnet: 'SP2NS7CNBBN3S9J6M4JJHT7WNBETRSBZ9KPVRENBJ.citycoin-tardis-v3
      (userCycle16 (try! (contract-call? .citycoin-tardis-v3 get-stacker-stats-nyc u6600 user)))
      (stackedCycle16 (get amountStacked userCycle16))
      ;; NYC vote calculation
      (nycVote (/ (+ (scale-up stackedCycle15) (scale-up stackedCycle16)) u2))
    )
    ;; check if there is a positive value
    (asserts! (or (>= stackedCycle15 u0) (>= stackedCycle16 u0)) none)
    ;; return the value
    (if scaled
      (some nycVote)
      (some (/ nycVote VOTE_SCALE_FACTOR))
    )
  )
)

;; GETTERS

;; returns if the start/end block heights are set
(define-read-only (is-initialized)
  (var-get initialized)
)

;; returns the list of proposals being voted on
(define-read-only (get-proposals)
  (ok CCIP_012)
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
