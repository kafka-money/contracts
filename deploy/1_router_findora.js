const UniswapV2Router02 = artifacts.require("FDR_UniswapV2Router02");
const UniswapV2Router02Fuck = artifacts.require("UniswapV2Router02Fuck");
const WETH = artifacts.require("WETH");
const Multicall2 = artifacts.require("Multicall2");
const KAFKA = artifacts.require("KAFKA");

const fs = require('fs');

const WETH_ADDRESS = undefined;
//const WETH_ADDRESS = undefined;

function exist(address) {
    return web3.eth.getCode(address).then(code=>code!='0x');
}

async function main() {
    const chainID = await web3.eth.getChainId();
    const accounts = await web3.eth.getAccounts();
    console.log("accounts:", accounts, chainID);
    const {FACTORY_ADDRESS, INIT_CODE_HASH} = require(`../factory_${chainID}.json`);
    const weth = !WETH_ADDRESS ? await WETH.new() : await WETH.at(WETH_ADDRESS);
    console.log("WETH:", weth.address);
    const uni = await KAFKA.new();
    const routerFuck = await UniswapV2Router02Fuck.new(FACTORY_ADDRESS, weth.address);
    const router = await UniswapV2Router02.new(FACTORY_ADDRESS, weth.address, routerFuck.address);
    const multicall = await Multicall2.new();
    console.log('ROUTER_FUCK:', routerFuck.address, await exist(routerFuck.address));
    console.log('------------------------------------------------');
    console.log('INIT_CODE_HASH:', INIT_CODE_HASH);
    console.log('FACTORY_ADDRESS:', FACTORY_ADDRESS, await exist(FACTORY_ADDRESS))
    console.log('ROUTER_ADDRESS:', router.address, await exist(router.address));
    console.log('WETH:', weth.address, await exist(weth.address));
    console.log('MULTICALL:', multicall.address, await exist(multicall.address));
    console.log("UNI:", uni.address, await exist(uni.address));
    fs.writeFileSync(`./factory_${chainID}.json`, JSON.stringify({
        FACTORY_ADDRESS,
        INIT_CODE_HASH,
        ROUTER_ADDRESS: router.address,
        WETH: weth.address,
        MULTICALL: multicall.address,
        UNI: uni.address,
    }))

}

module.exports = function (cbk) {
    main().then(cbk).catch(cbk);
};