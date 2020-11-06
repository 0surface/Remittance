const Remittance = artifacts.require("Remittance");
const truffleAssert = require("truffle-assertions");

contract("Remittance", (accounts) => {
  before(async () => {
    it("TestRPC must have adequate number of addresses", () => {
      assert.isAtLeast(accounts.length, 1, "Test has enough addresses");
    });
  });

  let remittance;
  const deployer = accounts[0];

  beforeEach("deploy a fresh contract", async () => {
    remittance = await Remittance.new({ from: deployer });
  });

  it("should generate expected hash value from inputs in order", () => {
    const first = "123456";
    const second = "abcdef";

    const expectedHash = web3.utils.soliditySha3({ type: "string", value: first }, { type: "string", value: second });

    return remittance.contract.methods
      .generateSecret(first, second)
      .call()
      .then((genratedHash) => {
        assert.strictEqual(genratedHash, expectedHash, "did not generate expected hash");
      });
  });

  it("should NOT generate expected hash value from inputs out of order", () => {
    const first = "123456";
    const second = "abcdef";

    const expectedHash = web3.utils.soliditySha3({ type: "string", value: first }, { type: "string", value: second });

    return remittance.contract.methods
      .generateSecret(second, first)
      .call()
      .then((genratedHash) => {
        assert.notEqual(genratedHash, expectedHash, "generated same hash with inputs in reverse order");
      });
  });

  it("should NOT generate expected hash value from inputs out of order", () => {
    const handlerPassword = "123456";
    const receiverPassword = "abcdef";

    const expectedHash = web3.utils.soliditySha3(
      { type: "string", value: handlerPassword },
      { type: "string", value: receiverPassword }
    );

    return remittance.contract.methods
      .generateSecret(receiverPassword, handlerPassword)
      .call()
      .then((genratedHash) => {
        assert.notEqual(genratedHash, expectedHash, "generate hash with out of order inputs");
      });
  });

  it("should NOT allow empty string as password", async () => {
    await truffleAssert.reverts(remittance.contract.methods.generateSecret("", "abcdef").call());
  });

  it("should NOT allow identical input password strings", async () => {
    await truffleAssert.reverts(remittance.contract.methods.generateSecret("abcdef", "abcdef").call());
  });
});
