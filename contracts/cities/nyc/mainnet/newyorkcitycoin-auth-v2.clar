;; NEWYORKCITYCOIN AUTH CONTRACT V2
;; CityCoins Protocol Version 2.0.0

(define-constant CONTRACT_OWNER tx-sender)

;; TRAIT DEFINITIONS

(use-trait coreTraitV2 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.citycoin-core-v2-trait.citycoin-core-v2)
(use-trait tokenTraitV2 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.citycoin-token-v2-trait.citycoin-token-v2)

;; ERRORS

(define-constant ERR_UNKNOWN_JOB (err u6000))
(define-constant ERR_UNAUTHORIZED (err u6001))
(define-constant ERR_JOB_IS_ACTIVE (err u6002))
(define-constant ERR_JOB_IS_NOT_ACTIVE (err u6003))
(define-constant ERR_ALREADY_VOTED_THIS_WAY (err u6004))
(define-constant ERR_JOB_IS_EXECUTED (err u6005))
(define-constant ERR_JOB_IS_NOT_APPROVED (err u6006))
(define-constant ERR_ARGUMENT_ALREADY_EXISTS (err u6007))
(define-constant ERR_NO_ACTIVE_CORE_CONTRACT (err u6008))
(define-constant ERR_CORE_CONTRACT_NOT_FOUND (err u6009))
(define-constant ERR_UNKNOWN_ARGUMENT (err u6010))
(define-constant ERR_INCORRECT_CONTRACT_STATE (err u6011))
(define-constant ERR_CONTRACT_ALREADY_EXISTS (err u6012))

;; JOB MANAGEMENT

(define-constant REQUIRED_APPROVALS u3)

(define-data-var lastJobId uint u0)

(define-map Jobs
  uint
  {
    creator: principal,
    name: (string-ascii 255),
    target: principal,
    approvals: uint,
    disapprovals: uint,
    isActive: bool,
    isExecuted: bool
  }
)

(define-map JobApprovers
  { jobId: uint, approver: principal }
  bool
)

(define-map Approvers
  principal
  bool
)

(define-map ArgumentLastIdsByType
  { jobId: uint, argumentType: (string-ascii 25) }
  uint
)

(define-map UIntArgumentsByName
  { jobId: uint, argumentName: (string-ascii 255) }
  { argumentId: uint, value: uint}
)

(define-map UIntArgumentsById
  { jobId: uint, argumentId: uint }
  { argumentName: (string-ascii 255), value: uint }
)

(define-map PrincipalArgumentsByName
  { jobId: uint, argumentName: (string-ascii 255) }
  { argumentId: uint, value: principal }
)

(define-map PrincipalArgumentsById
  { jobId: uint, argumentId: uint }
  { argumentName: (string-ascii 255), value: principal }
)

;; FUNCTIONS

(define-read-only (get-last-job-id)
  (var-get lastJobId)
)

(define-public (create-job (name (string-ascii 255)) (target principal))
  (let
    (
      (newJobId (+ (var-get lastJobId) u1))
    )
    (asserts! (is-approver tx-sender) ERR_UNAUTHORIZED)
    (map-set Jobs
      newJobId
      {
        creator: tx-sender,
        name: name,
        target: target,
        approvals: u0,
        disapprovals: u0,
        isActive: false,
        isExecuted: false
      }
    )
    (var-set lastJobId newJobId)
    (ok newJobId)
  )
)

(define-read-only (get-job (jobId uint))
  (map-get? Jobs jobId)
)

(define-public (activate-job (jobId uint))
  (let
    (
      (job (unwrap! (get-job jobId) ERR_UNKNOWN_JOB))
    )
    (asserts! (is-eq (get creator job) tx-sender) ERR_UNAUTHORIZED)
    (asserts! (not (get isActive job)) ERR_JOB_IS_ACTIVE)
    (map-set Jobs 
      jobId
      (merge job { isActive: true })
    )
    (ok true)
  )
)

