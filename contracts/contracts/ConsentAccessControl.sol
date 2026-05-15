// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IdentityRegistry} from "./IdentityRegistry.sol";
import {MedicalDataRegistry} from "./MedicalDataRegistry.sol";

contract ConsentAccessControl is AccessControl, Pausable {
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    uint256 public constant MAX_ASSETS_PER_REQUEST = 20;

    enum RequestStatus {
        Pending,
        Approved,
        Rejected,
        Cancelled
    }

    enum GrantStatus {
        Active,
        Revoked
    }

    struct AccessRequest {
        uint256 requestId;
        address requester;
        address patient;
        uint256[] assetIds;
        bytes32 purpose;
        uint256 requestedDuration;
        RequestStatus status;
        uint256 createdAt;
    }

    struct AccessGrant {
        uint256 grantId;
        uint256 requestId;
        address patient;
        address grantee;
        uint256[] assetIds;
        bytes32 encryptedKeyHash;
        string encryptedKeyUri;
        uint256 expiresAt;
        GrantStatus status;
        uint256 createdAt;
    }

    IdentityRegistry public immutable identityRegistry;
    MedicalDataRegistry public immutable dataRegistry;

    uint256 public nextRequestId = 1;
    uint256 public nextGrantId = 1;

    mapping(uint256 => AccessRequest) private requests;
    mapping(uint256 => AccessGrant) private grants;
    mapping(uint256 => uint256[]) private assetGrants;
    mapping(address => uint256[]) private requesterRequests;
    mapping(address => uint256[]) private patientRequests;
    mapping(address => uint256[]) private granteeGrants;

    event AccessRequested(uint256 indexed requestId, address indexed requester, address indexed patient);
    event AccessApproved(uint256 indexed requestId, uint256 indexed grantId, address indexed grantee);
    event AccessRejected(uint256 indexed requestId, address indexed patient, string reasonUri);
    event AccessCancelled(uint256 indexed requestId, address indexed requester);
    event GrantRevoked(uint256 indexed grantId, address indexed patient);
    event DataAccessRecorded(uint256 indexed grantId, uint256 indexed assetId, address indexed accessor, bytes32 accessProofHash);

    error InvalidRequest();
    error InvalidGrant();
    error InvalidScope();
    error InvalidDuration();
    error InvalidPatient();
    error InvalidRequester();
    error NotRequestPatient();
    error NotRequestOwner();
    error NotGrantPatient();
    error RequestNotPending();
    error GrantNotActive();

    constructor(address initialAdmin, IdentityRegistry identity, MedicalDataRegistry data) {
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(AUDITOR_ROLE, initialAdmin);
        identityRegistry = identity;
        dataRegistry = data;
    }

    function createAccessRequest(
        address patient,
        uint256[] calldata assetIds,
        bytes32 purpose,
        uint256 requestedDuration
    ) external whenNotPaused returns (uint256 requestId) {
        if (patient == address(0)) revert InvalidPatient();
        if (!identityRegistry.isActiveDoctor(msg.sender) && !identityRegistry.isActiveResearcher(msg.sender)) {
            revert InvalidRequester();
        }
        if (!identityRegistry.isActivePatient(patient)) revert InvalidPatient();
        if (assetIds.length == 0 || assetIds.length > MAX_ASSETS_PER_REQUEST) revert InvalidScope();
        if (requestedDuration == 0 || requestedDuration > 90 days) revert InvalidDuration();

        for (uint256 i = 0; i < assetIds.length; i++) {
            if (!dataRegistry.isActiveAsset(assetIds[i])) revert InvalidScope();
            if (dataRegistry.ownerOf(assetIds[i]) != patient) revert InvalidScope();
        }

        requestId = nextRequestId++;
        requests[requestId] = AccessRequest({
            requestId: requestId,
            requester: msg.sender,
            patient: patient,
            assetIds: assetIds,
            purpose: purpose,
            requestedDuration: requestedDuration,
            status: RequestStatus.Pending,
            createdAt: block.timestamp
        });
        requesterRequests[msg.sender].push(requestId);
        patientRequests[patient].push(requestId);
        emit AccessRequested(requestId, msg.sender, patient);
    }

    function approveRequest(
        uint256 requestId,
        string calldata encryptedKeyUri,
        bytes32 encryptedKeyHash,
        uint256 expiresAt
    ) external whenNotPaused returns (uint256 grantId) {
        AccessRequest storage requestItem = requests[requestId];
        if (requestItem.requestId == 0) revert InvalidRequest();
        if (requestItem.patient != msg.sender) revert NotRequestPatient();
        if (requestItem.status != RequestStatus.Pending) revert RequestNotPending();
        if (encryptedKeyHash == bytes32(0)) revert InvalidScope();
        if (expiresAt <= block.timestamp || expiresAt > block.timestamp + requestItem.requestedDuration) revert InvalidDuration();

        requestItem.status = RequestStatus.Approved;
        grantId = nextGrantId++;
        grants[grantId] = AccessGrant({
            grantId: grantId,
            requestId: requestId,
            patient: requestItem.patient,
            grantee: requestItem.requester,
            assetIds: requestItem.assetIds,
            encryptedKeyHash: encryptedKeyHash,
            encryptedKeyUri: encryptedKeyUri,
            expiresAt: expiresAt,
            status: GrantStatus.Active,
            createdAt: block.timestamp
        });

        for (uint256 i = 0; i < requestItem.assetIds.length; i++) {
            assetGrants[requestItem.assetIds[i]].push(grantId);
        }
        granteeGrants[requestItem.requester].push(grantId);
        emit AccessApproved(requestId, grantId, requestItem.requester);
    }

    function rejectRequest(uint256 requestId, string calldata reasonUri) external whenNotPaused {
        AccessRequest storage requestItem = requests[requestId];
        if (requestItem.requestId == 0) revert InvalidRequest();
        if (requestItem.patient != msg.sender) revert NotRequestPatient();
        if (requestItem.status != RequestStatus.Pending) revert RequestNotPending();
        requestItem.status = RequestStatus.Rejected;
        emit AccessRejected(requestId, msg.sender, reasonUri);
    }

    function cancelRequest(uint256 requestId) external whenNotPaused {
        AccessRequest storage requestItem = requests[requestId];
        if (requestItem.requestId == 0) revert InvalidRequest();
        if (requestItem.requester != msg.sender) revert NotRequestOwner();
        if (requestItem.status != RequestStatus.Pending) revert RequestNotPending();
        requestItem.status = RequestStatus.Cancelled;
        emit AccessCancelled(requestId, msg.sender);
    }

    function revokeGrant(uint256 grantId) external whenNotPaused {
        AccessGrant storage grant = grants[grantId];
        if (grant.grantId == 0) revert InvalidGrant();
        if (grant.patient != msg.sender && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert NotGrantPatient();
        if (grant.status != GrantStatus.Active) revert GrantNotActive();
        grant.status = GrantStatus.Revoked;
        emit GrantRevoked(grantId, msg.sender);
    }

    function recordAccess(uint256 grantId, uint256 assetId, bytes32 accessProofHash) external whenNotPaused {
        AccessGrant memory grant = grants[grantId];
        if (grant.grantId == 0 || grant.grantee != msg.sender) revert InvalidGrant();
        if (grant.status != GrantStatus.Active || grant.expiresAt <= block.timestamp) revert GrantNotActive();

        bool inScope = false;
        for (uint256 i = 0; i < grant.assetIds.length; i++) {
            if (grant.assetIds[i] == assetId) {
                inScope = true;
                break;
            }
        }
        if (!inScope) revert InvalidScope();
        emit DataAccessRecorded(grantId, assetId, msg.sender, accessProofHash);
    }

    function hasValidAccess(address grantee, uint256 assetId) public view returns (bool) {
        uint256[] storage grantIds = assetGrants[assetId];
        for (uint256 i = 0; i < grantIds.length; i++) {
            AccessGrant storage grant = grants[grantIds[i]];
            if (
                grant.grantee == grantee &&
                grant.status == GrantStatus.Active &&
                grant.expiresAt > block.timestamp
            ) {
                return true;
            }
        }
        return false;
    }

    function getRequest(uint256 requestId) external view returns (AccessRequest memory) {
        if (requests[requestId].requestId == 0) revert InvalidRequest();
        return requests[requestId];
    }

    function getGrant(uint256 grantId) external view returns (AccessGrant memory) {
        if (grants[grantId].grantId == 0) revert InvalidGrant();
        return grants[grantId];
    }

    function getPatientRequests(address patient) external view returns (uint256[] memory) {
        return patientRequests[patient];
    }

    function getRequesterRequests(address requester) external view returns (uint256[] memory) {
        return requesterRequests[requester];
    }

    function getGranteeGrants(address grantee) external view returns (uint256[] memory) {
        return granteeGrants[grantee];
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
