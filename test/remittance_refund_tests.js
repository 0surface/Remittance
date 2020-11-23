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

/* For future reference */
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
  const deployer = accounts[0];
  const sender = accounts[1];
  const remitter = accounts[2];
  const randomAddress = accounts[3];
  const _sent = 20;
  const gas = 4000000;
  const _withdrawalDeadline = 86400;
  const password = web3.utils.fromAscii("abcdef");
  const _nullKey = "0x0000000000000000000000000000000000000000000000000000000000000000";
  let _remitKey_ = "";

  describe("refund tests", () => {
    beforeEach("deploy a fresh contract, set lockDuration, generateSecret, deposit funds", async () => {
      //Deploy contract
      remittance = await Remittance.new({ from: deployer });

      //Act - generateSecret
      _remitKey_ = await remittance.contract.methods.generateKey(remitter, password).call({ from: sender, gas: gas });
      assert.isDefined(_remitKey_, "did not generate expected remitter key");

      //Act - Deposit
      const depositTxObj = await remittance.contract.methods
        .deposit(_remitKey_, _withdrawalDeadline)
        .send({ from: sender, value: _sent, gas: gas });
      assert.isDefined(depositTxObj, "deposit function did not get mined/execute");
    });

    it("should revert when deadline has not yet passed", async () => {
      //Act, Assert
      await truffleAssert.reverts(
        remittance.contract.methods.refund(_remitKey_).send({ from: sender, value: 0, gas: gas }),
        "Deposit is not yet eligible for refund"
      );
    });

    it("should revert given null remit Key", async () => {
      //Arrange
      advanceTime(_withdrawalDeadline + 1);

      //Act, Assert
      await truffleAssert.reverts(remittance.contract.methods.refund(_nullKey).send({ from: sender, value: 0 }));
    });

    it("revert if calling address is not owed a refund", async () => {
      //Arrange
      advanceTime(_withdrawalDeadline + 1);

      //Act, Assert
      await truffleAssert.reverts(
        remittance.contract.methods.refund(_remitKey_).send({ from: randomAddress, value: 0 }),
        "Caller is not depositor"
      );
    });

    it("emit Refund event with correct arguments", async () => {
      //Arrange
      advanceTime(_withdrawalDeadline + 1);

      //Act
      const refundTxObj = await remittance.contract.methods.refund(_remitKey_).send({ from: sender, value: 0, gas: gas });

      //Assert
      const eventObj = refundTxObj.events.LogRefund;
      assert.isDefined(eventObj, "event not emitted");
      assert.strictEqual(eventObj.event, "LogRefund", "correct evemt not emitted");
      assert.strictEqual(eventObj.returnValues.refundee, sender, "event refundee argument is incorrect");
      assert.strictEqual(eventObj.returnValues.refunded, _sent.toString(), "event amount argument is incorrect");
      assert.strictEqual(eventObj.returnValues.key, _remitKey_, "event remitKey argument is incorrect");
    });

    it("should allow successful refund", async () => {
      //Arrange
      advanceTime(_withdrawalDeadline + 1);
      const weiBefore = await web3.eth.getBalance(sender);
      const before = new BN(weiBefore);
      const owed = new BN(_sent);

      //Act
      const refundTxObj = await remittance.contract.methods.refund(_remitKey_).send({ from: sender, value: 0 });

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
      advanceTime(_withdrawalDeadline + 1);

      //Act
      const refundTxObj = await remittance.contract.methods.refund(_remitKey_).send({ from: sender, value: 0 });
      const eventObj = refundTxObj.events.LogRefund;
      assert.isDefined(eventObj, "first refund failed");

      //Assert
      await truffleAssert.reverts(
        remittance.contract.methods.refund(_remitKey_).send({ from: sender, value: 0 }),
        "Caller is not owed a refund"
      );
    });
  });
});
