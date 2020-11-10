const Remittance = artifacts.require("Remittance");
const truffleAssert = require("truffle-assertions");
const chai = require("chai");
const { assert, expect } = chai;

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
  const nullAddress = "0x0000000000000000000000000000000000000000";

  beforeEach("deploy a fresh contract", async () => {
    remittance = await Remittance.new({ from: deployer });
  });

  it("should generate expected hash value from passwords in order", () => {
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

    return remittance.contract.methods
      .generateSecret(handler, handlerPassword, receiverPassword)
      .call()
      .then((result) => {
        assert.strictEqual(result.handlerKey, expectedHandlerKey, "did not generate expected handler key");
        assert.strictEqual(result.hashedSecret, expectedHashedSecret, "did not generate expected hashed secret");
      });
  });

  it("should NOT generate expected hash value from passwords out of order", () => {
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

    return remittance.contract.methods
      .generateSecret(handler, receiverPassword, handlerPassword)
      .call()
      .then((result) => {
        assert.notEqual(result.handlerKey, expectedHandlerKey, "did not generate expected handler key");
        assert.notEqual(result.hashedSecret, expectedHashedSecret, "did not generate expected hashed secret");
      });
  });

  it("should revert if given empty string as a password", async () => {
    await truffleAssert.reverts(remittance.contract.methods.generateSecret(handler, "", "abcdef").call());
    await truffleAssert.reverts(remittance.contract.methods.generateSecret(handler, "abcdef", "").call());
  });

  it("should revert if given identical passwords", async () => {
    await truffleAssert.reverts(remittance.contract.methods.generateSecret(handler, "abcdef", "abcdef").call());
  });

  it("should revert if given null address", async () => {
    await truffleAssert.reverts(remittance.contract.methods.generateSecret(nullAddress, "abcdef", "abcdef").call());
  });
});
