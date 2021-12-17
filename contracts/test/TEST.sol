pragma solidity =0.6.6;
import "../libraries/UniswapV2Library.sol";
contract PairFor {
        // calculates the CREATE2 address for a pair without making any external calls
    function pairFor(address factory, address tokenA, address tokenB) public pure returns (address pair) {
       return UniswapV2Library.pairFor(factory, tokenA, tokenB);
    }

    // calculates the CREATE2 address for a pair without making any external calls
    function pairForX(address factory, address tokenA, address tokenB) public pure returns (bytes memory, bytes32, bytes memory, bytes32, address) {
        (address token0, address token1) = UniswapV2Library.sortTokens(tokenA, tokenB);
        bytes memory tokenPacked = abi.encodePacked(token0, token1);
        bytes32 tokenHash = keccak256(tokenPacked);
        bytes memory finalBytes = abi.encodePacked(
                hex'ff',
                factory,
                tokenHash,
                hex'3219438fd390818ae77173fa95298240dab79e38c7842f1e6512503b9c82e52f' // init code hash
            );
        bytes32 dataHash = keccak256(finalBytes);
        
            // new 0xd91ce99df031584f1cac7d4375e0a1a6f68d7f933304409548f2948911fdcb91
            // old 3219438fd390818ae77173fa95298240dab79e38c7842f1e6512503b9c82e52f
        return (tokenPacked, tokenHash, finalBytes, dataHash, address(uint(dataHash)));
    }

}