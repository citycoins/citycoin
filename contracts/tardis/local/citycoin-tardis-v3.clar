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

;; get-balance
(define-read-only (get-balance (blockHeight uint) (address principal))
  (let
    (
      (blockHash (unwrap! (get-block-hash blockHeight) ERR_INVALID_BLOCK))
      (balance (unwrap! (at-block blockHash (contract-call? .citycoin-token get-balance address)) ERR_BALANCE_NOT_FOUND))
    )
    (ok balance)
  )
)

;; get-total-supply
(define-read-only (get-supply (blockHeight uint))
  (let
    (
      (blockHash (unwrap! (get-block-hash blockHeight) ERR_INVALID_BLOCK))
      (supply (unwrap! (at-block blockHash (contract-call? .citycoin-token get-total-supply)) ERR_SUPPLY_NOT_FOUND))
    )
    (ok supply)
  )
)

;; get-stacking-stats-at-cycle-or-default
(define-read-only (get-stacking-stats (blockHeight uint))
  (let 
    (
      (blockHash (unwrap! (get-block-hash blockHeight) none))
      (cycleId (unwrap! (contract-call? .citycoin-core-v1 get-reward-cycle blockHeight) none))
      (stats (at-block blockHash (contract-call? .citycoin-core-v1 get-stacking-stats-at-cycle-or-default cycleId)))
    )
    (some stats)
  )
)

;; get-stacker-at-cycle-or-default
(define-read-only (get-stacker-stats (blockHeight uint) (address principal))
  (let
    (
      (blockHash (unwrap! (get-block-hash blockHeight) none))
      (userId (default-to u0 (contract-call? .citycoin-core-v1 get-user-id address)))
      (cycleId (unwrap! (contract-call? .citycoin-core-v1 get-reward-cycle blockHeight) none))
      (stacker (at-block blockHash (contract-call? .citycoin-core-v1 get-stacker-at-cycle-or-default cycleId userId)))
    )
    (some stacker)
  )
)
