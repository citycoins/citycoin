;; MIAMICOIN CORE CONTRACT V1 PATCH
;; CityCoins Protocol Version 2.0.0

(impl-trait 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.citycoin-core-trait.citycoin-core)

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
  (is-eq contract-caller 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-auth)
)

;; V1 TO V2 CONVERSION

;; pass-through function to allow burning MIA v1
(define-public (burn-mia-v1 (amount uint) (owner principal))
  (begin
    (asserts! (is-eq tx-sender owner) ERR_UNAUTHORIZED)
    (as-contract (try! (contract-call? 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-token burn amount owner)))
    (ok true)
  )
)
