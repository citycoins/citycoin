;; NEWYORKCITYCOIN TOKEN V2 CONTRACT
;; CityCoins Protocol Version 2.0.0

;; TRAIT DEFINITIONS

(impl-trait 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.citycoin-token-trait.citycoin-token)
(impl-trait 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.citycoin-token-v2-trait.citycoin-token-v2)
(use-trait coreTrait 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.citycoin-core-trait.citycoin-core)

;; ERROR CODES

(define-constant ERR_UNAUTHORIZED (err u2000))
(define-constant ERR_TOKEN_NOT_ACTIVATED (err u2001))
(define-constant ERR_TOKEN_ALREADY_ACTIVATED (err u2002))
(define-constant ERR_V1_BALANCE_NOT_FOUND (err u2003))
(define-constant ERR_INVALID_COINBASE_THRESHOLD (err u2004))
(define-constant ERR_INVALID_COINBASE_AMOUNT (err u2005))

;; SIP-010 DEFINITION

(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

(define-fungible-token newyorkcitycoin)

(define-constant DECIMALS u6)
(define-constant MICRO_CITYCOINS (pow u10 DECIMALS))

;; SIP-010 FUNCTIONS

(define-public (transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq from tx-sender) ERR_UNAUTHORIZED)
    (if (is-some memo)
      (print memo)
      none
    )
    (ft-transfer? newyorkcitycoin amount from to)
  )
)

(define-read-only (get-name)
  (ok "newyorkcitycoin")
)

(define-read-only (get-symbol)
  (ok "NYC")
)

(define-read-only (get-decimals)
  (ok DECIMALS)
)

(define-read-only (get-balance (user principal))
  (ok (ft-get-balance newyorkcitycoin user))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply newyorkcitycoin))
)

(define-read-only (get-token-uri)
  (ok (var-get tokenUri))
)

;; TOKEN CONFIGURATION

;; define bonus period and initial epoch length
(define-constant TOKEN_BONUS_PERIOD u10000)
(define-constant TOKEN_EPOCH_LENGTH u25000)

;; once activated, activation cannot happen again
(define-data-var tokenActivated bool false)

;; core contract states
(define-constant STATE_DEPLOYED u0)
(define-constant STATE_ACTIVE u1)
(define-constant STATE_INACTIVE u2)

;; one-time function to activate the token
(define-public (activate-token (coreContract principal) (stacksHeight uint))
  (let
    (
      (coreContractMap (try! (contract-call? 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-auth-v2 get-core-contract-info coreContract)))
      (threshold1 (+ stacksHeight TOKEN_BONUS_PERIOD TOKEN_EPOCH_LENGTH))         ;; 35,000 blocks
      (threshold2 (+ stacksHeight TOKEN_BONUS_PERIOD (* u3 TOKEN_EPOCH_LENGTH)))  ;; 85,000 blocks
      (threshold3 (+ stacksHeight TOKEN_BONUS_PERIOD (* u7 TOKEN_EPOCH_LENGTH)))  ;; 185,000 blocks
      (threshold4 (+ stacksHeight TOKEN_BONUS_PERIOD (* u15 TOKEN_EPOCH_LENGTH))) ;; 385,000 blocks
      (threshold5 (+ stacksHeight TOKEN_BONUS_PERIOD (* u31 TOKEN_EPOCH_LENGTH))) ;; 785,000 blocks
    )
    (asserts! (is-eq (get state coreContractMap) STATE_ACTIVE) ERR_UNAUTHORIZED)
    (asserts! (not (var-get tokenActivated)) ERR_TOKEN_ALREADY_ACTIVATED)
    (var-set tokenActivated true)
    (try! (set-coinbase-thresholds threshold1 threshold2 threshold3 threshold4 threshold5))
    (ok true)
  )
)

;; COINBASE THRESHOLDS

;; coinbase thresholds per halving, used to select coinbase rewards in core
;; initially set by register-user in core contract per CCIP-008
(define-data-var coinbaseThreshold1 uint u0)
(define-data-var coinbaseThreshold2 uint u0)
(define-data-var coinbaseThreshold3 uint u0)
(define-data-var coinbaseThreshold4 uint u0)
(define-data-var coinbaseThreshold5 uint u0)

