pragma solidity =0.6.6;

import {ERC20, ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/drafts/ERC20Permit.sol";

contract KAFKA is ERC20("KAFKA", "KAFKA"), ERC20Permit("KAFKA"), ERC20Burnable {
  constructor() public{
      ERC20._mint(msg.sender, 21000000e18);
  }
}
