// SPDX-License-Identifier: MIT
pragma solidity 0.7.0;

import "./Pausable.sol";

/*
 * @title Remittance
 * @dev Implements an off-line payment settlement system via an intermediary
 */
contract Remittance is Pausable {
    
    uint constant public DEFAULT_LOCK_DURATION = 432000 seconds; //5 days
    uint constant public MAX_DURATION = 3153600000; //100 years
    bytes32 NULL_BYTES32 = bytes32(0); 
    
    uint public lockDuration = DEFAULT_LOCK_DURATION;

    struct Remit {
        bytes32 withdrawHash;
        bytes32 refundHash;
        uint amount;
        uint deadline; 
    }

    mapping(bytes32 => Remit) public ledger;

    modifier remitInputsAreValid(address remitterAddress, string memory receiverPassword) {
        require(remitterAddress != address(0), "remitter address can not be null");
        require(bytes(receiverPassword).length > 0,"receiverPassword can not be empty");
        _;
    }

    event LogDeposited(address indexed depositor, uint deposited, bytes32 secret, bytes32 key, bytes32 refundHash );
    event LogWithdrawal(address indexed withdrawer, uint withdrawn, string receiverPassword);
    event LogLockDurationSet(address indexed owner, uint oldDuration, uint newDuration);
    event LogRefund(address indexed refundee, uint amount, address  remitterAddress, string receiverPassword);

    constructor() { }

    /*
    *@dev set the lockDuration value
    *@param uint
    */
    function setLockDuration(uint newDuration) onlyOwner whenNotPaused public {
        require(newDuration > 0, "Invalid minumum lock duration");        
        require(newDuration < MAX_DURATION, "Invalid maximum lock duration");
        uint _oldValue = lockDuration;
        lockDuration = newDuration;
        emit LogLockDurationSet(msg.sender, _oldValue, newDuration);
    }        

    /*
    @dev generates keccak256 hash from params
    @param non null address
    @param non-empty string values
     */
    function generateSecret(address remitterAddress, string memory receiverPassword) 
        view public 
        whenNotPaused
        remitInputsAreValid(remitterAddress, receiverPassword)
        returns(bytes32 withdrawSecret, bytes32 remitKey, bytes32 refundSecret) 
    {   
        return (generateSecretHash(remitterAddress, receiverPassword),
                generateKeyHash(receiverPassword, remitterAddress),
                generateSecretHash(msg.sender, receiverPassword));
    }   

    /*
     *@dev generates keccak256 hash from string and address
     */
    function generateKeyHash(string memory _password, address _address) 
        pure private returns (bytes32 keyHash){
        return keccak256(abi.encodePacked(_password, _address));
    }

    /*
     *@dev generates keccak256 hash from address and string
     */
    function generateSecretHash(address _address, string memory _password) 
        pure private returns (bytes32 secretHash) {
        return keccak256(abi.encodePacked(_address, _password));
    }

    /*
     *@dev deposit value to contract
     *@params bytes32
     */
    function deposit(bytes32 withdrawSecret, bytes32 remitKey, bytes32 refundSecret) public whenNotPaused payable {
        require(msg.value > 0, "Invalid minimum amount");  
        require(withdrawSecret != NULL_BYTES32, "Invalid withdrawSecret value");
        require(remitKey != NULL_BYTES32, "Invalid remitKey value");
        require(refundSecret != NULL_BYTES32, "Invalid refundSecret value");
        require(withdrawSecret != refundSecret, "withdrawSecret and refundSecret can not be identical");

        //SLOAD
        require(ledger[remitKey].amount == 0, "Invalid, remit Key has an active deposit");        
        
        //SSTORE
        ledger[remitKey] = Remit({ 
            withdrawHash: withdrawSecret, 
            refundHash: refundSecret, 
            amount: msg.value, 
            deadline: (block.timestamp + lockDuration) 
        });
        emit LogDeposited(msg.sender, msg.value, withdrawSecret, remitKey, refundSecret);
    }

    /*
    @dev transfer value to caller
    @params string password 
     */
    function withdraw(string memory receiverPassword) 
        whenNotPaused
        external 
    {   
        require(bytes(receiverPassword).length > 0,"receiverPassword can not be empty");
        bytes32 _ledgerKey = generateKeyHash(receiverPassword, msg.sender);

        //SLOAD
        Remit memory entry = ledger[_ledgerKey];
        uint _amount = entry.amount;

        require(_amount != 0, "Caller is not owed a withdrawal");
        require(generateSecretHash(msg.sender, receiverPassword) == entry.withdrawHash, "receiverPassword is incorrect");

        //SSTORE
        ledger[_ledgerKey] = Remit({ 
            withdrawHash: "", 
            refundHash: "", 
            amount: 0, 
            deadline: 0 
        });
        
        emit LogWithdrawal(msg.sender, _amount, receiverPassword);
        (bool success, ) = (msg.sender).call{value: _amount}("");        
        require(success, "withdraw failed");        
    }

    function refund(address remitterAddress, string memory receiverPassword)
        whenNotPaused
        remitInputsAreValid(remitterAddress, receiverPassword)
        external 
    {
        require(bytes(receiverPassword).length > 0,"receiverPassword can not be empty");
        bytes32 _ledgerKey = generateKeyHash(receiverPassword, remitterAddress);
         
        //SLOAD
        Remit memory entry = ledger[_ledgerKey];
        uint _amount = entry.amount;

        require(_amount != 0, "Caller is not owed a refund");
        require(generateSecretHash(msg.sender, receiverPassword) == entry.refundHash, "receiverPassword is incorrect");
        require(block.timestamp > entry.deadline, "deposit is not yet eligible for refund");

        //SSTORE
        ledger[_ledgerKey] = Remit({ 
            withdrawHash: "", 
            refundHash: "", 
            amount: 0, 
            deadline: 0 
        });
        
        emit LogRefund(msg.sender, _amount, remitterAddress, receiverPassword);
        (bool success, ) = (msg.sender).call{value: _amount}("");        
        require(success, "refund failed");
    }
}
