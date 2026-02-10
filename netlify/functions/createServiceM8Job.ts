/**
 * Netlify Function: Create ServiceM8 Job from Snapshot submission.
 *
 * Input: GET ?lead_id=...&timestamp=...&sig=... or POST body with same, or signed payload in body.
 * Validates HMAC signature (SNAPSHOT_SIGNING_SECRET), loads submission data, finds/creates Company,
 * creates/upserts Company Contact, creates Job. Returns JSON + HTML.
 *
 * Env: SERVICEM8_API_KEY, SERVICEM8_BASE_URL (optional), SNAPSHOT_SIGNING_SECRET
 */

import { createHmac, randomUUID } from "crypto";

/** Netlify function event (query + body). */
interface NetlifyEvent {
  httpMethod?: string;
  queryStringParameters?: Record<string, string>;
  headers?: Record<string, string>;
  body?: string | null;
}

const SERVICEM8_API_KEY = process.env.SERVICEM8_API_KEY;
const SERVICEM8_BASE_URL = process.env.SERVICEM8_BASE_URL || "https://api.servicem8.com/api_1.0";
const SNAPSHOT_SIGNING_SECRET = process.env.SNAPSHOT_SIGNING_SECRET;
/** ServiceM8 创建工单时的必填状态，需与账号内 Job Status 一致 */
const JOB_STATUS = process.env.SERVICEM8_JOB_STATUS || "Quote";
/** Job 的简短描述，详细内容在 notes 里 */
const JOB_DESCRIPTION = process.env.SERVICEM8_JOB_DESCRIPTION || "Whole house electric health check";

/** Snapshot submission payload (encoded as lead_id or in body). */
interface SnapshotPayload {
  name: string;
  email: string;
  phone: string;
  address?: string;
  summary?: string;
  notes?: string;
  /** Optional: risk band / result summary for job description */
  risk_band?: string;
  /** Optional: top triggers or notes */
  triggers?: string;
  /** Optional: link back to review page */
  review_url?: string;
  /** Submission time (ISO string or number) */
  submitted_at?: string | number;
}

function getRequestId(): string {
  return randomUUID().slice(0, 8);
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf8").toString("base64url");
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}

function sign(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

function verifySignature(leadId: string, timestamp: string, sig: string): boolean {
  if (!SNAPSHOT_SIGNING_SECRET) return false;
  const expected = sign(SNAPSHOT_SIGNING_SECRET, leadId + timestamp);
  return sig === expected && expected.length > 0;
}

/** Parse lead_id (base64url JSON) or return null. */
function parseLeadId(leadId: string): SnapshotPayload | null {
  try {
    const raw = base64UrlDecode(leadId);
    const data = JSON.parse(raw) as SnapshotPayload;
    if (!data.email || !data.name) return null;
    return data;
  } catch {
    return null;
  }
}

/** Fetch with X-API-Key. Never log response bodies that might contain secrets. */
async function servicem8Fetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith("http") ? path : `${SERVICEM8_BASE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": SERVICEM8_API_KEY!,
    ...(options.headers as Record<string, string>),
  };
  return fetch(url, { ...options, headers });
}

/** Find company by email (or phone). Returns company uuid or null. */
async function findCompanyByEmailOrPhone(email: string, phone: string): Promise<string | null> {
  // ServiceM8 OData: $filter=field eq 'value'. Escape single quotes in value. Adjust field names if your API uses contact_email etc.
  try {
    const safeEmail = email.replace(/'/g, "''");
    const q = `?$filter=email eq '${safeEmail}'`;
    const res = await servicem8Fetch(`company.json${q}`);
    if (!res.ok) return null;
    const list = (await res.json()) as Array<{ uuid?: string }>;
    if (Array.isArray(list) && list.length > 0 && list[0].uuid) return list[0].uuid;
  } catch {
    // ignore
  }
  try {
    const safePhone = phone.replace(/'/g, "''");
    const q = `?$filter=phone eq '${safePhone}'`;
    const res = await servicem8Fetch(`company.json${q}`);
    if (!res.ok) return null;
    const list = (await res.json()) as Array<{ uuid?: string }>;
    if (Array.isArray(list) && list.length > 0 && list[0].uuid) return list[0].uuid;
  } catch {
    // ignore
  }
  return null;
}

/** Find company by name (ServiceM8 要求 Name 唯一，同名则复用). */
async function findCompanyByName(name: string): Promise<string | null> {
  if (!name || name.length > 250) return null;
  try {
    const safe = name.replace(/'/g, "''");
    const q = `?$filter=name eq '${safe}'`;
    const res = await servicem8Fetch(`company.json${q}`);
    if (!res.ok) return null;
    const list = (await res.json()) as Array<{ uuid?: string }>;
    if (Array.isArray(list) && list.length > 0 && list[0].uuid) return list[0].uuid;
  } catch {
    // ignore
  }
  return null;
}

/** Create a new company. Returns uuid. Throws on error. */
async function createCompany(payload: SnapshotPayload): Promise<string> {
  const body: Record<string, string> = {
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
  };
  if ((payload.address || "").trim()) body.address = (payload.address || "").trim();
  const res = await servicem8Fetch("company.json", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ServiceM8 create company failed: ${res.status} ${text}`);
  }
  const uuid = res.headers.get("x-record-uuid");
  if (uuid) return uuid;
  const data = (await res.json()) as { uuid?: string };
  if (data?.uuid) return data.uuid;
  throw new Error("ServiceM8 company creation did not return uuid");
}