(define-public (approve-job (jobId uint))
  (let
    (
      (job (unwrap! (get-job jobId) ERR_UNKNOWN_JOB))
      (previousVote (map-get? JobApprovers { jobId: jobId, approver: tx-sender }))
    )
    (asserts! (get isActive job) ERR_JOB_IS_NOT_ACTIVE)
    (asserts! (is-approver tx-sender) ERR_UNAUTHORIZED)
    ;; save vote
    (map-set JobApprovers
      { jobId: jobId, approver: tx-sender }
      true
    )
    (match previousVote approved
      (begin
        (asserts! (not approved) ERR_ALREADY_VOTED_THIS_WAY)
        (map-set Jobs jobId
          (merge job 
            {
              approvals: (+ (get approvals job) u1),
              disapprovals: (- (get disapprovals job) u1)
            }
          )
        )
      )
      ;; no previous vote
      (map-set Jobs
        jobId
        (merge job { approvals: (+ (get approvals job) u1) } )
      )
    )  
    (ok true)
  )
)

(define-public (disapprove-job (jobId uint))
  (let
    (
      (job (unwrap! (get-job jobId) ERR_UNKNOWN_JOB))
      (previousVote (map-get? JobApprovers { jobId: jobId, approver: tx-sender }))
    )
    (asserts! (get isActive job) ERR_JOB_IS_NOT_ACTIVE)
    (asserts! (is-approver tx-sender) ERR_UNAUTHORIZED)
    ;; save vote
    (map-set JobApprovers
      { jobId: jobId, approver: tx-sender }
      false
    )
    (match previousVote approved
      (begin
        (asserts! approved ERR_ALREADY_VOTED_THIS_WAY)
        (map-set Jobs jobId
          (merge job 
            {
              approvals: (- (get approvals job) u1),
              disapprovals: (+ (get disapprovals job) u1)
            }
          )
        )
      )
      ;; no previous vote
      (map-set Jobs
        jobId
        (merge job { disapprovals: (+ (get disapprovals job) u1) } )
      )
    )
    (ok true)
  )
)

(define-read-only (is-job-approved (jobId uint))
  (match (get-job jobId) job
    (>= (get approvals job) REQUIRED_APPROVALS)
    false
  )
)

(define-public (mark-job-as-executed (jobId uint))
  (let
    (
      (job (unwrap! (get-job jobId) ERR_UNKNOWN_JOB))
    )
    (asserts! (get isActive job) ERR_JOB_IS_NOT_ACTIVE)
    (asserts! (>= (get approvals job) REQUIRED_APPROVALS) ERR_JOB_IS_NOT_APPROVED)
    (asserts! (is-eq (get target job) contract-caller) ERR_UNAUTHORIZED)
    (asserts! (not (get isExecuted job)) ERR_JOB_IS_EXECUTED)
    (map-set Jobs
      jobId
      (merge job { isExecuted: true })
    )
    (ok true)
  )
)

(define-public (add-uint-argument (jobId uint) (argumentName (string-ascii 255)) (value uint))
  (let
    (
      (argumentId (generate-argument-id jobId "uint"))
    )
    (try! (guard-add-argument jobId))
    (asserts! 
      (and
        (map-insert UIntArgumentsById
          { jobId: jobId, argumentId: argumentId }
          { argumentName: argumentName, value: value }
        )
        (map-insert UIntArgumentsByName
          { jobId: jobId, argumentName: argumentName }
          { argumentId: argumentId, value: value}
        )
      ) 
      ERR_ARGUMENT_ALREADY_EXISTS
    )
    (ok true)
  )
)

(define-read-only (get-uint-argument-by-name (jobId uint) (argumentName (string-ascii 255)))
  (map-get? UIntArgumentsByName { jobId: jobId, argumentName: argumentName })
)

(define-read-only (get-uint-argument-by-id (jobId uint) (argumentId uint))
  (map-get? UIntArgumentsById { jobId: jobId, argumentId: argumentId })
)

(define-read-only (get-uint-value-by-name (jobId uint) (argumentName (string-ascii 255)))
  (get value (get-uint-argument-by-name jobId argumentName))
)

