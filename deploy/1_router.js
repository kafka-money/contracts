const UniswapV2Router02 = artifacts.require("UniswapV2Router02");
const WETH = artifacts.require("WETH");
const Multicall2 = artifacts.require("Multicall2");

const FACTORY_ADDRESS = '0x309735093707c8A04e46B082a940A5daE89dd3E6';
//const WETH_ADDRESS = '0xfe0c9243e6559454058e9A050D2fC61144A72167';undefined;
const WETH_ADDRESS = undefined;

function exist(address) {
    return web3.eth.getCode(address).then(code=>code!='0x');
}

async function main() {
    const accounts = await web3.eth.getAccounts();
    console.log("accounts:", accounts);
    const weth = !WETH_ADDRESS ? await WETH.new() : await WETH.at(WETH_ADDRESS);
    console.log("WETH:", weth.address);
    const router = await UniswapV2Router02.new(FACTORY_ADDRESS, weth.address, {gas:"4294967290"});
    const multicall = await Multicall2.new();
    console.log('FACTORY_ADDRESS:', FACTORY_ADDRESS, await exist(FACTORY_ADDRESS))
    console.log('ROUTER_ADDRESS:', router.address, await exist(router.address));
    console.log('WETH:', weth.address, await exist(weth.address));
    console.log('MULTICALL:', multicall.address, await exist(multicall.address));

}

module.exports = function (cbk) {
    main().then(cbk).catch(cbk);
};