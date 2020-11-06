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
  const deployer = accounts[0];
  const sender = accounts[1];
  const handler = accounts[2];
  const randomAddress = accounts[3];
  const _randomHash = "0x72631ef6a9de404af013211acf2bec80a2d1c9c0b799846fea429a55bf864ee8";

  beforeEach("deploy a fresh contract", async () => {
    remittance = await Remittance.new({ from: deployer });
  });

  it("should revert when given passwords are incorrect", async () => {
    const _sent = 20;
    const handlerPassword = "123456";
    const receiverPassword = "abcdef";

    const depositTxObj = await remittance.contract.methods.deposit(_randomHash, handler).send({ from: sender, value: _sent });

    assert.isDefined(depositTxObj, "deposit function did not get mined/execute");

    await truffleAssert.reverts(
      remittance.contract.methods.withdraw(handlerPassword, receiverPassword).send({ from: handler, value: 0 }),
      "Incorrect password"
    );
  });

  it("should give owed money when both passwords are correct and inorder", async () => {
    const _sent = 20;
    const handlerPassword = "123456";
    const receiverPassword = "abcdef";

    const hashKey = web3.utils.soliditySha3(
      { type: "string", value: handlerPassword },
      { type: "string", value: receiverPassword }
    );

    const depositTxObj = await remittance.contract.methods.deposit(hashKey, handler).send({ from: sender, value: _sent });

    assert.isDefined(depositTxObj, "deposit function did not get mined/execute");

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

  it("should revert if the withdrawer address is not owed", async () => {
    const _sent = 20;
    const handlerPassword = "123456";
    const receiverPassword = "abcdef";
    const hashKey = web3.utils.soliditySha3(
      { type: "string", value: handlerPassword },
      { type: "string", value: receiverPassword }
    );

    const depositTxObj = await remittance.contract.methods.deposit(hashKey, handler).send({ from: handler, value: _sent });

    assert.isDefined(depositTxObj, "deposit function did not get mined/executed");

    await truffleAssert.reverts(
      remittance.contract.methods.withdraw(handlerPassword, receiverPassword).send({ from: randomAddress, value: 0 }),
      "Sender is not owed a withdrawal"
    );
  });
});
