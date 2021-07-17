;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; CITYCOIN LOGIC CONTRACT
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; TRAIT DEFINITIONS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(impl-trait .citycoin-logic-trait.citycoin-logic)

;; TODO: add logic trait for future upgrades

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; ERROR CODES
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant ERR_CONTRACT_NOT_ACTIVATED u2000)
(define-constant ERR_USER_ALREADY_MINED u2001)
(define-constant ERR_INSUFFICIENT_COMMITMENT u2002)
(define-constant ERR_INSUFFICIENT_BALANCE u2003)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; CORE FUNCTIONS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-private (get-activation-status)
  (contract-call? .citycoin-core get-activation-status)
)

(define-private (has-mined-at-block (userId uint) (stacksHeight uint))
  (contract-call? .citycoin-core has-mined-at-block userId stacksHeight)
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

;; 30% split to custodied wallet address for the city
(define-constant SPLIT_CITY_PCT u30)

(define-public (mine-tokens-at-block (userId uint) (stacksHeight uint) (amountUstx uint) (memo (optional (buff 34))))
  (begin
    (asserts! (get-activation-status) (err ERR_CONTRACT_NOT_ACTIVATED))
    (asserts! (not (has-mined-at-block userId stacksHeight)) (err ERR_USER_ALREADY_MINED))
    (asserts! (> amountUstx u0) (err ERR_INSUFFICIENT_COMMITMENT))
    (asserts! (>= (stx-get-balance tx-sender) amountUstx) (err ERR_INSUFFICIENT_BALANCE))
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
      (contract-call? .citycoin-core set-tokens-mined userId stacksHeight amountUstx toStackers toCity)
      (if (> toStackers u0)
        (begin
          ;; TODO: fix error here and double-check where STX are sent
          (stx-transfer? toStackers tx-sender (as-contract tx-sender))
          (stx-transfer? toCity tx-sender cityWallet)
        )
        (stx-transfer? toCity tx-sender cityWallet)
      )
    )
    (ok true)
  )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; STACKING
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
