
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; FUNCTIONS ONLY USED DURING TESTS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; used in core, tardis, token, and vote tests
(define-public (test-mint (amount uint) (recipient principal))
  (ft-mint? citycoins amount recipient)
)

;; rename test-activate-token
(define-public (test-set-token-activation)
  (ok (var-set tokenActivated true))
)
