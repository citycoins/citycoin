
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; FUNCTIONS ONLY USED DURING TESTS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-public (test-mint (amount uint) (recipient principal))
  (ft-mint? citycoins amount recipient)
)

(define-public (test-set-token-activation)
  (ok (var-set tokenActivated true))
)
