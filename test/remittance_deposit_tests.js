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
  const handler = accounts[2];
  const _sent = 20;
  const _randomHandlerKey = "0x72631ef6a9de404af013211acf2bec80a2d1c9c0b799846fea429a55bf864ee8";
  const _randomSecretHash = "0xaf01329a52180a2d1c9726311ac4c0b79f2becef6a9de4bf864ee809846fea45";

  beforeEach("deploy a fresh contract", async () => {
    remittance = await Remittance.new({ from: deployer });
  });

  it("should revert if given null secret hash", async () => {
    const nullHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
    await truffleAssert.reverts(
      remittance.contract.methods.deposit(nullHash, _randomHandlerKey).send({ from: sender, value: 10 }),
      "Invalid secretHash value"
    );
  });

  it("should revert if given null handler key", async () => {
    const nullHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
    await truffleAssert.reverts(
      remittance.contract.methods.deposit(_randomSecretHash, nullHash).send({ from: sender, value: 10 }),
      "Invalid handlerKey value"
    );
  });

  it("should revert if sent amount is 0", async () => {
    await truffleAssert.reverts(
      remittance.contract.methods.deposit(_randomSecretHash, _randomHandlerKey).send({ from: sender, value: 0 }),
      "Invalid minimum amount"
    );
  });

  it("should revert if input hashes are identical", async () => {
    await truffleAssert.reverts(
      remittance.contract.methods.deposit(_randomSecretHash, _randomSecretHash).send({ from: sender, value: _sent }),
      "secretHash and handlerKey can not be identical"
    );
  });

  it("should record sent amount as owed in storage", async () => {
    const expectedAmount = new BN(_sent);
    const expectedSecret = _randomSecretHash;

    const remitBefore = await remittance.ledger.call(_randomHandlerKey);
    await remittance.contract.methods.deposit(_randomSecretHash, _randomHandlerKey).send({ from: sender, value: _sent });
    const remitAfter = await remittance.ledger.call(_randomHandlerKey);

    const actual = remitAfter.amount.sub(remitBefore.amount);

    expect(actual).to.be.a.bignumber.that.equals(expectedAmount);
    expect(_randomSecretHash).equals(expectedSecret);
  });

  it("should revert if given active deposit key", async () => {
    const handlerPassword = "123456";
    const receiverPassword = "abcdef";

    const expectedHandlerKey = web3.utils.soliditySha3(
      { type: "address", value: handler },
      { type: "string", value: handlerPassword }
    );
    const expectedHashedSecret = web3.utils.soliditySha3(
      { type: "bytes32", value: expectedHandlerKey },
      { type: "string", value: receiverPassword }
    );

    const secrets = await remittance.contract.methods.generateSecret(handler, handlerPassword, receiverPassword).call();
    assert.strictEqual(secrets.handlerKey, expectedHandlerKey, "did not generate expected handler key");
    assert.strictEqual(secrets.hashedSecret, expectedHashedSecret, "did not generate expected hashed secret");

    const depositTxObj = await remittance.contract.methods
      .deposit(secrets.hashedSecret, secrets.handlerKey)
      .send({ from: sender, value: _sent });

    assert.isDefined(depositTxObj, "deposit transaction did not get mined/executed");

    await truffleAssert.reverts(
      remittance.contract.methods.deposit(secrets.hashedSecret, secrets.handlerKey).send({ from: sender, value: _sent }),
      "Invalid, handler Key has active deposit"
    );
  });
});
