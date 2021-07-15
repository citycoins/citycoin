;; CityCoins on Stacks, simulating PoX in a smart contract

;; error codes
(define-constant ERR-NO-WINNER u2000)
(define-constant ERR-NO-SUCH-MINER u2001)
(define-constant ERR-IMMATURE-TOKEN-REWARD u2002)
(define-constant ERR-UNAUTHORIZED u2003)
(define-constant ERR-ALREADY-CLAIMED u2004)
(define-constant ERR-STACKING-NOT-AVAILABLE u2005)
(define-constant ERR-CANNOT-STACK u2006)
(define-constant ERR-INSUFFICIENT-BALANCE u2007)
(define-constant ERR-ALREADY-MINED u2008)
(define-constant ERR-ROUND-FULL u2009)  ;; deprecated - this error is not used anymore
(define-constant ERR-NOTHING-TO-REDEEM u2010)
(define-constant ERR-CANNOT-MINE u2011)
(define-constant ERR-MINER-ALREADY-REGISTERED u2012)
(define-constant ERR-MINING-ACTIVATION-THRESHOLD-REACHED u2013)
(define-constant ERR-MINER-ID-NOT-FOUND u2014)
(define-constant ERR-TOO-SMALL-COMMITMENT u2015)
(define-constant ERR-CYCLE-NOT-COMPLETED u2016)

;; Tailor to your needs.
(define-constant TOKEN-REWARD-MATURITY u100)        ;; how long a miner must wait before claiming their minted tokens
(define-constant FIRST-STACKING-BLOCK u340282366920938463463374607431768211455)    ;; Stacks block height when Stacking is available
(define-constant REWARD-CYCLE-LENGTH u2100)          ;; how long a reward cycle is
(define-constant MAX-REWARD-CYCLES u32)             ;; how many reward cycles a Stacker can Stack their tokens for
(define-constant MAX-MINERS-COUNT u128)             ;; maximum amount of miners in one block
(define-constant LONG-UINT-LIST (list
u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12 u13 u14 u15 u16 
u17 u18 u19 u20 u21 u22 u23 u24 u25 u26 u27 u28 u29 u30 u31 u32 
u33 u34 u35 u36 u37 u38 u39 u40 u41 u42 u43 u44 u45 u46 u47 u48
u49 u50 u51 u52 u53 u54 u55 u56 u57 u58 u59 u60 u61 u62 u63 u64
u65 u66 u67 u68 u69 u70 u71 u72 u73 u74 u75 u76 u77 u78 u79 u80
u81 u82 u83 u84 u85 u86 u87 u88 u89 u90 u91 u92 u93 u94 u95 u96
u97 u98 u99 u100 u101 u102 u103 u104 u105 u106 u107 u108 u109 u110 u111 u112
u113 u114 u115 u116 u117 u118 u119 u120 u121 u122 u123 u124 u125 u126 u127 u128 
))

