;; MIAMICOIN CORE CONTRACT

;; GENERAL CONFIGURATION

(impl-trait 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.citycoin-core-trait.citycoin-core)
(define-constant CONTRACT_OWNER tx-sender)

;; ERROR CODES

(define-constant ERR_UNAUTHORIZED u1000)
(define-constant ERR_USER_ALREADY_REGISTERED u1001)
(define-constant ERR_USER_NOT_FOUND u1002)
(define-constant ERR_USER_ID_NOT_FOUND u1003)
(define-constant ERR_ACTIVATION_THRESHOLD_REACHED u1004)
(define-constant ERR_CONTRACT_NOT_ACTIVATED u1005)
(define-constant ERR_USER_ALREADY_MINED u1006)
(define-constant ERR_INSUFFICIENT_COMMITMENT u1007)
(define-constant ERR_INSUFFICIENT_BALANCE u1008)
(define-constant ERR_USER_DID_NOT_MINE_IN_BLOCK u1009)
(define-constant ERR_CLAIMED_BEFORE_MATURITY u1010)
(define-constant ERR_NO_MINERS_AT_BLOCK u1011)
(define-constant ERR_REWARD_ALREADY_CLAIMED u1012)
(define-constant ERR_MINER_DID_NOT_WIN u1013)
(define-constant ERR_NO_VRF_SEED_FOUND u1014)
(define-constant ERR_STACKING_NOT_AVAILABLE u1015)
(define-constant ERR_CANNOT_STACK u1016)
(define-constant ERR_REWARD_CYCLE_NOT_COMPLETED u1017)
(define-constant ERR_NOTHING_TO_REDEEM u1018)
(define-constant ERR_UNABLE_TO_FIND_CITY_WALLET u1019)
(define-constant ERR_CLAIM_IN_WRONG_CONTRACT u1020)
(define-constant ERR_BLOCK_HEIGHT_IN_PAST u1021)

;; CITY WALLET MANAGEMENT

;; initial value for city wallet, set to this contract until initialized
(define-data-var cityWallet principal 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-core-v1)

;; returns set city wallet principal
(define-read-only (get-city-wallet)
  (var-get cityWallet)
)
 
;; protected function to update city wallet variable
(define-public (set-city-wallet (newCityWallet principal))
  (begin
    (asserts! (is-authorized-auth) (err ERR_UNAUTHORIZED))
    (ok (var-set cityWallet newCityWallet))
  )
)

;; REGISTRATION

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
(define-public (register-user (memo (optional (string-utf8 50))))
  (let
    (
      (newId (+ u1 (var-get usersNonce)))
      (threshold (var-get activationThreshold))
      (initialized (contract-call? 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-auth is-initialized))
    )

    (asserts! initialized (err ERR_UNAUTHORIZED))

    (asserts! (is-none (map-get? UserIds tx-sender))
      (err ERR_USER_ALREADY_REGISTERED))

    (asserts! (<= newId threshold)
      (err ERR_ACTIVATION_THRESHOLD_REACHED))

    (if (is-some memo)
      (print memo)
      none
    )

    (get-or-create-user-id tx-sender)

    (if (is-eq newId threshold)
      (let
        (
          (activationBlockVal (+ block-height (var-get activationDelay)))
        )
        (try! (contract-call? 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-auth activate-core-contract (as-contract tx-sender) activationBlockVal))
        (try! (contract-call? 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-token activate-token (as-contract tx-sender) activationBlockVal))
        (try! (set-coinbase-thresholds))
        (var-set activationReached true)
        (var-set activationBlock activationBlockVal)
        (ok true)
      )
      (ok true)
    )
  )
)

;; MINING CONFIGURATION

;; define split to custodied wallet address for the city
(define-constant SPLIT_CITY_PCT u30)

;; how long a miner must wait before block winner can claim their minted tokens
(define-data-var tokenRewardMaturity uint u100)

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
(define-read-only (get-miner-at-block (stacksHeight uint) (userId uint))
  (map-get? MinersAtBlock { stacksHeight: stacksHeight, userId: userId })
)

