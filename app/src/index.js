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
    if (await this.validateDeposit()) return;

    const gas = 4000000;
    const _depositor = $("#depositSender").val();
    const _remitter = $("#depositRemitter").val();
    const _password = $("#depositPassword").val();
    const _amount = $("#depositAmount").val();

    const deployed = await this.remittance.deployed();
    const { deposit, generateSecret } = deployed;

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
    return hasError;
  },

  validateWithdraw: async function () {
    $("#withdrawPasswordError").html("");
    $("#withdrawerAddressError").html("");
    let hasError = false;

    if (!$("#withdrawPassword").val()) {
      $("#withdrawPasswordError").html("Withdraw password is required");
      hasError = true;
    }

    if (!$("#withdrawerAddress").val()) {
      $("#withdrawerAddressError").html("Withdrawe address is missing");
      hasError = true;
    }

    return hasError;
  },

  withdraw: async function () {
    console.log("withdraw ");
    //Validate input
    if (await this.validateWithdraw()) return;
    const _password = $("#withdrawPassword").val();
    const _withdrawer = $("#withdrawerAddress").val();

    const deployed = await this.remittance.deployed();
    const { withdraw } = deployed;
    const withdrawTxParamsObj = { from: _withdrawer };

    try {
      //Simulate withdrawal
      await withdraw.call(_password, withdrawTxParamsObj);
    } catch (err) {
      const errMessage = "Your Withdraw transaction will fail. Check your inputs and try again.";
      $("#status").html(errMessage);
      console.error(err);
      throw new Error(errMessage);
    }

    //Send withdrawal transaction
    const txObj = await withdraw(_password, withdrawTxParamsObj).on("transactionHash", (txHash) =>
      $("#status").html(`Withdraw transaction on the way : [ ${txHash} ]`)
    );

    await this.updateUI(txObj, "Withdraw");
    $("#withdrawPassword").html("");
  },

  refund: async function () {
    if (await this.validateRefund()) return;
    const _depositorAddress = $("#refundDepositor").val();
    const _remitterAddress = $("#refundRemitter").val();
    const _password = $("#refundPassword").val();

    const deployed = await this.remittance.deployed();
    const { refund } = deployed;
    const refundTxParamsObj = { from: _depositorAddress };

    try {
      await refund.call(_remitterAddress, _password, refundTxParamsObj);
    } catch (err) {
      const errMessage = "Your Refund transaction will fail. Check your inputs and try again.";
      $("#status").html(errMessage);
      console.error(err);
      throw new Error(errMessage);
    }

    const txObj = await refund(_remitterAddress, _password, refundTxParamsObj).on("transactionHash", (txHash) =>
      $("#status").html(`Refund transaction on the way : [ ${txHash} ]`)
    );

    await this.updateUI(txObj, "Refund");
    $("#refundRemitter").html("");
    $("#refundPassword").html("");
  },

  validateRefund: async function () {
    $("#refundDepositorError").html("");
    $("#refundRemitterError").html("");
    $("#refundPasswordError").html("");
    let hasError = false;

    if (!$("#refundDepositor").val()) {
      $("#refundDepositorError").html("Depsositor address is required");
      hasError = true;
    }

    if (!$("#refundRemitter").val()) {
      $("#refundRemitterError").html("Remitter address is required");
      hasError = true;
    }

    if (!$("#refundPassword").val()) {
      $("#refundPasswordError").html("Refund address is required");
      hasError = true;
    }

    return hasError;
  },

  setLockDuration: async function () {
    if (await this.validateLockDuration()) return;
    const _newDuration = parseInt($("#lockDurationAmount").val());
    const _deployer = this.wallets.find((w) => w.label === "Deployer");

    const deployed = await this.remittance.deployed();
    const { setLockDuration } = deployed;

    const txObjParams = { from: _deployer.address };

    try {
      await setLockDuration.call(_newDuration, txObjParams);
    } catch (err) {
      const errMessage = "Your setLockDuration transaction will fail. Check your input and try again.";
      $("#status").html(errMessage);
      console.error(err);
      throw new Error(errMessage);
    }

    const txObj = await setLockDuration(_newDuration, txObjParams).on("transactionHash", (txHash) =>
      $("#status").html(`setLockDuration transaction on the way : [ ${txHash} ]`)
    );

    await this.updateUI(txObj, "lockDuration");
    $("#lockDurationAmount").html("");
    this.showLockupDuration();
  },

  validateLockDuration: async function () {
    let hasError = false;
    if (!$("#lockDurationAmount").val()) {
      $("#lockDurationAmountError").html("Lock duration is required");
      hasError = true;
    }
    if (parseInt($("#lockDurationAmount").val()) === NaN || $("#lockDurationAmount").val() == 0) {
      $("#lockDurationAmountError").html("Lock duration is invalid");
      hasError = true;
    }
    return hasError;
  },

  pauseContract: async function () {
    const _deployer = this.wallets.find((w) => w.label === "Deployer");
    const deployed = await this.remittance.deployed();
    const { pause } = deployed;
    const txParamsObj = { from: _deployer.address };
    try {
      await pause.call(txParamsObj);
    } catch (err) {
      const errMessage = "Your pause transaction will fail. Check your balance/account and try again.";
      $("#status").html(errMessage);
      console.error(err);
      throw new Error(errMessage);
    }

    const txObj = await pause(txParamsObj).on("", (txHash) =>
      $("#status").html(`Your pause transaction on the way : [ ${txHash} ]`)
    );

    await this.updateUI(txObj, "pause");
    await this.setStatus("The Contract is Currently paused!", "pause");
  },

  resumeContract: async function () {
    const _deployer = this.wallets.find((w) => w.label === "Deployer");
    const deployed = await this.remittance.deployed();
    const { unpause } = deployed;
    const txParamsObj = { from: _deployer.address };
    try {
      await unpause.call(txParamsObj);
    } catch (err) {
      const errMessage = "Your unpause transaction will fail. Check your balance/account and try again.";
      $("#status").html(errMessage);
      console.error(err);
      throw new Error(errMessage);
    }

    const txObj = await unpause(txParamsObj).on("", (txHash) =>
      $("#status").html(`Your resume transaction is on the way : [ ${txHash} ]`)
    );

    await this.updateUI(txObj, "resume");
    await this.setStatus("", "");
  },

  // DISPLAY METHODS

  updateUI: async function (txObj, txName) {
    if (!txObj.receipt.status) {
      console.error("Wrong status");
      console.error(txObj.receipt);
      await this.setStatus(`There was an error in the ${txName} transaction execution, status not 1`, `error`);
    } else if (txObj.receipt.logs.length == 0) {
      console.error("Empty logs");
      console.error(txObj.receipt);
      await this.setStatus(`There was an error in the ${txName} transaction, missing expected event`, `error`);
    } else {
      await this.setStatus(`${txName} transaction executed`, ``);
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

    if (tone == "pause") {
      status.innerHTML = message;
      $("#status").addClass("alert-danger").removeClass("alert-primary");
    } else if (tone == "error") {
      status.innerHTML = message;
      $("#status").addClass("alert-warning").removeClass("alert-primary");
    } else {
      status.innerHTML = "DAPP contract working normally";
      $("#status").addClass("alert-sucess").removeClass("alert-danger");
    }
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
