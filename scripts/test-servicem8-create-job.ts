/**
 * Integration test: call createServiceM8Job with a signed mock payload.
 *
 * Usage:
 *   1. Copy .env.example to .env and set SNAPSHOT_SIGNING_SECRET (and optionally SERVICEM8_*).
 *   2. Run Netlify dev server: npx netlify dev
 *   3. In another terminal: npx ts-node scripts/test-servicem8-create-job.ts
 *      Or: node --loader ts-node/esm scripts/test-servicem8-create-job.ts
 *
 * Reads .env from project root. Calls POST /.netlify/functions/createServiceM8Job with
 * lead_id, timestamp, sig (HMAC over lead_id + timestamp).
 */

import { createHmac } from "crypto";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load .env from project root (simple parse, no external dep)
function loadEnv(): Record<string, string> {
  const root = resolve(__dirname, "..");
  const path = resolve(root, ".env");
  if (!existsSync(path)) {
    console.warn("No .env found at", path);
    return {};
  }
  const out: Record<string, string> = {};
  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1).replace(/\\n/g, "\n");
      out[m[1]] = v;
    }
  }
  return out;
}

const env = loadEnv();
const SECRET = env.SNAPSHOT_SIGNING_SECRET;
const BASE = env.NETLIFY_DEV_URL || "http://localhost:8888";

function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf8").toString("base64url");
}

function sign(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

async function main(): Promise<void> {
  if (!SECRET) {
    console.error("Set SNAPSHOT_SIGNING_SECRET in .env");
    process.exit(1);
  }

  const payload = {
    name: "Test User",
    email: "test@example.com",
    phone: "0400000000",
    address: "123 Test St, Adelaide SA",
    summary: "Snapshot test summary",
    notes: "Integration test run",
    submitted_at: Date.now(),
  };

  const leadId = base64UrlEncode(JSON.stringify(payload));
  const timestamp = String(Date.now());
  const sig = sign(SECRET, leadId + timestamp);

  const url = `${BASE}/.netlify/functions/createServiceM8Job`;
  const body = JSON.stringify({ lead_id: leadId, timestamp, sig });

  console.log("POST", url);
  console.log("Payload (lead_id length):", leadId.length);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text.slice(0, 500) + (text.length > 500 ? "..." : ""));

  if (!res.ok) {
    process.exit(1);
  }

  try {
    const data = JSON.parse(text);
    if (data.ok) {
      console.log("OK — company_uuid:", data.company_uuid, "job_uuid:", data.job_uuid);
    } else {
      console.error("API returned ok:false", data.error);
      process.exit(1);
    }
  } catch {
    // HTML response is fine for browser
    if (text.includes("Job created successfully")) {
      console.log("OK — HTML success page returned");
    } else {
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
