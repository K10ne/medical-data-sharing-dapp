import { z } from "zod";

export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

export const userSchema = z.object({
  address: addressSchema,
  role: z.enum(["patient", "doctor", "researcher", "admin", "auditor"]),
  displayName: z.string().min(1).max(80),
  organization: z.string().max(120).optional(),
  department: z.string().max(80).optional(),
  publicKey: z.string().max(4000).optional(),
  status: z.enum(["pending", "active", "rejected", "suspended"]).default("pending"),
  profileHash: z.string().optional()
});

export const assetSchema = z.object({
  owner: addressSchema,
  title: z.string().min(1).max(120),
  category: z.enum(["LAB_REPORT", "IMAGING", "DIAGNOSIS", "MEDICATION", "SURGERY", "CUSTOM"]),
  hospital: z.string().min(1).max(120),
  department: z.string().min(1).max(80),
  recordDate: z.string().min(4).max(20),
  tags: z.array(z.string().min(1).max(40)).default([]),
  cid: z.string().min(1),
  cidHash: z.string().min(8),
  contentHash: z.string().min(8),
  metadataHash: z.string().min(8)
});

export const uploadSchema = z.object({
  bytesBase64: z.string().min(1),
  contentType: z.string().min(1).default("application/octet-stream")
});

export const requestSchema = z.object({
  requester: addressSchema,
  patient: addressSchema,
  assetIds: z.array(z.string()).min(1).max(20),
  purpose: z.string().min(2).max(80),
  requestedDurationHours: z.number().int().min(1).max(24 * 90)
});

export const approveSchema = z.object({
  encryptedKeyRef: z.string().min(1),
  expiresAt: z.string().datetime()
});

export const actorSchema = z.object({
  actor: addressSchema
});
