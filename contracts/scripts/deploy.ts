import { ethers } from "hardhat";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const network = await ethers.provider.getNetwork();
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer signer. Set DEPLOYER_PRIVATE_KEY for testnet deployment.");
  }

  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy(deployer.address);
  await identityRegistry.waitForDeployment();

  const MedicalDataRegistry = await ethers.getContractFactory("MedicalDataRegistry");
  const medicalDataRegistry = await MedicalDataRegistry.deploy(
    deployer.address,
    await identityRegistry.getAddress()
  );
  await medicalDataRegistry.waitForDeployment();

  const ConsentAccessControl = await ethers.getContractFactory("ConsentAccessControl");
  const consentAccessControl = await ConsentAccessControl.deploy(
    deployer.address,
    await identityRegistry.getAddress(),
    await medicalDataRegistry.getAddress()
  );
  await consentAccessControl.waitForDeployment();

  const deployment = {
    chainId: Number(network.chainId),
    network: network.name,
    deployer: deployer.address,
    contracts: {
      IdentityRegistry: await identityRegistry.getAddress(),
      MedicalDataRegistry: await medicalDataRegistry.getAddress(),
      ConsentAccessControl: await consentAccessControl.getAddress()
    },
    deployedAt: new Date().toISOString()
  };

  const suffix = Number(network.chainId) === 31337 ? "local" : String(network.chainId);
  const outDir = path.resolve(__dirname, "../../apps/web/src/contracts");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `deployment.${suffix}.json`), JSON.stringify(deployment, null, 2));
  fs.writeFileSync(path.join(outDir, "deployment.active.json"), JSON.stringify(deployment, null, 2));

  const apiOutDir = path.resolve(__dirname, "../../apps/api/src/contracts");
  fs.mkdirSync(apiOutDir, { recursive: true });
  fs.writeFileSync(path.join(apiOutDir, `deployment.${suffix}.json`), JSON.stringify(deployment, null, 2));
  fs.writeFileSync(path.join(apiOutDir, "deployment.active.json"), JSON.stringify(deployment, null, 2));

  console.log("Contracts deployed:");
  console.table(deployment.contracts);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
