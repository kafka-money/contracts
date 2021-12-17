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
import './MasterChef.sol';

import {IStakingRewards} from "../interfaces/IStakingRewards.sol";
import {IUniswapV2ERC20} from "../interfaces/IUniswapV2ERC20.sol";

contract RewardsDistributionRecipient {
    address public rewardsDistribution;

    //function notifyRewardAmount(uint256 reward) external virtual;

    modifier onlyRewardsDistribution() {
        require(msg.sender == rewardsDistribution, 'Caller is not RewardsDistribution contract');
        _;
    }
}

//contract StakingRewards is IStakingRewards, RewardsDistributionRecipient, ReentrancyGuard {
contract UnionRewards is IStakingRewards, RewardsDistributionRecipient, ReentrancyGuard {
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

    MasterChef public chef;
    uint256 public pid;
    IERC20 public rewardsChefToken;
    uint256 public chefRewardPerTokenStored;
    mapping(address => uint256) public userChefRewardPerTokenPaid;
    mapping(address => uint256) public chefRewards;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        MasterChef _chef,
        uint256 _pid,
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken
    ) public {
        rewardsToken = IERC20(_rewardsToken);
        stakingToken = IERC20(_stakingToken);
        rewardsDistribution = _rewardsDistribution;
        chef = _chef;
        pid = _pid;
        rewardsChefToken = chef.kafka();
    }

    /* ========== VIEWS ========== */

    function totalSupply() external override view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external override view returns (uint256) {
        return _balances[account];
    }

    function lastTimeRewardApplicable() public override view returns (uint256) {
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
    function earnedChef(address account) public view returns (uint256) {
        return
            _balances[account].mul(chefRewardPerTokenStored.sub(userChefRewardPerTokenPaid[account])).div(1e18).add(
                chefRewards[account]
            );
    }

    function getRewardForDuration() external override view returns (uint256) {
        return rewardRate.mul(rewardsDuration);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function stakeWithPermit(
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant updateReward(msg.sender) updateChef(msg.sender, chefDeposit(amount)) {
        require(amount > 0, 'Cannot stake 0');
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);

        // permit
        IUniswapV2ERC20(address(stakingToken)).permit(msg.sender, address(this), amount, deadline, v, r, s);

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function stake(uint256 amount) external override nonReentrant updateReward(msg.sender) updateChef(msg.sender, chefDeposit(amount)) {
        require(amount > 0, 'Cannot stake 0');
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) public override nonReentrant updateReward(msg.sender) updateChef(msg.sender, chefWithdraw(amount)) {
        require(amount > 0, 'Cannot withdraw 0');
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function getReward() public override nonReentrant updateReward(msg.sender) updateChef(msg.sender, chefDeposit(0)) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardsToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }

        uint256 chefReward = chefRewards[msg.sender];
        if(chefReward > 0) {
            chefRewards[msg.sender] = 0;
            rewardsChefToken.safeTransfer(msg.sender, chefReward);
            emit RewardChefPaid(msg.sender, chefReward);
        }
    }

    function exit() external override {
        withdraw(_balances[msg.sender]);
        getReward();
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function notifyRewardAmount(uint256 reward) external onlyRewardsDistribution updateReward(address(0)) {
        if (block.timestamp >= periodFinish) {
            rewardRate = reward.div(rewardsDuration);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRate);
            rewardRate = reward.add(leftover).div(rewardsDuration);
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint256 balance = rewardsToken.balanceOf(address(this));
        require(rewardRate <= balance.div(rewardsDuration), 'Provided reward too high');

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(rewardsDuration);
        emit RewardAdded(reward);
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
    modifier updateChef(address account, uint256 deltaReward) {
        uint256 deltaPerToken = deltaReward.mul(1e18).div(_totalSupply);
        chefRewardPerTokenStored = chefRewardPerTokenStored.add(deltaPerToken);
        chefRewards[account] = earnedChef(account);
        userChefRewardPerTokenPaid[account] = chefRewardPerTokenStored;
        _;
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardChefPaid(address indexed user, uint256 reward);

    function chefDeposit(
        uint256 amount
    ) private returns(uint256) {
        uint256 beforeRewards = rewardsChefToken.balanceOf(address(this)); // save gas
        chef.deposit(pid, amount);
        return rewardsChefToken.balanceOf(address(this)).sub(beforeRewards);
    }

    function chefWithdraw(uint256 amount) private returns(uint256) {
        uint256 beforeRewards = rewardsChefToken.balanceOf(address(this)); // save gas
        chef.withdraw(pid, amount);
        return rewardsChefToken.balanceOf(address(this)).sub(beforeRewards);
    }
}