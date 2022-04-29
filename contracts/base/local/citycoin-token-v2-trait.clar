;; CITYCOIN TOKEN TRAIT

(define-trait citycoin-token-v2
  (

    (activate-token (principal uint)
      (response bool uint)
    )

    (set-token-uri ((optional (string-utf8 256)))
      (response bool uint)
    )

    (mint (uint principal)
      (response bool uint)
    )

    (burn (uint principal)
      (response bool uint)
    )

    (send-many ((list 200 { to: principal, amount: uint, memo: (optional (buff 34)) }))
      (response bool uint)
    )

    (update-coinbase-thresholds (uint uint uint uint uint)
      (response bool uint)
    )

    (update-coinbase-amounts (uint uint uint uint uint uint uint)
      (response bool uint)
    )

  )
)
