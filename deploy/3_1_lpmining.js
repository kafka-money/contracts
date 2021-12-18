const StakingRewardsKafka = artifacts.require("StakingRewardsKafka");
const KafkaStaker = artifacts.require("KafkaStaker");
const IERC20 = artifacts.require("ERC20");
const PairFor = artifacts.require("PairFor");
const fs = require('fs');

let deployed;
const keccak256 = x => web3.utils.keccak256(`0x${x}`).slice(2);
const bn = (n,x=10)=>new web3.utils.BN(n,x)
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
    const uniPool = deployed.STAKING[0];


    const rewardPerSecond = web3.utils.toWei('0.1');
    const reward90days = web3.utils.toWei("900000");
    for(const i in tokens) {
        const token0 = tokens[i];
        for(let j = Number(i)+1; j < tokens.length; j++) {
            const token1 = tokens[j];
            const pair = pairAddress(token0.address, token1.address);
            //const pairLog = await pairC.pairForX(deployed.FACTORY_ADDRESS, token0.address, token1.address)
            //console.log('log:', pairLog)
            //const pair2 = await pairC.pairFor(deployed.FACTORY_ADDRESS, token0.address, token1.address)
            //console.log(i, deployed.FACTORY_ADDRESS, token0, token1, pair)
            console.log(i, token0.symbol, token1.symbol, pair, await exist(pair));
            const stake = await StakingRewardsKafka.new(UNI, pair, uniPool.stakingAddress);
            stakes.push({
                tokens: [token0.symbol, token1.symbol],
                stakingRewardAddress: stake.address
            });
            console.log("transfer...")
            await uni.transfer(stake.address, reward90days);
            console.log("setRewardRate...")
            await stake.setRewardRate(rewardPerSecond);
        }
    }
    const uniStaker = await KafkaStaker.at(uniPool.stakingAddress);
    await uniStaker.addMinter(stakes.map(stake=>stake.stakingRewardAddress));
    console.log(stakes)
    deployed.STAKING_REWARDS_INFO = stakes;
    fs.writeFileSync(`./factory_${chainID}.json`, JSON.stringify(deployed));
}

module.exports = function (cbk) {
    main().then(cbk).catch(cbk);
};