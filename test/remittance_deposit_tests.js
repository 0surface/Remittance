const Remittance = artifacts.require("Remittance");
const truffleAssert = require("truffle-assertions");
const chai = require("chai");
const { assert, expect } = chai;

const { BN } = web3.utils.BN;
chai.use(require("chai-bn")(BN));

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
  const gas = 4000000;
  const _depositLockDuration = 86400;
  const _randomRemitKey = "0x72631ef6a9de404af013211acf2bec80a2d1c9c0b799846fea429a55bf864ee8";
  const _nullHash = "0x0000000000000000000000000000000000000000000000000000000000000000";

  describe("deposit tests", () => {
    beforeEach("deploy a fresh contract", async () => {
      remittance = await Remittance.new({ from: deployer });
    });

    it("should emit an event  with correct arguments", async () => {
      const depositTxObj = await remittance.contract.methods
        .deposit(_randomRemitKey, _depositLockDuration)
        .send({ from: sender, value: _sent, gas: gas });

      var depositBlock = await web3.eth.getBlock(depositTxObj.blockNumber);
      const expectedDeadline = depositBlock.timestamp + _depositLockDuration;

      const eventObj = depositTxObj.events.LogDeposited;
      assert.isDefined(eventObj, "event not emitted");
      assert.strictEqual(eventObj.event, "LogDeposited", "correct event not emitted");

      const eventArgs = eventObj.returnValues;
      assert.strictEqual(eventArgs.depositor, sender, "LogDeposited event depositor argument is incorrect");
      assert.strictEqual(eventArgs.deposited, _sent.toString(), "LogDeposited event deposited argument is incorrect");
      assert.strictEqual(eventArgs.key, _randomRemitKey, "LogDeposited event key argument is incorrect");

      assert.strictEqual(
        parseInt(eventArgs.withdrawalDeadline),
        expectedDeadline,
        "LogDeposited event withdrawalDeadline argument is incorrect"
      );
    });

    it("should record sent amount as owed in storage", async () => {
      const expectedAmount = new BN(_sent);
      const remitBefore = await remittance.ledger.call(_randomRemitKey);

      await remittance.contract.methods
        .deposit(_randomRemitKey, _depositLockDuration)
        .send({ from: sender, value: _sent, gas: gas });
      const remitAfter = await remittance.ledger.call(_randomRemitKey);
      const actualAmount = remitAfter.amount.sub(remitBefore.amount);

      expect(actualAmount).to.be.a.bignumber.that.equals(expectedAmount);
      expect(sender).to.equal(remitAfter.depositor);
    });

    it("should revert if given null remitkey", async () => {
      await truffleAssert.reverts(
        remittance.contract.methods.deposit(_nullHash, _depositLockDuration).send({ from: sender, value: _sent }),
        "Invalid remitKey value"
      );
    });

    it("should revert if deposit amount is 0", async () => {
      await truffleAssert.reverts(
        remittance.contract.methods.deposit(_randomRemitKey, _depositLockDuration).send({ from: sender, value: 0 }),
        "Invalid minimum deposit amount"
      );
    });

    it("should revert if deposit lock duration is 0", async () => {
      const minValue = await remittance.MIN_DURATION.call();
      await truffleAssert.reverts(
        remittance.contract.methods.deposit(_randomRemitKey, minValue).send({ from: sender, value: _sent }),
        "Invalid minumum lock duration"
      );
    });

    it("should revert if deposit lock duration is above maximum allowed", async () => {
      const maxValue = await remittance.MAX_DURATION.call();
      const aboveMaxValue = maxValue + 1;
      await truffleAssert.reverts(
        remittance.contract.methods.deposit(_randomRemitKey, aboveMaxValue).send({ from: sender, value: _sent }),
        "Invalid maximum lock duration"
      );
    });

    it("should revert when given an active deposit key", async () => {
      remittance.contract.methods.deposit(_randomRemitKey, _depositLockDuration).send({ from: sender, value: _sent });

      await truffleAssert.reverts(
        remittance.contract.methods.deposit(_randomRemitKey, _depositLockDuration).send({ from: sender, value: _sent, gas: gas }),
        "Invalid, remit Key has an active deposit"
      );
    });
  });

  describe("deposit with active/passowrd reuse denial test (in steps)", () => {
    it("should deploy contract first", async () => {
      remittance = await Remittance.new({ from: deployer });
    });

    const receiverPassword = web3.utils.fromAscii("abcdef");
    let _key_1 = "";

    it("should generate key", async () => {
      _key_1 = await remittance.contract.methods.generateKey(remitter, receiverPassword).call();
    });

    it("should deposit first time", async () => {
      const depositTxObj = await remittance.contract.methods
        .deposit(_key_1, _depositLockDuration)
        .send({ from: sender, value: _sent });

      assert.isDefined(depositTxObj, "deposit transaction did not get mined/executed");
    });

    it("should withdraw first deposit", async () => {
      const withdrawTxObj = await remittance.contract.methods
        .withdraw(receiverPassword)
        .send({ from: remitter, value: 0, gas: gas });
      assert.isDefined(withdrawTxObj, "withdraw function did not get mined/execute");
    });

    it("should revert when given an active deposit key", async () => {
      await truffleAssert.reverts(
        remittance.contract.methods.deposit(_key_1, _depositLockDuration).send({ from: sender, value: _sent, gas: gas }),
        "Invalid, Password has previously been used"
      );
    });
  });
});
