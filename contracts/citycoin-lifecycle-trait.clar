;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; CITYCOIN LIFECYCLE TRAIT
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; TRAIT DEFINITION
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-trait lifecycle (

  ;; triggers startup procedure immediately or at block height in future
  (startup ((optional uint))
    (response bool uint)
  )
  
  ;; triggers shutdown procedure immediately or at block height in future
  (shutdown ((optional uint))
    (response bool uint)
  )

  ;; returns contract information
  (get-contract-info ()
    (response 
      {
          version: (string-ascii 12),
          startupHeight: (optional uint),
          shutdownHeight: (optional uint),
          state: uint
      }
      uint    
    )
  )

  (get-contract-state ()
    (response uint uint)
  )

  (is-idle ()
    (response bool uint)
  )

  (is-starting-up ()
    (response bool uint)
  )

  (is-running ()
    (response bool uint)
  )

  (is-shuting-down ()
    (response bool uint)
  )

  (is-shut-down ()
    (response bool uint)
  )
))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; UTILITIES
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant STATE_IDLE u0)
(define-constant STATE_STARTUP u1)
(define-constant STATE_ACTIVE u2)
(define-constant STATE_SHUTDOWN u3)
(define-constant STATE_INACTIVE u4)

(define-read-only (contract-state (startupHeight (optional uint)) (shutdownHeight (optional uint)))
  (match startupHeight start
    (match shutdownHeight end
      (if (>= block-height end) STATE_INACTIVE STATE_SHUTDOWN)
      (if (>= block-height start) STATE_ACTIVE STATE_STARTUP)
    )
    STATE_IDLE
  )
)

(define-read-only (is-in-state (state uint) (allowedStates (list 4 uint)))
  (get is (fold is-in-state-closure allowedStates { state: state, is: false }))
)

(define-private (is-in-state-closure (allowedState uint) (data {state: uint, is: bool}))
  (if (get is data)
    data
    (if (is-eq allowedState (get state data))
      (merge data { is: true })
      data
    )
  )
)
