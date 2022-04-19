
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; FUNCTIONS ONLY USED DURING TESTS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; test to attempt changing city wallet from an unapproved address
(define-public (test-wallet-attack)
  (contract-call? .citycoin-core-v1 set-city-wallet 'STFCVYY1RJDNJHST7RRTPACYHVJQDJ7R1DWTQHQA)
)

;; test to attempt changing city wallet from an unapproved address
(define-public (test-wallet-attack-as-contract)
  (contract-call? .citycoin-core-v1 set-city-wallet (as-contract tx-sender))
)
