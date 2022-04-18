
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; FUNCTIONS ONLY USED DURING TESTS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; used by citycoin-core-v1.test.ts (and v2)
(define-public (test-unsafe-set-city-wallet (newCityWallet principal))
  (ok (var-set cityWallet newCityWallet))
)

;; used by citycoin-core-v1.test.ts (and v2)
(define-public (test-set-activation-threshold (newThreshold uint))
  (ok (var-set activationThreshold newThreshold))
)

(use-trait coreTrait .citycoin-core-trait.citycoin-core)

;; used in auth, core, tardis, token, and vote tests
(define-public (test-initialize-core (coreContract <coreTrait>))
  (begin
    (var-set activationThreshold u1)
    (try! (contract-call? .citycoin-auth test-initialize-contracts coreContract))
    (ok true)
  )
)
