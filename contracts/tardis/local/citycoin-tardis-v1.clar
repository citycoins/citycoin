;; CityCoins Tardis v1
;; A way to view historical information about MIA/NYC
;; to work around the API not accepting tip parameters
;; for specific contract functions.

;; ERRORS

(define-constant ERR_INVALID_BLOCK (err u7000))
(define-constant ERR_CYCLE_NOT_FOUND (err u7001))
(define-constant ERR_USER_NOT_FOUND (err u7002))
(define-constant ERR_SUPPLY_NOT_FOUND (err u7003))
(define-constant ERR_BALANCE_NOT_FOUND (err u7004))

;; get block hash by height

(define-private (get-block-hash (blockHeight uint))
  (get-block-info? id-header-hash blockHeight)
)

;; get-balance MIA
;; Mainnet: SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-token

(define-read-only (get-historical-balance (blockHeight uint) (address principal))
  (let 
    (
      (blockHash (unwrap! (get-block-hash blockHeight) ERR_INVALID_BLOCK))
      (balance (unwrap! (at-block blockHash (contract-call? .citycoin-token get-balance address)) ERR_BALANCE_NOT_FOUND))
    )
    (ok balance)
  )
)

;; get-balance NYC
;; Mainnet: SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5.newyorkcitycoin-token

;; get-total-supply MIA
;; Mainnet: SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-token

(define-read-only (get-historical-supply (blockHeight uint))
  (let 
    (
      (blockHash (unwrap! (get-block-hash blockHeight) ERR_INVALID_BLOCK))
      (supply (unwrap! (at-block blockHash (contract-call? .citycoin-token get-total-supply)) ERR_SUPPLY_NOT_FOUND))
    )
    (ok supply)
  )
)

;; get-total-supply NYC
;; Mainnet: SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5.newyorkcitycoin-token

;; get-stacking-stats-at-cycle MIA
;; Mainnet: SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-core-v1

(define-read-only (get-historical-stacking-stats (blockHeight uint))
  (let 
    (
      (blockHash (unwrap! (get-block-hash blockHeight) ERR_INVALID_BLOCK))
      (cycleId (unwrap! (contract-call? .citycoin-core-v1 get-reward-cycle blockHeight) ERR_CYCLE_NOT_FOUND))
      (stats (unwrap! (at-block blockHash (contract-call? .citycoin-core-v1 get-stacking-stats-at-cycle cycleId)) ERR_CYCLE_NOT_FOUND))
    )
    (ok stats)
  )
)

;; get-stacking-stats-at-cycle NYC
;; Mainnet: SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5.newyorkcitycoin-core-v1

;; get-stacker-at-cycle MIA
;; Mainnet: SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-core-v1

(define-read-only (get-historical-stacker-stats (blockHeight uint) (address principal))
  (let 
    (
      (blockHash (unwrap! (get-block-hash blockHeight) ERR_INVALID_BLOCK))
      (userId (unwrap! (contract-call? .citycoin-core-v1 get-user-id address) ERR_USER_NOT_FOUND))
      (cycleId (unwrap! (contract-call? .citycoin-core-v1 get-reward-cycle blockHeight) ERR_CYCLE_NOT_FOUND))
      (stacker (unwrap! (at-block blockHash (contract-call? .citycoin-core-v1 get-stacker-at-cycle cycleId userId)) ERR_CYCLE_NOT_FOUND))
    )
    (ok stacker)
  )
)

;; get-stacker-at-cycle NYC
;; Mainnet: SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5.newyorkcitycoin-core-v1

