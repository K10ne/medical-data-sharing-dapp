import { expect } from "chai";
import { ethers, network } from "hardhat";

const hash = (value: string) => ethers.keccak256(ethers.toUtf8Bytes(value));

describe("Medical data sharing flow", function () {
  async function deployFixture() {
    const [admin, patient, doctor, researcher, outsider] = await ethers.getSigners();

    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    const identity = await IdentityRegistry.deploy(admin.address);

    const MedicalDataRegistry = await ethers.getContractFactory("MedicalDataRegistry");
    const data = await MedicalDataRegistry.deploy(admin.address, await identity.getAddress());

    const ConsentAccessControl = await ethers.getContractFactory("ConsentAccessControl");
    const consent = await ConsentAccessControl.deploy(
      admin.address,
      await identity.getAddress(),
      await data.getAddress()
    );

    return { admin, patient, doctor, researcher, outsider, identity, data, consent };
  }

  it("registers users, uploads data, approves access and revokes the grant", async function () {
    const { admin, patient, doctor, identity, data, consent } = await deployFixture();

    await identity.connect(patient).registerUser(1, hash("alice-profile"), hash("alice-key"), "ipfs://alice-key");
    await identity.connect(doctor).registerUser(2, hash("bob-profile"), hash("bob-key"), "ipfs://bob-key");

    await expect(
      consent.connect(doctor).createAccessRequest(patient.address, [1], hash("TREATMENT"), 7 * 24 * 60 * 60)
    ).to.be.revertedWithCustomError(consent, "InvalidRequester");

    await identity.connect(admin).approveUser(doctor.address, admin.address);

    await data.connect(patient).registerDataAsset(
      hash("cid"),
      hash("ciphertext"),
      hash("metadata"),
      hash("LAB_REPORT")
    );

    await expect(
      data.connect(doctor).disableAsset(1)
    ).to.be.revertedWithCustomError(data, "NotAssetOwner");

    await consent.connect(doctor).createAccessRequest(patient.address, [1], hash("TREATMENT"), 7 * 24 * 60 * 60);
    await expect(
      consent.connect(doctor).approveRequest(1, "ipfs://key", hash("wrapped-key"), Math.floor(Date.now() / 1000) + 3600)
    ).to.be.revertedWithCustomError(consent, "NotRequestPatient");

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    await consent.connect(patient).approveRequest(1, "ipfs://key", hash("wrapped-key"), now + 3600);

    expect(await consent.hasValidAccess(doctor.address, 1)).to.equal(true);
    await expect(
      consent.connect(doctor).recordAccess(1, 1, hash("first-read"))
    ).to.emit(consent, "DataAccessRecorded");

    await consent.connect(patient).revokeGrant(1);
    expect(await consent.hasValidAccess(doctor.address, 1)).to.equal(false);
  });

  it("expires grants by timestamp", async function () {
    const { admin, patient, doctor, identity, data, consent } = await deployFixture();

    await identity.connect(patient).registerUser(1, hash("alice-profile"), hash("alice-key"), "ipfs://alice-key");
    await identity.connect(doctor).registerUser(2, hash("bob-profile"), hash("bob-key"), "ipfs://bob-key");
    await identity.connect(admin).approveUser(doctor.address, admin.address);
    await data.connect(patient).registerDataAsset(hash("cid"), hash("ciphertext"), hash("metadata"), hash("LAB_REPORT"));
    await consent.connect(doctor).createAccessRequest(patient.address, [1], hash("TREATMENT"), 3600);

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    await consent.connect(patient).approveRequest(1, "ipfs://key", hash("wrapped-key"), now + 120);
    expect(await consent.hasValidAccess(doctor.address, 1)).to.equal(true);

    await network.provider.send("evm_increaseTime", [180]);
    await network.provider.send("evm_mine");

    expect(await consent.hasValidAccess(doctor.address, 1)).to.equal(false);
  });
});
