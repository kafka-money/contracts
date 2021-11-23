const MasterChef = artifacts.require("MasterChef");
const IERC20 = artifacts.require("ERC20");
const PairFor = artifacts.require("PairFor");
const fs = require('fs');

const max256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

let deployed;
const keccak256 = x => web3.utils.keccak256(`0x${x}`).slice(2);
const bn = (n,x=10)=>new web3.utils.BN(n,x)
const hex20 = x=>'0'.repeat(40-x.length)+x
function pairFor(token0, token1) {
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

const now = ()=>Math.floor(Number(new Date())/1000);

async function main() {
    //const pairC = await PairFor.new();
    const chainID = await web3.eth.getChainId();
    //const chainID = 523
    const accounts = await web3.eth.getAccounts();
    console.log("accounts:", accounts, chainID);
    deployed = require(`../factory_${chainID}.json`);
    const UNI = deployed.UNI;
    const {tokens} = require(`../cocoSwap_${chainID}.json`);
    const uni = await IERC20.at(UNI);
    const stakes = []

    const rewardPerSecond = web3.utils.toWei('400');
    const chef = await MasterChef.new(UNI, accounts[0], rewardPerSecond, now());
    const reward60days = web3.utils.toWei("600000");
    await uni.transfer(chef.address, reward60days);
    for(const i in tokens) {
        const token0 = tokens[i];
        for(let j = Number(i)+1; j < tokens.length; j++) {
            const token1 = tokens[j];
            const pair = pairFor(token0.address, token1.address);
            const pairExist = await exist(pair);
            console.log(i, token0.symbol, token1.symbol, pair, pairExist);
            const pid = await chef.poolLength();
            await chef.add(100, pair, false);
            stakes.push({
                pid: Number(pid),
                tokens: [token0.symbol, token1.symbol],
                pair
            });
        }
    }
    deployed.MasterChef = {
        address: chef.address,
        pools: stakes
    };
    console.log(deployed.MasterChef)
    //fs.writeFileSync(`./factory_${chainID}.json`, JSON.stringify(deployed)); 
}

async function deposit() {
    //const pairC = await PairFor.new();
    const chainID = await web3.eth.getChainId();
    //const chainID = 523
    const accounts = await web3.eth.getAccounts();
    console.log("accounts:", accounts, chainID);
    const deployed = require(`../factory_${chainID}.json`);
    const chef = await MasterChef.at(deployed.MasterChef.address);
    for(const pool of deployed.MasterChef.pools) {
        const {pair, pid, tokens} = pool;
        if(!await exist(pair)) continue;
        const pairC = await IERC20.at(pair);
        const pairBalance = await pairC.balanceOf(accounts[0]);
        if(pairBalance > 0) {
            const allowance = await pairC.allowance(accounts[0], chef.address)
            if(allowance < pairBalance)
                await pairC.approve(chef.address, max256)
            await chef.deposit(pid, pairBalance)
            const userInfo = await chef.userInfo(pid, accounts[0]);
            console.log(tokens, userInfo);
        }
    }
}

module.exports = function (cbk) {
    //deposit().then(cbk).catch(cbk);
    main().then(cbk).catch(cbk);
};