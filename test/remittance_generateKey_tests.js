const Remittance = artifacts.require("Remittance");
const truffleAssert = require("truffle-assertions");
const chai = require("chai");
const { assert } = chai;

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

  describe("Generate remit key tests", () => {
    beforeEach("deploy a fresh contract", async () => {
      remittance = await Remittance.new({ from: deployer });
    });

    it("should generate expected hash value from passwords in order", () => {
      const receiverPassword = "abcdef";
      const expectedRemitKey = web3.utils.soliditySha3(
        { type: "string", value: receiverPassword },
        { type: "address", value: remitter }
      );

      return remittance.contract.methods
        .generateKey(remitter, receiverPassword)
        .call({ from: sender })
        .then((remitKey) => {
          assert.strictEqual(remitKey, expectedRemitKey, "did not generate expected remit key");
        });
    });

    it("should revert if given empty string as a password", async () => {
      await truffleAssert.reverts(
        remittance.contract.methods.generateKey(remitter, "").call({ from: sender }),
        "receiverPassword can not be empty"
      );
    });

    it("should revert if given null address", async () => {
      const nullAddress = "0x0000000000000000000000000000000000000000";

      await truffleAssert.reverts(
        remittance.contract.methods.generateKey(nullAddress, "abcdef").call({ from: sender }),
        "remitter address can not be null"
      );
    });
  });
});
