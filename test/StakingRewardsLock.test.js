const StakingRewardsLock = artifacts.require("StakingRewardsLock");
const ERC20 = artifacts.require("ERC20");

const BN = (n, d = 10) => new web3.utils.BN(n, d);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const EMPTY = '0x0000000000000000000000000000000000000000';

const N18 = n => BN(web3.utils.toWei(String(n)))

const percentMul = (a, b, c) => a.mul(new BN(b)).div(new BN(c));

advanceTime = (time) => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: '2.0',
            method: 'evm_increaseTime',
            params: [time],
            id: new Date().getTime()
        }, (err, result) => {
            if (err) { return reject(err) }
            return resolve(result)
        })
    })
}

advanceBlock = () => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: '2.0',
            method: 'evm_mine',
            id: new Date().getTime()
        }, (err, result) => {
            if (err) { return reject(err) }
            const newBlockHash = web3.eth.getBlock('latest').hash

            return resolve(newBlockHash)
        })
    })
}

function show(x) {
    let keys = Object.keys(x);
    if(keys.find(k=>isNaN(Number(k)))){
        keys = keys.filter(k=>isNaN(Number(k)));
    }
    console.log(keys.reduce((t,k)=>(t[k]=x[k].toString(),t),{}));
}

const RewardSecond = 10
const daysSecond = n=>24*3600*n;
const days = n=>daysSecond(n)*RewardSecond;

const xeq=(a,b)=>{
    a=Number(a)
    b=Number(b)
    console.log('xeq:', a, b)
    assert.equal(a<=b+RewardSecond&&a>=b-RewardSecond, true)
}

