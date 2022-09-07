;; CityCoins Tardis v3
;; A way to view historical information about MIA/NYC
;; to work around the API not accepting tip parameters
;; for specific contract functions.
;;
;; This version simplifies the contract and points to
;; CityCoins V2 contract addresses.

;; ERRORS

(define-constant ERR_INVALID_BLOCK (err u7000))
(define-constant ERR_SUPPLY_NOT_FOUND (err u7003))
(define-constant ERR_BALANCE_NOT_FOUND (err u7004))

;; get block hash by height

(define-private (get-block-hash (blockHeight uint))
  (get-block-info? id-header-hash blockHeight)
)

;; get-balance MIA
(define-read-only (get-balance-mia (blockHeight uint) (address principal))
  (let
    (
      (blockHash (unwrap! (get-block-hash blockHeight) ERR_INVALID_BLOCK))
      (balance (unwrap! (at-block blockHash (contract-call? 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2 get-balance address)) ERR_BALANCE_NOT_FOUND))
    )
    (ok balance)
  )
)

;; get-balance NYC
(define-read-only (get-balance-nyc (blockHeight uint) (address principal))
  (let
    (
      (blockHash (unwrap! (get-block-hash blockHeight) ERR_INVALID_BLOCK))
      (balance (unwrap! (at-block blockHash (contract-call? 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2 get-balance address)) ERR_BALANCE_NOT_FOUND))
    )
    (ok balance)
  )
)

;; get-total-supply MIA
(define-read-only (get-supply-mia (blockHeight uint))
  (let
    (
      (blockHash (unwrap! (get-block-hash blockHeight) ERR_INVALID_BLOCK))
      (supply (unwrap! (at-block blockHash (contract-call? 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2 get-total-supply)) ERR_SUPPLY_NOT_FOUND))
    )
    (ok supply)
  )
)

;; get-total-supply NYC
(define-read-only (get-supply-nyc (blockHeight uint))
  (let
    (
      (blockHash (unwrap! (get-block-hash blockHeight) ERR_INVALID_BLOCK))
      (supply (unwrap! (at-block blockHash (contract-call? 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2 get-total-supply)) ERR_SUPPLY_NOT_FOUND))
    )
    (ok supply)
  )
)

;; get-stacking-stats-at-cycle-or-default MIA
(define-read-only (get-stacking-stats-mia (blockHeight uint))
  (let 
    (
      (blockHash (unwrap! (get-block-hash blockHeight) none))
      (cycleId (unwrap! (contract-call? 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-core-v2 get-reward-cycle blockHeight) none))
      (stats (at-block blockHash (contract-call? 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-core-v2 get-stacking-stats-at-cycle-or-default cycleId)))
    )
    (some stats)
  )
)

;; get-stacking-stats-at-cycle-or-default NYC
(define-read-only (get-stacking-stats-nyc (blockHeight uint))
  (let 
    (
      (blockHash (unwrap! (get-block-hash blockHeight) none))
      (cycleId (unwrap! (contract-call? 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-core-v2 get-reward-cycle blockHeight) none))
      (stats (at-block blockHash (contract-call? 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-core-v2 get-stacking-stats-at-cycle-or-default cycleId)))
    )
    (some stats)
  )
)

;; get-stacker-at-cycle-or-default MIA
(define-read-only (get-stacker-stats-mia (blockHeight uint) (address principal))
  (let
    (
      (blockHash (unwrap! (get-block-hash blockHeight) none))
      (userId (default-to u0 (contract-call? 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-core-v2 get-user-id address)))
      (cycleId (unwrap! (contract-call? 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-core-v2 get-reward-cycle blockHeight) none))
      (stacker (at-block blockHash (contract-call? 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-core-v2 get-stacker-at-cycle-or-default cycleId userId)))
    )
    (some stacker)
  )
)

;; get-stacker-at-cycle-or-defualt NYC
(define-read-only (get-stacker-stats-nyc (blockHeight uint) (address principal))
  (let 
    (
      (blockHash (unwrap! (get-block-hash blockHeight) none))
      (userId (default-to u0 (contract-call? 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-core-v2 get-user-id address)))
      (cycleId (unwrap! (contract-call? 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-core-v2 get-reward-cycle blockHeight) none))
      (stacker (at-block blockHash (contract-call? 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-core-v2 get-stacker-at-cycle-or-default cycleId userId)))
    )
    (some stacker)
  )
)
