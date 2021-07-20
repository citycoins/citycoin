;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; CITYCOIN CORE CONTRACT
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; TRAIT DEFINITIONS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(use-trait logic .citycoin-logic-trait.citycoin-logic)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; CONTRACT OWNER
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant CONTRACT_OWNER tx-sender)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; ERROR CODES
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant ERR_UNAUTHORIZED u1000)
(define-constant ERR_USER_ALREADY_REGISTERED u1001)
(define-constant ERR_USER_NOT_FOUND u1002)
(define-constant ERR_ACTIVATION_THRESHOLD_REACHED u1003)
(define-constant ERR_CONTRACT_NOT_ACTIVATED u1004)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; CITY WALLET MANAGEMENT
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; initial value for city wallet
(define-data-var cityWallet principal 'ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE)

;; returns set city wallet principal
(define-read-only (get-city-wallet)
  (var-get cityWallet)
)
 
;; protected function to update city wallet variable
(define-public (set-city-wallet (newCityWallet principal))
  (begin
    (asserts! (is-authorized-city) (err ERR_UNAUTHORIZED))
    (ok (var-set cityWallet newCityWallet))
  )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; CONTRACT MANAGEMENT
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; contract states used in map CityCoinContracts
(define-constant CONTRACT_DEFINED u0)
(define-constant CONTRACT_ACTIVE u1)
(define-constant CONTRACT_INACTIVE u2)

;; initial value for active logic contract
;; set to deployer address at startup to prevent circular dependency of citycoin-core on citycoin-logic
(define-data-var activeContract principal CONTRACT_OWNER)

;; defines if the initial logic contract is provided for initialization
(define-data-var initialized bool false)

;; updates the activeContract variable with initial logic contract
;; can only be run once after deployment
(define-public (setup-active-contract (firstActiveContract principal))
  (begin
    (asserts! (is-authorized-owner) (err ERR_UNAUTHORIZED))
    (asserts! (not (var-get initialized)) (err ERR_UNAUTHORIZED))
    (var-set activeContract firstActiveContract)
    (var-set initialized true)
    (ok true)
  )
)

;; returns active contract
(define-read-only (get-active-contract)
  (var-get activeContract)
)

;; store logic contract information
(define-map CityCoinContracts
  principal
  {
    state: uint,
    startHeight: uint,
    endHeight: uint,
    active: bool
  }
)

;; returns logic contract information
(define-read-only (get-contract (address principal))
  (map-get? CityCoinContracts address)
)

;; set initial value for logic contract
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
;; (try! (contract-call? .citycoin-logic-v1 startup (some activationBlockVal)))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; REGISTRATION
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-data-var activationBlock uint u340282366920938463463374607431768211455)
(define-data-var activationDelay uint u150)
(define-data-var activationReached bool false)
(define-data-var activationThreshold uint u20)
(define-data-var usersNonce uint u0)

;; returns Stacks block height registration was activated at plus activationDelay
(define-read-only (get-activation-block)
  (let
    (
      (activated (var-get activationReached))
    )
    (asserts! activated (err ERR_CONTRACT_NOT_ACTIVATED))
    (ok (var-get activationBlock))
  )
)

;; returns activation delay
(define-read-only (get-activation-delay)
  (var-get activationDelay)
)

;; returns activation status as boolean
(define-read-only (get-activation-status)
  (var-get activationReached)
)

;; returns activation threshold
(define-read-only (get-activation-threshold)
  (var-get activationThreshold)
)

;; returns number of registered users, used for activation and tracking user IDs
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

;; returns (some userId) or none
(define-read-only (get-user-id (user principal))
  (map-get? UserIds user)
)

;; returns (some userPrincipal) or none
(define-read-only (get-user (userId uint))
  (map-get? Users userId)
)

;; returns user ID if it has been created, or creates and returns new ID
(define-private (get-or-create-user-id (user principal))
  (match
    (map-get? UserIds user)
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

;; registers users that signal activation of contract until threshold is met
;; TODO: change to string so message is easy to read?
(define-public (register-user (memo (optional (buff 34))))
  (let
    (
      (newId (+ u1 (var-get usersNonce)))
      (threshold (var-get activationThreshold))
    )

    (asserts! (not (var-get initialized)) (err ERR_UNAUTHORIZED))

    (asserts! (is-none (map-get? UserIds tx-sender))
      (err ERR_USER_ALREADY_REGISTERED))

    (asserts! (<= newId threshold)
      (err ERR_ACTIVATION_THRESHOLD_REACHED))

    (if (is-some memo)
      (print memo)
      none
    )

    ;; TODO: replace with get-or-create-user-id ?
    (map-set Users newId tx-sender)
    (map-set UserIds tx-sender newId)
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
(define-map MiningStatsAtBlock
  uint
  {
    minersCount: uint,
    amount: uint,
    amountToCity: uint,
    amountToStackers: uint,
    rewardClaimed: bool
  }
)

;; returns map MiningStatsAtBlock at a given Stacks block height if it exists
(define-read-only (get-mining-stats-at-block (stacksHeight uint))
  (map-get? MiningStatsAtBlock stacksHeight)
)

;; returns map MiningStatsAtBlock at a given Stacks block height
;; or, an empty structure
(define-read-only (get-mining-stats-at-block-or-default (stacksHeight uint))
  (default-to {
      minersCount: u0,
      amount: u0,
      amountToCity: u0,
      amountToStackers: u0,
      rewardClaimed: false
    }
    (map-get? MiningStatsAtBlock stacksHeight)
  )
)

;; At a given Stacks block height and user ID:
;; - what is their ustx commitment
;; - what are the low/high values (used for VRF)
(define-map MinersAtBlock
  {
    stacksHeight: uint,
    userId: uint
  }
  {
    ustx: uint,
    lowValue: uint,
    highValue: uint,
    winner: bool
  }
)

;; returns true if a given miner has already mined at a given block height
(define-read-only (has-mined-at-block (stacksHeight uint) (userId uint))
  (is-some 
    (map-get? MinersAtBlock { stacksHeight: stacksHeight, userId: userId })
  )
)

;; returns map MinersAtBlock at a given Stacks block height for a user ID
;; or, an empty structure
(define-read-only (get-miner-at-block (stacksHeight uint) (userId uint))
  (map-get? MinersAtBlock { stacksHeight: stacksHeight, userId: userId })
)

;; At a given Stacks block height:
;; - what is the max highValue from MinersAtBlock (used for VRF)
(define-map MinersAtBlockHighValue
  uint
  uint
)

;; returns last high value from map MinersAtBlockHighValue
(define-read-only (get-last-high-value-at-block (stacksHeight uint))
  (default-to u0
    (map-get? MinersAtBlockHighValue stacksHeight))
)

;; calls function to mine tokens in logic contract
(define-public (mine-tokens (logicTrait <logic>) (amountUstx uint) (memo (optional (buff 34))))
  (let
    (
      (userId (get-or-create-user-id tx-sender))
    )
    (if (is-some memo)
      (try! (contract-call? logicTrait mine-tokens-at-block userId block-height amountUstx memo))
      (try! (contract-call? logicTrait mine-tokens-at-block userId block-height amountUstx none))
    )
    (ok true)
  )
)

;; updates data based on mine tokens function in logic contract
(define-public (set-tokens-mined (userId uint) (stacksHeight uint) (amountUstx uint) (toStackers uint) (toCity uint))
  (let
    (
      (blockStats (get-mining-stats-at-block-or-default stacksHeight))
      (newMinersCount (+ (get minersCount blockStats) u1))
      (minerLowVal (get-last-high-value-at-block stacksHeight))
      (rewardCycle (default-to u0 (get-reward-cycle stacksHeight)))
      (rewardCycleStats (get-stacking-stats-at-cycle-or-default rewardCycle))
    )
    (asserts! (unwrap-panic (is-authorized-logic)) (err ERR_UNAUTHORIZED))
    (map-set MiningStatsAtBlock
      stacksHeight
      {
        minersCount: newMinersCount,
        amount: (+ (get amount blockStats) amountUstx),
        amountToCity: (+ (get amountToCity blockStats) toCity),
        amountToStackers: (+ (get amountToStackers blockStats) toStackers),
        rewardClaimed: false
      }
    )
    ;; TODO: use MERGE instead?
    (map-set MinersAtBlock
      {
        stacksHeight: stacksHeight,
        userId: userId
      }
      {
        ustx: amountUstx,
        lowValue: (+ minerLowVal u1),
        highValue: (+ minerLowVal amountUstx),
        winner: false
      }
    )
    (map-set MinersAtBlockHighValue
      stacksHeight
      (+ minerLowVal amountUstx)
    )
    ;; TODO: use MERGE instead?
    (map-set StackingStatsAtCycle
      stacksHeight
      {
        amountUstx: (+ (get amountUstx rewardCycleStats) toStackers),
        amountToken: (get amountToken rewardCycleStats)
      }
    )
    (ok true)
  )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; MINING REWARD CLAIMS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; calls function to claim mining reward in active logic contract
(define-public (claim-mining-reward (logicTrait <logic>) (minerBlockHeight uint))
  (begin
    (try! (contract-call? logicTrait claim-mining-reward-at-block tx-sender block-height minerBlockHeight))
    (ok true)
  )
)

(define-public (set-mining-reward-claimed (userId uint) (minerBlockHeight uint))
  (let
    (
      (blockStats (unwrap-panic (get-mining-stats-at-block minerBlockHeight)))
      (minerStats (unwrap-panic (get-miner-at-block minerBlockHeight userId)))
    )
    (asserts! (unwrap-panic (is-authorized-logic)) (err ERR_UNAUTHORIZED))
    (merge blockStats { rewardClaimed: true })
    (merge minerStats { winner: true })
    (ok true)
  )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; STACKING
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; how long a reward cycle is
(define-data-var rewardCycleLength uint u2100)

;; At a given reward cycle:
;; - how many Stackers were there
;; - what is the total uSTX submitted by miners
;; - what is the total amount of tokens stacked
;; TODO: could use a map-insert to track number of stackers in cycle?
(define-map StackingStatsAtCycle
  uint
  {
    amountUstx: uint,
    amountToken: uint
  }
)

;; returns the total stacked tokens and committed uSTX for a given reward cycle
;; or, an empty structure
(define-read-only (get-stacking-stats-at-cycle-or-default (rewardCycle uint))
  (default-to { amountUstx: u0, amountToken: u0 }
    (map-get? StackingStatsAtCycle rewardCycle))
)

;; returns the total stacked tokens and committed uSTX for a given reward cycle
(define-read-only (get-stacking-stats-at-cycle (rewardCycle uint))
  (map-get? StackingStatsAtCycle rewardCycle)
)

;; At a given reward cycle and user ID:
;; - what is the total tokens Stacked?
;; - how many tokens should be returned? (based on Stacking period)
(define-map StackerAtCycle
  {
    rewardCycle: uint,
    userId: uint
  }
  {
    amountStacked: uint,
    toReturn: uint
  }
)

(define-read-only (get-stacker-at-cycle-or-default (rewardCycle uint) (userId uint))
  (default-to { amountStacked: u0, toReturn: u0 }
    (map-get? StackerAtCycle { rewardCycle: rewardCycle, userId: userId }))
)

(define-read-only (get-stacker-at-cycle (rewardCycle uint) (userId uint))
  (map-get? StackerAtCycle { rewardCycle: rewardCycle, userId: userId })
)

;; get the reward cycle for a given Stacks block height
(define-read-only (get-reward-cycle (stacksHeight uint))
  (let
    (
      (firstStackingBlock (var-get activationBlock))
      (rcLen (var-get rewardCycleLength))
    )
    (if (>= stacksHeight firstStackingBlock)
      (some (/ (- stacksHeight firstStackingBlock) rcLen))
      none)
  )
)

;; determine if stacking is active in a given cycle
(define-read-only (stacking-active-at-cycle (rewardCycle uint))
  (is-some
    (get amountToken (map-get? StackingStatsAtCycle rewardCycle))
  )
)

(define-public (stack-tokens (logicTrait <logic>) (amountTokens uint) (lockPeriod uint))
  (let
    (
      (userId (get-or-create-user-id tx-sender))
    )
    (try! (contract-call? logicTrait stack-tokens-at-cycle tx-sender userId amountTokens block-height lockPeriod))
    (ok true)
  )
)

(define-public (set-tokens-stacked (userId uint) (targetCycle uint) (amountStacked uint) (toReturn uint))
  (let
    (
      (rewardCycleStats (unwrap-panic (get-stacking-stats-at-cycle targetCycle)))
      (stackerAtCycle (unwrap-panic (get-stacker-at-cycle targetCycle userId)))
    )
    (asserts! (unwrap-panic (is-authorized-logic)) (err ERR_UNAUTHORIZED))
    (map-set StackingStatsAtCycle
      targetCycle
      {
        amountUstx: (get amountUstx rewardCycleStats),
        amountToken: (+ amountStacked (get amountToken rewardCycleStats))
      }
    )
    (map-set StackerAtCycle
      {
        rewardCycle: targetCycle,
        userId: userId
      }
      {
        amountStacked: (+ amountStacked (get amountStacked stackerAtCycle)),
        toReturn: (+ toReturn (get toReturn stackerAtCycle))
      }
    )
    (ok true)
  )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; STACKING REWARD CLAIMS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; calls function to claim stacking reward in active logic contract
(define-public (claim-stacking-reward (logicTrait <logic>) (targetCycle uint))
  (begin
    (try! (contract-call? logicTrait claim-stacking-reward-at-cycle tx-sender block-height targetCycle))
    (ok true)
  )
)

(define-public (return-stacked-tokens-and-rewards (userId uint) (targetCycle uint) (toReturn uint) (entitledUstx uint))
  (let
    (
      (user (unwrap! (get-user userId) (err ERR_USER_NOT_FOUND)))
    )
    (asserts! (unwrap-panic (is-authorized-logic)) (err ERR_UNAUTHORIZED))
    ;; disable ability to claim again
    (map-set StackerAtCycle
      {
        rewardCycle: targetCycle,
        userId: userId
      }
      {
        amountStacked: u0,
        toReturn: u0
      }
    )
    ;; send back tokens if user was eligible
    (if (> toReturn u0)
      (try! (as-contract (contract-call? .citycoin-token transfer toReturn tx-sender user none)))
      true
    )
    ;; send back rewards if user was eligible
    (if (> entitledUstx u0)
      (try! (as-contract (stx-transfer? entitledUstx tx-sender user)))
      true
    )
    (ok true)
  )

  ;; disable ability to claim again in core
  ;; initiate transfer in core
  ;; - stacked tokens if unlocked
  ;; - entitled uSTX
  
)

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
    (asserts! (>= minerBlockHeight (var-get activationBlock)) u0)
    ;; if contract is active, return based on issuance schedule
    ;; halvings occur every 210,000 blocks for 1,050,000 Stacks blocks
    ;; then mining continues indefinitely with 3,125 CityCoins as the reward
    (asserts! (> minerBlockHeight (var-get coinbaseThreshold1))
      (if (<= (- minerBlockHeight (var-get activationBlock)) u10000)
        ;; bonus reward first 10,000 blocks
        u250000
        ;; standard reward remaining 200,000 blocks until 1st halving
        u100000
      )
    )
    ;; computations based on each halving threshold
    (asserts! (> minerBlockHeight (var-get coinbaseThreshold2)) u50000)
    (asserts! (> minerBlockHeight (var-get coinbaseThreshold3)) u25000)
    (asserts! (> minerBlockHeight (var-get coinbaseThreshold4)) u12500)
    (asserts! (> minerBlockHeight (var-get coinbaseThreshold5)) u6250)
    ;; default value after 5th halving
    u3125
  )
)

;; mint new tokens for claimant who won at given Stacks block height
;; TODO: verify access to function only available by core
(define-private (mint-coinbase (recipient principal) (stacksHeight uint))
  (contract-call? .citycoin-token mint (get-coinbase-amount stacksHeight) recipient)
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; UTILITIES
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; check if contract caller is city wallet
(define-private (is-authorized-city)
  (is-eq contract-caller (var-get cityWallet))
)

;; check if contract caller is contract owner
(define-private (is-authorized-owner)
  (is-eq contract-caller CONTRACT_OWNER)
)

;; check if contract caller is active logic contract
(define-private (is-authorized-logic)
  (begin
    (asserts! (var-get initialized) (err ERR_CONTRACT_NOT_ACTIVATED))
    (ok (is-eq contract-caller (get-active-contract)))
  )
)
