import {
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  http,
  type Address,
  type EIP1193Provider,
  type Hex
} from "viem";
import { hardhat, sepolia } from "viem/chains";
import deployment from "../contracts/deployment.active.json";

export type EthereumProvider = EIP1193Provider & {
  on?: (event: "accountsChanged" | "chainChanged", handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: "accountsChanged" | "chainChanged", handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export const activeDeployment = deployment;

export const targetChainId = Number(import.meta.env.VITE_CHAIN_ID ?? deployment.chainId ?? 31337);
export const targetChain = targetChainId === sepolia.id ? sepolia : hardhat;
export const targetChainName = import.meta.env.VITE_CHAIN_NAME ?? (targetChainId === sepolia.id ? "Sepolia" : "Hardhat Local");
export const blockExplorer = import.meta.env.VITE_BLOCK_EXPLORER ?? (targetChainId === sepolia.id ? "https://sepolia.etherscan.io" : "");
export const rpcUrl =
  (import.meta.env.VITE_RPC_URL as string | undefined) ??
  (targetChainId === sepolia.id ? "https://ethereum-sepolia-rpc.publicnode.com" : "http://127.0.0.1:8545");

export function hasContracts() {
  return Boolean(
    activeDeployment.contracts.IdentityRegistry &&
      activeDeployment.contracts.MedicalDataRegistry &&
      activeDeployment.contracts.ConsentAccessControl
  );
}

export function contractAddress(name: keyof typeof activeDeployment.contracts): Address {
  const value = activeDeployment.contracts[name];
  if (!value) throw new Error(`Missing ${name} deployment address. Deploy contracts first.`);
  return getAddress(value);
}

export function getWalletClient() {
  if (!window.ethereum) throw new Error("MetaMask is not installed.");
  return createWalletClient({
    chain: targetChain,
    transport: custom(window.ethereum)
  });
}

export function getPublicClient() {
  return createPublicClient({
    chain: targetChain,
    transport: http(rpcUrl)
  });
}

export async function waitForTransaction(hash: Hex) {
  return getPublicClient().waitForTransactionReceipt({ hash });
}

export async function connectMetaMask() {
  if (!window.ethereum) {
    throw new Error("未检测到 MetaMask，请先安装浏览器钱包。");
  }
  const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts[0]) throw new Error("MetaMask 未返回账户。");
  const chainIdHex = (await window.ethereum.request({ method: "eth_chainId" })) as string;
  return {
    address: getAddress(accounts[0]),
    chainId: Number.parseInt(chainIdHex, 16)
  };
}

export async function switchToTargetChain() {
  if (!window.ethereum) throw new Error("未检测到 MetaMask。");
  const chainIdHex = `0x${targetChainId.toString(16)}`;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }]
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? (error as { code?: number }).code : undefined;
    if (code !== 4902) throw error;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chainIdHex,
          chainName: targetChainName,
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [rpcUrl],
          blockExplorerUrls: blockExplorer ? [blockExplorer] : []
        }
      ]
    });
  }
}
