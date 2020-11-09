const Remittance = artifacts.require("Remittance");
const truffleAssert = require("truffle-assertions");
const chai = require("chai");
const { BN } = web3.utils.BN;
const { assert, expect } = chai;

chai.use(require("chai-bn")(BN));

contract("Remittance", (accounts) => {
  before(async () => {
    it("TestRPC must have adequate number of addresses", () => {
      assert.isAtLeast(accounts.length, 4, "Test has enough addresses");
    });
  });

  let remittance;
  const _sent = 20;
  const handlerPassword = "123456";
  const receiverPassword = "abcdef";
  const deployer = accounts[0];
  const sender = accounts[1];
  const handler = accounts[2];
  const randomAddress = accounts[3];
  const nullHash = "0x0000000000000000000000000000000000000000000000000000000000000000";

  it("should NOT double successful withdrawals", async () => {
    //Arrange
    const handlerPassword = "123456789";
    const receiverPassword = "abcdefghi";
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
    assert.isDefined(depositTxObj, "deposit function did not get mined/execute");
    const withdrawTxObj = await remittance.contract.methods
      .withdraw(handlerPassword, receiverPassword)
      .send({ from: handler, value: 0 });
    assert.isDefined(withdrawTxObj, "withdraw function did not get mined/execute");

    //Act, Assert
    await truffleAssert.reverts(
      remittance.contract.methods.withdraw(handlerPassword, receiverPassword).send({ from: handler, value: 0 }),
      "Sender is not owed a withdrawal"
    );
  });

  it("should clear ledger after successful withdrawal", async () => {
    //Arrange
    const handlerPassword = "987654321";
    const receiverPassword = "ihgfedcba";
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
    assert.isDefined(depositTxObj, "deposit function did not get mined/executed");

    const remitBeforeWithdrawal = await remittance.ledger.call(secrets.handlerKey);
    const withdrawTxObj = await remittance.contract.methods
      .withdraw(handlerPassword, receiverPassword)
      .send({ from: handler, value: 0 });
    assert.isDefined(withdrawTxObj, "withdraw function did not get mined/executed");

    //Act
    const remitAfterWithdrawal = await remittance.ledger.call(secrets.handlerKey);

    //Assert
    assert.notEqual(remitBeforeWithdrawal.amount, remitAfterWithdrawal.amount, "ledger amount not cleared after withdrawl");
    assert.strictEqual("0", remitAfterWithdrawal.amount.toString(10), "ledger amount sert to zero after withdrawl");
    assert.strictEqual(remitAfterWithdrawal.secret, nullHash, "ledger secret not cleared after withdrawl");
  });

  beforeEach("deploy a fresh contract, generate secrets and deposit money", async () => {
    remittance = await Remittance.new({ from: deployer });

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

    assert.isDefined(depositTxObj, "deposit function did not get mined/execute");
  });

  it("should give owed money when both passwords are correct", async () => {
    const weiBeforeWithdraw = await web3.eth.getBalance(handler);

    const withdrawTxObj = await remittance.contract.methods
      .withdraw(handlerPassword, receiverPassword)
      .send({ from: handler, value: 0 });
    const _gasAmount = withdrawTxObj.gasUsed;

    const withdrawTx = await web3.eth.getTransaction(withdrawTxObj.transactionHash);
    const _gasPrice = withdrawTx.gasPrice;

    const bn_gasPrice = new BN(_gasPrice);
    const bn_gasAmount = new BN(_gasAmount);
    const gasCost = bn_gasPrice.mul(bn_gasAmount);

    assert.isDefined(withdrawTxObj, "withdraw function did not get mined/execute");

    const weiAfterWithdraw = await web3.eth.getBalance(handler);

    const owed = new BN(_sent);
    const beforeBalance = new BN(weiBeforeWithdraw);
    const afterBalance = new BN(weiAfterWithdraw);

    const expectedAfterBalance = beforeBalance.add(owed).sub(gasCost);

    expect(afterBalance).to.be.a.bignumber.that.equals(expectedAfterBalance);
  });

  it("should revert when given empty password(s)", async () => {
    await truffleAssert.reverts(
      remittance.contract.methods.withdraw("", receiverPassword).send({ from: handler, value: 0 }),
      "handlerPassword can not be empty"
    );

    await truffleAssert.reverts(
      remittance.contract.methods.withdraw(handlerPassword, "").send({ from: handler, value: 0 }),
      "receiverPassword can not be empty"
    );
  });

  it("should revert when given identical passwords", async () => {
    await truffleAssert.reverts(
      remittance.contract.methods.withdraw(handlerPassword, handlerPassword).send({ from: handler, value: 0 }),
      "passwords can not be the same"
    );
  });

  it("should revert if the withdrawer address is not owed", async () => {
    await truffleAssert.reverts(
      remittance.contract.methods.withdraw(handlerPassword, receiverPassword).send({ from: randomAddress, value: 0 }),
      "Sender is not owed a withdrawal"
    );
  });

  it("should revert if passwords are incorrect", async () => {
    await truffleAssert.reverts(
      remittance.contract.methods.withdraw("wronghandlerPassword", "wrongReceiverPassword").send({ from: handler, value: 0 }),
      "Sender is not owed a withdrawal"
    );
  });

  it("should revert if receiver password is incorrect", async () => {
    await truffleAssert.reverts(
      remittance.contract.methods.withdraw(handlerPassword, "wrongReceiverPassword").send({ from: handler, value: 0 }),
      "Passwords are incorrect"
    );
  });

  it("should revert if handler password is incorrect", async () => {
    await truffleAssert.reverts(
      remittance.contract.methods.withdraw("wronghandlerPassword", receiverPassword).send({ from: handler, value: 0 }),
      "Sender is not owed a withdrawal"
    );
  });

  it("should revert if passwords are reversed", async () => {
    await truffleAssert.reverts(
      remittance.contract.methods.withdraw(receiverPassword, handlerPassword).send({ from: handler, value: 0 }),
      "Sender is not owed a withdrawal"
    );
  });
});
