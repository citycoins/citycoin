
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; FUNCTIONS ONLY USED DURING TESTS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-public (test-initialize-contracts (coreContract <coreTrait>))
  (let
    (
      (coreContractAddress (contract-of coreContract))
    )
    ;; (asserts! (is-eq contract-caller CONTRACT_OWNER) (err ERR_UNAUTHORIZED))
    (asserts! (not (var-get initialized)) (err ERR_UNAUTHORIZED))
    (map-set CoreContracts
      coreContractAddress
      {
        state: STATE_DEPLOYED,
        startHeight: u0,
        endHeight: u0
      })
    (try! (contract-call? coreContract set-city-wallet (var-get cityWallet)))
    (var-set initialized true)
    (ok true)
  )
)

(define-public (test-set-active-core-contract)
  (ok (var-set activeCoreContract .citycoin-core-v1))
)

;; core contract states
;; (define-constant STATE_DEPLOYED u0)
;; (define-constant STATE_ACTIVE u1)
;; (define-constant STATE_INACTIVE u2)

(define-public (test-set-core-contract-state (coreContract <coreTrait>) (state uint))
  (let
    (
      (coreContractAddress (contract-of coreContract))
    )
    (asserts! (or (>= state STATE_DEPLOYED) (<= state STATE_INACTIVE)) (err ERR_UNAUTHORIZED))
    (map-set CoreContracts
      coreContractAddress
      {
        state: state,
        startHeight: u0,
        endHeight: u0
      }
    )
    (ok true)
  )
)