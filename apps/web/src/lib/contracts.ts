import { encodeFunctionData, keccak256, stringToBytes, type Address, type Hex } from "viem";
import { consentAccessControlAbi, identityRegistryAbi, medicalDataRegistryAbi } from "../contracts/abis";
import { contractAddress, getWalletClient, hasContracts, waitForTransaction } from "./chain";
import type { Role } from "./types";

const roleCode: Record<Role, number> = {
  patient: 1,
  doctor: 2,
  researcher: 3,
  admin: 4,
  auditor: 5
};

export function bytes32(value: string): Hex {
  return keccak256(stringToBytes(value));
}

async function sendTransaction(to: Address, data: Hex) {
  const walletClient = getWalletClient();
  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error("MetaMask 未连接账户。");
  const hash = await walletClient.sendTransaction({ account, to, data });
  await waitForTransaction(hash);
  return hash;
}

export async function registerUserOnChain(role: Role, accountAddress: string) {
  if (!hasContracts()) throw new Error("合约地址尚未配置，请先部署合约。");
  const data = encodeFunctionData({
    abi: identityRegistryAbi,
    functionName: "registerUser",
    args: [roleCode[role], bytes32(`profile:${accountAddress}`), bytes32(`key:${accountAddress}`), `local-key://${accountAddress}`]
  });
  return sendTransaction(contractAddress("IdentityRegistry"), data);
}

export async function registerDataAssetOnChain(args: {
  cidHash: Hex;
  contentHash: Hex;
  metadataHash: Hex;
  category: string;
}) {
  if (!hasContracts()) throw new Error("合约地址尚未配置，请先部署合约。");
  const data = encodeFunctionData({
    abi: medicalDataRegistryAbi,
    functionName: "registerDataAsset",
    args: [args.cidHash, args.contentHash, args.metadataHash, bytes32(args.category)]
  });
  return sendTransaction(contractAddress("MedicalDataRegistry"), data);
}

export async function createAccessRequestOnChain(args: {
  patient: Address;
  assetIds: bigint[];
  purpose: string;
  durationSeconds: bigint;
}) {
  if (!hasContracts()) throw new Error("合约地址尚未配置，请先部署合约。");
  const data = encodeFunctionData({
    abi: consentAccessControlAbi,
    functionName: "createAccessRequest",
    args: [args.patient, args.assetIds, bytes32(args.purpose), args.durationSeconds]
  });
  return sendTransaction(contractAddress("ConsentAccessControl"), data);
}

export async function approveRequestOnChain(args: {
  requestId: bigint;
  encryptedKeyUri: string;
  encryptedKeyHash: Hex;
  expiresAtSeconds: bigint;
}) {
  if (!hasContracts()) throw new Error("合约地址尚未配置，请先部署合约。");
  const data = encodeFunctionData({
    abi: consentAccessControlAbi,
    functionName: "approveRequest",
    args: [args.requestId, args.encryptedKeyUri, args.encryptedKeyHash, args.expiresAtSeconds]
  });
  return sendTransaction(contractAddress("ConsentAccessControl"), data);
}

export async function revokeGrantOnChain(grantId: bigint) {
  if (!hasContracts()) throw new Error("合约地址尚未配置，请先部署合约。");
  const data = encodeFunctionData({
    abi: consentAccessControlAbi,
    functionName: "revokeGrant",
    args: [grantId]
  });
  return sendTransaction(contractAddress("ConsentAccessControl"), data);
}
