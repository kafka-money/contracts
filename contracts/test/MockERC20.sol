import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Mock is ERC20 {
    constructor(string memory name, string memory symbol, uint8 _decimals) public ERC20(name, symbol) {
        ERC20._setupDecimals(_decimals);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}