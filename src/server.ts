import express from "express";
import cors from "cors";
import { config, isFirebaseConfigured } from "./config";
import { compare, type TBPayload } from "./compare";
import { writeLog, type LogEntry } from "./firebase";
import type { MonitorSnapshot } from "./compare";

function normalizeDeviceIdForLookup(deviceId: string): string[] {
  const parts = deviceId.split("/");
  const last = parts[parts.length - 1];
  return last && last !== deviceId ? [deviceId, last] : [deviceId];
}

function buildVercelAuthHeaders(): Record<string, string> {
  const { vercelAuthUser, vercelAuthPassword } = config;
  if (vercelAuthUser && vercelAuthPassword) {
    const token = Buffer.from(
      `${vercelAuthUser}:${vercelAuthPassword}`,
    ).toString("base64");
    return { Authorization: `Basic ${token}` };
  }
  return {};
}

async function fetchMonitorState(
  deviceId: string,
): Promise<MonitorSnapshot | null> {
  const url = `${config.vercelUrl.replace(/\/$/, "")}/devices/latest`;
  try {
    const res = await fetch(url, { headers: buildVercelAuthHeaders() });
    if (!res.ok) {
      const body = await res.text();
      console.warn(
        `Vercel /devices/latest failed: ${res.status} ${res.statusText}`,
        body.slice(0, 200),
      );
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    const idsToTry = normalizeDeviceIdForLookup(deviceId);
    const device = data.find((d: { deviceId: string }) =>
      idsToTry.some(
        (id) => d.deviceId === id || d.deviceId?.endsWith("/" + id),
      ),
    );
    return device ?? null;
  } catch (err) {
    console.error("Fetch monitor state failed:", err);
    return null;
  }
}

export function createServer(): express.Application {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", firebase: isFirebaseConfigured() });
  });

  app.post("/compare", async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const deviceId = typeof body.deviceId === "string" ? body.deviceId : null;
    if (!deviceId) {
      return res.status(400).json({ error: "deviceId required" });
    }

    const tbPayload: TBPayload = {
      deviceId,
      observationId: body.observationId != null ? String(body.observationId) : undefined,
      tbState: body.tbState != null ? String(body.tbState) : null,
      tbHr: body.tbHr != null ? parseFloat(String(body.tbHr)) : null,
      tbBr: body.tbBr != null ? parseFloat(String(body.tbBr)) : null,
      effectiveTsMs:
        body.effectiveTsMs != null ? Number(body.effectiveTsMs) : undefined,
      rawData: body.rawData,
      topic: typeof body.topic === "string" ? body.topic : undefined,
    };

    const monitor = await fetchMonitorState(deviceId);
    const result = compare(tbPayload, monitor);

    const shouldLog =
      config.logMode === "all" ||
      (config.logMode === "mismatch" && result.result !== "OK");

    if (shouldLog && isFirebaseConfigured()) {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        deviceId,
        observationId: tbPayload.observationId,
        tbState: result.tbState,
        monitorState: result.monitorState,
        tbHr: result.tbHr,
        monitorHr: result.monitorHr,
        tbBr: result.tbBr,
        monitorBr: result.monitorBr,
        result: result.result,
        effectiveTsMs: tbPayload.effectiveTsMs,
        payload: tbPayload.rawData,
        topic: tbPayload.topic,
      };
      await writeLog(entry);
    }

    return res.status(200).json({ ok: true, result: result.result });
  });

  return app;
}
