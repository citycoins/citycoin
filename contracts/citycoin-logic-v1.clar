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
  (default-to u0 (contract-call? .citycoin-core get-reward-cycle stacksHeight))
)

(define-private (stacking-active-at-cycle (rewardCycle uint))
  (contract-call? .citycoin-core stacking-active-at-cycle rewardCycle)
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
      (rewardCycle (get-reward-cycle stacksHeight))
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
    ;; TODO: call to update data in core contract
    (ok true)
  )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; STACKING
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
