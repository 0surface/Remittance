// SPDX-License-Identifier: MIT
pragma solidity 0.7.0;

import "./Pausable.sol";

/*
 * @title Remittance
 * @dev Implements an off-line payment settlement system via an intermediary
 */
contract Remittance is Pausable {

    struct Remit {
        bytes32 secret;
        uint amount;
    }

    mapping(bytes32 => Remit) public ledger;

    event LogDeposited(address indexed depositor, uint deposited, bytes32 secret, bytes32 key);
    event LogWithdrawal(address indexed withdrawer, uint withdrawn, string handlerPassword, string receiverPassword);

    modifier passwordsAreValid(string memory handlerPassword, string memory receiverPassword) {
        require(bytes(handlerPassword).length > 0,"handlerPassword can not be empty");
        require(bytes(receiverPassword).length > 0,"receiverPassword can not be empty");
        require(keccak256(abi.encodePacked(handlerPassword)) != keccak256(abi.encodePacked(receiverPassword)), "passwords can not be the same");
        _;
    }

    constructor() { }

    /*
    @dev generates keccak256 hash from params
    @param non null address
    @param non-empty string values
     */
    function generateSecret(address handlerAddress, string memory handlerPassword, string memory receiverPassword)         
        passwordsAreValid(handlerPassword,receiverPassword) 
        pure public  
        returns(bytes32 hashedSecret, bytes32 handlerKey) 
    {        
        bytes32 _handlerKey = generateHandlerKey(handlerAddress,handlerPassword);            

        return (keccak256(abi.encodePacked(_handlerKey, receiverPassword)), _handlerKey);
    }    

    /*
     *@dev generates keccak256 hash from address and string
     */
    function generateHandlerKey(address handlerAddress, string memory handlerPassword) private pure returns (bytes32) {
        require(bytes(handlerPassword).length > 0,"handler password can not be empty");
        require(handlerAddress != address(0), "handler address can not be null");
        return keccak256(abi.encodePacked(handlerAddress, handlerPassword));
    }

    /*
    @dev deposit money into contract ledger
    @param handler = the address of the intermediary which performs ether to other currency exhange
    @param hashedSecret = keccak256 hash
    */
    function deposit(bytes32 secretHash, bytes32 handlerKey) public whenNotPaused payable {
        require(msg.value != 0, "Invalid minimum amount");  
        require(secretHash.length == 32 && secretHash != bytes32(""), "Invalid secretHash value");
        require(handlerKey.length == 32 && handlerKey != bytes32(""), "Invalid handlerKey value");
        require(secretHash != handlerKey, "secretHash and handlerKey can not be identical");

        //SLOAD
        Remit memory existing = ledger[handlerKey];
        require(existing.amount == 0, "Invalid, handler Key has active deposit");
        
        //SSTORE
        Remit memory newEntry = Remit({secret : secretHash, amount : msg.value});
        ledger[handlerKey] = newEntry;
        emit LogDeposited(msg.sender, msg.value, secretHash, handlerKey);
    }

    /*
    @dev transfer value to caller
    @params string passwords 
     */
    function withdraw(string memory handlerPassword, string memory receiverPassword) 
        passwordsAreValid(handlerPassword,receiverPassword) 
        whenNotPaused
        external 
    {   
        (bytes32 _withdrawSecret, bytes32 _ledgerKey) = generateSecret(msg.sender, handlerPassword, receiverPassword);
        
        //SLOAD
        Remit memory owed =  ledger[_ledgerKey];
        uint _amount = owed.amount;
        bytes32 _secret = owed.secret;
        require(_amount != 0 && _secret != "", "Sender is not owed a withdrawal");
        
        require(_withdrawSecret == _secret, "Passwords are incorrect");

        //SSTORE
        ledger[_ledgerKey].amount = 0;
        ledger[_ledgerKey].secret = "";              

        (bool success, ) = (msg.sender).call{value: _amount}("");        
        require(success, "withdraw failed");     
        emit LogWithdrawal(msg.sender,_amount, handlerPassword, receiverPassword);
    }
}
