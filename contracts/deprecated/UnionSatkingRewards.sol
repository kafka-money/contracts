/**
 *Submitted for verification at Etherscan.io on 2020-09-16
 */

pragma solidity =0.6.6;

import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/math/Math.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import {StakingRewards} from './StakingRewards.sol';

import {IStakingRewards} from "../interfaces/IStakingRewards.sol";
import {IUniswapV2ERC20} from "../interfaces/IUniswapV2ERC20.sol";

//contract StakingRewards is IStakingRewards, RewardsDistributionRecipient, ReentrancyGuard {
contract UnionRewards is IStakingRewards, ReentrancyGuard, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IERC20 public rewardsToken;
    IERC20 public stakingToken;
    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public rewardsDuration = 60 days;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    StakingRewards public attachedStaking;
    uint256 public attachedRewardPerTokenStored;
    mapping(address => uint256) public userAttachedRewardPerTokenPaid;
    mapping(address => uint256) public attachedRewards;

    /* ========== CONSTRUCTOR ========== */

    constructor(StakingRewards _attachedStaking, address _rewardsToken) public {
        rewardsToken = IERC20(_rewardsToken);
        stakingToken = _attachedStaking.stakingToken();
        attachedStaking = _attachedStaking;
    }

    /* ========== VIEWS ========== */

    function totalSupply() external override view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external override view returns (uint256) {
        return _balances[account];
    }

    function lastTimeRewardApplicable() public override view returns (uint256) {
        if(periodFinish == 0) return block.timestamp;
        return Math.min(block.timestamp, periodFinish);
    }

    function rewardPerToken() public override view returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable().sub(lastUpdateTime).mul(rewardRate).mul(1e18).div(_totalSupply)
            );
    }

    function earned(address account) public override view returns (uint256) {
        return
            _balances[account].mul(rewardPerToken().sub(userRewardPerTokenPaid[account])).div(1e18).add(
                rewards[account]
            );
    }

    function earnedAttached(address account) public view returns (uint256) {
        return
            _balances[account]
                .mul(attachedRewardPerTokenStored.sub(userAttachedRewardPerTokenPaid[account]))
                .div(1e18)
                .add(attachedRewards[account]);
    }

    function getRewardForDuration() external override view returns (uint256) {
        return rewardRate.mul(rewardsDuration);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function stake(uint256 amount)
        external
        override
        nonReentrant
        updateReward(msg.sender)
        updateAttached(msg.sender, attachedDeposit(amount))
    {
        require(amount > 0, 'Cannot stake 0');
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount)
        public
        override
        nonReentrant
        updateReward(msg.sender)
        updateAttached(msg.sender, attachedWithdraw(amount))
    {
        require(amount > 0, 'Cannot withdraw 0');
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
        emit Withdrawn(msg.sender, amount);
    }

    function getReward() public override nonReentrant updateReward(msg.sender) updateAttached(msg.sender, attachedDeposit(0)) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardsToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }

        uint256 attachedReward = attachedRewards[msg.sender];
        if (attachedReward > 0) {
            attachedRewards[msg.sender] = 0;
            IERC20(attachedStaking.rewardsToken()).safeTransfer(msg.sender, attachedReward);
            emit RewardAttachedPaid(msg.sender, attachedReward);
        }
    }

    function exit() external override {
        withdraw(_balances[msg.sender]);
        getReward();
    }

    /* ========== RESTRICTED FUNCTIONS ========== */
    function setRewardRate(uint256 rewardPerSecond) external onlyOwner updateReward(address(0)) {
        emit SetRewardRate(rewardRate, rewardPerSecond);
        rewardRate = rewardPerSecond;
    }

    function setPeriodFinish(uint256 _periodFinish) external onlyOwner {
        periodFinish = _periodFinish;
    }

    /* ========== MODIFIERS ========== */

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }
    modifier updateAttached(address account, uint256 deltaReward) {
        uint256 deltaPerToken = deltaReward.mul(1e18).div(_totalSupply);
        attachedRewardPerTokenStored = attachedRewardPerTokenStored.add(deltaPerToken);
        attachedRewards[account] = earnedAttached(account);
        userAttachedRewardPerTokenPaid[account] = attachedRewardPerTokenStored;
        _;
    }

    function attachedDeposit(uint256 amount) private returns (uint256 deltaReward) {
        deltaReward = attachedStaking.earned(address(this));
        if (deltaReward > 0) attachedStaking.getReward();
        if (amount == 0) return deltaReward;
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        if (stakingToken.allowance(address(this), address(attachedStaking)) < amount) {
            stakingToken.approve(address(attachedStaking), uint256(-1));
        }
        attachedStaking.stake(amount);
        return deltaReward;
    }

    function attachedWithdraw(uint256 amount) private returns (uint256 deltaReward) {
        deltaReward = attachedStaking.earned(address(this));
        if (deltaReward > 0) attachedStaking.getReward();
        if (amount == 0) return deltaReward;
        attachedStaking.withdraw(amount);
        stakingToken.safeTransfer(msg.sender, amount);
        return deltaReward;
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardAttachedPaid(address indexed user, uint256 reward);
    event SetRewardRate(uint256 oldRate, uint256 newRate);
}