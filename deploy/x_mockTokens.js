const ERC20Mock = artifacts.require("ERC20Mock");
const WETH = artifacts.require("WETH");
const UniswapV2Router02 = artifacts.require("UniswapV2Router02");
const fs = require('fs');
const BN = web3.utils.BN;

const D = console.log;

//const bn = x=>(new BN(x));
const bn = (n,x=10)=>new web3.utils.BN(n,x)
const nDecimals = (n,d=18)=>bn(n).mul(bn(10).pow(bn(d)));
const uDecimals = nDecimals(1, 18);

const TestAddresses = [
    "0x7A6Ed0a905053A21C15cB5b4F39b561B6A3FE50f",
    "0x855Ac656956AF761439f4a451c872E812E3900a4",
    "0x7806E77aE5C1726845762A983291241bc3a3f854",
    "0x6affBDeEF3418163a9537988F01816d6b43619AA"
]

const logos = require('../logo.json');

const Tokens = [{
    name:"USDC",
    symbol: "USDC",
    decimals: 6,
    price: 1
},{
    name:"USDT",
    symbol: "USDT",
    decimals: 18,
    price: 1
},{
    name:"DAI",
    symbol: "DAI",
    decimals: 18,
    price: 1
},{
    name:"BTC",
    symbol: "BTC",
    decimals: 8,
    price: 59000
},{
    name:"ETH",
    symbol: "ETH",
    decimals: 18,
    price: 3900
}]

async function faucet(tokens) {
    const chainId = await web3.eth.getChainId();
    const accounts = await web3.eth.getAccounts();
    TestAddresses.push(accounts[0]);
    for (let tester of TestAddresses) {
        D('mint faucet:', tester, tokens.length);
        if (chainId == 1337 || chainId == 31337)
            await web3.eth.sendTransaction({ from:accounts[0], to: tester, value: nDecimals(2, 18) });
        for(let token of tokens) {
            const amount = nDecimals(1000000, token.info.decimals);
            console.log("mint:", token.info.symbol, amount.toString())
            await token.mint(tester, amount);
        }
    }
}

const now = ()=>Math.floor(Number(new Date())/1000);

let deployed;
const keccak256 = x => web3.utils.keccak256(`0x${x}`).slice(2);

const hex20 = x=>'0'.repeat(40-x.length)+x
function pairAddress(token0, token1) {
    token0 = token0.slice(2)
    token1 = token1.slice(2)
    //console.log()
    if((bn(token1,16).lt(bn(token0,16)))) {
        [token0, token1] = [token1, token0];
    }
    const tokenPacked = hex20(token0)+hex20(token1);
    const tokenHash = keccak256(tokenPacked);
    const pairPacked = `ff${deployed.FACTORY_ADDRESS.slice(2)}${tokenHash}${deployed.INIT_CODE_HASH.slice(2)}`;
    //console.log({tokenPacked, tokenHash, pairPacked})
    const pairAddress = keccak256(pairPacked);
    return `0x${pairAddress.slice(-40)}`;
}

function exist(address) {
    return web3.eth.getCode(address).then(code=>code!='0x');
}

async function addLp(tokens) {
    const accounts = await web3.eth.getAccounts();
    const chainID = await web3.eth.getChainId();
    deployed = require(`../factory_${chainID}.json`);
    const router = await UniswapV2Router02.at(deployed.ROUTER_ADDRESS);
    const uni = await ERC20Mock.at(deployed.UNI);
    const weth = await WETH.at(deployed.WETH);
    uni.info = {price: 2, decimals: 18}
    weth.info = {price: 10, decimals: 18}
    const value = bn(100000);
    const extTokens = [...tokens, uni, weth]
    for(const i in extTokens) {
        const token0 = extTokens[i];
        const info = token0.info;
        const token0Amount = nDecimals(1, info.decimals).mul(value).div(bn(info.price));
        for(let j = Number(i)+1; j < extTokens.length; j++) {
            const token1 = extTokens[j];
            const info = token1.info;
            const token1Amount = nDecimals(1, info.decimals).mul(value).div(bn(info.price));
            if(token0 == weth) await weth.deposit({value:token0Amount})
            if(token1 == weth) await weth.deposit({value:token1Amount})
            await token0.approve(router.address, token0Amount);
            await token1.approve(router.address, token1Amount);
            console.log("addLiquidity-1")
            await router.addLiquidity(token0.address, token1.address, token0Amount, token1Amount, 0, 0, accounts[0], uDecimals); 
            console.log("addLiquidity-2")
            const pair = pairAddress(token0.address, token1.address);
            console.log(i, token0.info.symbol, token1.info.symbol, pair, await exist(pair));
        }
    }
}


async function main() {
    const accounts = await web3.eth.getAccounts();
    const chainId = await web3.eth.getChainId();
    D("accounts", accounts, chainId);
    const tokens = []
    const tokenCs = []
    for(const Token of Tokens) {
        const token = await ERC20Mock.new(Token.name, Token.symbol, Token.decimals);
        token.info = Token;
        tokenCs.push(token);
        tokens.push({
            chainId: chainId,
            address: token.address,
            name: Token.name,
            symbol: Token.name,
            decimals: Token.decimals,
            logoURI: logos[Token.name]
        })
    }

    await faucet(tokenCs);
    await addLp(tokenCs);

    const tokenList = {
        name: "Coco Default List",
        timestamp: new Date(),
        version: {
          "major": 2,
          "minor": 0,
          "patch": 0
        },
        tags: {},
        logoURI: "https://xxxx",
        keywords: [
          "coco",
          "default"
        ],
        tokens
    };
    fs.writeFileSync(`./cocoSwap_${chainId}.json`, JSON.stringify(tokenList));
}

module.exports = function (cbk) {
    main().then(cbk).catch(cbk);
};