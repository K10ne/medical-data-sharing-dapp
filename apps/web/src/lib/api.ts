import type {
  AccessGrant,
  AccessRequest,
  AuditEvent,
  DataAsset,
  NotificationItem,
  UserProfile
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),
  users: () => request<UserProfile[]>("/api/users"),
  assets: (owner?: string) => request<DataAsset[]>(`/api/assets${owner ? `?owner=${owner}` : ""}`),
  createAsset: (payload: Omit<DataAsset, "assetId" | "createdAt" | "status" | "version">) =>
    request<DataAsset>("/api/assets", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  uploadBlob: (payload: { bytesBase64: string; contentType: string }) =>
    request<{ cid: string; bytesBase64: string; contentType: string; createdAt: string }>("/api/ipfs/upload", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  getBlob: (cid: string) => request<{ cid: string; bytesBase64: string; contentType: string }>(`/api/ipfs/${cid}`),
  requests: (user?: string) => request<AccessRequest[]>(`/api/requests${user ? `?user=${user}` : ""}`),
  createRequest: (payload: Omit<AccessRequest, "requestId" | "createdAt" | "status">) =>
    request<AccessRequest>("/api/requests", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  approveRequest: (requestId: string, payload: { encryptedKeyRef: string; expiresAt: string }) =>
    request<AccessGrant>(`/api/requests/${requestId}/approve`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  rejectRequest: (requestId: string, actor: string) =>
    request<AccessRequest>(`/api/requests/${requestId}/reject`, {
      method: "POST",
      body: JSON.stringify({ actor })
    }),
  grants: (user?: string) => request<AccessGrant[]>(`/api/grants${user ? `?user=${user}` : ""}`),
  revokeGrant: (grantId: string, actor: string) =>
    request<AccessGrant>(`/api/grants/${grantId}/revoke`, {
      method: "POST",
      body: JSON.stringify({ actor })
    }),
  recordAccess: (grantId: string, assetId: string, actor: string) =>
    request<{ ok: boolean }>(`/api/grants/${grantId}/access/${assetId}`, {
      method: "POST",
      body: JSON.stringify({ actor })
    }),
  audit: (address?: string) => request<AuditEvent[]>(`/api/audit${address ? `?address=${address}` : ""}`),
  notifications: (user: string) => request<NotificationItem[]>(`/api/notifications?user=${user}`)
};
