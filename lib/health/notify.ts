import { createTransport, type Transporter } from "nodemailer";

export type Channel = "whatsapp" | "email";
export type ChannelResult = {
  channel: Channel;
  sent: boolean;
  error?: string;
  to?: string;
};

type Recipient = { phone: string; apiKey: string };

function whatsappRecipients(): Recipient[] {
  const list = (process.env.CALLMEBOT_RECIPIENTS ?? "")
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.lastIndexOf(":");
      return i > 0
        ? { phone: pair.slice(0, i).trim(), apiKey: pair.slice(i + 1).trim() }
        : null;
    })
    .filter((r): r is Recipient => !!r && !!r.phone && !!r.apiKey);
  const single = process.env.CALLMEBOT_PHONE?.trim();
  const singleKey = process.env.CALLMEBOT_API_KEY?.trim();
  if (single && singleKey && !list.some((r) => sameNumber(r.phone, single)))
    list.push({ phone: single, apiKey: singleKey });
  return list;
}

const digits = (phone: string) => phone.replace(/\D/g, "").replace(/^00/, "");
const sameNumber = (a: string, b: string) => digits(a) === digits(b);
const masked = (phone: string) => {
  const d = digits(phone);
  return d.length > 6 ? `+${d.slice(0, 3)}…${d.slice(-3)}` : phone;
};
export type Alert = {
  title: string;
  lines: string[];
  path?: string;
  tone: "down" | "up" | "warning" | "info";
};

export function channelsConfigured(): Record<Channel, boolean> {
  return {
    whatsapp: whatsappRecipients().length > 0,
    email: !!(process.env.SMTP_HOST && alertEmails().length),
  };
}

const EMOJI: Record<Alert["tone"], string> = {
  down: "🔴",
  up: "🟢",
  warning: "🟠",
  info: "🔔",
};

const hqLink = (path?: string) => {
  const base = process.env.HQ_URL?.replace(/\/+$/, "");
  return base && path ? `${base}${path}` : "";
};

export async function sendAlert(alert: Alert): Promise<ChannelResult[]> {
  const configured = channelsConfigured();
  const jobs: Promise<ChannelResult>[] = [];
  if (configured.whatsapp)
    jobs.push(...whatsappRecipients().map((to) => sendWhatsApp(alert, to)));
  if (configured.email) jobs.push(sendEmail(alert));
  if (!jobs.length)
    console.warn(
      `[health] No alert channel is set up. Would have sent: ${alert.title}\n${alert.lines.join("\n")}`,
    );
  return Promise.all(jobs);
}

async function sendWhatsApp(
  alert: Alert,
  to: Recipient,
): Promise<ChannelResult> {
  const link = hqLink(alert.path);
  const text = [
    `${EMOJI[alert.tone]} *${alert.title}*`,
    ...alert.lines,
    ...(link ? [link] : []),
  ].join("\n");
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(
    to.phone,
  )}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(to.apiKey)}`;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.text();
    if (!response.ok || /apikey is invalid|invalid apikey/i.test(body))
      throw new Error(
        response.ok
          ? "CallMeBot refused it: check the phone number and API key"
          : `CallMeBot answered HTTP ${response.status}`,
      );
    return { channel: "whatsapp", sent: true, to: masked(to.phone) };
  } catch (error) {
    const message = (error as Error).message;
    console.error(
      `[health] WhatsApp alert to ${masked(to.phone)} failed: ${message}`,
    );
    return {
      channel: "whatsapp",
      sent: false,
      error: message,
      to: masked(to.phone),
    };
  }
}

const cache = globalThis as unknown as { __hqMail?: Transporter };

function transport(): Transporter {
  const port = Number(process.env.SMTP_PORT || 587);
  cache.__hqMail ??= createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return cache.__hqMail;
}

const alertEmails = () =>
  (process.env.ALERT_EMAIL ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const COLOR: Record<Alert["tone"], string> = {
  down: "#dc2626",
  up: "#16a34a",
  warning: "#d97706",
  info: "#6474e0",
};

async function sendEmail(alert: Alert): Promise<ChannelResult> {
  const link = hqLink(alert.path);
  const text = [
    alert.title,
    "",
    ...alert.lines,
    ...(link ? ["", link] : []),
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f6f3f0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f1a17">
<div style="max-width:520px;margin:24px auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #eadfd6">
<div style="height:4px;background:${COLOR[alert.tone]}"></div>
<div style="padding:24px 26px">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a7f77">MESA HQ · Health</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${escapeHtml(alert.title)}</h1>
${alert.lines.map((l) => `<p style="margin:0 0 8px;font-size:15px;line-height:1.5">${escapeHtml(l)}</p>`).join("")}
${link ? `<p style="margin:20px 0 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#6474e0;color:#fff;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:9px">Open in HQ</a></p>` : ""}
</div></div></body></html>`;
  try {
    await transport().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: alertEmails(),
      subject: `${EMOJI[alert.tone]} ${alert.title}`,
      text,
      html,
    });
    return { channel: "email", sent: true };
  } catch (error) {
    const message = (error as Error).message;
    console.error(`[health] Email alert failed: ${message}`);
    return { channel: "email", sent: false, error: message };
  }
}
