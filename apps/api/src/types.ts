export type Role = "patient" | "doctor" | "researcher" | "admin" | "auditor";
export type UserStatus = "pending" | "active" | "rejected" | "suspended";
export type DataCategory = "LAB_REPORT" | "IMAGING" | "DIAGNOSIS" | "MEDICATION" | "SURGERY" | "CUSTOM";
export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";
export type GrantStatus = "active" | "revoked" | "expired";

export interface UserProfile {
  address: string;
  role: Role;
  displayName: string;
  organization?: string;
  department?: string;
  publicKey?: string;
  status: UserStatus;
  profileHash?: string;
  createdAt: string;
}

export interface DataAsset {
  assetId: string;
  owner: string;
  title: string;
  category: DataCategory;
  hospital: string;
  department: string;
  recordDate: string;
  tags: string[];
  cid: string;
  cidHash: string;
  contentHash: string;
  metadataHash: string;
  version: number;
  status: "active" | "disabled";
  createdAt: string;
}

export interface AccessRequest {
  requestId: string;
  requester: string;
  patient: string;
  assetIds: string[];
  purpose: string;
  requestedDurationHours: number;
  status: RequestStatus;
  createdAt: string;
}

export interface AccessGrant {
  grantId: string;
  requestId: string;
  patient: string;
  grantee: string;
  assetIds: string[];
  encryptedKeyRef: string;
  expiresAt: string;
  status: GrantStatus;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  eventType: string;
  actor: string;
  target?: string;
  assetId?: string;
  requestId?: string;
  grantId?: string;
  txHash?: string;
  blockNumber?: number;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  user: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}
