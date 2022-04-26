;; CITYCOIN VRF CONTRACT V2
;; CityCoins Protocol Version 2.0.0

;; ERROR CODES

(define-constant ERR_FAIL (err u3000))

;; CONFIGURATION

(define-map RandomUintAtBlock uint uint)

;; PUBLIC FUNCTIONS

;; returns the saved random integer
;; or, calculates and saves it to the map
;; #[allow(unchecked_data)]
(define-public (get-save-rnd (block uint))
  (match (map-get? RandomUintAtBlock block)
    rnd (ok rnd)
    (match (read-rnd block)
      rnd (begin (map-set RandomUintAtBlock block rnd) (ok rnd))
      err-val (err err-val)
    ) 
  )
)

;; returns the saved random integer
;; or, calculates and returns the value
(define-read-only (get-rnd (block uint))
  (match (map-get? RandomUintAtBlock block)
    rnd (ok rnd)
    (read-rnd block)
  )
)

;; PRIVATE FUNCTIONS

(define-private (read-rnd (block uint))
  (ok (lower-16-le (unwrap! (get-block-info? vrf-seed block) ERR_FAIL)))
)

(define-private (lower-16-le (vrfSeed (buff 32)))
  (+
    (lower-16-le-inner (element-at vrfSeed u16) u15)
    (lower-16-le-inner (element-at vrfSeed u17) u14)
    (lower-16-le-inner (element-at vrfSeed u18) u13)
    (lower-16-le-inner (element-at vrfSeed u19) u12)
    (lower-16-le-inner (element-at vrfSeed u20) u11)
    (lower-16-le-inner (element-at vrfSeed u21) u10)
    (lower-16-le-inner (element-at vrfSeed u22) u9)
    (lower-16-le-inner (element-at vrfSeed u23) u8)
    (lower-16-le-inner (element-at vrfSeed u24) u7)
    (lower-16-le-inner (element-at vrfSeed u25) u6)
    (lower-16-le-inner (element-at vrfSeed u26) u5)
    (lower-16-le-inner (element-at vrfSeed u27) u4)
    (lower-16-le-inner (element-at vrfSeed u28) u3)
    (lower-16-le-inner (element-at vrfSeed u29) u2)
    (lower-16-le-inner (element-at vrfSeed u30) u1)
    (lower-16-le-inner (element-at vrfSeed u31) u0)
  )
)

(define-private (lower-16-le-inner (byte (optional (buff 1))) (pos uint))
  (* (buff-to-u8 (unwrap-panic byte)) (pow u2 (* u8 pos)))
)

(define-private (buff-to-u8 (byte (buff 1)))
  (unwrap-panic (index-of 0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff byte))
)
