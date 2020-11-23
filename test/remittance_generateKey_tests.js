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
  const receiverPassword = web3.utils.fromAscii("abcdef");
  const emptyString = web3.utils.fromAscii("");

  describe("Generate remit key tests", () => {
    beforeEach("deploy a fresh contract", async () => {
      remittance = await Remittance.new({ from: deployer });
    });

    it("should generate expected hash value from password and address", () => {
      const _nullKey = "0x0000000000000000000000000000000000000000000000000000000000000000";

      return remittance.contract.methods
        .generateKey(remitter, receiverPassword)
        .call({ from: sender })
        .then((remitKey) => {
          assert.isDefined(remitKey, "did not generate expected remit key");
          assert.notEqual(remitKey, _nullKey, "did generate expected null remit key");
        });
    });

    it("should be able to generate remit Key from web3 soliditySha3", async () => {
      const web3SoliditySha3RemitKey = web3.utils.soliditySha3(
        { type: "bytes32", value: receiverPassword },
        { type: "address", value: remitter },
        { type: "address", value: remittance.address }
      );

      const soliditykeccak256RemitKey = await remittance.contract.methods
        .generateKey(remitter, receiverPassword)
        .call({ from: sender });

      assert.strictEqual(web3SoliditySha3RemitKey, soliditykeccak256RemitKey, "web3 and keccak256 generated keys don't match");
    });

    it("should revert if given empty string as a password", async () => {
      await truffleAssert.reverts(
        remittance.contract.methods.generateKey(remitter, emptyString).call({ from: sender }),
        "receiverPassword can not be empty"
      );
    });

    it("should revert if given null address", async () => {
      const nullAddress = "0x0000000000000000000000000000000000000000";

      await truffleAssert.reverts(
        remittance.contract.methods.generateKey(nullAddress, receiverPassword).call({ from: sender }),
        "remitter address can not be null"
      );
    });
  });
});
