// SPDX-License-Identifier: MIT
pragma solidity 0.7.0;

import "./Pausable.sol";

/*
 * @title Remittance
 * @dev Implements an payment settlement system via an intermediary
 */
contract Remittance is Pausable {
      
    uint constant public MAX_DURATION = 3153600000; //100 years
    uint constant public MIN_DURATION = 0;
    bytes32 constant NULL_BYTES32 = bytes32(0); 

    struct Remit {        
        uint amount;
        uint deadline;
        address depositor;
    }

    mapping(bytes32 => Remit) public ledger;

    event LogDeposited(address indexed depositor, uint deposited, bytes32 key, uint withdrawalDeadline);
    event LogWithdrawal(address indexed withdrawer, uint withdrawn, string receiverPassword, bytes32 key);    
    event LogRefund(address indexed refundee, uint refunded, bytes32 key);

    constructor() { }
    /*
    @dev generates keccak256 hash from params
    @param non null address
    @param non-empty string value
     */
    function generateKey(address remitterAddress, string memory receiverPassword) 
        view public 
        whenNotPaused
        returns(bytes32 remitKey) 
    {   
        require(remitterAddress != address(0), "remitter address can not be null");
        require(bytes(receiverPassword).length > 0,"receiverPassword can not be empty");
        return keccak256(abi.encodePacked(receiverPassword, remitterAddress, this));
    }    

    /*
     *@dev deposit value to contract
     *@params bytes32 key, uint duration
     */
    function deposit(bytes32 remitKey, uint depositLockDuration) public whenNotPaused payable {
        require(msg.value > 0, "Invalid minimum deposit amount");
        require(remitKey != NULL_BYTES32, "Invalid remitKey value");
        require(depositLockDuration > MIN_DURATION, "Invalid minumum lock duration");        
        require(depositLockDuration < MAX_DURATION, "Invalid maximum lock duration");        

        //SLOAD
        Remit memory entry = ledger[remitKey];
        require(entry.amount == 0, "Invalid, remit Key has an active deposit"); 
        require(entry.depositor == address(0), "Invalid, Password has previously been used");
               
        uint withdrawalDeadline = block.timestamp + depositLockDuration;

         //SSTORE
        ledger[remitKey] = Remit({ 
            depositor: msg.sender, 
            amount: msg.value, 
            deadline: withdrawalDeadline
        });
        emit LogDeposited(msg.sender, msg.value, remitKey, withdrawalDeadline);
    }

    /*
    @dev transfer value to caller
    @params string password 
     */
    function withdraw(string memory receiverPassword) 
        whenNotPaused
        external 
    { 
        bytes32 _ledgerKey = generateKey(msg.sender, receiverPassword);

        //SLOAD
        Remit memory entry = ledger[_ledgerKey];
        uint _amount = entry.amount;

        require(_amount != 0, "Caller is not owed a withdrawal");
        require(block.timestamp < entry.deadline, "withdrawal period has expired");

        //SSTORE
        ledger[_ledgerKey].amount = 0;
        ledger[_ledgerKey].deadline = 0;
        
        emit LogWithdrawal(msg.sender, _amount, receiverPassword,_ledgerKey);
        (bool success, ) = (msg.sender).call{value: _amount}("");        
        require(success, "withdraw failed");        
    }

    function refund(bytes32 remitKey)
        whenNotPaused
        external 
    { 
        //SLOAD
        Remit memory entry = ledger[remitKey];
        uint _amount = entry.amount;
        
        require(entry.depositor == msg.sender, "Caller is not depositor");
        require(_amount != 0, "Caller is not owed a refund");
        require(block.timestamp > entry.deadline, "Deposit is not yet eligible for refund");

        //SSTORE
        ledger[remitKey].amount = 0;
        ledger[remitKey].deadline = 0;
        
        emit LogRefund(msg.sender, _amount, remitKey);
        (bool success, ) = (msg.sender).call{value: _amount}("");        
        require(success, "refund failed");
    }
}
