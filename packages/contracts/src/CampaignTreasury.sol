// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CampaignTreasury
/// @notice Holds one loyalty campaign's USDC and pays out rewards. Only the
///         campaign's agent wallet can trigger a payout, and only within the
///         per-transaction and total-budget limits the contract checks itself.
contract CampaignTreasury is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public immutable business;
    address public immutable factory;

    address public agent;
    uint256 public perTxLimit;
    uint256 public campaignTotalLimit;
    uint256 public totalPaidOut;
    bool public paused;
    bool public closed;

    mapping(bytes32 => bool) public claimUsed;

    event Funded(address indexed from, uint256 amount);
    event PayoutExecuted(
        bytes32 indexed claimId,
        address indexed customer,
        uint256 amount,
        bytes32 nullifierHash,
        bytes32 receiptHash
    );
    event AgentUpdated(address indexed previous, address indexed next);
    event PausedSet(bool paused);
    event Closed(uint256 returnedToBusiness);

    error NotBusiness();
    error NotAgent();
    error IsPaused();
    error IsClosed();
    error ClaimAlreadyUsed();
    error OverPerTxLimit();
    error OverCampaignLimit();
    error ZeroAmount();

    modifier onlyBusiness() {
        if (msg.sender != business) revert NotBusiness();
        _;
    }

    constructor(
        address _usdc,
        address _business,
        address _agent,
        uint256 _perTxLimit,
        uint256 _campaignTotalLimit
    ) {
        usdc = IERC20(_usdc);
        business = _business;
        factory = msg.sender;
        agent = _agent;
        perTxLimit = _perTxLimit;
        campaignTotalLimit = _campaignTotalLimit;
    }

    /// @notice Pull USDC into the treasury. Caller must have approved this contract.
    function fund(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (closed) revert IsClosed();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Funded(msg.sender, amount);
    }

    /// @notice Pay a reward. Only the agent wallet can call this.
    /// @param claimId  unique per reward, also the replay key
    /// @param customer payout recipient
    /// @param nullifierHash World nullifier reference (kept off-chain, logged as a hash)
    /// @param receiptHash   receipt reference (kept off-chain, logged as a hash)
    /// @param amount   USDC, 6 decimals
    function payout(
        bytes32 claimId,
        address customer,
        bytes32 nullifierHash,
        bytes32 receiptHash,
        uint256 amount
    ) external nonReentrant {
        if (msg.sender != agent) revert NotAgent();
        if (paused) revert IsPaused();
        if (closed) revert IsClosed();
        if (amount == 0) revert ZeroAmount();
        if (claimUsed[claimId]) revert ClaimAlreadyUsed();
        if (amount > perTxLimit) revert OverPerTxLimit();
        if (totalPaidOut + amount > campaignTotalLimit) revert OverCampaignLimit();

        claimUsed[claimId] = true;
        totalPaidOut += amount;
        usdc.safeTransfer(customer, amount);

        emit PayoutExecuted(claimId, customer, amount, nullifierHash, receiptHash);
    }

    function setAgent(address next) external onlyBusiness {
        emit AgentUpdated(agent, next);
        agent = next;
    }

    function setPaused(bool value) external onlyBusiness {
        paused = value;
        emit PausedSet(value);
    }

    /// @notice Close the campaign and return the remaining balance to the business.
    function close() external onlyBusiness {
        if (closed) revert IsClosed();
        closed = true;
        uint256 remaining = usdc.balanceOf(address(this));
        if (remaining > 0) usdc.safeTransfer(business, remaining);
        emit Closed(remaining);
    }

    function balance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function remainingBudget() external view returns (uint256) {
        return campaignTotalLimit - totalPaidOut;
    }
}
