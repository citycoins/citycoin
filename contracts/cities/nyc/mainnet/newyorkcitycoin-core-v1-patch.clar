;; NEWYORKCITYCOIN CORE CONTRACT V1 PATCH
;; CityCoins Protocol Version 2.0.0

(impl-trait 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.citycoin-core-trait.citycoin-core)

;; uses same and skips errors already defined in newyorkcitycoin-core-v1
(define-constant ERR_UNAUTHORIZED (err u1001))
;; generic error used to disable all functions below
(define-constant ERR_CONTRACT_DISABLED (err u1021))

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

(define-public (shutdown-contract (stacksHeight uint))
  ERR_CONTRACT_DISABLED
)

;; need to allow function to succeed one time in order to be updated
;; as the new V1 core contract, then will fail after that
(define-data-var upgraded bool false)

(define-public (set-city-wallet (newCityWallet principal))
  (begin
    (asserts! (is-authorized-auth) ERR_UNAUTHORIZED)
    (if (var-get upgraded)
      ;; if true
      ERR_CONTRACT_DISABLED
      ;; if false
      (ok (var-set upgraded true))
    )
  )
)

;; checks if caller is auth contract
(define-private (is-authorized-auth)
  (is-eq contract-caller 'SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5.newyorkcitycoin-auth)
)