(define-read-only (get-uint-value-by-id (jobId uint) (argumentId uint))
  (get value (get-uint-argument-by-id jobId argumentId))
)

(define-public (add-principal-argument (jobId uint) (argumentName (string-ascii 255)) (value principal))
  (let
    (
      (argumentId (generate-argument-id jobId "principal"))
    )
    (try! (guard-add-argument jobId))
    (asserts! 
      (and
        (map-insert PrincipalArgumentsById
          { jobId: jobId, argumentId: argumentId }
          { argumentName: argumentName, value: value }
        )
        (map-insert PrincipalArgumentsByName
          { jobId: jobId, argumentName: argumentName }
          { argumentId: argumentId, value: value}
        )
      ) 
      ERR_ARGUMENT_ALREADY_EXISTS
    )
    (ok true)
  )
)

(define-read-only (get-principal-argument-by-name (jobId uint) (argumentName (string-ascii 255)))
  (map-get? PrincipalArgumentsByName { jobId: jobId, argumentName: argumentName })
)

(define-read-only (get-principal-argument-by-id (jobId uint) (argumentId uint))
  (map-get? PrincipalArgumentsById { jobId: jobId, argumentId: argumentId })
)

(define-read-only (get-principal-value-by-name (jobId uint) (argumentName (string-ascii 255)))
  (get value (get-principal-argument-by-name jobId argumentName))
)

(define-read-only (get-principal-value-by-id (jobId uint) (argumentId uint))
  (get value (get-principal-argument-by-id jobId argumentId))
)

;; PRIVATE FUNCTIONS

(define-read-only  (is-approver (user principal))
  (default-to false (map-get? Approvers user))
)

(define-private (generate-argument-id (jobId uint) (argumentType (string-ascii 25)))
  (let
    (
      (argumentId (+ (default-to u0 (map-get? ArgumentLastIdsByType { jobId: jobId, argumentType: argumentType })) u1))
    )
    (map-set ArgumentLastIdsByType
      { jobId: jobId, argumentType: argumentType }
      argumentId
    )
    ;; return
    argumentId
  )
)

(define-private (guard-add-argument (jobId uint))
  (let
    (
      (job (unwrap! (get-job jobId) ERR_UNKNOWN_JOB))
    )
    (asserts! (not (get isActive job)) ERR_JOB_IS_ACTIVE)
    (asserts! (is-eq (get creator job) contract-caller) ERR_UNAUTHORIZED)
    (ok true)
  )
)

;; CONTRACT MANAGEMENT

;; initial value for active core contract
;; set to deployer address at startup to prevent
;; circular dependency of core on auth
(define-data-var activeCoreContract principal CONTRACT_OWNER)
(define-data-var initialized bool false)

;; core contract states
(define-constant STATE_DEPLOYED u0)
(define-constant STATE_ACTIVE u1)
(define-constant STATE_INACTIVE u2)

;; core contract map
(define-map CoreContracts
  principal
  {
    state: uint, 
    startHeight: uint,
    endHeight: uint
  }
)

;; getter for active core contract
(define-read-only (get-active-core-contract)
  (begin
    (asserts! (not (is-eq (var-get activeCoreContract) CONTRACT_OWNER)) ERR_NO_ACTIVE_CORE_CONTRACT)
    (ok (var-get activeCoreContract))
  )
)

;; getter for core contract map
(define-read-only (get-core-contract-info (targetContract principal))
  (let
    (
      (coreContract (unwrap! (map-get? CoreContracts targetContract) ERR_CORE_CONTRACT_NOT_FOUND))
    )
    (ok coreContract)
  )
)

;; one-time function to initialize contracts after all contracts are deployed
;; - check that deployer is calling this function
;; - check this contract is not activated already (one-time use)
;; - set initial map value for core contract v1
;; - set cityWallet in core contract
;; - set intialized true
(define-public (initialize-contracts (coreContract <coreTraitV2>))
  (let
    (
      (coreContractAddress (contract-of coreContract))
    )
    (asserts! (is-eq contract-caller CONTRACT_OWNER) ERR_UNAUTHORIZED)
    (asserts! (not (var-get initialized)) ERR_UNAUTHORIZED)
    (map-set CoreContracts
      coreContractAddress
      {
        state: STATE_DEPLOYED,
        startHeight: u0,
        endHeight: u0
      })
    (try! (contract-call? coreContract set-city-wallet (var-get cityWallet)))
    (var-set initialized true)
    (ok true)
  )
)

