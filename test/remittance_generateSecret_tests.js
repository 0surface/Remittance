const Remittance = artifacts.require("Remittance");
const truffleAssert = require("truffle-assertions");
const chai = require("chai");
const { assert, expect } = chai;

contract("Remittance", (accounts) => {
  before(async () => {
    it("TestRPC must have adequate number of addresses", () => {
      assert.isAtLeast(accounts.length, 2, "Test has enough addresses");
    });
  });

  let remittance;
  const deployer = accounts[0];
  const sender = accounts[1];
  const remitter = accounts[2];
  const nullAddress = "0x0000000000000000000000000000000000000000";
  const receiverPassword = "abcdef";
  const expectedremitKey = web3.utils.soliditySha3(
    { type: "string", value: receiverPassword },
    { type: "address", value: remitter }
  );
  const expectedWithdrawSecret = web3.utils.soliditySha3(
    { type: "address", value: remitter },
    { type: "string", value: receiverPassword }
  );
  const expectedRefundSecret = web3.utils.soliditySha3(
    { type: "address", value: sender },
    { type: "string", value: receiverPassword }
  );

  describe("Generate Secret tests", () => {
    beforeEach("deploy a fresh contract", async () => {
      remittance = await Remittance.new({ from: deployer });
    });

    it("should generate expected hash value from passwords in order", () => {
      return remittance.contract.methods
        .generateSecret(remitter, receiverPassword)
        .call({ from: sender })
        .then((result) => {
          assert.strictEqual(result.withdrawSecret, expectedWithdrawSecret, "did not generate expected withdraw secret");
          assert.strictEqual(result.remitKey, expectedremitKey, "did not generate expected remit key");
          assert.strictEqual(result.refundSecret, expectedRefundSecret, "did not generate expected refund secret");
        });
    });

    it("should revert if given empty string as a password", async () => {
      await truffleAssert.reverts(
        remittance.contract.methods.generateSecret(remitter, "").call({ from: sender }),
        "receiverPassword can not be empty"
      );
    });

    it("should revert if given address string as password", async () => {
      console.log("remitter:", remitter);
      console.log("remitter.toString(): ", remitter.toString());
      await truffleAssert.reverts(
        remittance.contract.methods.generateSecret(remitter, remitter.toString()).call({ from: sender }),
        "password can not be the same as address"
      );
    });

    it("should revert if given null address", async () => {
      await truffleAssert.reverts(
        remittance.contract.methods.generateSecret(nullAddress, "abcdef").call({ from: sender }),
        "remitter address can not be null"
      );
    });
  });
});
