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
  const _randomRemitKey = "0x72631ef6a9de404af013211acf2bec80a2d1c9c0b799846fea429a55bf864ee8";
  const _randomSecretHash = "0xaf01329a52180a2d1c9726311ac4c0b79f2becef6a9de4bf864ee809846fea45";
  const _randomRefundSecret = "0x6311ac4c0b7946fea45f2becef6a9de4baf01329a52180a2d1c972f864ee8098";
  const _nullHash = "0x0000000000000000000000000000000000000000000000000000000000000000";

  describe("deposit tests", () => {
    beforeEach("deploy a fresh contract", async () => {
      remittance = await Remittance.new({ from: deployer });
    });

    it("should emit an event  with correct arguments", async () => {
      const _deposited = 25;
      const depositTxObj = await remittance.contract.methods
        .deposit(_randomSecretHash, _randomRemitKey, _randomRefundSecret)
        .send({ from: sender, value: _deposited, gas: gas });

      const eventObj = depositTxObj.events.LogDeposited;
      assert.isDefined(eventObj, "event not emitted");
      assert.isTrue(eventObj.event === "LogDeposited", "correct event not emitted");

      const eventArgs = eventObj.returnValues;
      assert.isTrue(eventArgs.depositor === sender, "LogDeposited event depositor argument is incorrect");
      assert.isTrue(eventArgs.deposited === _deposited.toString(), "LogDeposited event deposited argument is incorrect");
      assert.isTrue(eventArgs.secret === _randomSecretHash, "LogDeposited event secret argument is incorrect");
      assert.isTrue(eventArgs.key === _randomRemitKey, "LogDeposited event key argument is incorrect");
    });

    it("should record sent amount as owed in storage", async () => {
      const expectedAmount = new BN(_sent);
      const expectedSecret = _randomSecretHash;

      const remitBefore = await remittance.ledger.call(_randomRemitKey);
      await remittance.contract.methods
        .deposit(_randomSecretHash, _randomRemitKey, _randomRefundSecret)
        .send({ from: sender, value: _sent, gas: gas });

      const remitAfter = await remittance.ledger.call(_randomRemitKey);
      const actual = remitAfter.amount.sub(remitBefore.amount);

      expect(actual).to.be.a.bignumber.that.equals(expectedAmount);
      expect(_randomSecretHash).equals(expectedSecret);
    });

    it("should revert if given null secret hash", async () => {
      await truffleAssert.reverts(
        remittance.contract.methods.deposit(_nullHash, _randomRemitKey, _randomRefundSecret).send({ from: sender, value: 10 }),
        "Invalid withdrawSecret value"
      );
    });

    it("should revert if given null remitkey", async () => {
      await truffleAssert.reverts(
        remittance.contract.methods.deposit(_randomSecretHash, _nullHash, _randomRefundSecret).send({ from: sender, value: 10 }),
        "Invalid remitKey value"
      );
    });

    it("should revert if given null refund Secret", async () => {
      await truffleAssert.reverts(
        remittance.contract.methods.deposit(_randomSecretHash, _randomRemitKey, _nullHash).send({ from: sender, value: 10 }),
        "Invalid refundSecret value"
      );
    });

    it("should revert if sent amount is 0", async () => {
      await truffleAssert.reverts(
        remittance.contract.methods
          .deposit(_randomSecretHash, _randomRemitKey, _randomRefundSecret)
          .send({ from: sender, value: 0 }),
        "Invalid minimum amount"
      );
    });

    it("should revert if input hashes are identical", async () => {
      await truffleAssert.reverts(
        remittance.contract.methods
          .deposit(_randomSecretHash, _randomSecretHash, _randomSecretHash)
          .send({ from: sender, value: _sent, gas: gas }),
        "withdrawSecret and refundSecret can not be identical"
      );
    });
  });

  describe("active deposit denial test (in steps)", () => {
    it("should deploy contract first", async () => {
      remittance = await Remittance.new({ from: deployer });
    });

    const receiverPassword = "abcdef";
    let _remitKey_ = "";
    let _withdrawSecret_ = "";
    let _refundSecret_ = "";

    it("should generate keys", async () => {
      const secrets = await remittance.contract.methods.generateSecret(remitter, receiverPassword).call();
      _remitKey_ = secrets.remitKey;
      _withdrawSecret_ = secrets.withdrawSecret;
      _refundSecret_ = secrets.refundSecret;
    });

    it("should deposit first time", async () => {
      const depositTxObj = await remittance.contract.methods
        .deposit(_withdrawSecret_, _remitKey_, _refundSecret_)
        .send({ from: sender, value: _sent, gas: gas });

      assert.isDefined(depositTxObj, "deposit transaction did not get mined/executed");
    });

    it("should revert when given an active deposit key", async () => {
      await truffleAssert.reverts(
        remittance.contract.methods
          .deposit(_withdrawSecret_, _remitKey_, _refundSecret_)
          .send({ from: sender, value: _sent, gas: gas }),
        "Invalid, remit Key has an active deposit"
      );
    });
  });
});
