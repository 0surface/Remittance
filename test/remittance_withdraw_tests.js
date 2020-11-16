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
  const _randomAddress = accounts[3];
  const _withdrawalDeadline = 86400;
  const gas = 4000000;
  const _sent = 20;
  const receiverPassword = "abcdef";
  const expectedRemitkey = web3.utils.soliditySha3(
    { type: "string", value: receiverPassword },
    { type: "address", value: remitter }
  );

  describe("withdraw tests", () => {
    beforeEach("deploy a fresh contract, generate secrets and deposit money", async () => {
      //Arrange
      remittance = await Remittance.new({ from: deployer });

      //Act - generateSecret
      const remitKey = await remittance.contract.methods.generateKey(remitter, receiverPassword).call({ from: sender, gas: gas });
      assert.strictEqual(remitKey, expectedRemitkey, "did not generate expected remitter key");

      //Act - Deposit
      const depositTxObj = await remittance.contract.methods
        .deposit(remitKey, _withdrawalDeadline)
        .send({ from: sender, value: _sent, gas: gas });
      assert.isDefined(depositTxObj, "deposit function did not get mined/execute");
    });

    it("should NOT allow double successful withdrawals", async () => {
      //Act
      const fristWithdrawTxObj = await remittance.contract.methods
        .withdraw(receiverPassword)
        .send({ from: remitter, value: 0, gas: gas });
      assert.isDefined(fristWithdrawTxObj, "withdraw function did not get mined/execute");

      //Act, Assert
      await truffleAssert.reverts(
        remittance.contract.methods.withdraw(receiverPassword).send({ from: remitter, value: 0, gas: gas }),
        "Caller is not owed a withdrawal"
      );
    });

    it("should clear ledger after successful withdrawal", async () => {
      //Arrange
      const remitBefore = await remittance.ledger.call(expectedRemitkey);

      //Act
      const withdrawTxObj = await remittance.contract.methods
        .withdraw(receiverPassword)
        .send({ from: remitter, value: 0, gas: gas });
      assert.isDefined(withdrawTxObj, "withdraw function did not get mined/executed");

      //Assert
      const remitAfter = await remittance.ledger.call(expectedRemitkey);
      const zero = new BN(0);

      assert.notEqual(remitBefore.amount, remitAfter.amount, "ledger amount not cleared after withdrawl");
      expect(remitAfter.amount).to.be.a.bignumber.that.equals(zero);
      expect(remitAfter.deadline).to.be.a.bignumber.that.equals(zero);
    });

    it("should emit an event with correct arguments", async () => {
      //Act
      const withdrawTxObj = await remittance.contract.methods
        .withdraw(receiverPassword)
        .send({ from: remitter, value: 0, gas: gas });

      //Assert
      const eventObj = withdrawTxObj.events.LogWithdrawal;
      assert.isDefined(eventObj, "event not emitted");
      assert.isTrue(eventObj.event === "LogWithdrawal", "correct event not emitted");
      assert.isTrue(eventObj.returnValues.withdrawer === remitter, "LogWithdrawn event withdrawer argument is incorrect");
      assert.isTrue(eventObj.returnValues.withdrawn === _sent.toString(), "LogWithdrawn event withdrawn argument is incorrect");
      assert.isTrue(
        eventObj.returnValues.receiverPassword === receiverPassword,
        "LogWithdrawn event receiverPassword argument is incorrect"
      );
      assert.isTrue(eventObj.returnValues.key === expectedRemitkey, "LogWithdrawn event withdrawn argument is incorrect");
    });

    it("should pay owed money when receiver password is correct", async () => {
      //Arrange
      const weiBefore = await web3.eth.getBalance(remitter);
      const beforeBalance = new BN(weiBefore);
      const owed = new BN(_sent);

      //Act
      const withdrawTxObj = await remittance.contract.methods
        .withdraw(receiverPassword)
        .send({ from: remitter, value: 0, gas: gas });
      assert.isDefined(withdrawTxObj, "withdraw function did not get mined/execute");

      //Calcuate gas spent
      const _gasAmount = withdrawTxObj.gasUsed;
      const withdrawTx = await web3.eth.getTransaction(withdrawTxObj.transactionHash);
      const _gasPrice = withdrawTx.gasPrice;
      const bn_gasPrice = new BN(_gasPrice);
      const bn_gasAmount = new BN(_gasAmount);
      const gasCost = bn_gasPrice.mul(bn_gasAmount);

      //Assert
      const weiAfter = await web3.eth.getBalance(remitter);
      const after = new BN(weiAfter);
      const expectedAfter = beforeBalance.add(owed).sub(gasCost);
      expect(after).to.be.a.bignumber.that.equals(expectedAfter);
    });

    it("should revert when given empty password", async () => {
      await truffleAssert.reverts(
        remittance.contract.methods.withdraw("").send({ from: remitter, value: 0, gas: gas }),
        "receiverPassword can not be empty"
      );
    });

    it("should revert when withdrawal deadline has passed", async () => {
      advanceTime(_withdrawalDeadline + 1);

      await truffleAssert.reverts(
        remittance.contract.methods.withdraw(receiverPassword).send({ from: remitter, value: 0, gas: gas }),
        "withdrawal period has expired"
      );
    });

    it("should revert if the withdrawer address is not owed", async () => {
      await truffleAssert.reverts(
        remittance.contract.methods.withdraw(receiverPassword).send({ from: _randomAddress, value: 0, gas: gas }),
        "Caller is not owed a withdrawal"
      );
    });

    it("should revert if receiver password is incorrect", async () => {
      await truffleAssert.reverts(
        remittance.contract.methods.withdraw("wrongReceiverPassword").send({ from: remitter, value: 0, gas: gas }),
        "Caller is not owed a withdrawal"
      );
    });
  });
});
