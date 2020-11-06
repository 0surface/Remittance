const Web3 = require("web3");
const truffleContract = require("truffle-contract");
const $ = require("jquery");
const remittanceJson = require("../../build/contracts/Remittance.json");

const App = {
  web3: null,
  account: null,
  meta: null,
  wallets: [],
  remittance: truffleContract(remittanceJson),

  start: async function () {
    const { web3 } = this;
    try {
      this.remittance.setProvider(web3.currentProvider);
      this.setUpApp();
      this.hello();
      this.showContractBalance();
    } catch (error) {
      console.log(error);
      console.error("Could not connect to contract or chain.");
    }
  },

  hello: async function () {
    const deployed = await this.remittance.deployed();
    const num = await deployed.hello.call();
    this.setStatus(num.toString());
  },

  showContractBalance: async function () {
    const deployed = await this.remittance.deployed();
    const balance = await this.web3.eth.getBalance(deployed.address);
    const balanceElement = document.getElementById("contractBalance");
    balanceElement.innerHTML = balance;
  },

  setUpApp: function () {
    const { web3, wallets } = this;

    web3.eth
      .getAccounts()
      .then((accounts) => {
        if (accounts.length == 0) {
          throw new Error("No accounts with which to transact");
        }
        //account = accounts[0];
        return accounts;
      })
      .then((accountList) => {
        for (i = 0; i < 10; i++) {
          let address = accountList[i];
          wallets.push({ i, address });
        }
      })
      .catch(console.error);
  },

  setStatus: function (message) {
    const status = document.getElementById("status");
    status.innerHTML = message;
  },
};

window.App = App;

window.addEventListener("load", function () {
  if (window.ethereum) {
    // use MetaMask's provider
    App.web3 = new Web3(window.ethereum);
    window.ethereum.enable(); // get permission to access accounts
  } else {
    //Fall back local provider
    App.web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:8545"));
  }

  App.start();
});
