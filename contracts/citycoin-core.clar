;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; CONTRACT OWNER
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant CONTRACT_OWNER tx-sender)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; ERROR CODES
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant ERR_UNAUTHORIZED u1000)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; CITY WALLET MANAGEMENT
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-data-var cityWallet principal 'ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE)

;; test: returns result
(define-read-only (get-city-wallet)
  (var-get cityWallet)
)

;; test: call with no principal specified
;; test: call from non-approved principal
;; test: call from external contract
;; test: call from approved principal
(define-public (set-city-wallet (newCityWallet principal))
  (begin
    (asserts! (is-authorized-city) (err ERR_UNAUTHORIZED))
    (ok (var-set cityWallet newCityWallet))
  )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; CONTRACT MANAGEMENT
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant CONTRACT_DEFINED u0)
(define-constant CONTRACT_ACTIVE u1)
(define-constant CONTRACT_INACTIVE u2)

(define-data-var activeContract principal .citycoin-logic-v1)

(define-map cityCoinContracts
  principal
  {
    state: uint,
    startHeight: uint,
    endHeight: uint,
    active: bool
  }
)

(map-set cityCoinContracts .citycoin-logic-v1 { state: u0, startHeight: u0, endHeight: u0, active: false })

;; todo: function to update active contract

;; test: returns result
(define-read-only (get-active-contract)
  (var-get activeContract)
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; UTILITIES
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-private (is-authorized-city)
  (is-eq contract-caller (var-get cityWallet))
)

(define-private (is-authorized-owner)
  (is-eq contract-caller CONTRACT_OWNER)
)