(define-read-only (is-initialized)
  (var-get initialized)
)

;; function to activate core contract through registration
;; - check that target is in core contract map
;; - check that caller is core contract
;; - check that target is in STATE_DEPLOYED
;; - set active in core contract map
;; - set as activeCoreContract
(define-public (activate-core-contract (targetContract principal) (stacksHeight uint))
  (let
    (
      (coreContract (unwrap! (map-get? CoreContracts targetContract) ERR_CORE_CONTRACT_NOT_FOUND))
    )
    (asserts! (is-eq (get state coreContract) STATE_DEPLOYED) ERR_INCORRECT_CONTRACT_STATE)
    (asserts! (is-eq contract-caller targetContract) ERR_UNAUTHORIZED)
    (map-set CoreContracts
      targetContract
      {
        state: STATE_ACTIVE,
        startHeight: stacksHeight,
        endHeight: u0
      })
    (var-set activeCoreContract targetContract)
    (ok true)
  )
)

;; protected function to update core contract
(define-public (upgrade-core-contract (oldContract <coreTraitV2>) (newContract <coreTraitV2>))
  (let
    (
      (oldContractAddress (contract-of oldContract))
      (oldContractMap (unwrap! (map-get? CoreContracts oldContractAddress) ERR_CORE_CONTRACT_NOT_FOUND))
      (newContractAddress (contract-of newContract))
    )
    (asserts! (not (is-eq oldContractAddress newContractAddress)) ERR_CONTRACT_ALREADY_EXISTS)
    (asserts! (is-none (map-get? CoreContracts newContractAddress)) ERR_CONTRACT_ALREADY_EXISTS)
    (asserts! (is-authorized-city) ERR_UNAUTHORIZED)
    (map-set CoreContracts
      oldContractAddress
      {
        state: STATE_INACTIVE,
        startHeight: (get startHeight oldContractMap),
        endHeight: block-height
      })
    (map-set CoreContracts
      newContractAddress
      {
        state: STATE_DEPLOYED,
        startHeight: u0,
        endHeight: u0
      })
    (var-set activeCoreContract newContractAddress)
    (try! (contract-call? oldContract shutdown-contract block-height))
    (try! (contract-call? newContract set-city-wallet (var-get cityWallet)))
    (ok true)
  )
)

(define-public (execute-upgrade-core-contract-job (jobId uint) (oldContract <coreTraitV2>) (newContract <coreTraitV2>))
  (let
    (
      (oldContractArg (unwrap! (get-principal-value-by-name jobId "oldContract") ERR_UNKNOWN_ARGUMENT))
      (newContractArg (unwrap! (get-principal-value-by-name jobId "newContract") ERR_UNKNOWN_ARGUMENT))
      (oldContractAddress (contract-of oldContract))
      (oldContractMap (unwrap! (map-get? CoreContracts oldContractAddress) ERR_CORE_CONTRACT_NOT_FOUND))
      (newContractAddress (contract-of newContract))
    )
    (asserts! (not (is-eq oldContractAddress newContractAddress)) ERR_CONTRACT_ALREADY_EXISTS)
    (asserts! (is-none (map-get? CoreContracts newContractAddress)) ERR_CONTRACT_ALREADY_EXISTS)
    (asserts! (and (is-eq oldContractArg oldContractAddress) (is-eq newContractArg newContractAddress)) ERR_UNAUTHORIZED)
    (asserts! (is-approver contract-caller) ERR_UNAUTHORIZED)
    (map-set CoreContracts
      oldContractAddress
      {
        state: STATE_INACTIVE,
        startHeight: (get startHeight oldContractMap),
        endHeight: block-height
      })
    (map-set CoreContracts
      newContractAddress
      {
        state: STATE_DEPLOYED,
        startHeight: u0,
        endHeight: u0
      })
    (var-set activeCoreContract newContractAddress)
    (try! (contract-call? oldContract shutdown-contract block-height))
    (try! (contract-call? newContract set-city-wallet (var-get cityWallet)))
    (as-contract (mark-job-as-executed jobId))
  )
)

