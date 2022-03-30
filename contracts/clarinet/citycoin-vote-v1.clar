;; CityCoins Vote V1
;; A voting mechanism inspired by SIP-012 for Stacks,
;; defined in CCIP-011 and used to vote on ratifying
;; CCIP-008, CCIP-009, and CCIP-010.

;; ERRORS

(define-constant ERR_USER_NOT_FOUND (err u8000))
(define-constant ERR_STACKER_NOT_FOUND (err u8001))
(define-constant ERR_PROPOSAL_NOT_FOUND (err u8002))
(define-constant ERR_PROPOSAL_NOT_ACTIVE (err u8003))
(define-constant ERR_VOTE_ALREADY_CAST (err u8004))
(define-constant ERR_NOTHING_STACKED (err u8005))

;; PROPOSALS

(define-constant CCIP-008 {
  name: "CityCoins SIP-010 Token v2",
  link: "TODO",
  hash: "TODO"
})

(define-constant CCIP-009 {
  name: "CityCoins VRF v2",
  link: "TODO",
  hash: "TODO"
})

(define-constant CCIP-010 {
  name: "CityCoins Auth v2",
  link: "TODO",
  hash: "TODO"
})

;; CONSTANTS

;; TODO: update block heights
(define-constant VOTE_START_BLOCK u8500)
(define-constant VOTE_END_BLOCK u10600) ;; test voting period: 2100 blocks
(define-constant VOTE_PROPOSAL_ID u0)
(define-constant VOTE_SCALE_FACTOR (pow u10 u16)) ;; 16 decimal places

;; scale MIA votes to make 1 MIA = 1 NYC
;; full calculation available in CCIP-011
(define-constant MIA_SCALE_FACTOR u6987) ;; 0.6987 or 69.87%
(define-constant MIA_SCALE_BASE u10000)

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

;; VOTE FUNCTIONS

(define-public (vote-on-proposal (vote bool))
  (let
    (
      ;; TODO: allow tx-sender instead?
      (voterId (get-or-create-voter-id contract-caller))
      (voterRecord (map-get? Votes voterId))
      (proposalRecord (unwrap! (get-proposal-votes) ERR_PROPOSAL_NOT_FOUND))
    )
    ;; assert proposal is active
    (asserts! (and 
      (>= block-height VOTE_START_BLOCK)
      (<= block-height VOTE_END_BLOCK))
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
          ;; TODO: allow tx-sender instead?
          (scaledVoteMia (default-to u0 (get-mia-vote-amount contract-caller voterId)))
          (scaledVoteNyc (default-to u0 (get-nyc-vote-amount contract-caller voterId)))
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
          (map-set ProposalVotes
            VOTE_PROPOSAL_ID
            (merge proposalRecord {
              yesCount: (+ (get yesCount proposalRecord) u1),
              yesMia: (+ (get yesMia proposalRecord) voteMia),
              yesNyc: (+ (get yesNyc proposalRecord) voteNyc),
              yesTotal: (+ (get yesTotal proposalRecord) voteTotal),
            })
          )
          (map-set ProposalVotes
            VOTE_PROPOSAL_ID
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
    ;; TODO: print all information
    (ok true)
  )
)

;; MIA HELPER
(define-private (get-mia-vote-amount (user principal) (voterId uint))
  ;; returns (some uint) or (none)
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

;; NYC HELPERS
(define-private (get-nyc-vote-amount (user principal) (voterId uint))
  ;; returns (some uint) or (none)
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

(define-read-only (get-proposal-votes)
  (map-get? ProposalVotes VOTE_PROPOSAL_ID)
)

(define-read-only (get-voter (voterId uint))
  (map-get? Voters voterId)
)

(define-read-only (get-voter-id (voter principal))
  (map-get? VoterIds voter)
)

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
