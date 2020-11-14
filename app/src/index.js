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
    const { web3, $ } = this;
    try {
      this.remittance.setProvider(web3.currentProvider);
      await this.setUpApp();
    } catch (error) {
      console.log(error);
      console.error("Could not connect to contract or chain.");
    }
  },

  //CORE METHODS
  deposit: async function () {
    //Validate inputs
    if (this.validateDeposit()) return;

    const gas = 4000000;
    const _depositor = $("#depositSender").val();
    const _remitter = $("#depositRemitter").val();
    const _password = $("#depositPassword").val();
    const _amount = $("#depositAmount").val();

    const deployed = await this.remittance.deployed();
    const { deposit, generateSecret, ledger } = deployed;

    const depositTxParamsObj = {
      from: _depositor,
      value: this.web3.utils.toWei(_amount, "ether"),
      gas: gas,
    };

    //Generate secrets
    const secretTxObj = await generateSecret(_remitter, _password, { from: _depositor });
    const { withdrawSecret, remitKey, refundSecret } = secretTxObj;

    try {
      //Simulate transaction
      await deposit.call(withdrawSecret, remitKey, refundSecret, depositTxParamsObj);
    } catch (err) {
      const errMessage = "The Deposit transaction will fail. Check your inputs and try again.";
      $("#status").html(errMessage);
      console.error(err);
      throw new Error(errMessage);
    }

    //send deposit transaction
    const txObj = await deposit(withdrawSecret, remitKey, refundSecret, depositTxParamsObj).on("transactionHash", (txHash) =>
      $("#status").html(`Deposit transaction on the way : [ ${txHash} ]`)
    );

    //clear input elems
    $("#depositSender").html("");
    $("#depositRemitter").html("");
    $("#depositPassword").html("");
    $("#depositAmount").html("");

    //UpdateUI & balances table
    this.updateUI(txObj, "Deposit");
  },

  validateDeposit: async function () {
    $("#depositSenderError").html("");
    $("#depositRemitterError").html("");
    $("#depositPasswordError").html("");
    $("#depositAmountError").html("");
    let hasError = false;

    if (!$("#depositSender").val()) {
      $("#depositSenderError").html("Depositor address is required").css("color", "red");
      hasError = true;
    }
    if (!$("#depositRemitter").val()) {
      $("#depositRemitterError").html("Remitter address is required");
      hasError = true;
    }
    if (!$("#depositPassword").val()) {
      $("#depositPasswordError").html("Receiver's password is required");
      hasError = true;
    }
    if (!$("#depositAmount").val() || $("#depositAmount").val() == 0) {
      $("#depositAmountError").html("Deposit Amount is required");
      hasError = true;
    }
    if ($("#depositAmount").val() == 0) {
      $("#depositAmountError").html("Can not deposit zero");
      hasError = true;
    }
    return !hasError;
  },
  validateWithdraw: async function () {},

  withdraw: async function () {
    const deployed = await this.remittance.deployed();
    const balance = await this.web3.eth.getBalance(deployed.address);
    console.log("balance: ", balance);
    console.log("Withdraw btn clicked");
  },

  withdraw: async function () {},

  refund: async function () {},

  setLockDuration: async function () {
    const lockDurationAmountElem = document.getElementById("lockDurationAmount");
    const deployed = await this.remittance.deployed();
    const { setLockDuration, MAX_DURATION } = deployed;

    const max_Duration = await MAX_DURATION.call(); // 3153600000;
    console.log("max_Duration: ", max_Duration);
    console.log("MAX_DURATION: ", MAX_DURATION);

    const newDurationInseconds = parseInt(lockDurationAmountElem.value);
    console.log("newDurationInseconds", newDurationInseconds);

    if (newDurationInseconds > max_Duration) {
      throw new Error(`Invalid lock Duration above maximum allowed value [] ${max_Duration} seconds ]`);
    } else if (newDurationInseconds === 0 || typeof newDurationInseconds == undefined) {
      throw new Error(`Invalid lock Duration value`);
    }

    const _deployer = this.wallets.find((w) => w.label === "Deployer");
    console.log("deployer address: ", _deployer.address);
    console.log("this.remittance.setLockDuration ", setLockDuration);
    const txObj = await setLockDuration.sendTransaction(newDurationInseconds, { from: _deployer.address });

    console.log("txObj : ", txObj);
    lockDurationAmountElem.value = "";
  },

  // DISPLAY METHODS

  updateUI: async function (txObj, txName) {
    if (!txObj.receipt.status) {
      console.error("Wrong status");
      console.error(txObj.receipt);
      $("#status").html(`There was an error in the ${txName} transaction execution, status not 1`).css("background", "#FF5733");
    } else if (txObj.receipt.logs.length == 0) {
      console.error("Empty logs");
      console.error(txObj.receipt);
      $("#status").html(`There was an error in the ${txName} transaction, missing expected event`).css("background", "#FF5733");
    } else {
      $("#status").html(`${txName} transaction executed`);
    }

    this.showAddressBalances();
    return;
  },

  showLockupDuration: async function () {
    const deployed = await this.remittance.deployed();
    const { lockDuration } = deployed;
    const lockUpSeconds = await lockDuration.call();
    const lockupDurationElement = document.getElementById("lockupDuration");
    lockupDurationElement.innerHTML = this.getLockDurationDisplay(lockUpSeconds);
  },

  getLockDurationDisplay: function (lockUpSeconds) {
    const DAY_DIVISOR = 86400;
    const HOUR_DIVISOR = 3600;
    const MINUTE_DIVISOR = 60;

    const remainderForHours = lockUpSeconds % DAY_DIVISOR;
    const dayCount = (lockUpSeconds - remainderForHours) / DAY_DIVISOR;

    const reaminderForMinutes = remainderForHours % HOUR_DIVISOR;
    const hourCount = (remainderForHours - reaminderForMinutes) / HOUR_DIVISOR;

    const reminderForSeconds = reaminderForMinutes % MINUTE_DIVISOR;
    const mniuteCount = (reaminderForMinutes - reminderForSeconds) / MINUTE_DIVISOR;

    const days = `${dayCount.toString()} DAYS`;
    const hrs = hourCount != 0 ? `${hourCount.toString()} HOURS` : ``;
    const mints = mniuteCount != 0 ? `${mniuteCount.toString()} MINUTES` : ``;
    const scds = reminderForSeconds != 0 ? `${reminderForSeconds.toString()} SECS` : ``;

    return `${days} ${hrs} ${mints} ${scds}`;
  },

  showContractBalance: async function () {
    const deployed = await this.remittance.deployed();
    const balanceInWei = await this.web3.eth.getBalance(deployed.address);
    const balanceElement = document.getElementById("contractBalance");
    const balanceInEther = this.web3.utils.fromWei(balanceInWei, "ether");
    balanceElement.innerHTML = `${parseFloat(balanceInEther).toFixed(4)} ETH`;
  },

  showAddressBalances: async function () {
    this.wallets.slice(0, 5).map((wallet) => {
      this.showAddressBalance(wallet);
    });
  },

  showAddressBalance: async function (wallet) {
    if (wallet.i > 5) {
      throw new Error("Invalid account index");
    }
    document.getElementById(`address${wallet.i}`).innerHTML = wallet.address;
    const balanceInWei = await this.web3.eth.getBalance(wallet.address);
    document.getElementById(`address${wallet.i}Balance`).innerHTML = this.web3.utils.fromWei(balanceInWei, "ether");
    document.getElementById(`address${wallet.i}Label`).innerHTML = wallet.label;
  },

  setUpApp: async function () {
    const { web3 } = this;

    const labels = ["Deployer", "Depositor", "Remitter", "Troll", "Other"];

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
          let label = labels[i];
          this.wallets.push({ i, address, label });
        }
      })
      .catch(console.error);

    await this.showContractBalance();
    await this.showAddressBalances();
    await this.showLockupDuration();
    await this.setStatus();
  },

  setStatus: function (message, tone) {
    const status = document.getElementById("status");
    //status.addClass("text-danger");
    message = "DAPP contract working normally";
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
