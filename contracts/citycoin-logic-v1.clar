;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; CITYCOIN LOGIC CONTRACT
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; TODO: add logic trait for future upgrades

;; Determine whether or not the given miner can actually mine tokens right now.
;; * Stacking must be active for this smart contract
;; * No more than 31 miners must have mined already
;; * This miner hasn't mined in this block before
;; * The miner is committing a positive number of uSTX
;; * The miner has the uSTX to commit
(define-read-only (can-mine-tokens (miner principal) (miner-id uint) (stacks-block-height uint) (amount-ustx uint))
    (let
        (
            (block (get-mined-block-or-default stacks-block-height))
        )        
        (if (and (is-eq MAX-MINERS-COUNT (get miners-count block)) (<= amount-ustx (get least-commitment-ustx block)))
            (err ERR-TOO-SMALL-COMMITMENT)
            (begin
                (asserts! (is-some (get-reward-cycle stacks-block-height))
                    (err ERR-STACKING-NOT-AVAILABLE))

                (asserts! (not (has-mined miner-id stacks-block-height))
                    (err ERR-ALREADY-MINED))

                (asserts! (> amount-ustx u0)
                    (err ERR-CANNOT-MINE))

                (asserts! (>= (stx-get-balance miner) amount-ustx)
                    (err ERR-INSUFFICIENT-BALANCE))

                (ok true)
            )
        )
    )
)