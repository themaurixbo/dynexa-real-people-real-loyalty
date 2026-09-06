// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CampaignTreasury
/// @notice Holds a single loyalty campaign's USDC budget and pays out rewards
///         that were authorized off-chain by the campaign's agent signer.
///         The contract enforces the per-transaction and campaign-total limits
///         on its own — a valid signature is necessary but not sufficient.
contract CampaignTreasury is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct RewardAuthorization {
        bytes32 claimId; // unique per reward, also the replay key
        address customer; // payout recipient
        bytes32 nullifierHash; // World nullifier reference (not stored on-chain)
        bytes32 receiptHash; // receipt reference (not stored on-chain)
        uint256 amount; // USDC, 6 decimals
        uint256 giftTokenId; // informational, minted elsewhere
        uint256 deadline; // unix seconds
    }

    bytes32 private constant _AUTH_TYPEHASH = keccak256(
        "RewardAuthorization(bytes32 claimId,address customer,bytes32 nullifierHash,bytes32 receiptHash,uint256 amount,uint256 giftTokenId,uint256 deadline)"
    );

    IERC20 public immutable usdc;
    address public immutable business;
    address public immutable factory;

    address public agentSigner;
    uint256 public perTxLimit;
    uint256 public campaignTotalLimit;
    uint256 public totalPaidOut;
    bool public paused;
    bool public closed;

    mapping(bytes32 => bool) public claimUsed;

    event Funded(address indexed from, uint256 amount);
    event PayoutExecuted(bytes32 indexed claimId, address indexed customer, uint256 amount);
    event AgentSignerUpdated(address indexed previous, address indexed next);
    event Paused(bool paused);
    event Closed(uint256 returnedToBusiness);

    error NotBusiness();
    error IsPaused();
    error IsClosed();
    error AuthExpired();
    error ClaimAlreadyUsed();
    error OverPerTxLimit();
    error OverCampaignLimit();
    error BadSigner();
    error ZeroAmount();

    modifier onlyBusiness() {
        if (msg.sender != business) revert NotBusiness();
        _;
    }

    constructor(
        address _usdc,
        address _business,
        address _agentSigner,
        uint256 _perTxLimit,
        uint256 _campaignTotalLimit
    ) EIP712("DYNEXA CampaignTreasury", "1") {
        usdc = IERC20(_usdc);
        business = _business;
        factory = msg.sender;
        agentSigner = _agentSigner;
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

    /// @notice Execute a reward payout authorized by the agent signer.
    /// @dev Anyone can relay; funds only move on a valid signer signature and
    ///      only within the on-chain limits.
    function payout(RewardAuthorization calldata auth, bytes calldata signature)
        external
        nonReentrant
    {
        if (paused) revert IsPaused();
        if (closed) revert IsClosed();
        if (auth.amount == 0) revert ZeroAmount();
        if (block.timestamp > auth.deadline) revert AuthExpired();
        if (claimUsed[auth.claimId]) revert ClaimAlreadyUsed();
        if (auth.amount > perTxLimit) revert OverPerTxLimit();
        if (totalPaidOut + auth.amount > campaignTotalLimit) revert OverCampaignLimit();

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    _AUTH_TYPEHASH,
                    auth.claimId,
                    auth.customer,
                    auth.nullifierHash,
                    auth.receiptHash,
                    auth.amount,
                    auth.giftTokenId,
                    auth.deadline
                )
            )
        );
        if (ECDSA.recover(digest, signature) != agentSigner) revert BadSigner();

        claimUsed[auth.claimId] = true;
        totalPaidOut += auth.amount;
        usdc.safeTransfer(auth.customer, auth.amount);

        emit PayoutExecuted(auth.claimId, auth.customer, auth.amount);
    }

    function setAgentSigner(address next) external onlyBusiness {
        emit AgentSignerUpdated(agentSigner, next);
        agentSigner = next;
    }

    function setPaused(bool value) external onlyBusiness {
        paused = value;
        emit Paused(value);
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

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
