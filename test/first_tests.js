const Remittance = artifacts.require("Remittance");

contract("Remittance", (accounts) => {
  before(async () => {
    it("TestRPC must have adequate number of addresses", () => {
      assert.isTrue(accounts.length >= 115, "Test has enough addresses");
    });
  });

  let remittance;
  const deployer = accounts[0];
  const sender = accounts[1];
  const handler = accounts[2];
  const receiver = accounts[3];
  const random = accounts[4];
  const nullAddress = "0x0000000000000000000000000000000000000000";

  beforeEach("deploy a fresh contract", async () => {
    remittance = await Remittance.new({ from: deployer });
    console.log("before each");
  });

  it("should give expected value", () => {
    return remittance.contract.methods
      .hello()
      .call()
      .then((result) => {
        assert.equal(result, 42, "incorrect value");
      });
  });
});
