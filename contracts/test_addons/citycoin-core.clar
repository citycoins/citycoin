
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; FUNCTIONS ONLY USED DURING TESTS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-public (test-unsafe-city-wallet (newCityWallet principal))
  (ok (var-set cityWallet newCityWallet))
)

(define-public (test-set-activation-threshold (newThreshold uint))
  (ok (var-set activationThreshold newThreshold))
)

(define-public (test-generate-user-id (user principal))
  (ok (get-or-create-user-id user))
)

(define-public (test-activate-contract)
  (begin
    (var-set cityWallet 'STFCVYY1RJDNJHST7RRTPACYHVJQDJ7R1DWTQHQA)
    (var-set activationThreshold u1)
    (var-set activeContract .citycoin-logic-v1)
    (var-set initialized true)
    (ok true)
  )
)
