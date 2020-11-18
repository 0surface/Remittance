const Remittance = artifacts.require("Remittance");
const truffleAssertions = require("truffle-assertions");
const chai = require("chai");
const { assert } = chai;

contract("Remittance", (accounts) => {
  before(async () => {
    it("TestRPC must have adequate number of addresses", () => {
      assert.isAtLeast(accounts.length, 3, "Test has enough addresses");
    });
  });

  let remittance;
  const deployer = accounts[0];
  const sender = accounts[1];
  const remitter = accounts[2];
  const _sent = 20;
  const _depositLockDuration = 86400;
  const gas = 1000000;
  const receiverPassword = "abcdef";
  const _randomremitKey = "0x72631ef6a9de404af013211acf2bec80a2d1c9c0b799846fea429a55bf864ee8";
  let pauseTxObj = {};

  describe("pause/unpause tests", () => {
    it("revert when unpause is called after deployment", async () => {
      remittance = await Remittance.new({ from: deployer });
      await truffleAssertions.reverts(remittance.contract.methods.unpause().send({ from: deployer }), "Contract is not paused");
    });

    beforeEach("deploy a fresh contract", async () => {
      remittance = await Remittance.new({ from: deployer });
      pauseTxObj = await remittance.contract.methods.pause().send({ from: deployer });
    });

    it("should emit pause event when paused", async () => {
      assert.isDefined(pauseTxObj.events.LogContractPaused, "pause event not emitted");
      assert.isTrue(pauseTxObj.events.LogContractPaused.event === "LogContractPaused", "correct event not emitted");
    });

    it("should emit unpause event when unpaused", async () => {
      const unpauseTxObj = await remittance.contract.methods.unpause().send({ from: deployer });
      assert.isDefined(unpauseTxObj.events.LogContractUnpaused, "unpause event not emitted");
      assert.isTrue(unpauseTxObj.events.LogContractUnpaused.event === "LogContractUnpaused", "correct event not emitted");
    });

    it("revert when deposit is called", async () => {
      await truffleAssertions.reverts(
        remittance.contract.methods.deposit(_randomremitKey, _depositLockDuration).send({ from: sender, value: _sent }),
        "Contract is paused"
      );
    });

    it("should allow deposits after being unpaused", async () => {
      await remittance.contract.methods.unpause().send({ from: deployer });

      const txObj = await remittance.contract.methods
        .deposit(_randomremitKey, _depositLockDuration)
        .send({ from: sender, value: _sent, gas: gas });

      assert.isDefined(txObj.events.LogDeposited, "depoist disabled after contract is unpaused");
    });

    it("revert when withdraw is called when paused after deposit", async () => {
      await remittance.contract.methods.unpause().send({ from: deployer });

      const txObj = await remittance.contract.methods
        .deposit(_randomremitKey, _depositLockDuration)
        .send({ from: sender, value: _sent, gas: gas });

      await remittance.contract.methods.pause().send({ from: deployer });

      await truffleAssertions.reverts(
        remittance.contract.methods.withdraw(receiverPassword).send({ from: remitter, value: 0 }),
        "Contract is paused"
      );
    });

    it("should allow withdrawals after being unpaused", async () => {
      //Arrange
      await remittance.contract.methods.unpause().send({ from: deployer });
      const expectedRemitKey = web3.utils.soliditySha3(
        { type: "string", value: receiverPassword },
        { type: "address", value: remitter }
      );
      const depositTxObj = await remittance.contract.methods
        .deposit(expectedRemitKey, _depositLockDuration)
        .send({ from: sender, value: _sent, gas: gas });
      assert.isDefined(depositTxObj, "deposit function did not get mined/execute");

      //Act
      const withdrawTxObj = await remittance.contract.methods.withdraw(receiverPassword).send({ from: remitter, value: 0 });

      //Assert
      assert.isDefined(withdrawTxObj.events.LogWithdrawal, "withdraw disabled after contract is unpaused");
    });
  });
});
