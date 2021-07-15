;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; CONTRACT OWNER
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant CONTRACT_OWNER tx-sender)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; ERROR CODES
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant ERR_UNAUTHORIZED u1000)
(define-constant ERR-USER-ALREADY-REGISTERED u1001)
(define-constant ERR-ACTIVATION-THRESHOLD-REACHED u1002)
(define-constant ERR-CONTRACT-NOT-ACTIVATED u1003)

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

;; test: returns result
(define-read-only (get-active-contract)
  (var-get activeContract)
)

(define-map cityCoinContracts
  principal
  {
    state: uint,
    startHeight: uint,
    endHeight: uint,
    active: bool
  }
)

(define-read-only (get-contract (address principal))
  (map-get? cityCoinContracts address)
)

(map-set cityCoinContracts .citycoin-logic-v1 { state: u0, startHeight: u0, endHeight: u0, active: false })

;; TODO: function to update active contract
;;   called by register miner to activate first contract
;;   called by city wallet to update to new contract (+ delay)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; REGISTRATION
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-data-var activation-block uint u340282366920938463463374607431768211455)
(define-data-var activation-delay uint u150)
(define-data-var activation-reached bool false)
(define-data-var activation-threshold uint u20)
(define-data-var users-nonce uint u0)

(define-read-only (get-activation-block)
  (let 
    (
      (activated (var-get activation-reached))
    )
    (asserts! activated (err ERR-CONTRACT-NOT-ACTIVATED))
    (ok (var-get activation-block))
  )
)

(define-read-only (get-activation-delay)
  (var-get activation-delay)
)

(define-read-only (get-activation-status)
  (var-get activation-reached)
)

(define-read-only (get-activation-threshold)
  (var-get activation-threshold)
)

(define-read-only (get-registered-users-nonce)
  (var-get users-nonce)
)

;; map principals to a uint ID, was: miners
(define-map users
  { user: principal }
  { user-id: uint }
)

;; returns user ID if it has been created
(define-read-only (get-user-id (user principal))
  (get user-id (map-get? users { user: user }))
)

;; returns user ID if it has been created, or creates and returns new ID
(define-private (get-or-create-user-id (user principal))
  (match
    (get user-id (map-get? users { user: user }))
    value value
    (let
      (
        (new-id (+ u1 (var-get users-nonce)))
      )
      (map-set users
        { user: user }
        { user-id: new-id }
      )
      (var-set users-nonce new-id)
      new-id
    )
  )
)

;; registers user that signal activation of contract until threshold is met
(define-public (register-user (memo (optional (buff 34))))
  (let
    (
      (new-id (+ u1 (var-get users-nonce)))
      (threshold (var-get activation-threshold))
    )

    (asserts! (is-none (map-get? users { user: tx-sender }))
      (err ERR-USER-ALREADY-REGISTERED))

    (asserts! (<= new-id threshold)
      (err ERR-ACTIVATION-THRESHOLD-REACHED))

    (if (is-some memo)
      (print memo)
      none
    )

    (map-set users
      { user: tx-sender }
      { user-id: new-id }
    )

    (var-set users-nonce new-id)

    (if (is-eq new-id threshold)
      (let 
        (
          (activation-block-val (+ block-height (var-get activation-delay)))
        )
        (var-set activation-reached true)
        (var-set activation-block activation-block-val)
        (var-set coinbase-threshold-1 (+ activation-block-val TOKEN-HALVING-BLOCKS))
        (var-set coinbase-threshold-2 (+ activation-block-val (* u2 TOKEN-HALVING-BLOCKS)))
        (var-set coinbase-threshold-3 (+ activation-block-val (* u3 TOKEN-HALVING-BLOCKS)))
        (var-set coinbase-threshold-4 (+ activation-block-val (* u4 TOKEN-HALVING-BLOCKS)))
        (var-set coinbase-threshold-5 (+ activation-block-val (* u5 TOKEN-HALVING-BLOCKS)))
        (ok true)
      )
      (ok true)
    )    
  )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; STACKING
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;



;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; TOKEN
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; how many blocks until the next halving occurs
(define-constant TOKEN-HALVING-BLOCKS u210000)

;; store block height at each halving, set by register-user    
(define-data-var coinbase-threshold-1 uint u0)
(define-data-var coinbase-threshold-2 uint u0)
(define-data-var coinbase-threshold-3 uint u0)
(define-data-var coinbase-threshold-4 uint u0)
(define-data-var coinbase-threshold-5 uint u0)

;; return coinbase thresholds if contract activated
(define-read-only (get-coinbase-thresholds)
  (let 
    (
      (activated (var-get activation-reached))
    )
    (asserts! activated (err ERR-CONTRACT-NOT-ACTIVATED))
    (ok {
      coinbase-threshold-1: (var-get coinbase-threshold-1),
      coinbase-threshold-2: (var-get coinbase-threshold-2),
      coinbase-threshold-3: (var-get coinbase-threshold-3),
      coinbase-threshold-4: (var-get coinbase-threshold-4),
      coinbase-threshold-5: (var-get coinbase-threshold-5)
    })
  )
)

;; function for deciding how many tokens to mint, depending on when they were mined
(define-read-only (get-coinbase-amount (miner-block-height uint))
  ;; if contract is not active, return 0
  (asserts! (>= miner-block-height activation-block) u0)
  ;; if contract is active, return based on issuance schedule
  ;; halvings occur every 210,000 blocks for 1,050,000 Stacks blocks
  ;; then mining continues indefinitely with 3,125 CityCoins as the reward
  (asserts! (> miner-block-height (var-get coinbase-threshold-1))
    (if (<= (- miner-block-height activation-block) u10000)
      ;; bonus reward first 10,000 blocks
      u250000
      ;; standard reward remaining 200,000 blocks until 1st halving
      u100000
    )
  )
  (asserts! (> miner-block-height (var-get coinbase-threshold-2)) u50000)
  (asserts! (> miner-block-height (var-get coinbase-threshold-3)) u25000)
  (asserts! (> miner-block-height (var-get coinbase-threshold-4)) u12500)
  (asserts! (> miner-block-height (var-get coinbase-threshold-5)) u6250)
  ;; default value after 5th halving
  u3125
)

;; mint new tokens for claimant who won at given Stacks block height
(define-private (mint-coinbase (recipient principal) (stacks-block-ht uint))
  (contract-call? .citycoin-token mint (get-coinbase-amount stacks-block-ht) recipient)
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
