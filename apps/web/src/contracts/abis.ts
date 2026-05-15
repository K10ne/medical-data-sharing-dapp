export const identityRegistryAbi = [
  {
    type: "function",
    name: "registerUser",
    stateMutability: "nonpayable",
    inputs: [
      { name: "role", type: "uint8" },
      { name: "profileHash", type: "bytes32" },
      { name: "publicKeyHash", type: "bytes32" },
      { name: "publicKeyUri", type: "string" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "approveUser",
    stateMutability: "nonpayable",
    inputs: [
      { name: "account", type: "address" },
      { name: "organization", type: "address" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "isActivePatient",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }]
  },
  {
    type: "function",
    name: "isActiveDoctor",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }]
  }
] as const;

export const medicalDataRegistryAbi = [
  {
    type: "function",
    name: "registerDataAsset",
    stateMutability: "nonpayable",
    inputs: [
      { name: "cidHash", type: "bytes32" },
      { name: "contentHash", type: "bytes32" },
      { name: "metadataHash", type: "bytes32" },
      { name: "category", type: "bytes32" }
    ],
    outputs: [{ name: "assetId", type: "uint256" }]
  },
  {
    type: "function",
    name: "getAsset",
    stateMutability: "view",
    inputs: [{ name: "assetId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "assetId", type: "uint256" },
          { name: "owner", type: "address" },
          { name: "cidHash", type: "bytes32" },
          { name: "contentHash", type: "bytes32" },
          { name: "metadataHash", type: "bytes32" },
          { name: "category", type: "bytes32" },
          { name: "version", type: "uint256" },
          { name: "previousAssetId", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "createdAt", type: "uint256" }
        ]
      }
    ]
  }
] as const;

export const consentAccessControlAbi = [
  {
    type: "function",
    name: "createAccessRequest",
    stateMutability: "nonpayable",
    inputs: [
      { name: "patient", type: "address" },
      { name: "assetIds", type: "uint256[]" },
      { name: "purpose", type: "bytes32" },
      { name: "requestedDuration", type: "uint256" }
    ],
    outputs: [{ name: "requestId", type: "uint256" }]
  },
  {
    type: "function",
    name: "approveRequest",
    stateMutability: "nonpayable",
    inputs: [
      { name: "requestId", type: "uint256" },
      { name: "encryptedKeyUri", type: "string" },
      { name: "encryptedKeyHash", type: "bytes32" },
      { name: "expiresAt", type: "uint256" }
    ],
    outputs: [{ name: "grantId", type: "uint256" }]
  },
  {
    type: "function",
    name: "revokeGrant",
    stateMutability: "nonpayable",
    inputs: [{ name: "grantId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "recordAccess",
    stateMutability: "nonpayable",
    inputs: [
      { name: "grantId", type: "uint256" },
      { name: "assetId", type: "uint256" },
      { name: "accessProofHash", type: "bytes32" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "hasValidAccess",
    stateMutability: "view",
    inputs: [
      { name: "grantee", type: "address" },
      { name: "assetId", type: "uint256" }
    ],
    outputs: [{ type: "bool" }]
  }
] as const;
