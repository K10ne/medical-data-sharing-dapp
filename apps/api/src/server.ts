import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { z } from "zod";
import { store } from "./store.js";
import {
  actorSchema,
  approveSchema,
  assetSchema,
  requestSchema,
  uploadSchema,
  userSchema
} from "./schemas.js";

const app = express();
const port = Number(process.env.PORT ?? 4100);

app.use(helmet());
app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "25mb" }));
app.use(morgan("dev"));

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  return schema.parse(body);
}

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "medical-data-sharing-api",
    time: new Date().toISOString()
  });
});

app.get("/api/users", (_req, res) => {
  res.json(Array.from(store.users.values()));
});

app.get("/api/users/:address", (req, res) => {
  const user = store.users.get(req.params.address.toLowerCase());
  if (!user) {
    res.status(404).json({ error: "USER_NOT_FOUND" });
    return;
  }
  res.json(user);
});

app.post("/api/users", (req, res, next) => {
  try {
    const payload = parseBody(userSchema, req.body);
    const user = {
      ...payload,
      address: payload.address.toLowerCase(),
      status: payload.status ?? "pending",
      createdAt: new Date().toISOString()
    };
    store.upsertUser(user);
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

app.post("/api/ipfs/upload", (req, res, next) => {
  try {
    const payload = parseBody(uploadSchema, req.body);
    const blob = store.addBlob(payload.bytesBase64, payload.contentType ?? "application/octet-stream");
    res.status(201).json(blob);
  } catch (error) {
    next(error);
  }
});

app.get("/api/ipfs/:cid", (req, res) => {
  const blob = store.blobs.get(req.params.cid ?? "");
  if (!blob) {
    res.status(404).json({ error: "BLOB_NOT_FOUND" });
    return;
  }
  res.json(blob);
});

app.get("/api/assets", (req, res) => {
  const owner = String(req.query.owner ?? "").toLowerCase();
  const items = Array.from(store.assets.values()).filter((asset) => !owner || asset.owner.toLowerCase() === owner);
  res.json(items);
});

app.post("/api/assets", (req, res, next) => {
  try {
    const payload = parseBody(assetSchema, req.body);
    const asset = store.addAsset({
      ...payload,
      owner: payload.owner.toLowerCase(),
      tags: payload.tags ?? []
    });
    res.status(201).json(asset);
  } catch (error) {
    next(error);
  }
});

app.get("/api/requests", (req, res) => {
  const user = String(req.query.user ?? "").toLowerCase();
  const role = String(req.query.role ?? "");
  const items = Array.from(store.requests.values()).filter((item) => {
    if (!user) return true;
    if (role === "patient") return item.patient.toLowerCase() === user;
    if (role === "requester") return item.requester.toLowerCase() === user;
    return item.patient.toLowerCase() === user || item.requester.toLowerCase() === user;
  });
  res.json(items);
});

app.post("/api/requests", (req, res, next) => {
  try {
    const payload = parseBody(requestSchema, req.body);
    const request = store.addRequest({
      ...payload,
      requester: payload.requester.toLowerCase(),
      patient: payload.patient.toLowerCase()
    });
    res.status(201).json(request);
  } catch (error) {
    next(error);
  }
});

app.post("/api/requests/:requestId/approve", (req, res, next) => {
  try {
    const payload = parseBody(approveSchema, req.body);
    const grant = store.approveRequest(req.params.requestId, payload.encryptedKeyRef, payload.expiresAt);
    if (!grant) {
      res.status(404).json({ error: "REQUEST_NOT_FOUND" });
      return;
    }
    res.json(grant);
  } catch (error) {
    next(error);
  }
});

app.post("/api/requests/:requestId/reject", (req, res, next) => {
  try {
    const payload = parseBody(actorSchema, req.body);
    const request = store.rejectRequest(req.params.requestId, payload.actor.toLowerCase());
    if (!request) {
      res.status(404).json({ error: "REQUEST_NOT_FOUND" });
      return;
    }
    res.json(request);
  } catch (error) {
    next(error);
  }
});

app.get("/api/grants", (req, res) => {
  const user = String(req.query.user ?? "").toLowerCase();
  const items = Array.from(store.grants.values()).filter((grant) => {
    if (!user) return true;
    return grant.patient.toLowerCase() === user || grant.grantee.toLowerCase() === user;
  });
  res.json(items);
});

app.post("/api/grants/:grantId/revoke", (req, res, next) => {
  try {
    const payload = parseBody(actorSchema, req.body);
    const grant = store.revokeGrant(req.params.grantId, payload.actor.toLowerCase());
    if (!grant) {
      res.status(404).json({ error: "GRANT_NOT_FOUND" });
      return;
    }
    res.json(grant);
  } catch (error) {
    next(error);
  }
});

app.post("/api/grants/:grantId/access/:assetId", (req, res, next) => {
  try {
    const payload = parseBody(actorSchema, req.body);
    store.recordAccess(req.params.grantId, req.params.assetId, payload.actor.toLowerCase());
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/audit", (req, res) => {
  const address = String(req.query.address ?? "").toLowerCase();
  const items = store.audits.filter((event) => {
    if (!address) return true;
    return event.actor.toLowerCase() === address || event.target?.toLowerCase() === address;
  });
  res.json(items);
});

app.get("/api/notifications", (req, res) => {
  const user = String(req.query.user ?? "").toLowerCase();
  res.json(store.notifications.filter((item) => !user || item.user === user));
});

app.post("/api/notifications/:id/read", (req, res) => {
  const item = store.notifications.find((notification) => notification.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: "NOTIFICATION_NOT_FOUND" });
    return;
  }
  item.read = true;
  res.json(item);
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: "VALIDATION_ERROR", details: error.flatten() });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "INTERNAL_ERROR" });
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
