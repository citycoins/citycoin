;; MIAMICOIN AUTH CONTRACT

(define-constant CONTRACT_OWNER tx-sender)

;; TRAIT DEFINITIONS

(use-trait coreTrait 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.citycoin-core-trait.citycoin-core)
(use-trait tokenTrait 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.citycoin-token-trait.citycoin-token)

;; ERRORS

(define-constant ERR_UNKNOWN_JOB u6000)
(define-constant ERR_UNAUTHORIZED u6001)
(define-constant ERR_JOB_IS_ACTIVE u6002)
(define-constant ERR_JOB_IS_NOT_ACTIVE u6003)
(define-constant ERR_ALREADY_VOTED_THIS_WAY u6004)
(define-constant ERR_JOB_IS_EXECUTED u6005)
(define-constant ERR_JOB_IS_NOT_APPROVED u6006)
(define-constant ERR_ARGUMENT_ALREADY_EXISTS u6007)
(define-constant ERR_NO_ACTIVE_CORE_CONTRACT u6008)
(define-constant ERR_CORE_CONTRACT_NOT_FOUND u6009)
(define-constant ERR_UNKNOWN_ARGUMENT u6010)

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
    (asserts! (is-approver tx-sender) (err ERR_UNAUTHORIZED))
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
      (job (unwrap! (get-job jobId) (err ERR_UNKNOWN_JOB)))
    )
    (asserts! (is-eq (get creator job) tx-sender) (err ERR_UNAUTHORIZED))
    (asserts! (not (get isActive job)) (err ERR_JOB_IS_ACTIVE))
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
      (job (unwrap! (get-job jobId) (err ERR_UNKNOWN_JOB)))
      (previousVote (map-get? JobApprovers { jobId: jobId, approver: tx-sender }))
    )
    (asserts! (get isActive job) (err ERR_JOB_IS_NOT_ACTIVE))
    (asserts! (is-approver tx-sender) (err ERR_UNAUTHORIZED))
    ;; save vote
    (map-set JobApprovers
      { jobId: jobId, approver: tx-sender }
      true
    )
    (match previousVote approved
      (begin
        (asserts! (not approved) (err ERR_ALREADY_VOTED_THIS_WAY))
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
      (job (unwrap! (get-job jobId) (err ERR_UNKNOWN_JOB)))
      (previousVote (map-get? JobApprovers { jobId: jobId, approver: tx-sender }))
    )
    (asserts! (get isActive job) (err ERR_JOB_IS_NOT_ACTIVE))
    (asserts! (is-approver tx-sender) (err ERR_UNAUTHORIZED))
    ;; save vote
    (map-set JobApprovers
      { jobId: jobId, approver: tx-sender }
      false
    )
    (match previousVote approved
      (begin
        (asserts! approved (err ERR_ALREADY_VOTED_THIS_WAY))
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
      (job (unwrap! (get-job jobId) (err ERR_UNKNOWN_JOB)))
    )
    (asserts! (get isActive job) (err ERR_JOB_IS_NOT_ACTIVE))
    (asserts! (>= (get approvals job) REQUIRED_APPROVALS) (err ERR_JOB_IS_NOT_APPROVED))
    (asserts! (is-eq (get target job) contract-caller) (err ERR_UNAUTHORIZED))
    (asserts! (not (get isExecuted job)) (err ERR_JOB_IS_EXECUTED))
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
      (err ERR_ARGUMENT_ALREADY_EXISTS)
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
      (err ERR_ARGUMENT_ALREADY_EXISTS)
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
      (job (unwrap! (get-job jobId) (err ERR_UNKNOWN_JOB)))
    )
    (asserts! (not (get isActive job)) (err ERR_JOB_IS_ACTIVE))
    (asserts! (is-eq (get creator job) contract-caller) (err ERR_UNAUTHORIZED))
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
    (asserts! (not (is-eq (var-get activeCoreContract) CONTRACT_OWNER)) (err ERR_NO_ACTIVE_CORE_CONTRACT))
    (ok (var-get activeCoreContract))
  )
)