;; Define city wallet and mining split
(define-constant CITY_CUSTODIED_WALLET 'ST31270FK25JBGCRWYT7RNK90E946R8VW6SZYSQR6)  ;; the custodied wallet address for the city
(define-data-var city-wallet principal CITY_CUSTODIED_WALLET)  ;; variable used in place of constant for easier testing
(define-constant SPLIT_STACKER_PERCENTAGE u70)                 ;; 70% split to stackers of the CityCoin
(define-constant SPLIT_CITY_PERCENTAGE u30)                    ;; 30% split to custodied wallet address for the city

;; NOTE: must be as long as MAX-REWARD-CYCLES
(define-constant REWARD-CYCLE-INDEXES (list u0 u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12 u13 u14 u15 u16 u17 u18 u19 u20 u21 u22 u23 u24 u25 u26 u27 u28 u29 u30 u31))

(define-map UintLists
    uint                ;; size
    (list 128 uint)     ;; actual list
)

(define-private (get-uint-list (size uint))
    (default-to (list ) (map-get? UintLists size))
)

(fold fill-uint-list-closure LONG-UINT-LIST true)

(define-private (fill-uint-list-closure (idx uint) (x bool))
    (if (is-eq idx u1)
        (map-insert UintLists
            idx
            (unwrap-panic (as-max-len? (list u1) u128))
        )
        (map-insert UintLists
            idx
            (unwrap-panic (as-max-len? (append (unwrap-panic (map-get? UintLists (- idx u1))) idx) u128))
        )
    )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; Stacking configuration, as data vars (so it's easy to test).
(define-data-var reward-cycle-length uint REWARD-CYCLE-LENGTH)
(define-data-var token-reward-maturity uint TOKEN-REWARD-MATURITY)
(define-data-var max-reward-cycles uint MAX-REWARD-CYCLES)

;; NOTE: keep this private -- it's used by the test harness to set smaller (easily-tested) values.
(define-private (configure (first-block uint) (rc-len uint) (reward-maturity uint) (max-lockup uint))
    (begin
        (var-set first-stacking-block first-block)
        (var-set reward-cycle-length rc-len)
        (var-set token-reward-maturity reward-maturity)
        (var-set max-reward-cycles max-lockup)
        (ok true)
   )
)

(begin
    (asserts! (is-eq (len REWARD-CYCLE-INDEXES) MAX-REWARD-CYCLES) (err "Invalid max reward cycles"))
    (configure FIRST-STACKING-BLOCK REWARD-CYCLE-LENGTH TOKEN-REWARD-MATURITY MAX-REWARD-CYCLES)
)

;; Bind Stacks block height to a list of up to 128 miners (and how much they mined) per block,
;; and track whether or not the miner has come back to claim their tokens and who mined the least.
(define-map mined-blocks
    { stacks-block-height: uint }
    {
        miners-count: uint,
        least-commitment-idx: uint,
        least-commitment-ustx: uint,
        claimed: bool,
    }
)

(define-map blocks-miners
  { stacks-block-height: uint, idx: uint }
  { miner-id: uint, ustx: uint }
)

;; TO DO: think about adding amount to mined-blocks map.
(define-map block-commit
    { stacks-block-height: uint }
    { amount: uint, 
      amount-to-stackers: uint, 
      amount-to-city: uint 
    }
)

(define-map miners-block-commitment
    { miner-id: uint, stacks-block-height: uint }
    { committed: bool }
)

;; How many uSTX are mined per reward cycle, and how many tokens are locked up in the same reward cycle.
(define-map tokens-per-cycle
    { reward-cycle: uint }
    { total-ustx: uint, total-tokens: uint }
)

;; Who has locked up how many tokens for a given reward cycle.
(define-map stacked-per-cycle
    { stacker: principal, reward-cycle: uint }
    { amount-token: uint, to-return: uint }
)

(define-read-only (get-stacked-per-cycle (stacker principal) (reward-cycle uint))
    (map-get? stacked-per-cycle { stacker: stacker, reward-cycle: reward-cycle })
)

;; Getter for getting the list of miners and uSTX committments for a given block.
(define-read-only (get-miners-at-block (stacks-block-height uint))
    (get miners (fold 
        get-miners-at-block-closure 
        (get-uint-list (get miners-count (get-mined-block-or-default stacks-block-height))) 
        { stacks-block-height: stacks-block-height, miners: (list )}
    ))
)

(define-private (get-miners-at-block-closure (idx uint) (data { stacks-block-height: uint, miners: (list 128 { miner-id: uint, ustx: uint })}))
    (match (map-get? blocks-miners { stacks-block-height: (get stacks-block-height data), idx: idx })
        miner 
        {
            stacks-block-height: (get stacks-block-height data),
            miners: (unwrap-panic (as-max-len? (append (get miners data) miner) u128))
        }
        data
    )
)

;; Getter for getting how many uSTX are committed and tokens are Stacked per reward cycle.
(define-read-only (get-tokens-per-cycle (rc uint))
    (match (map-get? tokens-per-cycle { reward-cycle: rc })
        token-info token-info
        { total-ustx: u0, total-tokens: u0 }
    )
)

;; API endpoint for getting statistics about this PoX-lite contract.
;; Compare to /v2/pox on the Stacks node.
(define-read-only (get-pox-lite-info)
    (match (get-reward-cycle block-height)
        cur-reward-cycle
            (ok
                (let (
                    (token-info (get-tokens-per-cycle cur-reward-cycle))
                    (total-ft-supply (unwrap-panic (contract-call? .citycoin-token get-total-supply)))
                    (total-ustx-supply (stx-get-balance (as-contract tx-sender)))
                )
                {
                    reward-cycle-id: cur-reward-cycle,
                    first-block-height: (var-get first-stacking-block),
                    reward-cycle-length: (var-get reward-cycle-length),
                    total-supply: total-ft-supply,
                    total-ustx-locked: total-ustx-supply,
                    cur-liquid-supply: (- total-ft-supply (get total-tokens token-info)),
                    cur-locked-supply: (get total-tokens token-info),
                    cur-ustx-committed: (get total-ustx token-info)
                })
            )
        (err ERR-STACKING-NOT-AVAILABLE)
    )
)

;; Getter to obtain the list of miners and uSTX commitments at a given Stacks block height,
;; OR, an empty such structure.
(define-private (get-mined-block-or-default (stacks-block-height uint))
    (match (map-get? mined-blocks { stacks-block-height: stacks-block-height })
        block block
        { 
            miners-count: u0, 
            least-commitment-idx: u0,
            least-commitment-ustx: u0,
            claimed: false,
        })
)

;; Given stacks-block-height, return how many uSTX were committed in total
(define-read-only (get-block-commit-total (stacks-block-height uint))
    (default-to u0 (get amount (map-get? block-commit {stacks-block-height: stacks-block-height})))
)

;; Given stacks-block-height, return how many uSTX were committed to stackers
(define-read-only (get-block-commit-to-stackers (stacks-block-height uint))
    (default-to u0 (get amount-to-stackers (map-get? block-commit {stacks-block-height: stacks-block-height})))
)

;; Given stacks-block-height, return how many uSTX were committed to the city
(define-read-only (get-block-commit-to-city (stacks-block-height uint))
    (default-to u0 (get amount-to-city (map-get? block-commit {stacks-block-height: stacks-block-height})))
)

;; Inner fold function to determine which miner won the token batch at a particular Stacks block height, given a sampling value.
(define-private (get-block-winner-closure (idx uint) (data { stacks-block-height: uint, sample: uint, sum: uint, winner: (optional { miner-id: uint, ustx: uint})}))
    (match (map-get? blocks-miners { stacks-block-height: (get stacks-block-height data), idx: idx})
        miner 
        (let
            (
                (sum (get sum data))
                (sample (get sample data))
                (ustx (get ustx miner))
                (next-sum (+ sum ustx))
                (new-winner
                    (if (and (>= sample sum) (< sample next-sum))
                        (some miner)
                        (get winner data)
                    )
                )
            )
            {
                stacks-block-height: (get stacks-block-height data),
                sample: sample,
                sum: next-sum,
                winner: new-winner
            }
        )
        data
    )
)

;; Determine who won a given batch of tokens, given a random sample and a list of miners and commitments.
;; The probability that a given miner wins the batch is proportional to how many uSTX it committed out of the 
;; sum of commitments for this block.
(define-read-only (get-block-winner (stacks-block-height uint) (random-sample uint))
    (let
        (
            (commit-total (get-block-commit-total stacks-block-height))
        )
        (if (> commit-total u0)
            (get winner (fold 
                get-block-winner-closure 
                (get-uint-list (get miners-count (get-mined-block-or-default stacks-block-height)))
                { 
                    stacks-block-height: stacks-block-height,
                    sample: (mod random-sample commit-total), 
                    sum: u0, 
                    winner: none
                }
            ))
            none
        )
    )
)

;; Determine if a given miner has already mined at given block height
(define-read-only (has-mined (miner-id uint) (stacks-block-height uint))
    (is-some (map-get? miners-block-commitment 
        { miner-id: miner-id, stacks-block-height: stacks-block-height }
    ))
)

;; Determine whether or not the given principal can claim the mined tokens at a particular block height,
;; given the miners record for that block height, a random sample, and the current block height.
(define-read-only (can-claim-tokens (claimer principal) 
                                    (claimer-stacks-block-height uint)
                                    (random-sample uint)
                                    (block { 
                                        miners-count: uint,
                                        least-commitment-idx: uint, 
                                        least-commitment-ustx: uint,
                                        claimed: bool
                                    })
                                    (current-stacks-block uint))
    (let (
        (claimer-id (unwrap! (get-miner-id claimer) (err ERR-MINER-ID-NOT-FOUND)))
        (reward-maturity (var-get token-reward-maturity))
        (maximum-stacks-block-height
            (if (>= current-stacks-block reward-maturity)
                (- current-stacks-block reward-maturity)
                u0))
    )
    (if (< claimer-stacks-block-height maximum-stacks-block-height)
        (begin
            (asserts! (not (get claimed block))
                (err ERR-ALREADY-CLAIMED))

            (match (get-block-winner claimer-stacks-block-height random-sample)
                winner-rec (if (is-eq claimer-id (get miner-id winner-rec))
                               (ok true)
                               (err ERR-UNAUTHORIZED))
                (err ERR-NO-WINNER))
        )
        (err ERR-IMMATURE-TOKEN-REWARD)))
)

;; Mark a batch of mined tokens as claimed, so no one else can go and claim them.
(define-private (set-tokens-claimed (claimed-stacks-block-height uint))
    (let (
      (miner-rec (unwrap!
          (map-get? mined-blocks { stacks-block-height: claimed-stacks-block-height })
          (err ERR-NO-WINNER)))
    )
    (begin
       (asserts! (not (get claimed miner-rec))
          (err ERR-ALREADY-CLAIMED))

       (map-set mined-blocks
           { stacks-block-height: claimed-stacks-block-height }
           (merge miner-rec { claimed: true })
       )
       (ok true)))
)

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

;; Determine if a Stacker can Stack their tokens.  Like PoX, they must supply
;; a future Stacks block height at which Stacking begins, as well as a lock-up period
;; in reward cycles.
;; * The Stacker's start block height must be in the future
;; * The first reward cycle must be _after_ the current reward cycle
;; * The lock period must be valid (positive, but no greater than the maximum allowed period)
;; * The Stacker must have tokens to Stack.
(define-read-only (can-stack-tokens (stacker principal) (amount-tokens uint) (now-stacks-ht uint) (start-stacks-ht uint) (lock-period uint))
    (let (
        (cur-reward-cycle (unwrap! (get-reward-cycle now-stacks-ht) (err ERR-STACKING-NOT-AVAILABLE)))
        (start-reward-cycle (+ u1 (unwrap! (get-reward-cycle start-stacks-ht) (err ERR-STACKING-NOT-AVAILABLE))))
        (max-lockup (var-get max-reward-cycles))
    )
    (begin
        (asserts! (< now-stacks-ht start-stacks-ht)
            (err ERR-CANNOT-STACK))

        (asserts! (and (> lock-period u0) (<= lock-period max-lockup))
            (err ERR-CANNOT-STACK))

        (asserts! (> amount-tokens u0)
            (err ERR-CANNOT-STACK))

        (asserts! (<= amount-tokens (unwrap-panic (contract-call? .citycoin-token get-balance stacker)))
            (err ERR-INSUFFICIENT-BALANCE))

        (ok true)
    ))
)

;; Getter for get-entitled-stacking-reward that ensures correct block height is specified
(define-read-only (get-stacking-reward (stacker principal) (target-reward-cycle uint))
    (get-entitled-stacking-reward stacker target-reward-cycle block-height)
)

;; Determine how many uSTX a Stacker is allowed to claim, given the reward cycle they Stacked in and the current block height.
;; This method only returns a positive value if:
;; * The current block height is in a subsequent reward cycle
;; * The Stacker actually did lock up some tokens in the target reward cycle
;; * The Stacker locked up _enough_ tokens to get at least one uSTX.
;; It's possible to Stack tokens but not receive uSTX.  For example, no miners may have mined in this reward cycle.
;; As another example, you may have Stacked so few that you'd be entitled to less than 1 uSTX.
(define-private (get-entitled-stacking-reward (stacker principal) (target-reward-cycle uint) (cur-block-height uint))
    (let (
        (stacked-this-cycle
            (get amount-token
                (default-to { amount-token: u0 }
                    (map-get? stacked-per-cycle { stacker: stacker, reward-cycle: target-reward-cycle }))))
        (total-tokens-this-cycle
            (default-to { total-ustx: u0, total-tokens: u0 }
                (map-get? tokens-per-cycle { reward-cycle: target-reward-cycle })))
    )
    (match (get-reward-cycle cur-block-height)
        cur-reward-cycle
          (if (or (<= cur-reward-cycle target-reward-cycle) (is-eq u0 (get total-tokens total-tokens-this-cycle)))
              ;; either this reward cycle hasn't finished yet, or the Stacker contributed nothing
              u0
              ;; (total-ustx * this-stackers-tokens) / total-tokens-stacked
              (/ (* (get total-ustx total-tokens-this-cycle) stacked-this-cycle) 
                 (get total-tokens total-tokens-this-cycle))
          )
        ;; before first reward cycle
        u0
    ))
)

;; Helper variable used only to achieve "dynamic" filter condition in closure function called by `filter`
(define-data-var miner-to-kick (optional {miner-id: uint, amount-ustx: uint}) none)

;; Inner filter function.
;; Returns true if supplied miner in not miner who committed the least and needs to be kicked out of the list
(define-private (remove-miner-to-kick-closure (miner-data {miner-id: uint, amount-ustx: uint}))
    (not 
        (is-eq miner-data (unwrap-panic (var-get miner-to-kick)))
    )
)

(define-private (find-least (miner-data {miner-id: uint, amount-ustx: uint}) 
                            (ret-data (optional {miner-id: uint, amount-ustx: uint})))
    (if (is-some ret-data)
        (if ( < (get amount-ustx miner-data) (default-to u0 (get amount-ustx ret-data)))
            (some miner-data)
            ret-data
        )
        (some miner-data)
    )
)

;; Mark a miner as having mined in a given Stacks block and committed the given uSTX.
(define-private (set-tokens-mined (miner principal) (miner-id uint) (stacks-block-height uint) (commit-ustx uint) (commit-ustx-to-stackers uint) (commit-ustx-to-city uint))
    (let (
        (block (get-mined-block-or-default stacks-block-height))
        (increased-miners-count (+ (get miners-count block) u1))
        (new-idx increased-miners-count)
        (least-commitment-idx (get least-commitment-idx block))
        (least-commitment-ustx (get least-commitment-ustx block))
        
        (reward-cycle (unwrap! (get-reward-cycle stacks-block-height)
            (err ERR-STACKING-NOT-AVAILABLE)))

        (tokens-mined (default-to { total-ustx: u0, total-tokens: u0 } 
            (map-get? tokens-per-cycle { reward-cycle: reward-cycle }))
        )
    )
    (begin
        (if (> MAX-MINERS-COUNT (get miners-count block))
            (begin
                ;; list is not full - add new miner and calculate if he committed the least
                (map-set blocks-miners
                    { stacks-block-height: stacks-block-height, idx: new-idx }
                    { miner-id: miner-id, ustx: commit-ustx }
                )

                (map-set mined-blocks
                    { stacks-block-height: stacks-block-height }
                    {
                        miners-count: increased-miners-count,
                        least-commitment-idx: (if (or (is-eq new-idx u1) (< commit-ustx least-commitment-ustx)) new-idx least-commitment-idx),
                        least-commitment-ustx: (if (or (is-eq new-idx u1) (< commit-ustx least-commitment-ustx)) commit-ustx least-commitment-ustx),
                        claimed: false
                    }
                )
            )
            (begin
                ;; list is full - replace miner who committed the least with new one and calculate new miner who committed the least
                (map-set blocks-miners
                    { stacks-block-height: stacks-block-height, idx: least-commitment-idx }
                    { miner-id: miner-id, ustx: commit-ustx }
                )
                (let
                    (
                        (least-commitment (find-least-commitment stacks-block-height))
                    )
                    (map-set mined-blocks
                        { stacks-block-height: stacks-block-height }
                        {
                            miners-count: MAX-MINERS-COUNT,
                            least-commitment-idx: (get least-commitment-idx least-commitment),
                            least-commitment-ustx: (get least-commitment-ustx least-commitment),
                            claimed: false
                        }
                    )
                )
            )
        )
        (map-set miners-block-commitment
            { miner-id: miner-id, stacks-block-height: stacks-block-height}
            { committed: true }
        )
        (map-set tokens-per-cycle
            { reward-cycle: reward-cycle }
            { total-ustx: (+ commit-ustx-to-stackers (get total-ustx tokens-mined)), total-tokens: (get total-tokens tokens-mined) }
        )
        (map-set block-commit
            { stacks-block-height: stacks-block-height }
            {
                amount: (+ commit-ustx (get-block-commit-total stacks-block-height)),
                amount-to-stackers: (+ commit-ustx-to-stackers (get-block-commit-to-stackers stacks-block-height)),
                amount-to-city: (+ commit-ustx-to-city (get-block-commit-to-city stacks-block-height))
            }
        )
        (ok true)
    ))
)

(define-read-only (find-least-commitment (stacks-block-height uint))
  (fold find-least-commitment-closure LONG-UINT-LIST { stacks-block-height: stacks-block-height, least-commitment-idx: u0, least-commitment-ustx: u0 })
)

(define-private (find-least-commitment-closure (idx uint) (data { stacks-block-height: uint, least-commitment-idx: uint, least-commitment-ustx: uint }))
  
    (match (get ustx (map-get? blocks-miners { stacks-block-height: (get stacks-block-height data), idx: idx }))
      ustx 
      (if (or (is-eq idx u1) (< ustx (get least-commitment-ustx data)))
        {
          stacks-block-height: (get stacks-block-height data),
          least-commitment-idx: (if (> ustx u0) idx u0), ;; if is used here to return 0 when called on block without miners
          least-commitment-ustx: ustx
        }
        data
      )
      data
    )
)


;; Get the reward cycle for a given Stacks block height
(define-read-only (get-reward-cycle (stacks-bh uint))
    (let (
        (first-stack-block (var-get first-stacking-block))
        (rc-len (var-get reward-cycle-length))
    )
    (if (>= stacks-bh first-stack-block)
        (some (/ (- stacks-bh first-stack-block) rc-len))
        none
    ))
)

;; Get the first Stacks block height for a given reward cycle.
(define-read-only (get-first-block-height-in-reward-cycle (reward-cycle uint))
    (+ (var-get first-stacking-block) (* (var-get reward-cycle-length) reward-cycle)))

;; Inner fold function for Stacking tokens.  Populates the stacked-per-cycle and tokens-per-cycle tables for each
;; reward cycle the Stacker is Stacking in.
(define-private (stack-tokens-closure (reward-cycle-idx uint) (commitment { stacker: principal, amt: uint, first: uint, last: uint }))
    (let (
        (stacker (get stacker commitment))
        (amount-token (get amt commitment))
        (first-reward-cycle (get first commitment))
        (last-reward-cycle (get last commitment))
        (target-reward-cycle (+ first-reward-cycle reward-cycle-idx))
        (stacked-rec (default-to {amount-token: u0, to-return: u0} (get-stacked-per-cycle stacker target-reward-cycle )))
        (stacked-already (get amount-token stacked-rec))
        (to-return-already (get to-return stacked-rec))
        (tokens-this-cycle (match (map-get? tokens-per-cycle { reward-cycle: target-reward-cycle })
                                rec rec
                                { total-ustx: u0, total-tokens: u0 }))
    )
    (begin
        (if (and (>= target-reward-cycle first-reward-cycle) (< target-reward-cycle last-reward-cycle))
            (begin
                (map-set stacked-per-cycle
                    { stacker: stacker, reward-cycle: target-reward-cycle }
                    { 
                        amount-token: (+ amount-token stacked-already),
                        to-return: (if (is-eq target-reward-cycle (- last-reward-cycle u1)) (+ to-return-already amount-token) to-return-already)
                    }
                )

                (map-set tokens-per-cycle
                    { reward-cycle: target-reward-cycle }
                    { total-ustx: (get total-ustx tokens-this-cycle), total-tokens: (+ amount-token (get total-tokens tokens-this-cycle)) })

                true)
           false)
        { stacker: stacker, amt: amount-token, first: first-reward-cycle, last: last-reward-cycle }
    ))
)

;; Stack the contract's tokens.  Stacking will begin at the next reward cycle following
;; the reward cycle in which start-stacks-ht resides.
;; This method takes possession of the Stacker's tokens until the given number of reward cycles
;; has passed.
(define-public (stack-tokens (amount-tokens uint) (start-stacks-ht uint) (lock-period uint))
    (let (
        (start-reward-cycle (+ u1 (unwrap! (get-reward-cycle start-stacks-ht) (err ERR-STACKING-NOT-AVAILABLE))))
    )
    (begin
        (try! (can-stack-tokens tx-sender amount-tokens block-height start-stacks-ht lock-period))

        (unwrap! (contract-call? .citycoin-token transfer amount-tokens tx-sender (as-contract tx-sender) none)
            (err ERR-INSUFFICIENT-BALANCE))

        (fold stack-tokens-closure REWARD-CYCLE-INDEXES
            { stacker: tx-sender, amt: amount-tokens, first: start-reward-cycle, last: (+ start-reward-cycle lock-period) })

        (ok true)
    ))
)

;; Mine tokens.  The miner commits uSTX into this contract (which Stackers can claim later with claim-stacking-reward),
;; and in doing so, enters their candidacy to be able to claim the block reward (via claim-mining-reward).  The miner must 
;; wait for a token maturity window in order to obtain the tokens.  Once that window passes, they can get the tokens.
;; This ensures that no one knows the VRF seed that will be used to pick the winner.
(define-public (mine-tokens (amount-ustx uint) (memo (optional (buff 34))))
    (begin
        (if (is-some memo)
            (print memo)
            none
        )
        (mine-tokens-at-block block-height (get-or-create-miner-id tx-sender) amount-ustx)
    )
)

(define-public (mine-tokens-over-30-blocks (amount-ustx uint))
    (let
        ((miner-id (get-or-create-miner-id tx-sender)))

        (asserts! (>= (stx-get-balance tx-sender) (* u30 amount-ustx))
            (err ERR-INSUFFICIENT-BALANCE))

        (try! (mine-tokens-at-block block-height miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u1) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u2) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u3) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u4) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u5) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u6) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u7) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u8) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u9) miner-id amount-ustx))

        (try! (mine-tokens-at-block (+ block-height u10) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u11) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u12) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u13) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u14) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u15) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u16) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u17) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u18) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u19) miner-id amount-ustx))

        (try! (mine-tokens-at-block (+ block-height u20) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u21) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u22) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u23) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u24) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u25) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u26) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u27) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u28) miner-id amount-ustx))
        (try! (mine-tokens-at-block (+ block-height u29) miner-id amount-ustx))
        (ok true)
    )
)

