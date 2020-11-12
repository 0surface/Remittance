const Remittance = artifacts.require("Remittance");
const truffleAssert = require("truffle-assertions");
const chai = require("chai");
const { BN } = web3.utils.BN;
const { assert, expect } = chai;
chai.use(require("chai-bn")(BN));

function advanceTime(time) {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [time],
        id: new Date().getTime(),
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
  });
}

function advanceOneBlock() {
  const id = Date.now();
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_mine",
        id: id + 1,
      },
      (err2, res) => (err2 ? reject(err2) : resolve(res))
    );
  });
}

contract("Remittance", (accounts) => {
  before(async () => {
    it("TestRPC must have adequate number of addresses", () => {
      assert.isAtLeast(accounts.length, 4, "Test has enough addresses");
    });
  });

  let remittance;
  const _sent = 20;
  const gas = 4000000;
  const deployer = accounts[0];
  const sender = accounts[1];
  const remitter = accounts[2];
  const randomAddress = accounts[3];
  const password = "abcdef";
  const nullAddress = "0x0000000000000000000000000000000000000000";
  const expectedKey = web3.utils.soliditySha3({ type: "string", value: password }, { type: "address", value: remitter });
  const expWithdrawSecret = web3.utils.soliditySha3({ type: "address", value: remitter }, { type: "string", value: password });
  const expRefSecret = web3.utils.soliditySha3({ type: "address", value: sender }, { type: "string", value: password });

  describe("refund tests - with ganache-cli running 1 second block time", () => {
    beforeEach("deploy a fresh contract, set lockDuration, generateSecret, deposit funds", async () => {
      //Deploy contract
      remittance = await Remittance.new({ from: deployer });

      //Set lock duration to 1 second
      const txObj = await remittance.contract.methods.setLockDuration(1).send({ from: deployer });

      //Act - generateSecret
      const hash = await remittance.contract.methods.generateSecret(remitter, password).call({ from: sender, gas: gas });
      assert.strictEqual(hash.remitKey, expectedKey, "did not generate expected remitter key");
      assert.strictEqual(hash.withdrawSecret, expWithdrawSecret, "did not generate expected withdraw secret");
      assert.strictEqual(hash.refundSecret, expRefSecret, "did not generate expected refund secret");

      //Act - Deposit
      const depositTxObj = await remittance.contract.methods
        .deposit(hash.withdrawSecret, hash.remitKey, hash.refundSecret)
        .send({ from: sender, value: _sent, gas: gas });
      assert.isDefined(depositTxObj, "deposit function did not get mined/execute");
    });

    it("(meta test) it should skip time", async () => {
      const txObj1 = await remittance.contract.methods.setLockDuration(1).send({ from: deployer });
      const block1 = await web3.eth.getBlock(txObj1.blockNumber);

      advanceTime(10);
      const txObj2 = await remittance.contract.methods.setLockDuration(2).send({ from: deployer });
      const block2 = await web3.eth.getBlock(txObj2.blockNumber);

      advanceTime(8);
      const txObj3 = await remittance.contract.methods.setLockDuration(2).send({ from: deployer });
      const block3 = await web3.eth.getBlock(txObj3.blockNumber);

      assert.isTrue(block1.timestamp + 10 === block2.timestamp, "first skip failed");
      assert.isTrue(block2.timestamp + 8 === block3.timestamp, "first skip failed");
    });

    it("should revert when deadline has not yet passed", async () => {
      //Act, Assert
      await truffleAssert.reverts(
        remittance.contract.methods.refund(remitter, password).send({ from: sender, value: 0, gas: gas })
      );
    });

    it("should revert given null address input", async () => {
      //Arrange
      advanceTime(2);

      //Act, Assert
      await truffleAssert.reverts(remittance.contract.methods.refund(nullAddress, password).send({ from: sender, value: 0 }));
    });

    it("should revert given empty password input", async () => {
      //Arrange
      advanceTime(2);

      //Act, Assert
      await truffleAssert.reverts(remittance.contract.methods.refund(remitter, "").send({ from: sender, value: 0 }));
    });

    it("revert if calling address is not owed a refund", async () => {
      //Arrange
      advanceTime(2);

      //Act, Assert
      await truffleAssert.reverts(remittance.contract.methods.refund(randomAddress, "").send({ from: sender, value: 0 }));
    });

    it("emit Refund event with correct arguments", async () => {
      //Arrange
      advanceTime(2);

      //Act
      const refundTxObj = await remittance.contract.methods.refund(remitter, password).send({ from: sender, value: 0, gas: gas });

      //Assert
      const eventObj = refundTxObj.events.LogRefund;
      assert.isDefined(eventObj, "event not emitted");
      assert.strictEqual(eventObj.event, "LogRefund", "correct evemt not emitted");
      assert.strictEqual(eventObj.returnValues.refundee, sender, "event refundee argument is incorrect");
      assert.strictEqual(eventObj.returnValues.amount, _sent.toString(), "event amount argument is incorrect");
      assert.strictEqual(eventObj.returnValues.remitterAddress, remitter, "event remitterAddress argument is incorrect");
      assert.strictEqual(eventObj.returnValues.receiverPassword, password, "event receiverPassword argument is incorrect");
    });

    it("should allow successful refund", async () => {
      //Arrange
      advanceTime(2);
      const weiBefore = await web3.eth.getBalance(sender);
      const before = new BN(weiBefore);
      const owed = new BN(_sent);

      //Act
      const refundTxObj = await remittance.contract.methods.refund(remitter, password).send({ from: sender, value: 0 });

      //Calculate gas spent
      const refundTx = await web3.eth.getTransaction(refundTxObj.transactionHash);
      const _gasPrice = new BN(refundTx.gasPrice);
      const _gasAmount = new BN(refundTxObj.gasUsed);
      const _gasCost = _gasPrice.mul(_gasAmount);

      //Assert
      const weiAfter = await web3.eth.getBalance(sender);
      const after = new BN(weiAfter);
      const expectedAfter = before.add(owed).sub(_gasCost);
      expect(after).to.be.a.bignumber.that.equals(expectedAfter);
    });

    it("should NOT allow successful double refunds", async () => {
      //Arrange -first refund
      advanceTime(2);

      //Act
      const refundTxObj = await remittance.contract.methods.refund(remitter, password).send({ from: sender, value: 0 });
      const eventObj = refundTxObj.events.LogRefund;
      assert.isDefined(eventObj, "first refund failed");

      //Assert
      await truffleAssert.reverts(
        remittance.contract.methods.refund(remitter, password).send({ from: sender, value: 0 }),
        "Caller is not owed a refund"
      );
    });
  });
});
