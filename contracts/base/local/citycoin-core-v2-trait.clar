;; CITYCOIN CORE TRAIT V2

(define-trait citycoin-core-v2
  (

    (register-user ((optional (string-utf8 50)))
      (response bool uint)
    )

    (mine-tokens (uint (optional (buff 34)))
      (response bool uint)
    )

    (mine-many ((list 200 uint))
      (response bool uint)
    )

    (claim-mining-reward (uint)
      (response bool uint)
    )

    (stack-tokens (uint uint)
      (response bool uint)
    )

    (claim-stacking-reward (uint)
      (response bool uint)
    )

    (set-city-wallet (principal)
      (response bool uint)
    )

    (update-coinbase-amounts ()
      (response bool uint)
    )

    (update-coinbase-thresholds ()
      (response bool uint)
    )
    
    (shutdown-contract (uint)
      (response bool uint)
    )

  )
)
