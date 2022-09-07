;; CityCoins Tardis v2
;; A way to view historical information about MIA/NYC
;; to work around the API not accepting tip parameters
;; for specific contract functions.
;;
;; This version includes functions to return the default
;; values if not found instead of generating an error.

;; ERRORS

(define-constant ERR_INVALID_BLOCK u7000)
(define-constant ERR_CYCLE_NOT_FOUND u7001)
(define-constant ERR_USER_NOT_FOUND u7002)
(define-constant ERR_SUPPLY_NOT_FOUND u7003)
(define-constant ERR_BALANCE_NOT_FOUND u7004)

;; get block hash by height

(define-private (get-block-hash (blockHeight uint))
  (get-block-info? id-header-hash blockHeight)
)

;; get-balance MIA
(define-read-only (get-historical-balance-mia (blockHeight uint) (address principal))
  (let
    (
      (blockHash (unwrap! (get-block-hash blockHeight) (err ERR_INVALID_BLOCK)))
      (balance (unwrap! (at-block blockHash (contract-call? 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-token get-balance address)) (err ERR_BALANCE_NOT_FOUND)))
    )
    (ok balance)
  )
)

;; get-balance NYC
(define-read-only (get-historical-balance-nyc (blockHeight uint) (address principal))
  (let
    (
      (blockHash (unwrap! (get-block-hash blockHeight) (err ERR_INVALID_BLOCK)))
      (balance (unwrap! (at-block blockHash (contract-call? 'SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5.newyorkcitycoin-token get-balance address)) (err ERR_BALANCE_NOT_FOUND)))
    )
    (ok balance)
  )
)

;; get-total-supply MIA
(define-read-only (get-historical-supply-mia (blockHeight uint))
  (let
    (
      (blockHash (unwrap! (get-block-hash blockHeight) (err ERR_INVALID_BLOCK)))
      (supply (unwrap! (at-block blockHash (contract-call? 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-token get-total-supply)) (err ERR_SUPPLY_NOT_FOUND)))
    )
    (ok supply)
  )
)

;; get-total-supply NYC
(define-read-only (get-historical-supply-nyc (blockHeight uint))
  (let
    (
      (blockHash (unwrap! (get-block-hash blockHeight) (err ERR_INVALID_BLOCK)))
      (supply (unwrap! (at-block blockHash (contract-call? 'SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5.newyorkcitycoin-token get-total-supply)) (err ERR_SUPPLY_NOT_FOUND)))
    )
    (ok supply)
  )
)

;; get-stacking-stats-at-cycle MIA
(define-read-only (get-historical-stacking-stats-mia (blockHeight uint))
  (let
    (
      (blockHash (unwrap! (get-block-hash blockHeight) (err ERR_INVALID_BLOCK)))
      (cycleId (unwrap! (contract-call? 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-core-v1 get-reward-cycle blockHeight) (err ERR_CYCLE_NOT_FOUND)))
      (stats (unwrap! (at-block blockHash (contract-call? 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-core-v1 get-stacking-stats-at-cycle cycleId)) (err ERR_CYCLE_NOT_FOUND)))
    )
    (ok stats)
  )
)

;; get-stacking-stats-at-cycle-or-default MIA
(define-read-only (get-historical-stacking-stats-or-default-mia (blockHeight uint))
  (let 
    (
      (blockHash (unwrap! (get-block-hash blockHeight) none))
      (cycleId (unwrap! (contract-call? 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-core-v1 get-reward-cycle blockHeight) none))
      (stats (at-block blockHash (contract-call? 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-core-v1 get-stacking-stats-at-cycle-or-default cycleId)))
    )
    (some stats)
  )
)

;; get-stacking-stats-at-cycle NYC
(define-read-only (get-historical-stacking-stats-nyc (blockHeight uint))
  (let
    (
      (blockHash (unwrap! (get-block-hash blockHeight) (err ERR_INVALID_BLOCK)))
      (cycleId (unwrap! (contract-call? 'SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5.newyorkcitycoin-core-v1 get-reward-cycle blockHeight) (err ERR_CYCLE_NOT_FOUND)))
      (stats (unwrap! (at-block blockHash (contract-call? 'SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5.newyorkcitycoin-core-v1 get-stacking-stats-at-cycle cycleId)) (err ERR_CYCLE_NOT_FOUND)))
    )
    (ok stats)
  )
)

;; get-stacking-stats-at-cycle-or-default NYC
(define-read-only (get-historical-stacking-stats-or-default-nyc (blockHeight uint))
  (let 
    (
      (blockHash (unwrap! (get-block-hash blockHeight) none))
      (cycleId (unwrap! (contract-call? 'SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5.newyorkcitycoin-core-v1 get-reward-cycle blockHeight) none))
      (stats (at-block blockHash (contract-call? 'SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5.newyorkcitycoin-core-v1 get-stacking-stats-at-cycle-or-default cycleId)))
    )
    (some stats)
  )
)

;; get-stacker-at-cycle MIA
(define-read-only (get-historical-stacker-stats-mia (blockHeight uint) (address principal))
  (let
    (
      (blockHash (unwrap! (get-block-hash blockHeight) (err ERR_INVALID_BLOCK)))
      (userId (unwrap! (contract-call? 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-core-v1 get-user-id address) (err ERR_USER_NOT_FOUND)))
      (cycleId (unwrap! (contract-call? 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-core-v1 get-reward-cycle blockHeight) (err ERR_CYCLE_NOT_FOUND)))
      (stacker (unwrap! (at-block blockHash (contract-call? 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-core-v1 get-stacker-at-cycle cycleId userId)) (err ERR_CYCLE_NOT_FOUND)))
    )
    (ok stacker)
  )
)

;; get-stacker-at-cycle-or-default MIA
(define-read-only (get-historical-stacker-stats-or-default-mia (blockHeight uint) (address principal))
  (let
    (
      (blockHash (unwrap! (get-block-hash blockHeight) none))
      (userId (default-to u0 (contract-call? 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-core-v1 get-user-id address)))
      (cycleId (unwrap! (contract-call? 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-core-v1 get-reward-cycle blockHeight) none))
      (stacker (at-block blockHash (contract-call? 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-core-v1 get-stacker-at-cycle-or-default cycleId userId)))
    )
    (some stacker)
  )
)

;; get-stacker-at-cycle NYC
(define-read-only (get-historical-stacker-stats-nyc (blockHeight uint) (address principal))
  (let
    (
      (blockHash (unwrap! (get-block-hash blockHeight) (err ERR_INVALID_BLOCK)))
      (userId (unwrap! (contract-call? 'SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5.newyorkcitycoin-core-v1 get-user-id address) (err ERR_USER_NOT_FOUND)))
      (cycleId (unwrap! (contract-call? 'SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5.newyorkcitycoin-core-v1 get-reward-cycle blockHeight) (err ERR_CYCLE_NOT_FOUND)))
      (stacker (unwrap! (at-block blockHash (contract-call? 'SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5.newyorkcitycoin-core-v1 get-stacker-at-cycle cycleId userId)) (err ERR_CYCLE_NOT_FOUND)))
    )
    (ok stacker)
  )
)

;; get-stacker-at-cycle-or-default NYC
(define-read-only (get-historical-stacker-stats-or-default-nyc (blockHeight uint) (address principal))
  (let 
    (
      (blockHash (unwrap! (get-block-hash blockHeight) none))
      (userId (default-to u0 (contract-call? 'SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5.newyorkcitycoin-core-v1 get-user-id address)))
      (cycleId (unwrap! (contract-call? 'SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5.newyorkcitycoin-core-v1 get-reward-cycle blockHeight) none))
      (stacker (at-block blockHash (contract-call? 'SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5.newyorkcitycoin-core-v1 get-stacker-at-cycle-or-default cycleId userId)))
    )
    (some stacker)
  )
)
