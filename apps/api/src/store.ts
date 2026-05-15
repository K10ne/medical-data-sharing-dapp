import { nanoid } from "nanoid";
import type {
  AccessGrant,
  AccessRequest,
  AuditEvent,
  DataAsset,
  NotificationItem,
  UserProfile
} from "./types.js";

interface StoredBlob {
  cid: string;
  bytesBase64: string;
  contentType: string;
  createdAt: string;
}

const now = () => new Date().toISOString();

export class InMemoryStore {
  users = new Map<string, UserProfile>();
  assets = new Map<string, DataAsset>();
  requests = new Map<string, AccessRequest>();
  grants = new Map<string, AccessGrant>();
  audits: AuditEvent[] = [];
  notifications: NotificationItem[] = [];
  blobs = new Map<string, StoredBlob>();

  constructor() {
    this.seed();
  }

  private seed() {
    const patient = "0x7a91b554cc4d7c3f4f0890d6b7d0c64bff2b3521";
    const doctor = "0x1f9b7c7d233f8b5ad8e2fd61bca12b03aa9f0532";
    const admin = "0xa8a30d7a4f87c4bdb00e5cb192402d7df6c63c77";

    this.upsertUser({
      address: patient,
      role: "patient",
      displayName: "Alice Chen",
      status: "active",
      publicKey: "demo-patient-public-key",
      createdAt: now()
    });
    this.upsertUser({
      address: doctor,
      role: "doctor",
      displayName: "Dr. Bob Lin",
      organization: "示例第一医院",
      department: "心内科",
      status: "active",
      publicKey: "demo-doctor-public-key",
      createdAt: now()
    });
    this.upsertUser({
      address: admin,
      role: "admin",
      displayName: "Institution Admin",
      organization: "示例第一医院",
      status: "active",
      createdAt: now()
    });
  }

  upsertUser(user: UserProfile) {
    this.users.set(user.address.toLowerCase(), user);
    this.addAudit("USER_UPSERTED", user.address, { target: user.address });
  }

  addBlob(bytesBase64: string, contentType: string) {
    const cid = `local-${nanoid(20)}`;
    this.blobs.set(cid, {
      cid,
      bytesBase64,
      contentType,
      createdAt: now()
    });
    return this.blobs.get(cid)!;
  }

  addAsset(asset: Omit<DataAsset, "assetId" | "createdAt" | "status" | "version">) {
    const assetId = String(this.assets.size + 1);
    const item: DataAsset = {
      ...asset,
      assetId,
      status: "active",
      version: 1,
      createdAt: now()
    };
    this.assets.set(assetId, item);
    this.addAudit("DATA_ASSET_REGISTERED", item.owner, { assetId });
    return item;
  }

  addRequest(request: Omit<AccessRequest, "requestId" | "createdAt" | "status">) {
    const requestId = String(this.requests.size + 1);
    const item: AccessRequest = {
      ...request,
      requestId,
      status: "pending",
      createdAt: now()
    };
    this.requests.set(requestId, item);
    this.addAudit("ACCESS_REQUESTED", item.requester, {
      target: item.patient,
      requestId
    });
    this.notify(item.patient, "新的医疗数据访问申请", `${item.requester.slice(0, 10)} 请求访问 ${item.assetIds.length} 份数据`);
    return item;
  }

  approveRequest(requestId: string, encryptedKeyRef: string, expiresAt: string) {
    const request = this.requests.get(requestId);
    if (!request) return undefined;
    request.status = "approved";
    const grantId = String(this.grants.size + 1);
    const grant: AccessGrant = {
      grantId,
      requestId,
      patient: request.patient,
      grantee: request.requester,
      assetIds: request.assetIds,
      encryptedKeyRef,
      expiresAt,
      status: "active",
      createdAt: now()
    };
    this.grants.set(grantId, grant);
    this.addAudit("ACCESS_APPROVED", request.patient, {
      target: request.requester,
      requestId,
      grantId
    });
    this.notify(request.requester, "访问申请已通过", `授权 ${grantId} 有效至 ${new Date(expiresAt).toLocaleString()}`);
    return grant;
  }

  rejectRequest(requestId: string, actor: string) {
    const request = this.requests.get(requestId);
    if (!request) return undefined;
    request.status = "rejected";
    this.addAudit("ACCESS_REJECTED", actor, {
      target: request.requester,
      requestId
    });
    this.notify(request.requester, "访问申请被拒绝", `申请 ${requestId} 已被患者拒绝`);
    return request;
  }

  revokeGrant(grantId: string, actor: string) {
    const grant = this.grants.get(grantId);
    if (!grant) return undefined;
    grant.status = "revoked";
    this.addAudit("GRANT_REVOKED", actor, {
      target: grant.grantee,
      grantId
    });
    this.notify(grant.grantee, "授权已撤销", `授权 ${grantId} 已被患者撤销`);
    return grant;
  }

  recordAccess(grantId: string, assetId: string, actor: string) {
    this.addAudit("DATA_ACCESS_RECORDED", actor, {
      assetId,
      grantId
    });
  }

  addAudit(eventType: string, actor: string, rest: Partial<AuditEvent> = {}) {
    const event: AuditEvent = {
      id: String(this.audits.length + 1),
      eventType,
      actor,
      createdAt: now(),
      txHash: rest.txHash ?? `0x${nanoid(64).replace(/-/g, "0").slice(0, 64)}`,
      blockNumber: rest.blockNumber ?? 1000 + this.audits.length,
      ...rest
    };
    this.audits.unshift(event);
    return event;
  }

  notify(user: string, title: string, body: string) {
    const item: NotificationItem = {
      id: nanoid(10),
      user: user.toLowerCase(),
      title,
      body,
      read: false,
      createdAt: now()
    };
    this.notifications.unshift(item);
    return item;
  }
}

export const store = new InMemoryStore();
