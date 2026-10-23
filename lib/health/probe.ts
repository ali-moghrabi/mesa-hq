import { connect } from "node:tls";

export const TIMEOUT_MS = 10_000;

export type ProbeResult = {
  ok: boolean;
  status: number;
  ms: number;
  error: string;
};

const USER_AGENT = "MESA-HQ-Health/1.0 (+uptime check)";

function describe(error: unknown): string {
  const e = error as {
    name?: string;
    message?: string;
    cause?: { code?: string };
  };
  if (e?.name === "TimeoutError" || e?.name === "AbortError")
    return `No answer within ${TIMEOUT_MS / 1000}s`;
  const code = e?.cause?.code ?? "";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN")
    return "Domain not found (DNS)";
  if (code === "ECONNREFUSED") return "Connection refused";
  if (code === "ECONNRESET") return "Connection dropped";
  if (code.startsWith("CERT_") || code.includes("SSL") || code.includes("TLS"))
    return "SSL certificate problem";
  return e?.message || "Request failed";
}

async function request(url: string, accept: string) {
  const started = performance.now();
  const response = await fetch(url, {
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "user-agent": USER_AGENT, accept },
  });
  return { response, ms: Math.round(performance.now() - started) };
}

export async function probeWebsite(url: string): Promise<ProbeResult> {
  const started = performance.now();
  try {
    const { response, ms } = await request(url, "text/html");
    await response.body?.cancel().catch(() => {});
    return {
      ok: response.ok,
      status: response.status,
      ms,
      error: response.ok ? "" : `Answered HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - started),
      error: describe(error),
    };
  }
}

export async function probeApi(apiUrl: string): Promise<ProbeResult> {
  const started = performance.now();
  try {
    const { response, ms } = await request(
      healthUrl(apiUrl),
      "application/json",
    );
    type Answer = { status?: string; db?: string };
    const body = (await response.json().catch(() => null)) as Answer | null;
    const ok = response.ok && body?.status === "ok";
    return {
      ok,
      status: response.status,
      ms,
      error: ok
        ? ""
        : body?.db === "down"
          ? "API is up, but its database isn't answering"
          : response.ok
            ? "Unexpected answer (is this a MESA API?)"
            : `Answered HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - started),
      error: describe(error),
    };
  }
}

export const healthUrl = (apiUrl: string) =>
  `${apiUrl.replace(/\/+$/, "").replace(/\/api(\/v\d+)?$/i, "")}/api/health`;

const day = (date: Date) => date.toISOString().slice(0, 10);

export function probeCertificate(
  host: string,
): Promise<{ expiresAt: string; error: string }> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: { expiresAt: string; error: string }) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };

    const socket = connect({
      host,
      port: 443,
      servername: host,
      rejectUnauthorized: false,
      timeout: TIMEOUT_MS,
    });
    socket.once("secureConnect", () => {
      const cert = socket.getPeerCertificate();
      const expires = cert?.valid_to ? new Date(cert.valid_to) : null;
      done({
        expiresAt:
          expires && !Number.isNaN(expires.getTime()) ? day(expires) : "",
        error: socket.authorized
          ? ""
          : `Certificate not trusted (${String(socket.authorizationError ?? "unknown")})`,
      });
    });
    socket.once("timeout", () =>
      done({ expiresAt: "", error: `No answer within ${TIMEOUT_MS / 1000}s` }),
    );
    socket.once("error", (error) =>
      done({
        expiresAt: "",
        error: describe({ cause: error, message: error.message }),
      }),
    );
  });
}

const HOSTED = [/\.vercel\.app$/i, /\.onrender\.com$/i, /^localhost$/i];

export function registrableDomain(host: string): string {
  const labels = host
    .toLowerCase()
    .replace(/^www\./, "")
    .split(".");
  if (labels.length < 2) return host;
  const [second, top] = labels.slice(-2);
  const nested =
    labels.length >= 3 &&
    top.length === 2 &&
    ["com", "net", "org", "edu", "gov", "co"].includes(second);
  return labels.slice(nested ? -3 : -2).join(".");
}

export async function probeDomain(
  host: string,
): Promise<{ expiresAt: string; error: string }> {
  if (HOSTED.some((re) => re.test(host))) return { expiresAt: "", error: "" };
  const domain = registrableDomain(host);
  try {
    const response = await fetch(`https://rdap.org/domain/${domain}`, {
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/rdap+json", "user-agent": USER_AGENT },
    });
    if (!response.ok)
      return {
        expiresAt: "",
        error:
          response.status === 404
            ? "The registry doesn't publish an expiry date"
            : `Lookup answered HTTP ${response.status}`,
      };
    const data = (await response.json()) as {
      events?: { eventAction?: string; eventDate?: string }[];
    };
    const event = data.events?.find((e) => e.eventAction === "expiration");
    const date = event?.eventDate ? new Date(event.eventDate) : null;
    return date && !Number.isNaN(date.getTime())
      ? { expiresAt: day(date), error: "" }
      : { expiresAt: "", error: "The registry doesn't publish an expiry date" };
  } catch (error) {
    return { expiresAt: "", error: describe(error) };
  }
}
