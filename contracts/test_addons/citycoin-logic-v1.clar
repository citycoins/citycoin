
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; FUNCTIONS ONLY USED DURING TESTS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-public (test-mine-tokens (user principal) (stacksHeight uint) (amountUstx uint))
  (let
    (
      (userId (unwrap-panic (contract-call? .citycoin-core test-generate-user-id user)))
    )
    (try! (contract-call? .citycoin-core set-tokens-mined userId stacksHeight amountUstx u0 u0))
    (ok true)
  )
)