;; CITY WALLET MANAGEMENT

;; initial value for city wallet
(define-data-var cityWallet principal 'SM18VBF2QYAAHN57Q28E2HSM15F6078JZYZ2FQBCX)

;; returns city wallet principal
(define-read-only (get-city-wallet)
  (ok (var-get cityWallet))
)
 
;; protected function to update city wallet variable
(define-public (set-city-wallet (targetContract <coreTraitV2>) (newCityWallet principal))
  (let
    (
      (coreContractAddress (contract-of targetContract))
      (coreContract (unwrap! (map-get? CoreContracts coreContractAddress) ERR_CORE_CONTRACT_NOT_FOUND))
    )
    (asserts! (is-authorized-city) ERR_UNAUTHORIZED)
    (asserts! (is-eq coreContractAddress (var-get activeCoreContract)) ERR_UNAUTHORIZED)
    (var-set cityWallet newCityWallet)
    (try! (contract-call? targetContract set-city-wallet newCityWallet))
    (ok true)
  )
)

(define-public (execute-set-city-wallet-job (jobId uint) (targetContract <coreTraitV2>))
  (let
    (
      (coreContractAddress (contract-of targetContract))
      (coreContract (unwrap! (map-get? CoreContracts coreContractAddress) ERR_CORE_CONTRACT_NOT_FOUND))
      (newCityWallet (unwrap! (get-principal-value-by-name jobId "newCityWallet") ERR_UNKNOWN_ARGUMENT))
    )
    (asserts! (is-approver contract-caller) ERR_UNAUTHORIZED)
    (asserts! (is-eq coreContractAddress (var-get activeCoreContract)) ERR_UNAUTHORIZED)
    (var-set cityWallet newCityWallet)
    (try! (contract-call? targetContract set-city-wallet newCityWallet))
    (as-contract (mark-job-as-executed jobId))
  )
)

;; check if contract caller is city wallet
(define-private (is-authorized-city)
  (is-eq contract-caller (var-get cityWallet))
)

;; TOKEN MANAGEMENT

(define-public (set-token-uri (targetContract <tokenTraitV2>) (newUri (optional (string-utf8 256))))
  (begin
    (asserts! (is-authorized-city) ERR_UNAUTHORIZED)
    (as-contract (try! (contract-call? targetContract set-token-uri newUri)))
    (ok true)
  )
)

;; COINBASE THRESHOLDS

(define-public (update-coinbase-thresholds (targetCore <coreTraitV2>) (targetToken <tokenTraitV2>) (threshold1 uint) (threshold2 uint) (threshold3 uint) (threshold4 uint) (threshold5 uint))
  (begin
    (asserts! (is-authorized-city) ERR_UNAUTHORIZED)
    ;; update in token contract
    (as-contract (try! (contract-call? targetToken update-coinbase-thresholds threshold1 threshold2 threshold3 threshold4 threshold5)))
    ;; update core contract based on token contract
    (as-contract (try! (contract-call? targetCore update-coinbase-thresholds)))
    (ok true)
  )
)

(define-public (execute-update-coinbase-thresholds-job (jobId uint) (targetCore <coreTraitV2>) (targetToken <tokenTraitV2>))
  (let
    (
      (threshold1 (unwrap! (get-uint-value-by-name jobId "threshold1") ERR_UNKNOWN_ARGUMENT))
      (threshold2 (unwrap! (get-uint-value-by-name jobId "threshold2") ERR_UNKNOWN_ARGUMENT))
      (threshold3 (unwrap! (get-uint-value-by-name jobId "threshold3") ERR_UNKNOWN_ARGUMENT))
      (threshold4 (unwrap! (get-uint-value-by-name jobId "threshold4") ERR_UNKNOWN_ARGUMENT))
      (threshold5 (unwrap! (get-uint-value-by-name jobId "threshold5") ERR_UNKNOWN_ARGUMENT))
    )
    (asserts! (is-approver contract-caller) ERR_UNAUTHORIZED)
    (as-contract (try! (contract-call? targetToken update-coinbase-thresholds threshold1 threshold2 threshold3 threshold4 threshold5)))
    (as-contract (try! (contract-call? targetCore update-coinbase-thresholds)))
    (as-contract (mark-job-as-executed jobId))
  )
)

;; COINBASE AMOUNTS (REWARDS)

(define-public (update-coinbase-amounts (targetCore <coreTraitV2>) (targetToken <tokenTraitV2>) (amountBonus uint) (amount1 uint) (amount2 uint) (amount3 uint) (amount4 uint) (amount5 uint) (amountDefault uint))
  (begin
    (asserts! (is-authorized-city) ERR_UNAUTHORIZED)
    ;; update in token contract
    (as-contract (try! (contract-call? targetToken update-coinbase-amounts amountBonus amount1 amount2 amount3 amount4 amount5 amountDefault)))
    ;; update core contract based on token contract
    (as-contract (try! (contract-call? targetCore update-coinbase-amounts)))
    (ok true)
  )
)

(define-public (execute-update-coinbase-amounts-job (jobId uint) (targetCore <coreTraitV2>) (targetToken <tokenTraitV2>))
  (let
    (
      (amountBonus (unwrap! (get-uint-value-by-name jobId "amountBonus") ERR_UNKNOWN_ARGUMENT))
      (amount1 (unwrap! (get-uint-value-by-name jobId "amount1") ERR_UNKNOWN_ARGUMENT))
      (amount2 (unwrap! (get-uint-value-by-name jobId "amount2") ERR_UNKNOWN_ARGUMENT))
      (amount3 (unwrap! (get-uint-value-by-name jobId "amount3") ERR_UNKNOWN_ARGUMENT))
      (amount4 (unwrap! (get-uint-value-by-name jobId "amount4") ERR_UNKNOWN_ARGUMENT))
      (amount5 (unwrap! (get-uint-value-by-name jobId "amount5") ERR_UNKNOWN_ARGUMENT))
      (amountDefault (unwrap! (get-uint-value-by-name jobId "amountDefault") ERR_UNKNOWN_ARGUMENT))
    )
    (asserts! (is-approver contract-caller) ERR_UNAUTHORIZED)
    (as-contract (try! (contract-call? targetToken update-coinbase-amounts amountBonus amount1 amount2 amount3 amount4 amount5 amountDefault)))
    (as-contract (try! (contract-call? targetCore update-coinbase-amounts)))
    (as-contract (mark-job-as-executed jobId))
  )
)

;; APPROVERS MANAGEMENT

(define-public (execute-replace-approver-job (jobId uint))
  (let
    (
      (oldApprover (unwrap! (get-principal-value-by-name jobId "oldApprover") ERR_UNKNOWN_ARGUMENT))
      (newApprover (unwrap! (get-principal-value-by-name jobId "newApprover") ERR_UNKNOWN_ARGUMENT))
    )
    (asserts! (is-approver contract-caller) ERR_UNAUTHORIZED)
    (map-set Approvers oldApprover false)
    (map-set Approvers newApprover true)
    (as-contract (mark-job-as-executed jobId))
  )
)

;; CONTRACT INITIALIZATION

(map-insert Approvers 'SP372JVX6EWE2M0XPA84MWZYRRG2M6CAC4VVC12V1 true)
(map-insert Approvers 'SP2R0DQYR7XHD161SH2GK49QRP1YSV7HE9JSG7W6G true)
(map-insert Approvers 'SPN4Y5QPGQA8882ZXW90ADC2DHYXMSTN8VAR8C3X true)
(map-insert Approvers 'SP3YYGCGX1B62CYAH4QX7PQE63YXG7RDTXD8BQHJQ true)
(map-insert Approvers 'SP7DGES13508FHRWS1FB0J3SZA326FP6QRMB6JDE true)
