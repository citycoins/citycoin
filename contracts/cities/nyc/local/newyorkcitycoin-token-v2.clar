;; NEWYORKCITYCOIN TOKEN V2 CONTRACT
;; CityCoins Protocol Version 2.0.0

;; TRAIT DEFINITIONS

(impl-trait .citycoin-token-trait.citycoin-token)
(use-trait coreTrait .citycoin-core-trait.citycoin-core)

;; ERROR CODES

(define-constant ERR_UNAUTHORIZED (err u2000))
(define-constant ERR_TOKEN_NOT_ACTIVATED (err u2001))
(define-constant ERR_TOKEN_ALREADY_ACTIVATED (err u2002))
(define-constant ERR_V1_BALANCE_NOT_FOUND (err u2003))

;; SIP-010 DEFINITION

(impl-trait .sip-010-trait-ft-standard.sip-010-trait)
;; MAINNET
;; (impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

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

;; store block height at each halving, set by register-user in core contract 
(define-data-var coinbaseThreshold1 uint u0)
(define-data-var coinbaseThreshold2 uint u0)
(define-data-var coinbaseThreshold3 uint u0)
(define-data-var coinbaseThreshold4 uint u0)
(define-data-var coinbaseThreshold5 uint u0)

;; once activated, thresholds cannot be updated again
(define-data-var tokenActivated bool false)

;; core contract states
(define-constant STATE_DEPLOYED u0)
(define-constant STATE_ACTIVE u1)
(define-constant STATE_INACTIVE u2)

;; one-time function to activate the token
(define-public (activate-token (coreContract principal) (stacksHeight uint))
  (let
    (
      (coreContractMap (try! (contract-call? .newyorkcitycoin-auth get-core-contract-info coreContract)))
    )
    (asserts! (is-eq (get state coreContractMap) STATE_ACTIVE) ERR_UNAUTHORIZED)
    (asserts! (not (var-get tokenActivated)) ERR_TOKEN_ALREADY_ACTIVATED)
    (var-set tokenActivated true)
    (var-set coinbaseThreshold1 (+ stacksHeight TOKEN_BONUS_PERIOD TOKEN_EPOCH_LENGTH))        ;; 35,000 blocks
    (var-set coinbaseThreshold2 (+ stacksHeight TOKEN_BONUS_PERIOD (* u2 TOKEN_EPOCH_LENGTH))) ;; 85,000 blocks
    (var-set coinbaseThreshold3 (+ stacksHeight TOKEN_BONUS_PERIOD (* u3 TOKEN_EPOCH_LENGTH))) ;; 185,000 blocks
    (var-set coinbaseThreshold4 (+ stacksHeight TOKEN_BONUS_PERIOD (* u4 TOKEN_EPOCH_LENGTH))) ;; 385,000 blocks
    (var-set coinbaseThreshold5 (+ stacksHeight TOKEN_BONUS_PERIOD (* u5 TOKEN_EPOCH_LENGTH))) ;; 785,000 blocks
    (ok true)
  )
)

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

;; CONVERSION

(define-public (convert-to-v2)
  (let
    (
      (balanceV1 (unwrap! (contract-call? .newyorkcitycoin-token get-balance tx-sender) ERR_V1_BALANCE_NOT_FOUND))
    )
    ;; verify positive balance
    (asserts! (> balanceV1 u0) ERR_V1_BALANCE_NOT_FOUND)
    ;; burn old
    (try! (contract-call? .newyorkcitycoin-token burn balanceV1 tx-sender))
    (print {
      balanceV1: balanceV1,
      balanceV2: (* balanceV1 MICRO_CITYCOINS),
      tx-sender: tx-sender
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
      (coreContract (try! (contract-call? .newyorkcitycoin-auth get-core-contract-info contract-caller)))
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
  (is-eq contract-caller .newyorkcitycoin-auth)
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

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; TESTING FUNCTIONS
;; DELETE BEFORE DEPLOYING TO MAINNET
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant DEPLOYED_AT block-height)

(define-private (is-test-env)
  (is-eq DEPLOYED_AT u0)
)

(define-public (test-mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-test-env) ERR_UNAUTHORIZED)
    (ft-mint? newyorkcitycoin amount recipient)
  )
)
