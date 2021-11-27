/**
 *Submitted for verification at Etherscan.io on 2020-09-16
 */

pragma solidity =0.6.6;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./test/fmt.sol";

// Inheritancea
// Inheritancea
interface IStakingRewards {
    // Views
    function lastTimeRewardApplicable() external view returns (uint256);

    function rewardPerToken() external view returns (uint256);

    function earned(address account) external view returns (uint256);

    function getRewardForDuration() external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    // Mutative

    function stake(uint256 amount) external;

    function withdraw(uint256 amount) external;

    function getReward() external;

    function exit() external;
}

//contract StakingRewards is IStakingRewards, RewardsDistributionRecipient, ReentrancyGuard {
contract StakingRewardsLock is ReentrancyGuard, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IERC20 public rewardsToken;
    IERC20 public stakingToken;
    uint256 public periodFinish = 0;
    uint256 public _rewardRate = 0; // rewardRate set by official
    uint256 public rewardRateFromPenalty = 0; // rewards from other pool's early exit
    uint256 public rewardsDuration = 90 days;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards; // in locked
    mapping(address => uint256) public rewardsTime; // used to calculate lock-up
    uint256 public constant LOCK_PERIOD = 90 days;
    mapping(address => uint256) public unlocked; // un locked

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    uint256 public immutable CREATED_TIME;
    StakingRewardsLock public PenaltyPool;

    /* ========== CONSTRUCTOR ========== */

    constructor(address _rewardsToken, address _stakingToken, StakingRewardsLock _PenaltyPool) public {
        rewardsToken = IERC20(_rewardsToken);
        stakingToken = IERC20(_stakingToken);
        CREATED_TIME = block.timestamp;
        PenaltyPool = _PenaltyPool;
        require(address(_PenaltyPool)==address(0) || _PenaltyPool.rewardsToken() == rewardsToken, "invalid _PenaltyPool");
    }

    function earlyPenalty(uint256 amount)
        public
        pure
        returns (uint256 eraly, uint256 penalty)
    {
        eraly = amount / 3;
        penalty = amount - eraly;
    }

    function rewardRate() public view returns(uint256) {
        return _rewardRate + rewardRateFromPenalty;
    }

    function curEpochStart() public view returns (uint256) {
        uint256 epoch = lastTimeRewardApplicable().sub(CREATED_TIME).div(
            LOCK_PERIOD
        );
        return CREATED_TIME.add(epoch.mul(LOCK_PERIOD));
    }

    /* ========== VIEWS ========== */

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        if (periodFinish == 0) return block.timestamp;
        return Math.min(block.timestamp, periodFinish);
    }

    function rewardPerToken() public view returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable()
                    .sub(lastUpdateTime)
                    .mul(rewardRate())
                    .mul(1e18)
                    .div(_totalSupply)
            );
    }

    function deltaEarned(address account) public view returns (uint256) {
        return
            _balances[account]
                .mul(rewardPerToken().sub(userRewardPerTokenPaid[account]))
                .div(1e18);
    }

    function earned(address account) external view returns (uint256) {
        return deltaEarned(account).add(rewards[account]).add(unlocked[account]);
    }

    function getRewardForDuration() external view returns (uint256) {
        return rewardRate().mul(rewardsDuration);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function stakeWithPermit(
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);

        // permit
        IUniswapV2ERC20(address(stakingToken)).permit(
            msg.sender,
            address(this),
            amount,
            deadline,
            v,
            r,
            s
        );

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function stake(uint256 amount)
        external
        nonReentrant
        updateReward(msg.sender)
    {
        require(amount > 0, "Cannot stake 0");
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount)
        public
        nonReentrant
        updateReward(msg.sender)
    {
        _withdraw(amount);
    }

    // emergency withdraw
    function withdrawOnly(uint256 amount) public nonReentrant {
        _withdraw(amount);
    }

    function _withdraw(uint256 amount) private {
        require(amount > 0, "Cannot withdraw 0");
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function getReward(bool force)
        public
        nonReentrant
        updateReward(msg.sender)
    {
        uint256 freed = unlocked[msg.sender];
        unlocked[msg.sender] = 0;
        rewardsToken.safeTransfer(msg.sender, freed);
        emit RewardPaid(msg.sender, freed);
        if (force) {
            (uint256 early, uint256 penalty) = earlyPenalty(
                rewards[msg.sender]
            );
            rewards[msg.sender] = 0;
            rewardsTime[msg.sender] = block.timestamp;
            rewardsToken.safeTransfer(msg.sender, early);
            emit RewardPaid(msg.sender, early);
            uint256 burned = penalty / 6;
            uint256 notified = penalty - burned;
            rewardsToken.safeTransfer(address(0), burned);
            StakingRewardsLock pool = address(PenaltyPool) == address(0) ? this : PenaltyPool;
            {
                if(pool != this)
                    rewardsToken.approve(address(pool), notified);
                pool.notifyExtraReward(notified);
            }
            emit EarlyPenalty(msg.sender, early, burned, address(pool), notified);
        }
    }

    function exit() external {
        withdraw(_balances[msg.sender]);
        getReward(true);
    }

    /* ========== RESTRICTED FUNCTIONS ========== */
    function setRewardRate(uint256 rewardPerSecond)
        external
        onlyOwner
        updateReward(address(0))
    {
        _rewardRate = rewardPerSecond;
        emit SetRewardRate(rewardPerSecond);
    }

    function notifyExtraReward(uint256 amount)
        external
        updateReward(address(0))
    {
        if(msg.sender != address(this))
            rewardsToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 curEpochEnd = curEpochStart().add(rewardsDuration);
        if(block.timestamp < curEpochEnd) {
            uint256 duration = curEpochEnd.sub(block.timestamp);
            rewardRateFromPenalty = rewardRateFromPenalty.add(amount.div(duration));
            emit NotifyExtraReward(msg.sender, amount, rewardRateFromPenalty);
        }
    }

    function setPeriodFinish(uint256 _periodFinish) external onlyOwner {
        periodFinish = _periodFinish;
    }

    /* ========== MODIFIERS ========== */

    function earnedDetails(address account)
        public
        view
        returns (
            uint256 rewardTime,
            uint256 _unlocked,
            uint256 locked
        )
    {
        uint256 deltaReward = deltaEarned(account);
        uint256 timestamp = lastTimeRewardApplicable();
        uint256 _curEpochStart = curEpochStart();
        uint256 lastEpochRewardsTime = rewardsTime[account];
        _unlocked = unlocked[account];
        locked = rewards[account];
        if (lastEpochRewardsTime == 0) {
            rewardTime = block.timestamp;
        } else if (lastEpochRewardsTime < _curEpochStart) {
            uint256 stakeDuration = timestamp - lastEpochRewardsTime;
            uint256 deltaUnlocked = deltaReward
                .mul(_curEpochStart.sub(lastEpochRewardsTime))
                .div(stakeDuration);
            _unlocked = _unlocked.add(locked).add(deltaUnlocked); // locked become unlocked, and plus delta
            locked = deltaReward.sub(deltaUnlocked); // locked is delta locked
            rewardTime = _curEpochStart;
        } else {
            locked = locked.add(deltaReward);
            rewardTime = Math.max(lastEpochRewardsTime, _curEpochStart);
        }
        rewardTime = block.timestamp;
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            (
                rewardsTime[account],
                unlocked[account],
                rewards[account]
            ) = earnedDetails(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    /* ========== EVENTS ========== */
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event EarlyPenalty(
        address indexed user,
        uint256 early,
        uint256 burned,
        address toStakePool,
        uint256 toAmount
    );
    event SetRewardRate(uint256 rate);
    event NotifyExtraReward(address from, uint256 amount, uint256 rate);
}

interface IUniswapV2ERC20 {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}
