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
  const handler = accounts[2];
  const _sent = 20;
  const handlerPassword = "123456";
  const receiverPassword = "abcdef";
  const _randomHandlerKey = "0x72631ef6a9de404af013211acf2bec80a2d1c9c0b799846fea429a55bf864ee8";
  const _randomSecretHash = "0xaf01329a52180a2d1c9726311ac4c0b79f2becef6a9de4bf864ee809846fea45";
  const expectedHandlerKey = web3.utils.soliditySha3(
    { type: "address", value: handler },
    { type: "string", value: handlerPassword }
  );
  const expectedHashedSecret = web3.utils.soliditySha3(
    { type: "bytes32", value: expectedHandlerKey },
    { type: "string", value: receiverPassword }
  );
  let pauseTxObj = {};

  beforeEach("deploy a fresh contract", async () => {
    remittance = await Remittance.new({ from: deployer });
  });

  it("should emit pause event when paused", async () => {
    pauseTxObj = await remittance.contract.methods.pause().send({ from: deployer });
    assert.isDefined(pauseTxObj.events.LogContractPaused, "pause event not emitted");

    const eventObj = pauseTxObj.events.LogContractPaused;
    assert.isDefined(eventObj, "event not emitted");
    assert.isTrue(eventObj.event === "LogContractPaused", "correct event not emitted");
  });

  it("should allow deposits after being unpaused", async () => {
    pauseTxObj = await remittance.contract.methods.pause().send({ from: deployer });
    assert.isDefined(pauseTxObj.events.LogContractPaused, "pause event not emitted");

    const unpauseTxObj = await remittance.contract.methods.unpause().send({ from: deployer });
    assert.isDefined(unpauseTxObj.events.LogContractUnpaused, "LogContractUnpaused event not emitted");

    const secrets = await remittance.contract.methods.generateSecret(handler, handlerPassword, receiverPassword).call();
    assert.strictEqual(secrets.handlerKey, expectedHandlerKey, "did not generate expected handler key");
    assert.strictEqual(secrets.hashedSecret, expectedHashedSecret, "did not generate expected hashed secret");

    const depositTxObj = await remittance.contract.methods
      .deposit(secrets.hashedSecret, secrets.handlerKey)
      .send({ from: sender, value: _sent });

    assert.isDefined(depositTxObj, "deposit function did not get mined/execute");

    const withdrawTxObj = await remittance.contract.methods
      .withdraw(handlerPassword, receiverPassword)
      .send({ from: handler, value: 0 });
    assert.isDefined(withdrawTxObj.events.LogWithdrawal, "withdraw disabled after contract is unpaused");
  });

  it("should allow withdrawals after being unpaused", async () => {
    pauseTxObj = await remittance.contract.methods.pause().send({ from: deployer });
    assert.isDefined(pauseTxObj.events.LogContractPaused, "pause event not emitted");
    const unpauseTxObj = await remittance.contract.methods.unpause().send({ from: deployer });
    assert.isDefined(unpauseTxObj.events.LogContractUnpaused, "LogContractUnpaused event not emitted");

    const txObj = await remittance.contract.methods
      .deposit(_randomSecretHash, _randomHandlerKey)
      .send({ from: sender, value: _sent });

    assert.isDefined(txObj.events.LogDeposited, "depoist disabled after contract is unpaused");
  });

  it("revert when deposit is called", async () => {
    pauseTxObj = await remittance.contract.methods.pause().send({ from: deployer });
    assert.isDefined(pauseTxObj.events.LogContractPaused, "pause event not emitted");

    await truffleAssertions.reverts(
      remittance.contract.methods.deposit(_randomSecretHash, _randomHandlerKey).send({ from: sender, value: _sent }),
      "Contract is paused"
    );
  });

  it("revert when withdraw is called when paused after deposit", async () => {
    const secrets = await remittance.contract.methods.generateSecret(handler, handlerPassword, receiverPassword).call();
    assert.strictEqual(secrets.handlerKey, expectedHandlerKey, "did not generate expected handler key");
    assert.strictEqual(secrets.hashedSecret, expectedHashedSecret, "did not generate expected hashed secret");

    const depositTxObj = await remittance.contract.methods
      .deposit(secrets.hashedSecret, secrets.handlerKey)
      .send({ from: sender, value: _sent });

    assert.isDefined(depositTxObj, "deposit function did not get mined/execute");

    pauseTxObj = await remittance.contract.methods.pause().send({ from: deployer });
    assert.isDefined(pauseTxObj.events.LogContractPaused, "pause event not emitted");

    await truffleAssertions.reverts(
      remittance.contract.methods.withdraw(handlerPassword, receiverPassword).send({ from: handler, value: 0 }),
      "Contract is paused"
    );
  });
});
