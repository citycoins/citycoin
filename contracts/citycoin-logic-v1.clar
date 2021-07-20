;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; CITYCOIN LOGIC CONTRACT
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; TRAIT DEFINITIONS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(impl-trait .citycoin-logic-trait.citycoin-logic)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; ERROR CODES
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant ERR_CONTRACT_NOT_ACTIVATED u2000)
(define-constant ERR_USER_ALREADY_MINED u2001)
(define-constant ERR_INSUFFICIENT_COMMITMENT u2002)
(define-constant ERR_INSUFFICIENT_BALANCE u2003)
(define-constant ERR_USER_ID_NOT_FOUND u2004)
(define-constant ERR_USER_DID_NOT_MINE_IN_BLOCK u2005)
(define-constant ERR_CLAIMED_BEFORE_MATURITY u2006)
(define-constant ERR_NO_MINERS_AT_BLOCK u2007)
(define-constant ERR_REWARD_ALREADY_CLAIMED u2007)
(define-constant ERR_MINER_DID_NOT_WIN u2008)
(define-constant ERR_NO_VRF_SEED_FOUND u2009)
(define-constant ERR_STACKING_NOT_AVAILABLE u2010)
(define-constant ERR_CANNOT_STACK u2011)
(define-constant ERR_REWARD_CYCLE_NOT_COMPLETED u2012)
(define-constant ERR_NOTHING_TO_REDEEM u2013)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; CORE FUNCTIONS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-private (get-activation-status)
  (contract-call? .citycoin-core get-activation-status)
)

(define-private (get-user-id (user principal))
  (contract-call? .citycoin-core get-user-id user)
)

(define-private (has-mined-at-block (stacksHeight uint) (userId uint))
  (contract-call? .citycoin-core has-mined-at-block stacksHeight userId)
)

(define-private (get-mining-stats-at-block (stacksHeight uint))
  (contract-call? .citycoin-core get-mining-stats-at-block stacksHeight)
)

(define-private (get-miner-at-block (stacksHeight uint) (userId uint))
  (contract-call? .citycoin-core get-miner-at-block stacksHeight userId)
)

(define-private (get-last-high-value-at-block (stacksHeight uint))
  (contract-call? .citycoin-core get-last-high-value-at-block stacksHeight)
)

(define-private (get-reward-cycle (stacksHeight uint))
  (contract-call? .citycoin-core get-reward-cycle stacksHeight)
)

(define-private (stacking-active-at-cycle (rewardCycle uint))
  (contract-call? .citycoin-core stacking-active-at-cycle rewardCycle)
)

(define-private (get-stacking-stats-at-cycle-or-default (rewardCycle uint))
  (contract-call? .citycoin-core get-stacking-stats-at-cycle-or-default rewardCycle)
)

(define-private (get-stacking-stats-at-cycle (rewardCycle uint))
  (contract-call? .citycoin-core get-stacking-stats-at-cycle rewardCycle)
)

(define-private (get-stacker-at-cycle-or-default (rewardCycle uint) (userId uint))
  (contract-call? .citycoin-core get-stacker-at-cycle-or-default rewardCycle userId)
)