(define-private (mine-tokens-at-block (stacks-block-height uint) (miner-id uint) (amount-ustx uint))
    (let (
        (rc (unwrap! (get-reward-cycle stacks-block-height)
            (err ERR-STACKING-NOT-AVAILABLE)))
        (total-stacked (get total-tokens (map-get? tokens-per-cycle { reward-cycle: rc })))
        (total-stacked-ustx (default-to u0 total-stacked))
        (stacked-something (not (is-eq total-stacked-ustx u0)))
        (amount-ustx-to-stacker
            (if stacked-something
                (/ (* SPLIT_STACKER_PERCENTAGE amount-ustx) u100)
                u0
            )
        )
        (amount-ustx-to-city
            (if stacked-something
                (/ (* SPLIT_CITY_PERCENTAGE amount-ustx) u100)
                amount-ustx
            )
        )
    )
    (begin
        (try! (can-mine-tokens tx-sender miner-id stacks-block-height amount-ustx))
        (try! (set-tokens-mined tx-sender miner-id stacks-block-height amount-ustx amount-ustx-to-stacker amount-ustx-to-city))

        ;; check if stacking is active
        (if stacked-something
            ;; transfer with split if active
            (begin
                (unwrap-panic (stx-transfer? amount-ustx-to-stacker tx-sender (as-contract tx-sender)))
                (unwrap-panic (stx-transfer? amount-ustx-to-city tx-sender (var-get city-wallet)))
            )
            ;; transfer to custodied wallet if not active
            (unwrap-panic (stx-transfer? amount-ustx-to-city tx-sender (var-get city-wallet)))
        )

        (ok true)
    ))
)