;; returns map MinersAtBlock at a given Stacks block height for a user ID
;; or, an empty structure
(define-read-only (get-miner-at-block-or-default (stacksHeight uint) (userId uint))
  (default-to {
    highValue: u0,
    lowValue: u0,
    ustx: u0,
    winner: false
  }
    (map-get? MinersAtBlock { stacksHeight: stacksHeight, userId: userId }))
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

;; At a given Stacks block height:
;; - what is the userId of miner who won this block
(define-map BlockWinnerIds
  uint
  uint
)

(define-read-only (get-block-winner-id (stacksHeight uint))
  (map-get? BlockWinnerIds stacksHeight)
)

;; MINING ACTIONS

(define-public (mine-tokens (amountUstx uint) (memo (optional (buff 34))))
  (let
    (
      (userId (get-or-create-user-id tx-sender))
    )
    (try! (mine-tokens-at-block userId block-height amountUstx memo))
    (ok true)
  )
)

(define-public (mine-many (amounts (list 200 uint)))
  (begin
    (asserts! (get-activation-status) (err ERR_CONTRACT_NOT_ACTIVATED))
    (asserts! (> (len amounts) u0) (err ERR_INSUFFICIENT_COMMITMENT))
    (match (fold mine-single amounts (ok { userId: (get-or-create-user-id tx-sender), toStackers: u0, toCity: u0, stacksHeight: block-height }))
      okReturn 
      (begin
        (asserts! (>= (stx-get-balance tx-sender) (+ (get toStackers okReturn) (get toCity okReturn))) (err ERR_INSUFFICIENT_BALANCE))
        (if (> (get toStackers okReturn ) u0)
          (try! (stx-transfer? (get toStackers okReturn ) tx-sender (as-contract tx-sender)))
          false
        )
        (try! (stx-transfer? (get toCity okReturn) tx-sender (var-get cityWallet)))
        (ok true)
      )
      errReturn (err errReturn)
    )
  )
)

(define-private (mine-single 
  (amountUstx uint) 
  (return (response 
    { 
      userId: uint,
      toStackers: uint,
      toCity: uint,
      stacksHeight: uint
    }
    uint
  )))

  (match return okReturn
    (let
      (
        (stacksHeight (get stacksHeight okReturn))
        (rewardCycle (default-to u0 (get-reward-cycle stacksHeight)))
        (stackingActive (stacking-active-at-cycle rewardCycle))
        (toCity
          (if stackingActive
            (/ (* SPLIT_CITY_PCT amountUstx) u100)
            amountUstx
          )
        )
        (toStackers (- amountUstx toCity))
      )
      (asserts! (not (has-mined-at-block stacksHeight (get userId okReturn))) (err ERR_USER_ALREADY_MINED))
      (asserts! (> amountUstx u0) (err ERR_INSUFFICIENT_COMMITMENT))
      (try! (set-tokens-mined (get userId okReturn) stacksHeight amountUstx toStackers toCity))
      (ok (merge okReturn 
        {
          toStackers: (+ (get toStackers okReturn) toStackers),
          toCity: (+ (get toCity okReturn) toCity),
          stacksHeight: (+ stacksHeight u1)
        }
      ))
    )
    errReturn (err errReturn)
  ) 
)

(define-private (mine-tokens-at-block (userId uint) (stacksHeight uint) (amountUstx uint) (memo (optional (buff 34))))
  (let
    (
      (rewardCycle (default-to u0 (get-reward-cycle stacksHeight)))
      (stackingActive (stacking-active-at-cycle rewardCycle))
      (toCity
        (if stackingActive
          (/ (* SPLIT_CITY_PCT amountUstx) u100)
          amountUstx
        )
      )
      (toStackers (- amountUstx toCity))
    )
    (asserts! (get-activation-status) (err ERR_CONTRACT_NOT_ACTIVATED))
    (asserts! (not (has-mined-at-block stacksHeight userId)) (err ERR_USER_ALREADY_MINED))
    (asserts! (> amountUstx u0) (err ERR_INSUFFICIENT_COMMITMENT))
    (asserts! (>= (stx-get-balance tx-sender) amountUstx) (err ERR_INSUFFICIENT_BALANCE))
    (try! (set-tokens-mined userId stacksHeight amountUstx toStackers toCity))
    (if (is-some memo)
      (print memo)
      none
    )
    (if stackingActive
      (try! (stx-transfer? toStackers tx-sender (as-contract tx-sender)))
      false
    )
    (try! (stx-transfer? toCity tx-sender (var-get cityWallet)))
    (ok true)
  )
)

(define-private (set-tokens-mined (userId uint) (stacksHeight uint) (amountUstx uint) (toStackers uint) (toCity uint))
  (let
    (
      (blockStats (get-mining-stats-at-block-or-default stacksHeight))
      (newMinersCount (+ (get minersCount blockStats) u1))
      (minerLowVal (get-last-high-value-at-block stacksHeight))
      (rewardCycle (unwrap! (get-reward-cycle stacksHeight)
        (err ERR_STACKING_NOT_AVAILABLE)))
      (rewardCycleStats (get-stacking-stats-at-cycle-or-default rewardCycle))
    )
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
    (map-set MinersAtBlock
      {
        stacksHeight: stacksHeight,
        userId: userId
      }
      {
        ustx: amountUstx,
        lowValue: (if (> minerLowVal u0) (+ minerLowVal u1) u0),
        highValue: (+ minerLowVal amountUstx),
        winner: false
      }
    )
    (map-set MinersAtBlockHighValue
      stacksHeight
      (+ minerLowVal amountUstx)
    )
    (if (> toStackers u0)
      (map-set StackingStatsAtCycle
        rewardCycle
        {
          amountUstx: (+ (get amountUstx rewardCycleStats) toStackers),
          amountToken: (get amountToken rewardCycleStats)
        }
      )
      false
    )
    (ok true)
  )
)

;; MINING REWARD CLAIM ACTIONS

;; calls function to claim mining reward in active logic contract
(define-public (claim-mining-reward (minerBlockHeight uint))
  (begin
    (asserts! (or (is-eq (var-get shutdownHeight) u0) (< minerBlockHeight (var-get shutdownHeight))) (err ERR_CLAIM_IN_WRONG_CONTRACT))
    (try! (claim-mining-reward-at-block tx-sender block-height minerBlockHeight))
    (ok true)
  )
)

;; Determine whether or not the given principal can claim the mined tokens at a particular block height,
;; given the miners record for that block height, a random sample, and the current block height.
(define-private (claim-mining-reward-at-block (user principal) (stacksHeight uint) (minerBlockHeight uint))
  (let
    (
      (maturityHeight (+ (var-get tokenRewardMaturity) minerBlockHeight))
      (userId (unwrap! (get-user-id user) (err ERR_USER_ID_NOT_FOUND)))
      (blockStats (unwrap! (get-mining-stats-at-block minerBlockHeight) (err ERR_NO_MINERS_AT_BLOCK)))
      (minerStats (unwrap! (get-miner-at-block minerBlockHeight userId) (err ERR_USER_DID_NOT_MINE_IN_BLOCK)))
      (isMature (asserts! (> stacksHeight maturityHeight) (err ERR_CLAIMED_BEFORE_MATURITY)))
      (vrfSample (unwrap! (contract-call? 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.citycoin-vrf get-random-uint-at-block maturityHeight) (err ERR_NO_VRF_SEED_FOUND)))
      (commitTotal (get-last-high-value-at-block minerBlockHeight))
      (winningValue (mod vrfSample commitTotal))
    )
    (asserts! (not (get rewardClaimed blockStats)) (err ERR_REWARD_ALREADY_CLAIMED))
    (asserts! (and (>= winningValue (get lowValue minerStats)) (<= winningValue (get highValue minerStats)))
      (err ERR_MINER_DID_NOT_WIN))
    (try! (set-mining-reward-claimed userId minerBlockHeight))
    (ok true)
  )
)

(define-private (set-mining-reward-claimed (userId uint) (minerBlockHeight uint))
  (let
    (
      (blockStats (get-mining-stats-at-block-or-default minerBlockHeight))
      (minerStats (get-miner-at-block-or-default minerBlockHeight userId))
      (user (unwrap! (get-user userId) (err ERR_USER_NOT_FOUND)))
    )
    (map-set MiningStatsAtBlock
      minerBlockHeight
      {
        minersCount: (get minersCount blockStats),
        amount: (get amount blockStats),
        amountToCity: (get amountToCity blockStats),
        amountToStackers: (get amountToStackers blockStats),
        rewardClaimed: true
      }
    )
    (map-set MinersAtBlock
      {
        stacksHeight: minerBlockHeight,
        userId: userId
      }
      {
        ustx: (get ustx minerStats),
        lowValue: (get lowValue minerStats),
        highValue: (get highValue minerStats),
        winner: true
      }
    )
    (map-set BlockWinnerIds
      minerBlockHeight
      userId
    )
    (try! (mint-coinbase user minerBlockHeight))
    (ok true)
  )
)

(define-read-only (is-block-winner (user principal) (minerBlockHeight uint))
  (is-block-winner-and-can-claim user minerBlockHeight false)
)

(define-read-only (can-claim-mining-reward (user principal) (minerBlockHeight uint))
  (is-block-winner-and-can-claim user minerBlockHeight true)
)

(define-private (is-block-winner-and-can-claim (user principal) (minerBlockHeight uint) (testCanClaim bool))
  (let
    (
      (userId (unwrap! (get-user-id user) false))
      (blockStats (unwrap! (get-mining-stats-at-block minerBlockHeight) false))
      (minerStats (unwrap! (get-miner-at-block minerBlockHeight userId) false))
      (maturityHeight (+ (var-get tokenRewardMaturity) minerBlockHeight))
      (vrfSample (unwrap! (contract-call? 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.citycoin-vrf get-random-uint-at-block maturityHeight) false))
      (commitTotal (get-last-high-value-at-block minerBlockHeight))
      (winningValue (mod vrfSample commitTotal))
    )
    (if (and (>= winningValue (get lowValue minerStats)) (<= winningValue (get highValue minerStats)))
      (if testCanClaim (not (get rewardClaimed blockStats)) true)
      false
    )
  )
)

;; STACKING CONFIGURATION

(define-constant MAX_REWARD_CYCLES u32)
(define-constant REWARD_CYCLE_INDEXES (list u0 u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12 u13 u14 u15 u16 u17 u18 u19 u20 u21 u22 u23 u24 u25 u26 u27 u28 u29 u30 u31))

;; how long a reward cycle is
(define-data-var rewardCycleLength uint u2100)

;; At a given reward cycle:
;; - how many Stackers were there
;; - what is the total uSTX submitted by miners
;; - what is the total amount of tokens stacked
(define-map StackingStatsAtCycle
  uint
  {
    amountUstx: uint,
    amountToken: uint
  }
)

;; returns the total stacked tokens and committed uSTX for a given reward cycle
(define-read-only (get-stacking-stats-at-cycle (rewardCycle uint))
  (map-get? StackingStatsAtCycle rewardCycle)
)

;; returns the total stacked tokens and committed uSTX for a given reward cycle
;; or, an empty structure
(define-read-only (get-stacking-stats-at-cycle-or-default (rewardCycle uint))
  (default-to { amountUstx: u0, amountToken: u0 }
    (map-get? StackingStatsAtCycle rewardCycle))
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

(define-read-only (get-stacker-at-cycle (rewardCycle uint) (userId uint))
  (map-get? StackerAtCycle { rewardCycle: rewardCycle, userId: userId })
)

(define-read-only (get-stacker-at-cycle-or-default (rewardCycle uint) (userId uint))
  (default-to { amountStacked: u0, toReturn: u0 }
    (map-get? StackerAtCycle { rewardCycle: rewardCycle, userId: userId }))
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

;; get the first Stacks block height for a given reward cycle.
(define-read-only (get-first-stacks-block-in-reward-cycle (rewardCycle uint))
  (+ (var-get activationBlock) (* (var-get rewardCycleLength) rewardCycle))
)

;; getter for get-entitled-stacking-reward that specifies block height
(define-read-only (get-stacking-reward (userId uint) (targetCycle uint))
  (get-entitled-stacking-reward userId targetCycle block-height)
)

;; get uSTX a Stacker can claim, given reward cycle they stacked in and current block height
;; this method only returns a positive value if:
;; - the current block height is in a subsequent reward cycle
;; - the stacker actually locked up tokens in the target reward cycle
;; - the stacker locked up _enough_ tokens to get at least one uSTX
;; it is possible to Stack tokens and not receive uSTX:
;; - if no miners commit during this reward cycle
;; - the amount stacked by user is too few that you'd be entitled to less than 1 uSTX
(define-private (get-entitled-stacking-reward (userId uint) (targetCycle uint) (stacksHeight uint))
  (let
    (
      (rewardCycleStats (get-stacking-stats-at-cycle-or-default targetCycle))
      (stackerAtCycle (get-stacker-at-cycle-or-default targetCycle userId))
      (totalUstxThisCycle (get amountUstx rewardCycleStats))
      (totalStackedThisCycle (get amountToken rewardCycleStats))
      (userStackedThisCycle (get amountStacked stackerAtCycle))
    )
    (match (get-reward-cycle stacksHeight)
      currentCycle
      (if (or (<= currentCycle targetCycle) (is-eq u0 userStackedThisCycle))
        ;; this cycle hasn't finished, or Stacker contributed nothing
        u0
        ;; (totalUstxThisCycle * userStackedThisCycle) / totalStackedThisCycle
        (/ (* totalUstxThisCycle userStackedThisCycle) totalStackedThisCycle)
      )
      ;; before first reward cycle
      u0
    )
  )
)

;; STACKING ACTIONS

(define-public (stack-tokens (amountTokens uint) (lockPeriod uint))
  (let
    (
      (userId (get-or-create-user-id tx-sender))
    )
    (try! (stack-tokens-at-cycle tx-sender userId amountTokens block-height lockPeriod))
    (ok true)
  )
)

(define-private (stack-tokens-at-cycle (user principal) (userId uint) (amountTokens uint) (startHeight uint) (lockPeriod uint))
  (let
    (
      (currentCycle (unwrap! (get-reward-cycle startHeight) (err ERR_STACKING_NOT_AVAILABLE)))
      (targetCycle (+ u1 currentCycle))
      (commitment {
        stackerId: userId,
        amount: amountTokens,
        first: targetCycle,
        last: (+ targetCycle lockPeriod)
      })
    )
    (asserts! (get-activation-status) (err ERR_CONTRACT_NOT_ACTIVATED))
    (asserts! (and (> lockPeriod u0) (<= lockPeriod MAX_REWARD_CYCLES))
      (err ERR_CANNOT_STACK))
    (asserts! (> amountTokens u0) (err ERR_CANNOT_STACK))
    (try! (contract-call? 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-token transfer amountTokens tx-sender (as-contract tx-sender) none))
    (match (fold stack-tokens-closure REWARD_CYCLE_INDEXES (ok commitment))
      okValue (ok true)
      errValue (err errValue)
    )
  )
)

(define-private (stack-tokens-closure (rewardCycleIdx uint)
  (commitmentResponse (response 
    {
      stackerId: uint,
      amount: uint,
      first: uint,
      last: uint
    }
    uint
  )))

  (match commitmentResponse
    commitment 
    (let
      (
        (stackerId (get stackerId commitment))
        (amountToken (get amount commitment))
        (firstCycle (get first commitment))
        (lastCycle (get last commitment))
        (targetCycle (+ firstCycle rewardCycleIdx))
        (stackerAtCycle (get-stacker-at-cycle-or-default targetCycle stackerId))
        (amountStacked (get amountStacked stackerAtCycle))
        (toReturn (get toReturn stackerAtCycle))
      )
      (begin
        (if (and (>= targetCycle firstCycle) (< targetCycle lastCycle))
          (begin
            (if (is-eq targetCycle (- lastCycle u1))
              (set-tokens-stacked stackerId targetCycle amountToken amountToken)
              (set-tokens-stacked stackerId targetCycle amountToken u0)
            )
            true
          )
          false
        )
        commitmentResponse
      )
    )
    errValue commitmentResponse
  )
)

(define-private (set-tokens-stacked (userId uint) (targetCycle uint) (amountStacked uint) (toReturn uint))
  (let
    (
      (rewardCycleStats (get-stacking-stats-at-cycle-or-default targetCycle))
      (stackerAtCycle (get-stacker-at-cycle-or-default targetCycle userId))
    )
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
  )
)

;; STACKING REWARD CLAIMS

;; calls function to claim stacking reward in active logic contract
(define-public (claim-stacking-reward (targetCycle uint))
  (begin
    (try! (claim-stacking-reward-at-cycle tx-sender block-height targetCycle))
    (ok true)
  )
)

(define-private (claim-stacking-reward-at-cycle (user principal) (stacksHeight uint) (targetCycle uint))
  (let
    (
      (currentCycle (unwrap! (get-reward-cycle stacksHeight) (err ERR_STACKING_NOT_AVAILABLE)))
      (userId (unwrap! (get-user-id user) (err ERR_USER_ID_NOT_FOUND)))
      (entitledUstx (get-entitled-stacking-reward userId targetCycle stacksHeight))
      (stackerAtCycle (get-stacker-at-cycle-or-default targetCycle userId))
      (toReturn (get toReturn stackerAtCycle))
    )
    (asserts! (or
      (is-eq true (var-get isShutdown))
      (> currentCycle targetCycle))
      (err ERR_REWARD_CYCLE_NOT_COMPLETED))
    (asserts! (or (> toReturn u0) (> entitledUstx u0)) (err ERR_NOTHING_TO_REDEEM))
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
      (try! (as-contract (contract-call? 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-token transfer toReturn tx-sender user none)))
      true
    )
    ;; send back rewards if user was eligible
    (if (> entitledUstx u0)
      (try! (as-contract (stx-transfer? entitledUstx tx-sender user)))
      true
    )
    (ok true)
  )
)

;; TOKEN CONFIGURATION

;; store block height at each halving, set by register-user in core contract
(define-data-var coinbaseThreshold1 uint u0)
(define-data-var coinbaseThreshold2 uint u0)
(define-data-var coinbaseThreshold3 uint u0)
(define-data-var coinbaseThreshold4 uint u0)
(define-data-var coinbaseThreshold5 uint u0)

(define-private (set-coinbase-thresholds)
  (let
    (
      (coinbaseAmounts (try! (contract-call? 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-token get-coinbase-thresholds)))
    )
    (var-set coinbaseThreshold1 (get coinbaseThreshold1 coinbaseAmounts))
    (var-set coinbaseThreshold2 (get coinbaseThreshold2 coinbaseAmounts))
    (var-set coinbaseThreshold3 (get coinbaseThreshold3 coinbaseAmounts))
    (var-set coinbaseThreshold4 (get coinbaseThreshold4 coinbaseAmounts))
    (var-set coinbaseThreshold5 (get coinbaseThreshold5 coinbaseAmounts))
    (ok true)
  )
)

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
    ;; then mining continues indefinitely with 3,125 tokens as the reward
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
(define-private (mint-coinbase (recipient principal) (stacksHeight uint))
  (as-contract (contract-call? 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-token mint (get-coinbase-amount stacksHeight) recipient))
)

;; UTILITIES

(define-data-var shutdownHeight uint u0)
(define-data-var isShutdown bool false)

;; stop mining and stacking operations
;; in preparation for a core upgrade
(define-public (shutdown-contract (stacksHeight uint))
  (begin
    ;; make sure block height is in the future
    (asserts! (>= stacksHeight block-height) (err ERR_BLOCK_HEIGHT_IN_PAST))
    ;; only allow shutdown request from AUTH
    (asserts! (is-authorized-auth) (err ERR_UNAUTHORIZED))
    ;; set variables to disable mining/stacking in CORE
    (var-set activationReached false)
    (var-set shutdownHeight stacksHeight)
    ;; set variable to allow for all stacking claims
    (var-set isShutdown true)
    (ok true)
  )
)

;; check if contract caller is city wallet
(define-private (is-authorized-city)
  (is-eq contract-caller (var-get cityWallet))
)

;; check if contract caller is contract owner
(define-private (is-authorized-owner)
  (is-eq contract-caller CONTRACT_OWNER)
)

;; checks if caller is Auth contract
(define-private (is-authorized-auth)
  (is-eq contract-caller 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-auth)
)
