import { ethers } from "hardhat";
import deployment from "../../apps/web/src/contracts/deployment.active.json";

async function main() {
  const account = process.env.APPROVE_USER_ADDRESS;
  if (!account || !ethers.isAddress(account)) {
    throw new Error("Set APPROVE_USER_ADDRESS to the doctor/researcher wallet address.");
  }

  const [admin] = await ethers.getSigners();
  const identity = await ethers.getContractAt("IdentityRegistry", deployment.contracts.IdentityRegistry, admin);
  const tx = await identity.approveUser(account, admin.address);
  console.log(`Approving ${account} with tx ${tx.hash}`);
  await tx.wait();
  console.log("User approved.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
