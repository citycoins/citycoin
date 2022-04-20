import { assertEquals, describe, types, run, Chain, beforeEach, it} from "../../deps.ts";
import { AuthModel } from "../../models/auth.model.ts";
import { CoreModel } from "../../models/core.model.ts";
import { Accounts, Context } from "../../src/context.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let core: CoreModel;
let core2: CoreModel;
let core3: CoreModel;
let auth: AuthModel;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  auth = ctx.models.get(AuthModel);
  core = ctx.models.get(CoreModel, "citycoin-core-v1");
  core2 = ctx.models.get(CoreModel, "citycoin-core-v2");
  core3 = ctx.models.get(CoreModel, "citycoin-core-v3");
})

describe("[CityCoin Auth]", () => {
  //////////////////////////////////////////////////
  // CONTRACT MANAGEMENT
  //////////////////////////////////////////////////
  describe("CONTRACT MANAGEMENT", () => {
    describe("get-active-core-contract()", () => {
      it("fails with ERR_NO_ACTIVE_CORE_CONTRACT if auth contract is not initialized", () => {
        // act
        const result = auth.getActiveCoreContract().result;

        // assert
        result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_NO_ACTIVE_CORE_CONTRACT);
      });
      it("succeeds and returns active core contract after auth contract is initialized", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const target = core.address;
        chain.mineBlock([auth.testSetActiveCoreContract(sender)]);

        // act
        const result = auth.getActiveCoreContract().result;

        // assert
        result.expectOk().expectPrincipal(target);
      });
    });

    describe("initialize-contracts()", () => {
      it("fails with ERR_UNAUTHORIZED if not called by CONTRACT_OWNER", () => {
        // arrange
        const sender = accounts.get("wallet_2")!;
        const target = core.address;

        // act
        const receipt = chain.mineBlock([
          auth.initializeContracts(target, sender),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNAUTHORIZED);
      });

      it("fails with ERR_UNAUTHORIZED if auth contract is already initialized", () => {
        // arrange
        const sender = accounts.get("deployer")!;
        const target = core.address;

        // act
        chain.mineBlock([auth.initializeContracts(target, sender)]);

        const receipt = chain.mineBlock([
          auth.initializeContracts(target, sender),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNAUTHORIZED);
      });

      it("throws ERR_INCORRECT_CONTRACT_STATE if new contract is not in STATE_DEPLOYED", () => {
        // arrange
        const sender = accounts.get("city_wallet")!;
        const contract = core.address;

        chain.mineBlock([
          core.testInitializeCore(contract),
          core.testSetActivationThreshold(1),
          core.registerUser(sender),
        ]);

        // act
        const testActive = chain.mineBlock([
          auth.testSetCoreContractState(contract, AuthModel.ContractState.STATE_ACTIVE, sender),
        ]);
        const receiptActive = chain.mineBlock([
          auth.activateCoreContract(contract, testActive.height, sender)
        ]).receipts[0];

        const testInactive = chain.mineBlock([
          auth.testSetCoreContractState(contract, AuthModel.ContractState.STATE_INACTIVE, sender),
        ]);
        const receiptInactive = chain.mineBlock([
          auth.activateCoreContract(contract, testInactive.height, sender)
        ]).receipts[0];

        // assert
        receiptActive.result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_INCORRECT_CONTRACT_STATE);

        receiptInactive.result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_INCORRECT_CONTRACT_STATE);
      });

      it("succeeds and updates core contract map", () => {
        // arrange
        const sender = accounts.get("deployer")!;
        const target = core.address;

        // act
        const receipt = chain.mineBlock([
          auth.initializeContracts(target, sender),
        ]).receipts[0];

        const result = auth.getCoreContractInfo(target).result;

        // assert
        receipt.result.expectOk();

        const expectedContractData = {
          state: types.uint(AuthModel.ContractState.STATE_DEPLOYED),
          startHeight: types.uint(0),
          endHeight: types.uint(0),
        };

        const actualContractData = result.expectOk().expectTuple();

        assertEquals(actualContractData, expectedContractData);
      });
    });

    describe("upgrade-core-contract()", () => {
      it("fails with ERR_CORE_CONTRACT_NOT_FOUND if principal not found in core contracts map", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const oldContract = core.address;
        const newContract = core.address;

        // act
        const receipt = chain.mineBlock([
          auth.upgradeCoreContract(oldContract, newContract, sender),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_CORE_CONTRACT_NOT_FOUND);
      });

      it("throws ERR_CONTRACT_ALREADY_EXISTS if old and new contract are the same", () => {
        // arrange
        const sender = accounts.get("city_wallet")!;
        const oldContract = core.address;
        const newContract = core.address;

        chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(sender),
        ]);

        // act
        const receipt = chain.mineBlock([
          auth.upgradeCoreContract(oldContract, newContract, sender),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_CONTRACT_ALREADY_EXISTS);
      });
      it("throws ERR_CONTRACT_ALREADY_EXISTS if called with a target contract already in core contracts map", () => {
        // arrange
        const sender = accounts.get("city_wallet")!;
        const oldContract = core.address;
        const newContract = core2.address;

        chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(sender),
          auth.testSetCoreContractState(newContract, AuthModel.ContractState.STATE_INACTIVE, sender),
        ]);

        // act
        const receipt = chain.mineBlock([
          auth.upgradeCoreContract(oldContract, newContract, sender),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_CONTRACT_ALREADY_EXISTS);
      });
      it("fails with ERR_UNAUTHORIZED if not called by city wallet", () => {
        // arrange
        const sender = accounts.get("wallet_1")!;
        const oldContract = core.address;
        const newContract = core2.address;

        chain.mineBlock([
          core.testInitializeCore(core.address),
          core.testSetActivationThreshold(1),
          core.registerUser(sender),
        ]);

        // act
        const receipt = chain.mineBlock([
          auth.upgradeCoreContract(oldContract, newContract, sender),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNAUTHORIZED);
      });
      it("succeeds and updates core contract map and active variable", () => {
        // arrange
        const sender = accounts.get("city_wallet")!;
        const oldContract = core.address;
        const newContract = core2.address;

        chain.mineBlock([
          core.testInitializeCore(oldContract),
          core.testSetActivationThreshold(1),
          core.registerUser(sender),
        ]);

        // act
        const blockUpgrade = chain.mineBlock([
          auth.upgradeCoreContract(oldContract, newContract, sender),
        ]);

        // act
        const activeContract = auth.getActiveCoreContract().result;
        const oldContractData =
          auth.getCoreContractInfo(oldContract).result;
        const newContractData =
          auth.getCoreContractInfo(newContract).result;

        // assert
        blockUpgrade.receipts[0].result.expectOk();

        activeContract.expectOk().expectPrincipal(newContract);

        // TODO: why the +1 and -1 here ??
        const expectedOldContractData = {
          state: types.uint(AuthModel.ContractState.STATE_INACTIVE),
          startHeight: types.uint(CoreModel.ACTIVATION_DELAY + 1),
          endHeight: types.uint(blockUpgrade.height - 1),
        };
        const expectedNewContractData = {
          state: types.uint(AuthModel.ContractState.STATE_DEPLOYED),
          startHeight: types.uint(0),
          endHeight: types.uint(0),
        };
        const actualOldContractData = oldContractData.expectOk().expectTuple();
        const actualNewContractData = newContractData.expectOk().expectTuple();

        assertEquals(actualOldContractData, expectedOldContractData);
        assertEquals(actualNewContractData, expectedNewContractData);
      });
    });

    describe("execute-upgrade-core-contract-job()", () => {
      it("throws ERR_UNAUTHORIZED if contract-caller is not an approver", () => {
        // arrange
        const jobId = 1;
        const sender = accounts.get("wallet_1")!;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const approver3 = accounts.get("wallet_4")!;
        const invalidApprover = accounts.get("wallet_6")!;
        const oldContract = core.address;
        const newContract = core2.address;

        chain.mineBlock([
          core.testInitializeCore(oldContract),
          core.testSetActivationThreshold(1),
          core.registerUser(sender),
          auth.createJob(
            "upgrade core",
            auth.address,
            sender
          ),
          auth.addPrincipalArgument(
            jobId,
            "oldContract",
            oldContract,
            sender
          ),
          auth.addPrincipalArgument(
            jobId,
            "newContract",
            newContract,
            sender
          ),
          auth.activateJob(jobId, sender),
          auth.approveJob(jobId, approver1),
          auth.approveJob(jobId, approver2),
          auth.approveJob(jobId, approver3),
        ]);

        // act
        const blockUpgrade = chain.mineBlock([
          auth.executeUpgradeCoreContractJob(
            jobId,
            oldContract,
            newContract,
            invalidApprover
          ),
        ]);

        // assert
        blockUpgrade.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNAUTHORIZED);
      });

      it("throws ERR_UNAUTHORIZED if submitted trait principal does not match job principal", () => {
        // arrange
        const jobId = 1;
        const sender = accounts.get("wallet_1")!;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const approver3 = accounts.get("wallet_4")!;
        const oldContract = core.address;
        const newContract = core2.address;
        const invalidContract = core3.address;

        chain.mineBlock([
          core.testInitializeCore(oldContract),
          core.testSetActivationThreshold(1),
          core.registerUser(sender),
          auth.createJob(
            "upgrade core",
            auth.address,
            sender
          ),
          auth.addPrincipalArgument(
            jobId,
            "oldContract",
            oldContract,
            sender
          ),
          auth.addPrincipalArgument(
            jobId,
            "newContract",
            newContract,
            sender
          ),
          auth.activateJob(jobId, sender),
          auth.approveJob(jobId, approver1),
          auth.approveJob(jobId, approver2),
          auth.approveJob(jobId, approver3),
        ]);

        // act
        const blockUpgrade = chain.mineBlock([
          auth.executeUpgradeCoreContractJob(
            jobId,
            oldContract,
            invalidContract,
            sender
          ),
        ]);

        // assert
        blockUpgrade.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_UNAUTHORIZED);
      });

      it("throws ERR_CONTRACT_ALREADY_EXISTS if old and new contract are the same", () => {
        // arrange
        const jobId = 1;
        const sender = accounts.get("wallet_1")!;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const approver3 = accounts.get("wallet_4")!;
        const oldContract = core.address;

        chain.mineBlock([
          core.testInitializeCore(oldContract),
          core.testSetActivationThreshold(1),
          core.registerUser(sender),
          auth.createJob(
            "upgrade core",
            auth.address,
            sender
          ),
          auth.addPrincipalArgument(
            jobId,
            "oldContract",
            oldContract,
            sender
          ),
          auth.addPrincipalArgument(
            jobId,
            "newContract",
            oldContract,
            sender
          ),
          auth.activateJob(jobId, sender),
          auth.approveJob(jobId, approver1),
          auth.approveJob(jobId, approver2),
          auth.approveJob(jobId, approver3),
        ]);

        // act
        const blockUpgrade = chain.mineBlock([
          auth.executeUpgradeCoreContractJob(
            jobId,
            oldContract,
            oldContract,
            sender
          ),
        ]);

        // assert
        blockUpgrade.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_CONTRACT_ALREADY_EXISTS);
      });

      it("throws ERR_CONTRACT_ALREADY_EXISTS if called with a target contract already in core contracts map", () => {
        // arrange
        const jobId = 1;
        const sender = accounts.get("wallet_1")!;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const approver3 = accounts.get("wallet_4")!;
        const oldContract = core.address;
        const newContract = core2.address;

        chain.mineBlock([
          core.testInitializeCore(oldContract),
          core.testSetActivationThreshold(1),
          core.registerUser(sender),
          auth.testSetCoreContractState(newContract, AuthModel.ContractState.STATE_INACTIVE, sender),
          auth.createJob(
            "upgrade core",
            auth.address,
            sender
          ),
          auth.addPrincipalArgument(
            jobId,
            "oldContract",
            oldContract,
            sender
          ),
          auth.addPrincipalArgument(
            jobId,
            "newContract",
            newContract,
            sender
          ),
          auth.activateJob(jobId, sender),
          auth.approveJob(jobId, approver1),
          auth.approveJob(jobId, approver2),
          auth.approveJob(jobId, approver3),
        ]);

        // act
        const blockUpgrade = chain.mineBlock([
          auth.executeUpgradeCoreContractJob(
            jobId,
            oldContract,
            newContract,
            sender
          ),
        ]);

        // assert
        blockUpgrade.receipts[0].result
          .expectErr()
          .expectUint(AuthModel.ErrCode.ERR_CONTRACT_ALREADY_EXISTS);
      });

      it("succeeds and updates core contract map and active variable", () => {
        // arrange
        const jobId = 1;
        const sender = accounts.get("wallet_1")!;
        const approver1 = accounts.get("wallet_2")!;
        const approver2 = accounts.get("wallet_3")!;
        const approver3 = accounts.get("wallet_4")!;
        const oldContract = core.address;
        const newContract = core2.address;

        chain.mineBlock([
          core.testInitializeCore(oldContract),
          core.testSetActivationThreshold(1),
          core.registerUser(sender),
          auth.createJob(
            "upgrade core",
            auth.address,
            sender
          ),
          auth.addPrincipalArgument(
            jobId,
            "oldContract",
            oldContract,
            sender
          ),
          auth.addPrincipalArgument(
            jobId,
            "newContract",
            newContract,
            sender
          ),
          auth.activateJob(jobId, sender),
          auth.approveJob(jobId, approver1),
          auth.approveJob(jobId, approver2),
          auth.approveJob(jobId, approver3),
        ]);

        // act
        const blockUpgrade = chain.mineBlock([
          auth.executeUpgradeCoreContractJob(
            jobId,
            oldContract,
            newContract,
            sender
          ),
        ]);

        // act
        const activeContract = auth.getActiveCoreContract().result;
        const oldContractData =
          auth.getCoreContractInfo(oldContract).result;
        const newContractData =
          auth.getCoreContractInfo(newContract).result;

        // assert
        blockUpgrade.receipts[0].result.expectOk();

        activeContract.expectOk().expectPrincipal(newContract);

        // TODO: why the +1 and -1 here ??
        const expectedOldContractData = {
          state: types.uint(AuthModel.ContractState.STATE_INACTIVE),
          startHeight: types.uint(CoreModel.ACTIVATION_DELAY + 1),
          endHeight: types.uint(blockUpgrade.height - 1),
        };
        const expectedNewContractData = {
          state: types.uint(AuthModel.ContractState.STATE_DEPLOYED),
          startHeight: types.uint(0),
          endHeight: types.uint(0),
        };
        const actualOldContractData = oldContractData.expectOk().expectTuple();
        const actualNewContractData = newContractData.expectOk().expectTuple();

        assertEquals(actualOldContractData, expectedOldContractData);
        assertEquals(actualNewContractData, expectedNewContractData);
      });
    });
  });
});

run();
