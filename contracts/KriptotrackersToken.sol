pragma solidity ^0.5.2;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Pausable.sol";

contract KriptotrackersToken is  ERC20, ERC20Detailed, ERC20Mintable,ERC20Pausable{

	constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    )
        ERC20Pausable()
        ERC20Mintable()
        ERC20Detailed(_name, _symbol, _decimals)
        ERC20()
        public
    {}
}
