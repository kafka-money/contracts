const KafkaStaker = artifacts.require("KafkaStaker");
const ERC20 = artifacts.require("ERC20");
const fs = require('fs');

const max256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
const zeroAddress = '0x'.padEnd(42, '0')

async function main() {
    //const pairC = await PairFor.new();
    const chainID = await web3.eth.getChainId();
    //const chainID = 523
    const accounts = await web3.eth.getAccounts();
    console.log("accounts:", accounts, chainID);
    const deployed = require(`../factory_${chainID}.json`);
    const UNI = deployed.UNI;
    const {tokens} = require(`../cocoSwap_${chainID}.json`);
    const uni = await ERC20.at(UNI);
    const stakes = []

    const rewardPerSecond = web3.utils.toWei('0.1');
    const reward90days = web3.utils.toWei("900000");
    console.log("uni:", UNI)
    const staker = await KafkaStaker.new(UNI);
    await staker.approveRewardDistributor(UNI, accounts[0], true);
    await uni.approve(staker.address, reward90days);
    await staker.notifyRewardAmount(UNI, reward90days);
    stakes.push({
        names:["uni","uni"],
        stakingAddress: staker.address,
        stakeToken: UNI,
        rewardToken: UNI
    });
    console.log(stakes)
    deployed.STAKING = stakes;
    fs.writeFileSync(`./factory_${chainID}.json`, JSON.stringify(deployed));
}


async function stake() {
    //const pairC = await PairFor.new();
    const chainID = await web3.eth.getChainId();
    //const chainID = 523
    const accounts = await web3.eth.getAccounts();
    console.log("accounts:", accounts, chainID);
    const deployed = require(`../factory_${chainID}.json`);
    const UNI = deployed.UNI;
    const {tokens} = require(`../cocoSwap_${chainID}.json`);
    //const uni = await ERC20.at(UNI);
    //const stakingRewards = await KafkaStaker.at(deployed.STAKING[0].stakingAddress);
    //await uni.approve(stakingRewards.address, max256);
    //await stakingRewards.stake(web3.utils.toWei('10'));
    for(const staking of deployed.STAKING) {
        const stakingRewards = await KafkaStaker.at(staking.stakingAddress);
        const stakingToken = await ERC20.at(staking.stakeToken);
        const decimals = Number(await stakingToken.decimals());
        const amount = n=>`${n}${'0'.repeat(decimals)}`
        const a10 = amount(10);
        console.log(a10)
        await stakingToken.approve(stakingRewards.address, max256);
        await stakingRewards.stake(a10);
    }
}

module.exports = function (cbk) {
    main().then(cbk).catch(cbk);
    //stake().then(cbk).catch(cbk);
};