;; NEWYORKCITYCOIN CORE CONTRACT V1 PATCH
;; CityCoins Protocol Version 2.0.0

(impl-trait .citycoin-core-trait.citycoin-core)

;; generic error used to disable all functions below
(define-constant ERR_CONTRACT_DISABLED (err u1000))

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
