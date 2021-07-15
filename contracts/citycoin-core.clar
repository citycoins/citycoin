;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; CONTRACT OWNER
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant CONTRACT_OWNER tx-sender)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; ERROR CODES
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant ERR_UNAUTHORIZED u1000)
(define-constant ERR_USER_ALREADY_REGISTERED u1001)
(define-constant ERR_ACTIVATION_THRESHOLD_REACHED u1002)
(define-constant ERR_CONTRACT_NOT_ACTIVATED u1003)

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

(define-map CityCoinContracts
  principal
  {
    state: uint,
    startHeight: uint,
    endHeight: uint,
    active: bool
  }
)

(define-read-only (get-contract (address principal))
  (map-get? CityCoinContracts address)
)

(map-set CityCoinContracts .citycoin-logic-v1 { state: u0, startHeight: u0, endHeight: u0, active: false })

;; TODO: function to update active contract
;;   called by register miner to activate first contract
;;   called by city wallet to update to new contract (+ delay)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; REGISTRATION
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-data-var activationBlock uint u340282366920938463463374607431768211455)
(define-data-var activationDelay uint u150)
(define-data-var activationReached bool false)
(define-data-var activationThreshold uint u20)
(define-data-var usersNonce uint u0)

(define-read-only (get-activation-block)
  (let 
    (
      (activated (var-get activationReached))
    )
    (asserts! activated (err ERR_CONTRACT_NOT_ACTIVATED))
    (ok (var-get activationBlock))
  )
)

(define-read-only (get-activation-delay)
  (var-get activationDelay)
)

(define-read-only (get-activation-status)
  (var-get activationReached)
)

(define-read-only (get-activation-threshold)
  (var-get activationThreshold)
)

(define-read-only (get-registered-users-nonce)
  (var-get usersNonce)
)

;; map principals to a uint ID, was: miners
(define-map Users
  { user: principal }
  { user-id: uint }
)

;; map principals ID to a principal
(define-map UserIds
  { user-id: uint }
  { user: principal }
)

;; returns user ID if it exists
(define-read-only (get-user-id (user principal))
  (get user-id (map-get? Users { user: user }))
)

;; returns user principal if it exists
(define-read-only (get-user (user-id uint))
  (get user (map-get? UserIds { user-id: user-id }))
)

;; returns user ID if it has been created, or creates and returns new ID
(define-private (get-or-create-user-id (user principal))
  (match
    (get user-id (map-get? Users { user: user }))
    value value
    (let
      (
        (new-id (+ u1 (var-get usersNonce)))
      )
      (map-set Users
        { user: user }
        { user-id: new-id }
      )
      (map-set UserIds
        { user-id: new-id }
        { user: user }
      )
      (var-set usersNonce new-id)
      new-id
    )
  )
)

;; registers user that signal activation of contract until threshold is met
(define-public (register-user (memo (optional (buff 34))))
  (let
    (
      (new-id (+ u1 (var-get usersNonce)))
      (threshold (var-get activationThreshold))
    )

    (asserts! (is-none (map-get? Users { user: tx-sender }))
      (err ERR_USER_ALREADY_REGISTERED))

    (asserts! (<= new-id threshold)
      (err ERR_ACTIVATION_THRESHOLD_REACHED))

    (if (is-some memo)
      (print memo)
      none
    )

    (map-set Users
      { user: tx-sender }
      { user-id: new-id }
    )

    (map-set UserIds
      { user-id: new-id }
      { user: user }
    )

    (var-set usersNonce new-id)

    (if (is-eq new-id threshold)
      (let 
        (
          (activationBlock-val (+ block-height (var-get activationDelay)))
        )
        (var-set activationReached true)
        (var-set activationBlock activationBlock-val)
        (var-set coinbaseThreshold1 (+ activationBlock-val TOKEN_HALVING_BLOCKS))
        (var-set coinbaseThreshold2 (+ activationBlock-val (* u2 TOKEN_HALVING_BLOCKS)))
        (var-set coinbaseThreshold3 (+ activationBlock-val (* u3 TOKEN_HALVING_BLOCKS)))
        (var-set coinbaseThreshold4 (+ activationBlock-val (* u4 TOKEN_HALVING_BLOCKS)))
        (var-set coinbaseThreshold5 (+ activationBlock-val (* u5 TOKEN_HALVING_BLOCKS)))
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
(define-constant TOKEN_HALVING_BLOCKS u210000)

;; store block height at each halving, set by register-user    
(define-data-var coinbaseThreshold1 uint u0)
(define-data-var coinbaseThreshold2 uint u0)
(define-data-var coinbaseThreshold3 uint u0)
(define-data-var coinbaseThreshold4 uint u0)
(define-data-var coinbaseThreshold5 uint u0)

;; return coinbase thresholds if contract activated
(define-read-only (get-coinbase-thresholds)
  (let 
    (
      (activated (var-get activationReached))
    )
    (asserts! activated (err ERR_CONTRACT_NOT_ACTIVATED))
    (ok {
      coinbaseThreshold1: (var-get coinbaseThreshold1),
      coinbaseThreshold2: (var-get coinbaseThreshold2),
      coinbaseThreshold3: (var-get coinbaseThreshold3),
      coinbaseThreshold4: (var-get coinbaseThreshold4),
      coinbaseThreshold5: (var-get coinbaseThreshold5)
    })
  )
)

;; function for deciding how many tokens to mint, depending on when they were mined
(define-read-only (get-coinbase-amount (miner-block-height uint))
  ;; if contract is not active, return 0
  (asserts! (>= miner-block-height activationBlock) u0)
  ;; if contract is active, return based on issuance schedule
  ;; halvings occur every 210,000 blocks for 1,050,000 Stacks blocks
  ;; then mining continues indefinitely with 3,125 CityCoins as the reward
  (asserts! (> miner-block-height (var-get coinbaseThreshold1))
    (if (<= (- miner-block-height activationBlock) u10000)
      ;; bonus reward first 10,000 blocks
      u250000
      ;; standard reward remaining 200,000 blocks until 1st halving
      u100000
    )
  )
  (asserts! (> miner-block-height (var-get coinbaseThreshold2)) u50000)
  (asserts! (> miner-block-height (var-get coinbaseThreshold3)) u25000)
  (asserts! (> miner-block-height (var-get coinbaseThreshold4)) u12500)
  (asserts! (> miner-block-height (var-get coinbaseThreshold5)) u6250)
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