(define-private (get-stacker-at-cycle (rewardCycle uint) (userId uint))
  (contract-call? .citycoin-core get-stacker-at-cycle rewardCycle userId)
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; MINING
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; define split to custodied wallet address for the city
(define-constant SPLIT_CITY_PCT u30)

;; mine tokens at a given block height and transfer data back to core contract
(define-public (mine-tokens-at-block (userId uint) (stacksHeight uint) (amountUstx uint) (memo (optional (buff 34))))
  (let
    (
      (rewardCycle (default-to u0 (get-reward-cycle stacksHeight)))
      (stackingActive (stacking-active-at-cycle rewardCycle))
      (cityWallet (contract-call? .citycoin-core get-city-wallet))
      (toCity
        (if stackingActive
          (/ (* SPLIT_CITY_PCT amountUstx) u100)
          amountUstx
        )
      )
      (toStackers (- amountUstx toCity))
    )
    ;; TODO: only allow calls from core contract
    (asserts! (get-activation-status) (err ERR_CONTRACT_NOT_ACTIVATED))
    (asserts! (not (has-mined-at-block stacksHeight userId)) (err ERR_USER_ALREADY_MINED))
    (asserts! (> amountUstx u0) (err ERR_INSUFFICIENT_COMMITMENT))
    (asserts! (>= (stx-get-balance tx-sender) amountUstx) (err ERR_INSUFFICIENT_BALANCE))
    (try! (contract-call? .citycoin-core set-tokens-mined userId stacksHeight amountUstx toStackers toCity))
    (if stackingActive
      (try! (stx-transfer? toStackers tx-sender .citycoin-core))
      false
    )
    (try! (stx-transfer? toCity tx-sender cityWallet))
    (ok true)
  )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; MINING REWARD CLAIMS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; how long a miner must wait before block winner can claim their minted tokens
(define-data-var tokenRewardMaturity uint u100)

;; Determine whether or not the given principal can claim the mined tokens at a particular block height,
;; given the miners record for that block height, a random sample, and the current block height.
(define-public (claim-mining-reward-at-block (user principal) (stacksHeight uint) (minerBlockHeight uint))
  (let
    (
      (maturityHeight (+ (var-get tokenRewardMaturity) minerBlockHeight))
      (userId (unwrap! (get-user-id user) (err ERR_USER_ID_NOT_FOUND)))
      (blockStats (unwrap! (get-mining-stats-at-block minerBlockHeight) (err ERR_NO_MINERS_AT_BLOCK)))
      (minerStats (unwrap! (get-miner-at-block minerBlockHeight userId) (err ERR_USER_DID_NOT_MINE_IN_BLOCK)))
      (vrfSample (unwrap! (contract-call? .citycoin-vrf get-random-uint-at-block maturityHeight) (err ERR_NO_VRF_SEED_FOUND)))
      (commitTotal (get-last-high-value-at-block minerBlockHeight))
      (winningValue (mod vrfSample commitTotal))
    )
    ;; TODO: only allow calls from core contract
    (asserts! (> stacksHeight maturityHeight) (err ERR_CLAIMED_BEFORE_MATURITY))
    (asserts! (has-mined-at-block stacksHeight userId) (err ERR_USER_DID_NOT_MINE_IN_BLOCK))
    (asserts! (not (get rewardClaimed blockStats)) (err ERR_REWARD_ALREADY_CLAIMED))
    (asserts! (not (is-eq commitTotal u0)) (err ERR_NO_MINERS_AT_BLOCK))
    (asserts! (and (>= (get lowValue minerStats) winningValue) (<= (get highValue minerStats) winningValue))
      (err ERR_MINER_DID_NOT_WIN))
    (try! (contract-call? .citycoin-core set-mining-reward-claimed userId minerBlockHeight))
    (ok true)
  )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; STACKING
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant MAX_REWARD_CYCLES u32)
(define-constant REWARD_CYCLE_INDEXES (list u0 u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12 u13 u14 u15 u16 u17 u18 u19 u20 u21 u22 u23 u24 u25 u26 u27 u28 u29 u30 u31))

(define-public (stack-tokens-at-cycle (user principal) (userId uint) (amountTokens uint) (startHeight uint) (lockPeriod uint))
  (let
    (
      (currentCycle (unwrap! (get-reward-cycle startHeight) (err ERR_STACKING_NOT_AVAILABLE)))
      (targetCycle (+ u1 currentCycle))
      (commitment {
        stackerId: userId,
        amount: amountTokens,
        first: targetCycle,
        last: (+ targetCycle lockPeriod)
      })
    )
    (asserts! (and (> lockPeriod u0) (<= lockPeriod MAX_REWARD_CYCLES))
      (err ERR_CANNOT_STACK))
    (asserts! (> amountTokens u0) (err ERR_CANNOT_STACK))
    (asserts! (<= amountTokens (unwrap-panic (contract-call? .citycoin-token get-balance user)))
      (err ERR_INSUFFICIENT_BALANCE))
    (try! (contract-call? .citycoin-token transfer amountTokens tx-sender .citycoin-core none))
    
    (match (fold stack-tokens-closure REWARD_CYCLE_INDEXES (ok commitment))
      okValue (ok true)
      errValue (err errValue)
    )
  )
)

(define-private (stack-tokens-closure (rewardCycleIdx uint)
  (commitmentResponse (response 
    {
      stackerId: uint,
      amount: uint,
      first: uint,
      last: uint
    }
    uint
  )))

  (match commitmentResponse
    commitment 
    (let
      (
        (stackerId (get stackerId commitment))
        (amountToken (get amount commitment))
        (firstCycle (get first commitment))
        (lastCycle (get last commitment))
        (targetCycle (+ firstCycle rewardCycleIdx))
        (stackerAtCycle (get-stacker-at-cycle-or-default targetCycle stackerId))
        (amountStacked (get amountStacked stackerAtCycle))
        (toReturn (get toReturn stackerAtCycle))
        (stackingStatsAtCycle (get-stacking-stats-at-cycle-or-default targetCycle))
      )
      (begin
        (if (and (>= targetCycle firstCycle) (< targetCycle lastCycle))
          (begin
            (if (is-eq targetCycle (- lastCycle u1))
              (try! (set-tokens-stacked stackerId targetCycle amountStacked (+ toReturn amountToken)))
              (try! (set-tokens-stacked stackerId targetCycle amountStacked toReturn))
            )
            true
          )
          false
        )
        commitmentResponse
      )
    )
    errValue commitmentResponse
  )
)

(define-private (set-tokens-stacked (stackerId uint) (targetCycle uint) (amountStacked uint) (toReturn uint))
  (contract-call? .citycoin-core set-tokens-stacked stackerId targetCycle amountStacked toReturn)
)

;; getter for get-entitled-stacking-reward that specifies block height
(define-read-only (get-stacking-reward (userId uint) (targetCycle uint))
  (get-entitled-stacking-reward userId targetCycle block-height)
)

;; get uSTX a Stacker can claim, given reward cycle they stacked in and current block height
;; this method only returns a positive value if:
;; - the current block height is in a subsequent reward cycle
;; - the stacker actually locked up tokens in the target reward cycle
;; - the stacker locked up _enough_ tokens to get at least one uSTX
;; it is possible to Stack tokens and not receive uSTX:
;; - if no miners commit during this reward cycle
;; - the amount stacked by user is too few that you'd be entitled to less than 1 uSTX
(define-private (get-entitled-stacking-reward (userId uint) (targetCycle uint) (stacksHeight uint))
  (let
    (
      (rewardCycleStats (unwrap-panic (get-stacking-stats-at-cycle targetCycle)))
      (stackerAtCycle (unwrap-panic (get-stacker-at-cycle targetCycle userId)))
      (totalUstxThisCycle (get amountUstx rewardCycleStats))
      (totalStackedThisCycle (get amountToken rewardCycleStats))
      (userStackedThisCycle (get amountStacked stackerAtCycle))
    )
    (match (get-reward-cycle stacksHeight)
      currentCycle
      (if (or (<= currentCycle targetCycle) (is-eq u0 userStackedThisCycle))
        ;; this cycle hasn't finished, or Stacker contributed nothing
        u0
        ;; (totalUstxThisCycle * userStackedThisCycle) / totalStackedThisCycle
        (/ (* totalUstxThisCycle userStackedThisCycle) totalStackedThisCycle)
      )
      ;; before first reward cycle
      u0
    )
  )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; STACKING REWARD CLAIMS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-public (claim-stacking-reward-at-cycle (user principal) (stacksHeight uint) (targetCycle uint))
  (let
    (
      (currentCycle (unwrap! (get-reward-cycle stacksHeight) (err ERR_STACKING_NOT_AVAILABLE)))
      (userId (unwrap! (get-user-id user) (err ERR_USER_ID_NOT_FOUND)))
      (entitledUstx (get-entitled-stacking-reward userId targetCycle stacksHeight))
      (stackerAtCycle (get-stacker-at-cycle-or-default targetCycle userId))
      (toReturn (get toReturn stackerAtCycle))
    )
    ;; TODO: only allow calls from core contract
    (asserts! (> currentCycle targetCycle) (err ERR_REWARD_CYCLE_NOT_COMPLETED))
    (asserts! (or (> toReturn u0) (> entitledUstx u0)) (err ERR_NOTHING_TO_REDEEM))
    (try! (contract-call? .citycoin-core return-stacked-tokens-and-rewards userId targetCycle toReturn entitledUstx))
    (ok true)
  )
)
