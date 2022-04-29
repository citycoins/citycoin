;; MIAMICOIN CORE CONTRACT V1 PATCH
;; CityCoins Protocol Version 2.0.0

(impl-trait .citycoin-core-trait.citycoin-core)


;; uses same and skips errors already defined in miamicoin-core-v1
(define-constant ERR_UNAUTHORIZED (err u1001))
;; generic error used to disable all functions below
(define-constant ERR_CONTRACT_DISABLED (err u1021))

;; DISABLED FUNCTIONS

(define-public (register-user (memo (optional (string-utf8 50))))
  ERR_CONTRACT_DISABLED
)

(define-public (mine-tokens (amountUstx uint) (memo (optional (buff 34))))
  ERR_CONTRACT_DISABLED
)

(define-public (claim-mining-reward (minerBlockHeight uint))
  ERR_CONTRACT_DISABLED
)

(define-public (stack-tokens (amountTokens uint) (lockPeriod uint))
  ERR_CONTRACT_DISABLED
)

(define-public (claim-stacking-reward (targetCycle uint))
  ERR_CONTRACT_DISABLED
)

(define-public (set-city-wallet (newCityWallet principal))
  ERR_CONTRACT_DISABLED
)

(define-public (shutdown-contract (stacksHeight uint))
  ERR_CONTRACT_DISABLED
)

;; V1 TO V2 CONVERSION

;; pass-through function to allow burning MIA v1
(define-public (burn-mia-v1 (amount uint) (owner principal))
  (begin
    (asserts! (is-eq tx-sender owner) ERR_UNAUTHORIZED)
    (as-contract (try! (contract-call? .miamicoin-token burn amount owner)))
    (ok true)
  )
)
