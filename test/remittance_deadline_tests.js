const Remittance = artifacts.require("Remittance");
const truffleAssertions = require("truffle-assertions");
const chai = require("chai");
const { BN } = web3.utils.BN;
chai.use(require("chai-bn")(BN));
const { assert, expect } = chai;

contract("Remittance", (accounts) => {
  before(async () => {
    it("TestRPC must have adequate number of addresses", () => {
      assert.isAtLeast(accounts.length, 2, "Test has enough addresses");
    });
  });

  let remittance;
  const deployer = accounts[0];
  const notOwner = accounts[1];

  describe("deadline value setting tests", () => {
    beforeEach("deploy a fresh contract", async () => {
      remittance = await Remittance.new({ from: deployer });
    });

    it("should have 432000 (5 days) by default", async () => {
      const defaultDeadline = await remittance.lockDuration.call();
      const expectedDefaultDeadline = new BN(defaultDeadline);
      expect(defaultDeadline).to.be.a.bignumber.that.equals(expectedDefaultDeadline);
    });

    it("should revert if called other than contract owner", async () => {
      await truffleAssertions.reverts(
        remittance.contract.methods.setLockDuration(600).send({ from: notOwner }),
        "Caller is not owner"
      );
    });

    it("should revert when contrat is paused", async () => {
      pauseTxObj = await remittance.contract.methods.pause().send({ from: deployer });
      assert.isDefined(pauseTxObj.events.LogContractPaused, "pause event not emitted");

      await truffleAssertions.reverts(
        remittance.contract.methods.setLockDuration(600).send({ from: deployer }),
        "Contract is paused"
      );
    });

    it("should revert when given invalid minumum value", async () => {
      await truffleAssertions.reverts(
        remittance.contract.methods.setLockDuration(0).send({ from: deployer }),
        "Invalid minumum lock duration"
      );
    });

    it("should revert when given invalid maximum value", async () => {
      await truffleAssertions.reverts(
        remittance.contract.methods.setLockDuration(31536000001).send({ from: deployer }),
        "Invalid maximum lock duration"
      );
    });

    it("should emit event with correct arguments", async () => {
      const newDuration = 360000;
      const oldDuration = await remittance.lockDuration.call();

      const txObj = await remittance.contract.methods.setLockDuration(newDuration).send({ from: deployer });
      const eventObj = txObj.events.LogLockDurationSet;

      assert.isDefined(eventObj, "event not emitted");
      assert.isTrue(eventObj.event === "LogLockDurationSet", "correct event not emitted");
      assert.isTrue(eventObj.returnValues.owner === deployer, "event owner argument is incorrect");
      assert.isTrue(eventObj.returnValues.oldDuration === oldDuration.toString(), "event oldDuration argument is incorrect");
      assert.isTrue(eventObj.returnValues.newDuration === newDuration.toString(), "event newDuration argument is incorrect");
    });

    it("should set value correctly", async () => {
      const newDuration = 360000;
      const expectedValue = new BN(newDuration);
      const beforeDuration = await remittance.lockDuration.call();
      const beforeValue = new BN(beforeDuration);

      const txObj = await remittance.contract.methods.setLockDuration(newDuration).send({ from: deployer });
      assert.isDefined(txObj, "Transaction did not get mined/executed");
      const afterDuration = await remittance.lockDuration.call();
      const afterValue = new BN(afterDuration);

      assert.notEqual(beforeValue, afterValue, "value has not changed");
      expect(afterValue).to.be.a.bignumber.that.equals(expectedValue);
    });
  });
});
