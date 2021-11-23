const UniswapV2Factory = artifacts.require("UniswapV2Factory");
const UniswapV2Pair = artifacts.require("UniswapV2Pair");
const fs = require('fs');

async function main() {
    const chainID = await web3.eth.getChainId();
    const accounts = await web3.eth.getAccounts();
    console.log("accounts:", accounts, chainID, await web3.eth.getBalance(accounts[0]));
    const factory = await UniswapV2Factory.new(accounts[0]);
    const FACTORY_ADDRESS = factory.address;
    const INIT_CODE_HASH = web3.utils.keccak256(UniswapV2Pair.bytecode);
    console.log('FACTORY_ADDRESS:', FACTORY_ADDRESS);
    //console.log('INIT_CODE_HASH:', web3.utils.keccak256(UniswapV2Pair.deployedBytecode));
    console.log('INIT_CODE_HASH:', INIT_CODE_HASH);
    fs.writeFileSync(`./factory_${chainID}.json`, JSON.stringify({
        FACTORY_ADDRESS,
        INIT_CODE_HASH, 
    }))
}

module.exports = function (cbk) {
    main().then(cbk).catch(cbk);
};