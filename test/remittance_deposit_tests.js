const Remittance = artifacts.require("Remittance");
const truffleAssert = require("truffle-assertions");
const chai = require("chai");
const { assert, expect } = chai;

const { BN } = web3.utils.BN;
chai.use(require("chai-bn")(BN));

contract("Remittance", (accounts) => {
  before(async () => {
    it("TestRPC must have adequate number of addresses", () => {
      assert.isAtLeast(accounts.length, 3, "Test has enough addresses");
    });
  });

  let remittance;
  const deployer = accounts[0];
  const sender = accounts[1];
  const handler = accounts[2];
  const nullAddress = "0x0000000000000000000000000000000000000000";
  const _randomHash = "0x72631ef6a9de404af013211acf2bec80a2d1c9c0b799846fea429a55bf864ee8";

  beforeEach("deploy a fresh contract", async () => {
    remittance = await Remittance.new({ from: deployer });
  });

  it("should revert if deposited towards null address", async () => {
    await truffleAssert.reverts(
      remittance.contract.methods.deposit(_randomHash, nullAddress).send({ from: sender, value: 10 }),
      "Can not deposit into null address"
    );
  });

  it("should revert if given null hash", async () => {
    const nullHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
    await truffleAssert.reverts(
      remittance.contract.methods.deposit(nullHash, nullAddress).send({ from: sender, value: 10 }),
      "Invalid hash value"
    );
  });

  it("should revert if sent amount is 0", async () => {
    await truffleAssert.reverts(
      remittance.contract.methods.deposit(_randomHash, handler).send({ from: sender, value: 0 }),
      "Invalid minimum amount"
    );
  });

  it("should record sent amount as owed in storage", async () => {
    const _sent = 20;
    const expected = new BN(_sent);

    const remitBefore = await remittance.ledger.call(handler);
    await remittance.contract.methods.deposit(_randomHash, handler).send({ from: sender, value: _sent });
    const remitAfter = await remittance.ledger.call(handler);

    const actual = remitAfter.amount.sub(remitBefore.amount);

    expect(actual).to.be.a.bignumber.that.equals(expected);
  });
});