;; Claim the block reward.  This mints and transfers out a miner's tokens if it is indeed the block winner for
;; the given Stacks block.  The VRF seed will be sampled at the target mined stacks block height _plus_ the 
;; maturity window, and if the miner (i.e. the caller of this function) both mined in the target Stacks block
;; and was later selected by the VRF as the winner, they will receive that block's token batch.
;; Note that this method actually mints the contract's tokens -- they do not exist until the miner calls
;; this method.
(define-public (claim-mining-reward (mined-stacks-block-ht uint))
    (let (
        (random-sample (unwrap! (contract-call? .citycoin-vrf get-random-uint-at-block (+ mined-stacks-block-ht (var-get token-reward-maturity)))
                        (err ERR-IMMATURE-TOKEN-REWARD)))
        (block (unwrap! (map-get? mined-blocks { stacks-block-height: mined-stacks-block-ht })
                        (err ERR-NO-WINNER)))
    )
    (begin
        (try! (can-claim-tokens tx-sender mined-stacks-block-ht random-sample block block-height))
        (try! (set-tokens-claimed mined-stacks-block-ht))
        (try! (mint-coinbase tx-sender mined-stacks-block-ht))

        (ok true)
    ))
)

;; Claim a Stacking reward.  Once a reward cycle passes, a Stacker can call this method to obtain any
;; uSTX that were committed to the contract during that reward cycle (proportional to how many tokens
;; they locked up).
(define-public (claim-stacking-reward (target-reward-cycle uint))
    (let (
        (stacker tx-sender)
        (cur-reward-cycle (unwrap! (get-reward-cycle block-height) (err ERR-STACKING-NOT-AVAILABLE)))
        (entitled-ustx (get-stacking-reward tx-sender target-reward-cycle))
        (to-return (get to-return (default-to { amount-token: u0, to-return: u0 } (get-stacked-per-cycle stacker target-reward-cycle))))
    )
    (begin
        ;; check that target reward cycle is complete
        (asserts! (> cur-reward-cycle target-reward-cycle)
            (err ERR-CYCLE-NOT-COMPLETED))

        (asserts! (or (> to-return u0) (> entitled-ustx u0))
            (err ERR-NOTHING-TO-REDEEM))

        ;; disable ability to claim again
        (map-set stacked-per-cycle
            { stacker: tx-sender, reward-cycle: target-reward-cycle }
            { amount-token: u0, to-return: u0 }
        )

        ;; send back stacked tokens if user was eligible
        (if (> to-return u0)
            (try! (as-contract (contract-call? .citycoin-token transfer to-return tx-sender stacker none)))
            true
        )

        ;; send back rewards if user was eligible
        (if (> entitled-ustx u0)
            (try! (as-contract (stx-transfer? entitled-ustx tx-sender stacker)))
            true
        )

        (ok true)
    ))
)

