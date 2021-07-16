;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; CITYCOIN CORE CONTRACT
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

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

(map-set CityCoinContracts
  .citycoin-logic-v1
  {
    state: CONTRACT_DEFINED,
    startHeight: u0,
    endHeight: u0,
    active: false 
  })

;; TODO: function to update active contract
;;   called by register miner to activate first contract
;;   called by city wallet to update to new contract (+ delay)
;; (try! (contract-call? .citycoin-logic-v1 startup (some activationBlockVal))

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

;; store user principal by user id
(define-map Users
  uint
  principal
)

;; store user id by user principal
(define-map UserIds
  principal
  uint
)

;; returns user ID if it exists
(define-read-only (get-user-id (user principal))
  (map-get? UserIds user)
)

;; returns user principal if it exists
(define-read-only (get-user (userId uint))
  (map-get? Users userId)
)

;; returns user ID if it has been created, or creates and returns new ID
(define-private (get-or-create-user-id (user principal))
  (match
    (get user-id (map-get? Users { user: user }))
    value value
    (let
      (
        (newId (+ u1 (var-get usersNonce)))
      )
      (map-set Users newId user)
      (map-set UserIds user newId)
      (var-set usersNonce newId)
      newId
    )
  )
)

;; registers user that signal activation of contract until threshold is met
(define-public (register-user (memo (optional (buff 34))))
  (let
    (
      (newId (+ u1 (var-get usersNonce)))
      (threshold (var-get activationThreshold))
    )

    (asserts! (is-none (map-get? UserIds tx-sender))
      (err ERR_USER_ALREADY_REGISTERED))

    (asserts! (<= newId threshold)
      (err ERR_ACTIVATION_THRESHOLD_REACHED))

    (if (is-some memo)
      (print memo)
      none
    )

    (map-set Users newId user)
    (map-set UserIds user newId)
    (var-set usersNonce newId)

    (if (is-eq newId threshold)
      (let 
        (
          (activationBlockVal (+ block-height (var-get activationDelay)))
        )
        (var-set activationReached true)
        (var-set activationBlock activationBlockVal)
        (var-set coinbaseThreshold1 (+ activationBlockVal TOKEN_HALVING_BLOCKS))
        (var-set coinbaseThreshold2 (+ activationBlockVal (* u2 TOKEN_HALVING_BLOCKS)))
        (var-set coinbaseThreshold3 (+ activationBlockVal (* u3 TOKEN_HALVING_BLOCKS)))
        (var-set coinbaseThreshold4 (+ activationBlockVal (* u4 TOKEN_HALVING_BLOCKS)))
        (var-set coinbaseThreshold5 (+ activationBlockVal (* u5 TOKEN_HALVING_BLOCKS)))
        (map-set CityCoinContracts
          .citycoin-logic-v1
          {
            state: CONTRACT_ACTIVE,
            startHeight: activationBlockVal,
            endHeight: u0,
            active: true
        })
        (ok true)
      )
      (ok true)
    )    
  )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; MINING
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; At a given Stacks block height:
;; - how many miners were there
;; - what was the total amount submitted
;; - what was the total amount submitted to the city
;; - what was the total amount submitted to Stackers
;; - was the block reward claimed
(define-map BlockMiningStats
  uint
  {
    minersCount: uint,
    amount: uint,
    amountToCity: uint,
    amountToStackers: uint,
    rewardClaimed: bool
  }
)

(define-read-only (get-mined-blocks-stats (stacksHeight uint))
  (let 
    (
      (activated (var-get activationReached))
      (blockStats (map-get? BlockMiningStats stacksHeight))
    )
    (asserts! activated (err ERR_CONTRACT_NOT_ACTIVATED))
    (ok blockStats)
  )
)

;; At a given Stacks block height and index:
;; - what is the miner's ID
;; - what is their ustx commitment
;; - what are the low/high values (used for VRF)
(define-map BlockMiners
  { 
    stacksBlockHeight: uint,
    idx: uint
  }
  { 
    userId: uint,
    ustx: uint,
    lowValue: uint,
    highValue: uint
  }
)

;; At a given Stacks block height:
;; - what is the max highValue from BlockMiners (used for VRF)
(define-map BlockMinersHighValue
  uint
  uint
)

;; At a given Stacks block height and miner ID:
;; - did the miner mine yet
;; - what index in BlockMiners
(define-map BlockMinersById
  {
    stacksBlockHeight: uint,
    userId: uint
  }
  {
    committed: bool,
    idx: uint
  }
)

;;;;;

;; OLD DATA MAPS FOR REFERENCE - IGNORE

;; Bind Stacks block height to a list of up to 128 miners (and how much they mined) per block,
;; and track whether or not the miner has come back to claim their tokens and who mined the least.
(define-map mined-blocks
    { stacks-block-height: uint }
    {
        miners-count: uint,
        least-commitment-idx: uint,
        least-commitment-ustx: uint,
        claimed: bool,
    }
)

(define-map blocks-miners
  { stacks-block-height: uint, idx: uint }
  { miner-id: uint, ustx: uint }
)

;; TO DO: think about adding amount to mined-blocks map.
(define-map block-commit
    { stacks-block-height: uint }
    { amount: uint, 
      amount-to-stackers: uint, 
      amount-to-city: uint 
    }
)

(define-map miners-block-commitment
    { miner-id: uint, stacks-block-height: uint }
    { committed: bool }
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
(define-read-only (get-coinbase-amount (minerBlockHeight uint))
  (begin
    ;; if contract is not active, return 0
    (asserts! (>= minerBlockHeight activationBlock) u0)
    ;; if contract is active, return based on issuance schedule
    ;; halvings occur every 210,000 blocks for 1,050,000 Stacks blocks
    ;; then mining continues indefinitely with 3,125 CityCoins as the reward
    (asserts! (> minerBlockHeight (var-get coinbaseThreshold1))
      (if (<= (- minerBlockHeight activationBlock) u10000)
        ;; bonus reward first 10,000 blocks
        u250000
        ;; standard reward remaining 200,000 blocks until 1st halving
        u100000
      )
    )
    (asserts! (> minerBlockHeight (var-get coinbaseThreshold2)) u50000)
    (asserts! (> minerBlockHeight (var-get coinbaseThreshold3)) u25000)
    (asserts! (> minerBlockHeight (var-get coinbaseThreshold4)) u12500)
    (asserts! (> minerBlockHeight (var-get coinbaseThreshold5)) u6250)
    ;; default value after 5th halving
    u3125
  )
)

;; mint new tokens for claimant who won at given Stacks block height
(define-private (mint-coinbase (recipient principal) (stacksBlockHeight uint))
  (contract-call? .citycoin-token mint (get-coinbase-amount stacksBlockHeight) recipient)
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

;; refactor all "activated" checks above
;; to use this function instead ??
;; OR
;; just use the get-activation-status
;; read-only function ??
(define-private (is-activated)
  (let 
    (
      (activated (var-get activationReached))
    )
    (asserts! activated (err ERR_CONTRACT_NOT_ACTIVATED))
    (ok true)
  )
)