pragma solidity =0.6.6;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract KAFKA is ERC20("KAFKA", "KAFKA") {
  constructor() public{
      ERC20._mint(msg.sender, 21000000e18);
  }
}