;; return coinbase thresholds if token activated
(define-read-only (get-coinbase-thresholds)
  (let
    (
      (activated (var-get tokenActivated))
    )
    (asserts! activated ERR_TOKEN_NOT_ACTIVATED)
    (ok {
      coinbaseThreshold1: (var-get coinbaseThreshold1),
      coinbaseThreshold2: (var-get coinbaseThreshold2),
      coinbaseThreshold3: (var-get coinbaseThreshold3),
      coinbaseThreshold4: (var-get coinbaseThreshold4),
      coinbaseThreshold5: (var-get coinbaseThreshold5)
    })
  )
)

(define-private (set-coinbase-thresholds (threshold1 uint) (threshold2 uint) (threshold3 uint) (threshold4 uint) (threshold5 uint))
  (begin
    ;; check that all thresholds increase in value
    (asserts! (and (> threshold1 u0) (> threshold2 threshold1) (> threshold3 threshold2) (> threshold4 threshold3) (> threshold5 threshold4)) ERR_INVALID_COINBASE_THRESHOLD)
    ;; set coinbase thresholds
    (var-set coinbaseThreshold1 threshold1)
    (var-set coinbaseThreshold2 threshold2)
    (var-set coinbaseThreshold3 threshold3)
    (var-set coinbaseThreshold4 threshold4)
    (var-set coinbaseThreshold5 threshold5)
    ;; print coinbase thresholds
    (print {
      coinbaseThreshold1: threshold1,
      coinbaseThreshold2: threshold2,
      coinbaseThreshold3: threshold3,
      coinbaseThreshold4: threshold4,
      coinbaseThreshold5: threshold5
    })
    (ok true)
  )
)

;; only accessible by auth
(define-public (update-coinbase-thresholds (threshold1 uint) (threshold2 uint) (threshold3 uint) (threshold4 uint) (threshold5 uint))
  (begin
    (asserts! (is-authorized-auth) ERR_UNAUTHORIZED)
    (asserts! (var-get tokenActivated) ERR_TOKEN_NOT_ACTIVATED)
    (try! (set-coinbase-thresholds threshold1 threshold2 threshold3 threshold4 threshold5))
    (ok true)
  )
)

;; COINBASE AMOUNTS (REWARDS)

;; coinbase rewards per threshold per CCIP-008
(define-data-var coinbaseAmountBonus uint (* MICRO_CITYCOINS u250000))
(define-data-var coinbaseAmount1 uint (* MICRO_CITYCOINS u100000))
(define-data-var coinbaseAmount2 uint (* MICRO_CITYCOINS u50000))
(define-data-var coinbaseAmount3 uint (* MICRO_CITYCOINS u25000))
(define-data-var coinbaseAmount4 uint (* MICRO_CITYCOINS u12500))
(define-data-var coinbaseAmount5 uint (* MICRO_CITYCOINS u6250))
(define-data-var coinbaseAmountDefault uint (* MICRO_CITYCOINS u3125))

;; return coinbase thresholds if token activated
(define-read-only (get-coinbase-amounts)
  (ok {
    coinbaseAmountBonus: (var-get coinbaseAmountBonus),
    coinbaseAmount1: (var-get coinbaseAmount1),
    coinbaseAmount2: (var-get coinbaseAmount2),
    coinbaseAmount3: (var-get coinbaseAmount3),
    coinbaseAmount4: (var-get coinbaseAmount4),
    coinbaseAmount5: (var-get coinbaseAmount5),
    coinbaseAmountDefault: (var-get coinbaseAmountDefault)
  })
)