contract("Stake test", async accounts => {
    before(
        async () => {
            this.initStake = async()=>{
                this.stakeToken = await ERC20.new(N18(100000000));
                this.rewardToken = await ERC20.new(N18(100000000));
                this.stakingKafka = await StakingRewardsLock.new(this.rewardToken.address, this.stakeToken.address, "0x".padEnd(42, '0'));
                this.staking = await StakingRewardsLock.new(this.rewardToken.address, this.stakeToken.address, this.stakingKafka.address);
                //this.staking = this.stakingKafka
                await this.staking.setRewardRate(RewardSecond);
                await this.rewardToken.transfer(this.staking.address, N18(24 * 3600));
                let day = 0;
                this.incDays = async n => {
                    day += n;
                    await advanceTime(daysSecond(n));
                    await advanceBlock();
                    console.log("-----------incDays:", n, day)
                }       
            }
        }
    );

    it(`test stake - getreward(false) `, async () => {
        await this.initStake();
        const stakeToken = this.stakeToken;
        const rewardToken = this.rewardToken;
        const staking = this.staking;
        let day = 0;
        const incDays = async n => {
            day += n;
            await advanceTime(daysSecond(n));
            await advanceBlock();
            console.log("-----------incDays:", n, day)
        }
        await stakeToken.approve(staking.address, N18(10000000000));
        await staking.stake(N18(1));
        await this.incDays(90);
        {
            const rewards = await staking.earnedDetails(accounts[0]);
            show(rewards)
            xeq(rewards._unlocked, days(90))
            xeq(rewards.locked, 0)
        }
        await this.incDays(30);
        {
            const rewards = await staking.earnedDetails(accounts[0])
            const unlocked = await staking.unlocked(accounts[0]);
            show(rewards)
            show({unlocked})
            xeq(unlocked, 0)
            xeq(rewards._unlocked, days(90))
            xeq(rewards.locked, days(30))
        }
        const before = await rewardToken.balanceOf(accounts[0]);
        console.log("getReward")
        await staking.getReward(false);
        const after = await rewardToken.balanceOf(accounts[0]);
        //await advanceBlock();
        {
            const rewards = await staking.earnedDetails(accounts[0])
            const unlocked = await staking.unlocked(accounts[0]);
            show(rewards)
            show({unlocked})
            show({delta: after.sub(before)})

            xeq(unlocked, 0)
            xeq(rewards._unlocked, 0)
            xeq(rewards.locked, days(30))
            xeq(after.sub(before), days(90))
        }
        await this.incDays(90);
        {
            const rewards = await staking.earnedDetails(accounts[0])
            const unlocked = await staking.unlocked(accounts[0]);
            show(rewards)
            show({unlocked})
            xeq(rewards._unlocked, days(90))
            xeq(rewards.locked, days(30))
        }
    });

    it(`test stake - getreward(true)`, async () => {
        await this.initStake();
        const stakeToken = this.stakeToken;
        const rewardToken = this.rewardToken;
        const staking = this.staking;

        await stakeToken.approve(staking.address, N18(10000000000));
        await staking.stake(N18(1));
        await this.incDays(90);
        {
            const rewards = await staking.earnedDetails(accounts[0]);
            show(rewards)
            xeq(rewards._unlocked, days(90))
            xeq(rewards.locked, 0)
        }
        await this.incDays(30);
        {
            const rewards = await staking.earnedDetails(accounts[0])
            const unlocked = await staking.unlocked(accounts[0]);
            show(rewards)
            show({unlocked})
            xeq(unlocked, 0)
            xeq(rewards._unlocked, days(90))
            xeq(rewards.locked, days(30))
        }
        const before = await rewardToken.balanceOf(accounts[0]);
        console.log("getReward")
        await staking.getReward(true);
        const after = await rewardToken.balanceOf(accounts[0]);
        //await advanceBlock();
        {
            const rewards = await staking.earnedDetails(accounts[0])
            const unlocked = await staking.unlocked(accounts[0]);
            show(rewards)
            show({unlocked})
            show({delta: after.sub(before)})

            xeq(unlocked, 0)
            xeq(rewards._unlocked, 0)
            xeq(rewards.locked, days(0))
            xeq(after.sub(before), days(90)+days(30)/3)
        }
        await this.incDays(90);
        {
            const rewards = await staking.earnedDetails(accounts[0])
            const unlocked = await staking.unlocked(accounts[0]);
            show(rewards)
            show({unlocked})
            xeq(rewards._unlocked, days(60))
            xeq(rewards.locked, days(30))
        }
    });
    it(`test stake - stake`, async () => {
        await this.initStake();
        const stakeToken = this.stakeToken;
        const rewardToken = this.rewardToken;
        const staking = this.staking;

        await stakeToken.approve(staking.address, N18(10000000000));
        await staking.stake(N18(1));
        await this.incDays(90);
        {
            const rewards = await staking.earnedDetails(accounts[0]);
            show(rewards)
            xeq(rewards._unlocked, days(90))
            xeq(rewards.locked, 0)
        }
        await this.incDays(30);
        {
            const rewards = await staking.earnedDetails(accounts[0])
            const unlocked = await staking.unlocked(accounts[0]);
            show(rewards)
            show({unlocked})
            xeq(unlocked, 0)
            xeq(rewards._unlocked, days(90))
            xeq(rewards.locked, days(30))
        }
        const before = await rewardToken.balanceOf(accounts[0]);
        console.log("stake again")
        await staking.stake(N18(1));
        const after = await rewardToken.balanceOf(accounts[0]);
        //await advanceBlock();
        {
            const rewards = await staking.earnedDetails(accounts[0])
            const unlocked = await staking.unlocked(accounts[0]);
            show(rewards)
            show({unlocked})
            show({delta: after.sub(before)})

            xeq(unlocked, days(90))
            xeq(rewards._unlocked, days(90))
            xeq(rewards.locked, days(30))
            xeq(after.sub(before), 0)
        }
        await this.incDays(90);
        {
            const rewards = await staking.earnedDetails(accounts[0])
            const unlocked = await staking.unlocked(accounts[0]);
            show(rewards)
            show({unlocked})
            xeq(rewards._unlocked, days(180))
            xeq(rewards.locked, days(30))
        }
    });

    it(`test stake - withdraw`, async () => {
        await this.initStake();
        const stakeToken = this.stakeToken;
        const rewardToken = this.rewardToken;
        const staking = this.staking;

        await stakeToken.approve(staking.address, N18(10000000000));
        await staking.stake(N18(1));
        await this.incDays(90);
        {
            const rewards = await staking.earnedDetails(accounts[0]);
            show(rewards)
            xeq(rewards._unlocked, days(90))
            xeq(rewards.locked, 0)
        }
        await this.incDays(30);
        {
            const rewards = await staking.earnedDetails(accounts[0])
            const unlocked = await staking.unlocked(accounts[0]);
            show(rewards)
            show({unlocked})
            xeq(unlocked, 0)
            xeq(rewards._unlocked, days(90))
            xeq(rewards.locked, days(30))
        }
        const before = await rewardToken.balanceOf(accounts[0]);
        console.log("withdraw all")
        await staking.withdraw(N18(1));
        const after = await rewardToken.balanceOf(accounts[0]);
        const stakeAmount = await staking.balanceOf(accounts[0]);
        //await advanceBlock();
        {
            const rewards = await staking.earnedDetails(accounts[0])
            const unlocked = await staking.unlocked(accounts[0]);
            show(rewards)
            show({unlocked})
            show({delta: after.sub(before)})
            
            xeq(stakeAmount, 0);
            xeq(unlocked, days(90))
            xeq(rewards._unlocked, days(90))
            xeq(rewards.locked, days(30))
            xeq(after.sub(before), 0)
        }
        await this.incDays(90);
        {
            const rewards = await staking.earnedDetails(accounts[0])
            const unlocked = await staking.unlocked(accounts[0]);
            show(rewards)
            show({unlocked})
            xeq(rewards._unlocked, days(120))
            xeq(rewards.locked, days(0))
        }
    });

    it(`test stake - withdraw - stake`, async () => {
        await this.initStake();
        const stakeToken = this.stakeToken;
        const rewardToken = this.rewardToken;
        const staking = this.staking;

        await stakeToken.approve(staking.address, N18(10000000000));
        await staking.stake(N18(1));
        await this.incDays(90);
        {
            const rewards = await staking.earnedDetails(accounts[0]);
            show(rewards)
            xeq(rewards._unlocked, days(90))
            xeq(rewards.locked, 0)
        }
        await this.incDays(30);
        {
            const rewards = await staking.earnedDetails(accounts[0])
            const unlocked = await staking.unlocked(accounts[0]);
            show(rewards)
            show({unlocked})
            xeq(unlocked, 0)
            xeq(rewards._unlocked, days(90))
            xeq(rewards.locked, days(30))
        }
        const before = await rewardToken.balanceOf(accounts[0]);
        console.log("withdraw all")
        await staking.withdraw(N18(1));
        const after = await rewardToken.balanceOf(accounts[0]);
        const stakeAmount = await staking.balanceOf(accounts[0]);
        //await advanceBlock();
        {
            const rewards = await staking.earnedDetails(accounts[0])
            const unlocked = await staking.unlocked(accounts[0]);
            show(rewards)
            show({unlocked})
            show({delta: after.sub(before)})
            
            xeq(stakeAmount, 0);
            xeq(unlocked, days(90))
            xeq(rewards._unlocked, days(90))
            xeq(rewards.locked, days(30))
            xeq(after.sub(before), 0)
        }
        await this.incDays(90);
        {
            const rewards = await staking.earnedDetails(accounts[0])
            const unlocked = await staking.unlocked(accounts[0]);
            show(rewards)
            show({unlocked})
            xeq(rewards._unlocked, days(120))
            xeq(rewards.locked, days(0))
        }
        console.log('stake again');
        await staking.stake(N18(1));
        await this.incDays(90);
        {
            const rewards = await staking.earnedDetails(accounts[0])
            const unlocked = await staking.unlocked(accounts[0]);
            show(rewards)
            show({unlocked})
            xeq(rewards._unlocked, days(180))
            xeq(rewards.locked, days(30))
        }
    });
})