// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IdentityRegistry} from "./IdentityRegistry.sol";

contract MedicalDataRegistry is AccessControl, Pausable {
    bytes32 public constant REGISTRY_ADMIN_ROLE = keccak256("REGISTRY_ADMIN_ROLE");

    enum DataStatus {
        Active,
        Disabled
    }

    struct DataAsset {
        uint256 assetId;
        address owner;
        bytes32 cidHash;
        bytes32 contentHash;
        bytes32 metadataHash;
        bytes32 category;
        uint256 version;
        uint256 previousAssetId;
        DataStatus status;
        uint256 createdAt;
    }

    IdentityRegistry public immutable identityRegistry;
    uint256 public nextAssetId = 1;

    mapping(uint256 => DataAsset) private assets;
    mapping(address => uint256[]) private ownerAssets;

    event DataAssetRegistered(uint256 indexed assetId, address indexed owner, bytes32 category);
    event DataAssetVersioned(uint256 indexed oldAssetId, uint256 indexed newAssetId);
    event DataAssetDisabled(uint256 indexed assetId, address indexed owner);

    error InvalidAsset();
    error InvalidHash();
    error NotAssetOwner();
    error NotActivePatient();
    error AssetNotActive();

    constructor(address initialAdmin, IdentityRegistry registry) {
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(REGISTRY_ADMIN_ROLE, initialAdmin);
        identityRegistry = registry;
    }

    function registerDataAsset(
        bytes32 cidHash,
        bytes32 contentHash,
        bytes32 metadataHash,
        bytes32 category
    ) external whenNotPaused returns (uint256 assetId) {
        if (!identityRegistry.isActivePatient(msg.sender)) revert NotActivePatient();
        if (cidHash == bytes32(0) || contentHash == bytes32(0) || metadataHash == bytes32(0)) revert InvalidHash();

        assetId = nextAssetId++;
        assets[assetId] = DataAsset({
            assetId: assetId,
            owner: msg.sender,
            cidHash: cidHash,
            contentHash: contentHash,
            metadataHash: metadataHash,
            category: category,
            version: 1,
            previousAssetId: 0,
            status: DataStatus.Active,
            createdAt: block.timestamp
        });
        ownerAssets[msg.sender].push(assetId);
        emit DataAssetRegistered(assetId, msg.sender, category);
    }

    function createNewVersion(
        uint256 previousAssetId,
        bytes32 cidHash,
        bytes32 contentHash,
        bytes32 metadataHash
    ) external whenNotPaused returns (uint256 newAssetId) {
        DataAsset storage previous = assets[previousAssetId];
        if (previous.assetId == 0) revert InvalidAsset();
        if (previous.owner != msg.sender) revert NotAssetOwner();
        if (cidHash == bytes32(0) || contentHash == bytes32(0) || metadataHash == bytes32(0)) revert InvalidHash();

        previous.status = DataStatus.Disabled;
        newAssetId = nextAssetId++;
        assets[newAssetId] = DataAsset({
            assetId: newAssetId,
            owner: msg.sender,
            cidHash: cidHash,
            contentHash: contentHash,
            metadataHash: metadataHash,
            category: previous.category,
            version: previous.version + 1,
            previousAssetId: previousAssetId,
            status: DataStatus.Active,
            createdAt: block.timestamp
        });

        ownerAssets[msg.sender].push(newAssetId);
        emit DataAssetDisabled(previousAssetId, msg.sender);
        emit DataAssetVersioned(previousAssetId, newAssetId);
    }

    function disableAsset(uint256 assetId) external whenNotPaused {
        DataAsset storage asset = assets[assetId];
        if (asset.assetId == 0) revert InvalidAsset();
        if (asset.owner != msg.sender) revert NotAssetOwner();
        asset.status = DataStatus.Disabled;
        emit DataAssetDisabled(assetId, msg.sender);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function getAsset(uint256 assetId) external view returns (DataAsset memory) {
        DataAsset memory asset = assets[assetId];
        if (asset.assetId == 0) revert InvalidAsset();
        return asset;
    }

    function getOwnerAssets(address owner) external view returns (uint256[] memory) {
        return ownerAssets[owner];
    }

    function isOwner(uint256 assetId, address account) external view returns (bool) {
        return assets[assetId].owner == account;
    }

    function isActiveAsset(uint256 assetId) external view returns (bool) {
        return assets[assetId].assetId != 0 && assets[assetId].status == DataStatus.Active;
    }

    function ownerOf(uint256 assetId) external view returns (address) {
        if (assets[assetId].assetId == 0) revert InvalidAsset();
        return assets[assetId].owner;
    }
}