(define-private (set-coinbase-amounts (amountBonus uint) (amount1 uint) (amount2 uint) (amount3 uint) (amount4 uint) (amount5 uint) (amountDefault uint))
  (begin
    ;; check that all amounts are greater than zero
    (asserts! (and (> amountBonus u0) (> amount1 u0) (> amount2 u0) (> amount3 u0) (> amount4 u0) (> amount5 u0) (> amountDefault u0)) ERR_INVALID_COINBASE_AMOUNT)
    ;; set coinbase amounts in token contract
    (var-set coinbaseAmountBonus amountBonus)
    (var-set coinbaseAmount1 amount1)
    (var-set coinbaseAmount2 amount2)
    (var-set coinbaseAmount3 amount3)
    (var-set coinbaseAmount4 amount4)
    (var-set coinbaseAmount5 amount5)
    (var-set coinbaseAmountDefault amountDefault)
    ;; print coinbase amounts
    (print {
      coinbaseAmountBonus: amountBonus,
      coinbaseAmount1: amount1,
      coinbaseAmount2: amount2,
      coinbaseAmount3: amount3,
      coinbaseAmount4: amount4,
      coinbaseAmount5: amount5,
      coinbaseAmountDefault: amountDefault
    })
    (ok true)
  )
)

;; only accessible by auth
(define-public (update-coinbase-amounts (amountBonus uint) (amount1 uint) (amount2 uint) (amount3 uint) (amount4 uint) (amount5 uint) (amountDefault uint))
  (begin
    (asserts! (is-authorized-auth) ERR_UNAUTHORIZED)
    ;; (asserts! (var-get tokenActivated) ERR_TOKEN_NOT_ACTIVATED)
    (try! (set-coinbase-amounts amountBonus amount1 amount2 amount3 amount4 amount5 amountDefault))
    (ok true)
  )
)

;; V1 TO V2 CONVERSION

(define-public (convert-to-v2)
  (let
    (
      (balanceV1 (unwrap! (contract-call? 'SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5.newyorkcitycoin-token get-balance tx-sender) ERR_V1_BALANCE_NOT_FOUND))
    )
    ;; verify positive balance
    (asserts! (> balanceV1 u0) ERR_V1_BALANCE_NOT_FOUND)
    ;; burn old
    (try! (contract-call? 'SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5.newyorkcitycoin-token burn balanceV1 tx-sender))
    (print {
      burnedV1: balanceV1,
      mintedV2: (* balanceV1 MICRO_CITYCOINS),
      tx-sender: tx-sender,
      contract-caller: contract-caller
    })
    ;; create new
    (ft-mint? newyorkcitycoin (* balanceV1 MICRO_CITYCOINS) tx-sender)
  )
)

;; UTILITIES

(define-data-var tokenUri (optional (string-utf8 256)) (some u"https://cdn.citycoins.co/metadata/newyorkcitycoin.json"))

;; set token URI to new value, only accessible by Auth
(define-public (set-token-uri (newUri (optional (string-utf8 256))))
  (begin
    (asserts! (is-authorized-auth) ERR_UNAUTHORIZED)
    (ok (var-set tokenUri newUri))
  )
)

;; mint new tokens, only accessible by a Core contract
(define-public (mint (amount uint) (recipient principal))
  (let
    (
      (coreContract (try! (contract-call? 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-auth-v2 get-core-contract-info contract-caller)))
    )
    (ft-mint? newyorkcitycoin amount recipient)
  )
)

;; burn tokens
(define-public (burn (amount uint) (owner principal))
  (begin
    (asserts! (is-eq tx-sender owner) ERR_UNAUTHORIZED)
    (ft-burn? newyorkcitycoin amount owner)
  )
)

;; checks if caller is Auth contract
(define-private (is-authorized-auth)
  (is-eq contract-caller 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-auth-v2)
)

;; SEND-MANY

(define-public (send-many (recipients (list 200 { to: principal, amount: uint, memo: (optional (buff 34)) })))
  (fold check-err
    (map send-token recipients)
    (ok true)
  )
)

(define-private (check-err (result (response bool uint)) (prior (response bool uint)))
  (match prior ok-value
    result
    err-value (err err-value)
  )
)

(define-private (send-token (recipient { to: principal, amount: uint, memo: (optional (buff 34)) }))
  (send-token-with-memo (get amount recipient) (get to recipient) (get memo recipient))
)

(define-private (send-token-with-memo (amount uint) (to principal) (memo (optional (buff 34))))
  (let
    (
      (transferOk (try! (transfer amount tx-sender to memo)))
    )
    (ok transferOk)
  )
)