(define-read-only (get-total-supply-ustx)
    (ok (stx-get-balance (as-contract tx-sender)))
)

(define-read-only (get-city-wallet)
    (var-get city-wallet)
)

;; Update the city-wallet variable
;; This can only be called by the city-wallet principal.
;; Calling `set-city-wallet` from an outside contract (that is not the city-wallet principal)
;; is not allowed
(define-public (set-city-wallet (wallet-address principal))
  (begin
    (asserts! (is-eq contract-caller (var-get city-wallet)) (err ERR-UNAUTHORIZED))
    (ok (var-set city-wallet wallet-address))
  )
)

;;
;; LIFECYCLE TRAIT FUNCTIONS
;;
(impl-trait .citycoin-lifecycle-trait.lifecycle-trait)

(define-constant CONTRACT_VERSION "0.0.1")
(define-data-var startupBH (optional uint) none)
(define-data-var shutdownBH (optional uint) none)
(define-data-var state uint u0)

(define-read-only (get-contract-info)
    (ok {
        version: CONTRACT_VERSION,
        startupBH: (var-get startupBH),
        shutdownBH: (var-get shutdownBH),
        state: (var-get state)
    })
)

(define-public (startup (height (optional uint)))
    ;; not implemented
    (ok (var-set startupBH height))
)

(define-public (shutdown (height (optional uint)))
    ;; not implemented
    (ok (var-set shutdownBH height))
)