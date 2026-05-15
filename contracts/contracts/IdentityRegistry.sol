// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract IdentityRegistry is AccessControl, Pausable {
    bytes32 public constant INSTITUTION_ADMIN_ROLE = keccak256("INSTITUTION_ADMIN_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    enum Role {
        None,
        Patient,
        Doctor,
        Researcher,
        InstitutionAdmin,
        Auditor
    }

    enum UserStatus {
        None,
        Pending,
        Active,
        Rejected,
        Suspended
    }

    struct UserProfile {
        address account;
        Role role;
        UserStatus status;
        bytes32 profileHash;
        bytes32 publicKeyHash;
        string publicKeyUri;
        address organization;
        uint256 createdAt;
        uint256 updatedAt;
    }

    mapping(address => UserProfile) private users;

    event UserRegistered(address indexed account, Role role, bytes32 profileHash);
    event UserApproved(address indexed account, address indexed approver);
    event UserRejected(address indexed account, address indexed approver);
    event UserSuspended(address indexed account, address indexed operator);
    event PublicKeyUpdated(address indexed account, bytes32 publicKeyHash, string publicKeyUri);

    error UserAlreadyRegistered();
    error UserNotFound();
    error InvalidRole();
    error InvalidAddress();
    error UserNotActive();

    constructor(address initialAdmin) {
        if (initialAdmin == address(0)) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(INSTITUTION_ADMIN_ROLE, initialAdmin);
        _grantRole(AUDITOR_ROLE, initialAdmin);
    }

    function registerUser(
        Role role,
        bytes32 profileHash,
        bytes32 publicKeyHash,
        string calldata publicKeyUri
    ) external whenNotPaused {
        if (users[msg.sender].account != address(0)) revert UserAlreadyRegistered();
        if (role == Role.None || role == Role.InstitutionAdmin || role == Role.Auditor) revert InvalidRole();

        UserStatus status = role == Role.Patient ? UserStatus.Active : UserStatus.Pending;
        users[msg.sender] = UserProfile({
            account: msg.sender,
            role: role,
            status: status,
            profileHash: profileHash,
            publicKeyHash: publicKeyHash,
            publicKeyUri: publicKeyUri,
            organization: address(0),
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        emit UserRegistered(msg.sender, role, profileHash);
        if (status == UserStatus.Active) {
            emit UserApproved(msg.sender, msg.sender);
        }
    }

    function registerInstitutionAdmin(
        address account,
        bytes32 profileHash,
        bytes32 publicKeyHash,
        string calldata publicKeyUri
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0)) revert InvalidAddress();
        if (users[account].account != address(0)) revert UserAlreadyRegistered();

        users[account] = UserProfile({
            account: account,
            role: Role.InstitutionAdmin,
            status: UserStatus.Active,
            profileHash: profileHash,
            publicKeyHash: publicKeyHash,
            publicKeyUri: publicKeyUri,
            organization: account,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        _grantRole(INSTITUTION_ADMIN_ROLE, account);
        emit UserRegistered(account, Role.InstitutionAdmin, profileHash);
        emit UserApproved(account, msg.sender);
    }

    function approveUser(address account, address organization) external onlyRole(INSTITUTION_ADMIN_ROLE) {
        UserProfile storage user = users[account];
        if (user.account == address(0)) revert UserNotFound();
        if (user.role == Role.None) revert InvalidRole();

        user.status = UserStatus.Active;
        user.organization = organization == address(0) ? msg.sender : organization;
        user.updatedAt = block.timestamp;
        emit UserApproved(account, msg.sender);
    }

    function rejectUser(address account) external onlyRole(INSTITUTION_ADMIN_ROLE) {
        UserProfile storage user = users[account];
        if (user.account == address(0)) revert UserNotFound();
        user.status = UserStatus.Rejected;
        user.updatedAt = block.timestamp;
        emit UserRejected(account, msg.sender);
    }

    function suspendUser(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        UserProfile storage user = users[account];
        if (user.account == address(0)) revert UserNotFound();
        user.status = UserStatus.Suspended;
        user.updatedAt = block.timestamp;
        emit UserSuspended(account, msg.sender);
    }

    function updatePublicKey(bytes32 publicKeyHash, string calldata publicKeyUri) external whenNotPaused {
        UserProfile storage user = users[msg.sender];
        if (user.account == address(0)) revert UserNotFound();
        user.publicKeyHash = publicKeyHash;
        user.publicKeyUri = publicKeyUri;
        user.updatedAt = block.timestamp;
        emit PublicKeyUpdated(msg.sender, publicKeyHash, publicKeyUri);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function getUser(address account) external view returns (UserProfile memory) {
        UserProfile memory user = users[account];
        if (user.account == address(0)) revert UserNotFound();
        return user;
    }

    function isActive(address account) public view returns (bool) {
        return users[account].account != address(0) && users[account].status == UserStatus.Active;
    }

    function isActivePatient(address account) external view returns (bool) {
        return isActive(account) && users[account].role == Role.Patient;
    }

    function isActiveDoctor(address account) external view returns (bool) {
        return isActive(account) && users[account].role == Role.Doctor;
    }

    function isActiveResearcher(address account) external view returns (bool) {
        return isActive(account) && users[account].role == Role.Researcher;
    }

    function roleOf(address account) external view returns (Role) {
        return users[account].role;
    }
}
