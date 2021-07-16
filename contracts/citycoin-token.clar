;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; CITYCOIN TOKEN CONTRACT
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; CONTRACT OWNER
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant CONTRACT_OWNER tx-sender)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; ERROR CODES
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant ERR_UNAUTHORIZED u3)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; SIP-010 DEFINITION
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)
;; testnet: (impl-trait 'STR8P3RD1EHA8AA37ERSSSZSWKS9T2GYQFGXNA4C.sip-010-trait-ft-standard.sip-010-trait)

(define-fungible-token citycoins)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; SIP-010 FUNCTIONS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-public (transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
    (begin
        (asserts! (is-eq from tx-sender) (err ERR_UNAUTHORIZED))
        (if (is-some memo)
            (print memo)
            none
        )
        (ft-transfer? citycoins amount from to)
    )
)

(define-read-only (get-name)
    (ok "citycoins")
)

(define-read-only (get-symbol)
    (ok "CYCN")
)

(define-read-only (get-decimals)
    (ok u0)
)

(define-read-only (get-balance (user principal))
    (ok (ft-get-balance citycoins user))
)

(define-read-only (get-total-supply)
    (ok (ft-get-supply citycoins))
)

(define-read-only (get-token-uri)
    (ok (var-get tokenUri))
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; UTILITIES
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-data-var tokenUri (optional (string-utf8 256)) (some u"https://cdn.citycoins.co/metadata/citycoin.json"))
(define-data-var trustedCaller principal .citycoin-core)

;; set token URI to new value, only accessible by CITYCOIN CORE
(define-public (set-token-uri (newUri (optional (string-utf8 256))))
    (begin
        (asserts! (is-eq contract-caller (var-get trustedCaller)) (err ERR_UNAUTHORIZED))
        (ok (var-set tokenUri newUri))
    )
)

;; mint new tokens, only accessible by CITYCOIN CORE
(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq contract-caller (var-get trustedCaller)) (err ERR_UNAUTHORIZED))
    (ft-mint? citycoins amount recipient)
  )
)

;; burn tokens, only accessible by CITYCOIN CORE
(define-public (burn (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq contract-caller (var-get trustedCaller)) (err ERR_UNAUTHORIZED))
    (ft-burn? citycoins amount recipient)
  )
)

;; send-many interface
(define-private (send-citycoins (amount uint) (to principal))
  (let
    (
      (transferOk (try! (transfer amount tx-sender to none)))
    )
    (ok transferOk)
  )
)

(define-private (check-err (result (response bool uint)) (prior (response bool uint)))
  (match prior ok-value result
               err-value (err err-value))
)

(define-public (send-many (recipients (list 200 { to: principal, amount: uint })))
  (fold check-err
    (map send-citycoins recipients)
    (ok true)
  )
)
