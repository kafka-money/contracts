pragma solidity >=0.5.0;

contract Test {
}
contract Block{
    function create2() external returns(Test) {
        return new Test{salt:bytes32(now)}();
    }
    function getBlockNumber() external view returns (uint) {
        return block.number;
    }
    function getBalance(address a) external view returns(uint) {
        return a.balance;
    }
    function getTime() external view returns(uint) {
        return now;
    }
    function getsender() external view returns(address) {
        return msg.sender;
    }
}