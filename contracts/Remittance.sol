// SPDX-License-Identifier: MIT
pragma solidity 0.7.0;

/*
 * @title Remittance
 * @dev Implements an off-line payment settlement system via an intermediary
 */
contract Remittance {

    struct remit {
        bytes32 secret;
        uint amount;
    }

    mapping(address => remit) ledger;

    modifier passwordsAreValid(string memory handlerPassword, string memory receiverPassword) {
        require(!compareStringsbyBytes(handlerPassword, ""), "handlerPassword can not be empty");
        require(!compareStringsbyBytes(receiverPassword,""), "receiverPassword can not be empty");
        require(!compareStringsbyBytes(handlerPassword,receiverPassword), "passwords can not be the same");
        _;
    }

    constructor(){
        
    }

    function hello() public pure returns(uint random) {
        return 42;
    }

    /*
    @dev generates keccak256 hash from params
    @param secret1 = string value
    @param secret2 = string value
     */
    function generateSecret(string memory handlerPassword, string memory receiverPassword) 
        passwordsAreValid(handlerPassword,receiverPassword) 
        pure public  
        returns(bytes32 hashedSecret) 
    {
        return keccak256(abi.encodePacked(handlerPassword, receiverPassword));
    }

    function compareStringsbyBytes(string memory s1, string memory s2) public pure returns(bool){
        return keccak256(abi.encodePacked(s1)) == keccak256(abi.encodePacked(s2));
    }

    /*
    @dev deposit money into contract ledger
    @param handler = the address of the intermediary which performs ether to other currency exhange
    @param hashedSecret = keccak256 hash
    */
    function deposit(address handler, bytes32 secretPass) public payable {
        require(msg.value != 0, "Invalid minimum amount");        
        remit memory tmp;
        tmp.secret = secretPass;
        tmp.amount = msg.value;
        ledger[handler] = tmp;
    }

    /*
    @dev transfer value to caller
    @param 
     */
    function withdraw(string memory handlerPassword, string memory receiverPassword) passwordsAreValid(handlerPassword,receiverPassword) external {
        require(generateSecret(handlerPassword, receiverPassword) == ledger[msg.sender].secret, "Incorrect password");
        
        (bool success, ) = (msg.sender).call{value: ledger[msg.sender].amount}("");
        require(success, "withdraw failed");
        ledger[msg.sender].amount = 0;
        ledger[msg.sender].secret = "";
    }
}