;; getter for core contract map
(define-read-only (get-core-contract-info (targetContract principal))
  (let
    (
      (coreContract (unwrap! (map-get? CoreContracts targetContract) (err ERR_CORE_CONTRACT_NOT_FOUND)))
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
(define-public (initialize-contracts (coreContract <coreTrait>))
  (let
    (
      (coreContractAddress (contract-of coreContract))
    )
    (asserts! (is-eq contract-caller CONTRACT_OWNER) (err ERR_UNAUTHORIZED))
    (asserts! (not (var-get initialized)) (err ERR_UNAUTHORIZED))
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
;; - set active in core contract map
;; - set as activeCoreContract
(define-public (activate-core-contract (targetContract principal) (stacksHeight uint))
  (let
    (
      (coreContract (unwrap! (map-get? CoreContracts targetContract) (err ERR_CORE_CONTRACT_NOT_FOUND)))
    )
    (asserts! (is-eq contract-caller targetContract) (err ERR_UNAUTHORIZED))
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
(define-public (upgrade-core-contract (oldContract <coreTrait>) (newContract <coreTrait>))
  (let
    (
      (oldContractAddress (contract-of oldContract))
      (oldContractMap (unwrap! (map-get? CoreContracts oldContractAddress) (err ERR_CORE_CONTRACT_NOT_FOUND)))
      (newContractAddress (contract-of newContract))
    )
    (asserts! (not (is-eq oldContractAddress newContractAddress)) (err ERR_UNAUTHORIZED))
    (asserts! (is-authorized-city) (err ERR_UNAUTHORIZED))
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

(define-public (execute-upgrade-core-contract-job (jobId uint) (oldContract <coreTrait>) (newContract <coreTrait>))
  (let
    (
      (oldContractArg (unwrap! (get-principal-value-by-name jobId "oldContract") (err ERR_UNKNOWN_ARGUMENT)))
      (newContractArg (unwrap! (get-principal-value-by-name jobId "newContract") (err ERR_UNKNOWN_ARGUMENT)))
      (oldContractAddress (contract-of oldContract))
      (oldContractMap (unwrap! (map-get? CoreContracts oldContractAddress) (err ERR_CORE_CONTRACT_NOT_FOUND)))
      (newContractAddress (contract-of newContract))
    )
    (asserts! (is-approver contract-caller) (err ERR_UNAUTHORIZED))
    (asserts! (and (is-eq oldContractArg oldContractAddress) (is-eq newContractArg newContractAddress)) (err ERR_UNAUTHORIZED))
    (asserts! (not (is-eq oldContractAddress newContractAddress)) (err ERR_UNAUTHORIZED))
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
(define-data-var cityWallet principal 'SM2MARAVW6BEJCD13YV2RHGYHQWT7TDDNMNRB1MVT)

;; returns city wallet principal
(define-read-only (get-city-wallet)
  (ok (var-get cityWallet))
)
 
;; protected function to update city wallet variable
(define-public (set-city-wallet (targetContract <coreTrait>) (newCityWallet principal))
  (let
    (
      (coreContractAddress (contract-of targetContract))
      (coreContract (unwrap! (map-get? CoreContracts coreContractAddress) (err ERR_CORE_CONTRACT_NOT_FOUND)))
    )
    (asserts! (is-authorized-city) (err ERR_UNAUTHORIZED))
    (asserts! (is-eq coreContractAddress (var-get activeCoreContract)) (err ERR_UNAUTHORIZED))
    (var-set cityWallet newCityWallet)
    (try! (contract-call? targetContract set-city-wallet newCityWallet))
    (ok true)
  )
)

(define-public (execute-set-city-wallet-job (jobId uint) (targetContract <coreTrait>))
  (let
    (
      (coreContractAddress (contract-of targetContract))
      (coreContract (unwrap! (map-get? CoreContracts coreContractAddress) (err ERR_CORE_CONTRACT_NOT_FOUND)))
      (newCityWallet (unwrap! (get-principal-value-by-name jobId "newCityWallet") (err ERR_UNKNOWN_ARGUMENT)))
    )
    (asserts! (is-approver contract-caller) (err ERR_UNAUTHORIZED))
    (asserts! (is-eq coreContractAddress (var-get activeCoreContract)) (err ERR_UNAUTHORIZED))
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

(define-public (set-token-uri (targetContract <tokenTrait>) (newUri (optional (string-utf8 256))))
  (begin
    (asserts! (is-authorized-city) (err ERR_UNAUTHORIZED))
    (as-contract (try! (contract-call? targetContract set-token-uri newUri)))
    (ok true)
  )
)

;; APPROVERS MANAGEMENT

(define-public (execute-replace-approver-job (jobId uint))
  (let
    (
      (oldApprover (unwrap! (get-principal-value-by-name jobId "oldApprover") (err ERR_UNKNOWN_ARGUMENT)))
      (newApprover (unwrap! (get-principal-value-by-name jobId "newApprover") (err ERR_UNKNOWN_ARGUMENT)))
    )
    (asserts! (is-approver contract-caller) (err ERR_UNAUTHORIZED))
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
