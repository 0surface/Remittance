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

    mapping(address => remit) public ledger;

    modifier passwordsAreValid(string memory handlerPassword, string memory receiverPassword) {
        require(keccak256(abi.encodePacked(handlerPassword)) != keccak256(abi.encodePacked("")), "handlerPassword can not be empty");
        require(keccak256(abi.encodePacked(receiverPassword)) != keccak256(abi.encodePacked("")), "receiverPassword can not be empty");
        require(keccak256(abi.encodePacked(handlerPassword)) != keccak256(abi.encodePacked(receiverPassword)), "passwords can not be the same");
        _;
    }

    constructor(){
        //TODO: add Ownable library
        //TODO: add Pausable library
        //TDDO: add Destructable library
    }

    function getRemitAmount(address ledgerKey) public view returns(uint amount) {
        return ledger[ledgerKey].amount;
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
    

    /*
    @dev deposit money into contract ledger
    @param handler = the address of the intermediary which performs ether to other currency exhange
    @param hashedSecret = keccak256 hash
    */
    function deposit(bytes32 secretHash, address handler) public payable {
        require(msg.value != 0, "Invalid minimum amount");  
        require(handler != address(0), "Can not deposit into null address");
        
        remit memory tmp = remit({secret : secretHash, amount : msg.value});
        ledger[handler] = tmp;
    }

    /*
    @dev transfer value to caller
    @param 
     */
    function withdraw(string memory handlerPassword, string memory receiverPassword) 
        passwordsAreValid(handlerPassword,receiverPassword) external 
    {        
        remit memory owed =  ledger[msg.sender];
        uint _amount = owed.amount;
        bytes32 _secret = owed.secret;

        require(_amount != 0 && _secret != "", "Sender is not owed a withdrawal");
        require(generateSecret(handlerPassword, receiverPassword) == _secret, "Incorrect passwords");

        ledger[msg.sender].amount = 0;
        ledger[msg.sender].secret = "";
        
        //TODO:check msg.sender is contract, "human" - act differently        

        (bool success, ) = (msg.sender).call{value: _amount}("");        
        require(success, "withdraw failed");        
    }
}