/** Create or update company contact (primary contact for company). */
async function upsertCompanyContact(companyUuid: string, payload: SnapshotPayload): Promise<void> {
  // ServiceM8 may use jobcontact for job-level contact; company contact might be embedded.
  // If your API has a separate company_contact endpoint, call it here.
  // For now we ensure company has name/email/phone; no separate contact endpoint assumed.
  try {
    const res = await servicem8Fetch(`company/${companyUuid}.json`);
    if (!res.ok) return;
    const company = (await res.json()) as Record<string, unknown>;
    if (company.email === payload.email && company.phone === payload.phone) return;
    await servicem8Fetch(`company/${companyUuid}.json`, {
      method: "POST",
      body: JSON.stringify({
        uuid: companyUuid,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
      }),
    });
  } catch {
    // Non-fatal: job can still be created
  }
}

/** Create job: short job_description, long content in notes. */
async function createJob(companyUuid: string, payload: SnapshotPayload): Promise<string> {
  const submittedAt =
    payload.submitted_at != null
      ? typeof payload.submitted_at === "number"
        ? new Date(payload.submitted_at).toISOString()
        : String(payload.submitted_at)
      : new Date().toISOString();

  const noteParts: string[] = [
    "Source: Snapshot",
    `Submission: ${submittedAt}`,
    payload.risk_band ? `Risk/Result: ${payload.risk_band}` : "",
    payload.summary ? `Summary:\n${payload.summary}` : "",
    payload.triggers ? `Triggers/Notes: ${payload.triggers}` : "",
    payload.notes ? `Notes: ${payload.notes}` : "",
    payload.review_url ? `Review: ${payload.review_url}` : "",
  ].filter(Boolean);
  const jobNotes = noteParts.join("\n");
  const jobAddress = (payload.address || "").trim() || "Address not provided";

  const body: Record<string, string> = {
    company_uuid: companyUuid,
    job_address: jobAddress,
    job_description: JOB_DESCRIPTION,
    status: JOB_STATUS,
  };
  if (jobNotes) body.notes = jobNotes;

  const res = await servicem8Fetch("job.json", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ServiceM8 create job failed: ${res.status} ${text}`);
  }

  const uuid = res.headers.get("x-record-uuid");
  if (uuid) return uuid;
  const data = (await res.json()) as { uuid?: string };
  if (data?.uuid) return data.uuid;
  throw new Error("ServiceM8 job creation did not return uuid");
}

/** Create job contact (contact name, email, phone on the job). Non-fatal if API differs. */
async function createJobContact(jobUuid: string, payload: SnapshotPayload): Promise<void> {
  try {
    const body = {
      job_uuid: jobUuid,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
    };
    const res = await servicem8Fetch("jobcontact.json", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn("ServiceM8 create job contact failed (non-fatal):", res.status, text);
    }
  } catch (e) {
    console.warn("ServiceM8 create job contact error (non-fatal):", e);
  }
}

function htmlPage(title: string, body: string, isError: boolean): string {
  const status = isError ? "Error" : "Success";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>${escapeHtml(title)}</title></head>
<body>
  <h1>${escapeHtml(status)}</h1>
  ${body}
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const handler = async (event: NetlifyEvent): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  const requestId = getRequestId();
  const method = event.httpMethod || "GET";

  // Prefer JSON for programmatic calls, HTML for browser
  const accept = event.headers["accept"] || "";
  const wantsHtml = accept.includes("text/html");

  const log = (msg: string, extra?: Record<string, unknown>) => {
    console.log(JSON.stringify({ requestId, msg, ...extra }));
  };

  if (!SERVICEM8_API_KEY) {
    log("missing SERVICEM8_API_KEY");
    const body = JSON.stringify({ ok: false, error: "Service not configured" });
    return { statusCode: 503, headers: { "Content-Type": "application/json" }, body };
  }

  if (!SNAPSHOT_SIGNING_SECRET) {
    log("missing SNAPSHOT_SIGNING_SECRET");
    const body = JSON.stringify({ ok: false, error: "Service not configured" });
    return { statusCode: 503, headers: { "Content-Type": "application/json" }, body };
  }

  let leadId: string;
  let timestamp: string;
  let sig: string;

  if (method === "GET") {
    const params = event.queryStringParameters || {};
    leadId = params.lead_id || "";
    timestamp = params.timestamp || "";
    sig = params.sig || "";
  } else if (method === "POST") {
    try {
      const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body || {};
      leadId = body.lead_id || "";
      timestamp = body.timestamp || String(body.timestamp || "");
      sig = body.sig || "";
      if (!leadId && body.payload && body.sig) {
        const raw = typeof body.payload === "string" ? body.payload : JSON.stringify(body.payload);
        leadId = base64UrlEncode(raw);
        timestamp = body.timestamp || String(Date.now());
        sig = body.sig;
      }
    } catch {
      const body = JSON.stringify({ ok: false, error: "Invalid request body" });
      return { statusCode: 400, headers: { "Content-Type": "application/json" }, body };
    }
  } else {
    const body = JSON.stringify({ ok: false, error: "Method not allowed" });
    return { statusCode: 405, headers: { "Content-Type": "application/json" }, body };
  }

  if (!leadId || !timestamp || !sig) {
    log("missing lead_id, timestamp or sig");
    const body = JSON.stringify({ ok: false, error: "Missing lead_id, timestamp or sig" });
    return { statusCode: 400, headers: { "Content-Type": "application/json" }, body };
  }

  if (!verifySignature(leadId, timestamp, sig)) {
    log("invalid signature");
    const body = JSON.stringify({ ok: false, error: "Invalid signature" });
    return { statusCode: 403, headers: { "Content-Type": "application/json" }, body };
  }

  const payload = parseLeadId(leadId);
  if (!payload) {
    log("invalid lead_id payload");
    const body = JSON.stringify({ ok: false, error: "Invalid lead_id" });
    return { statusCode: 400, headers: { "Content-Type": "application/json" }, body };
  }

  log("processing", { lead_id: leadId.slice(0, 20) + "..." });

  let companyUuid: string;
  let jobUuid: string;
  let companyReused = false;

  try {
    let existing = await findCompanyByEmailOrPhone(payload.email, payload.phone);
    if (existing) {
      companyUuid = existing;
      companyReused = true;
      log("company reused (email/phone)", { company_uuid: companyUuid });
    } else {
      existing = await findCompanyByName(payload.name);
      if (existing) {
        companyUuid = existing;
        companyReused = true;
        log("company reused (name)", { company_uuid: companyUuid });
      } else {
        companyUuid = await createCompany(payload);
        log("company created", { company_uuid: companyUuid });
      }
    }

    await upsertCompanyContact(companyUuid, payload);

    jobUuid = await createJob(companyUuid, payload);
    log("job created", { job_uuid: jobUuid });

    await createJobContact(jobUuid, payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("error", { error: message });
    const body = JSON.stringify({ ok: false, error: message });
    if (wantsHtml) {
      const html = htmlPage(
        "Create ServiceM8 Job",
        `<p>Error: ${escapeHtml(message)}</p>`,
        true
      );
      return { statusCode: 502, headers: { "Content-Type": "text/html; charset=utf-8" }, body: html };
    }
    return { statusCode: 502, headers: { "Content-Type": "application/json" }, body };
  }

  const jsonBody = JSON.stringify({
    ok: true,
    company_uuid: companyUuid,
    job_uuid: jobUuid,
    company_reused: companyReused,
  });

  if (wantsHtml) {
    const html = htmlPage(
      "Create ServiceM8 Job",
      `
      <p>Job created successfully.</p>
      <ul>
        <li>Company: ${escapeHtml(companyUuid)} ${companyReused ? "(reused)" : "(new)"}</li>
        <li>Job: ${escapeHtml(jobUuid)}</li>
      </ul>
      <p><a href="${escapeHtml(SERVICEM8_BASE_URL.replace("/api_1.0", ""))}">Open ServiceM8</a></p>
      `,
      false
    );
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: html,
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: jsonBody,
  };
};
