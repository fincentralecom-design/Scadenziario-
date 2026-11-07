// Invio reale dei messaggi: Email (Resend o Brevo), SMS e WhatsApp (Twilio o Brevo).
// Nessun SDK: solo fetch verso le API REST, così le dipendenze restano minime.
import type { AlertMessage } from "./alerts";
import type { Settings } from "./types";

export type Channel = "email" | "whatsapp" | "sms";

export interface SendResult {
  channel: Channel;
  ok: boolean;
  skipped?: boolean;
  provider?: string;
  detail: string;
}

const env = (k: string) => process.env[k]?.trim() || "";

/** Normalizza un numero italiano in formato internazionale E.164 (+39...). */
export function normalizePhone(raw: string): string {
  let p = raw.replace(/[\s\-().]/g, "");
  if (!p) return "";
  if (p.startsWith("00")) p = `+${p.slice(2)}`;
  if (!p.startsWith("+")) p = `+39${p}`;
  return p;
}

export function providerStatus() {
  return {
    email: env("RESEND_API_KEY") ? "Resend" : env("BREVO_API_KEY") ? "Brevo" : null,
    sms: env("TWILIO_ACCOUNT_SID") && env("TWILIO_AUTH_TOKEN") && (env("TWILIO_SMS_FROM") || env("TWILIO_MESSAGING_SERVICE_SID"))
      ? "Twilio"
      : env("BREVO_API_KEY") && env("BREVO_SMS_SENDER")
        ? "Brevo"
        : null,
    whatsapp: env("TWILIO_ACCOUNT_SID") && env("TWILIO_AUTH_TOKEN") && env("TWILIO_WHATSAPP_FROM")
      ? "Twilio"
      : env("BREVO_API_KEY") && env("BREVO_WHATSAPP_SENDER")
        ? "Brevo"
        : null,
  };
}

async function readError(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  return `HTTP ${res.status} ${body.slice(0, 300)}`;
}

async function sendEmail(to: string, msg: AlertMessage): Promise<SendResult> {
  const from = env("EMAIL_FROM") || "Scadenziario Greco <onboarding@resend.dev>";
  if (env("RESEND_API_KEY")) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: msg.subject, html: msg.emailHtml, text: msg.emailText }),
    });
    return { channel: "email", provider: "Resend", ok: res.ok, detail: res.ok ? `Inviata a ${to}` : await readError(res) };
  }
  if (env("BREVO_API_KEY")) {
    const m = from.match(/^(.*)<(.+)>$/);
    const sender = m ? { name: m[1].trim(), email: m[2].trim() } : { email: from };
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": env("BREVO_API_KEY"), "Content-Type": "application/json" },
      body: JSON.stringify({ sender, to: [{ email: to }], subject: msg.subject, htmlContent: msg.emailHtml, textContent: msg.emailText }),
    });
    return { channel: "email", provider: "Brevo", ok: res.ok, detail: res.ok ? `Inviata a ${to}` : await readError(res) };
  }
  return { channel: "email", ok: false, skipped: true, detail: "Nessun provider email configurato (RESEND_API_KEY o BREVO_API_KEY)" };
}

async function twilio(params: Record<string, string>): Promise<Response> {
  const sid = env("TWILIO_ACCOUNT_SID");
  return fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${env("TWILIO_AUTH_TOKEN")}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
}

async function sendSms(to: string, msg: AlertMessage): Promise<SendResult> {
  const num = normalizePhone(to);
  const st = providerStatus().sms;
  if (st === "Twilio") {
    const params: Record<string, string> = { To: num, Body: msg.sms };
    if (env("TWILIO_MESSAGING_SERVICE_SID")) params.MessagingServiceSid = env("TWILIO_MESSAGING_SERVICE_SID");
    else params.From = env("TWILIO_SMS_FROM");
    const res = await twilio(params);
    return { channel: "sms", provider: "Twilio", ok: res.ok, detail: res.ok ? `Inviato a ${num}` : await readError(res) };
  }
  if (st === "Brevo") {
    const res = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
      method: "POST",
      headers: { "api-key": env("BREVO_API_KEY"), "Content-Type": "application/json" },
      body: JSON.stringify({ sender: env("BREVO_SMS_SENDER"), recipient: num.replace("+", ""), content: msg.sms, type: "transactional" }),
    });
    return { channel: "sms", provider: "Brevo", ok: res.ok, detail: res.ok ? `Inviato a ${num}` : await readError(res) };
  }
  return { channel: "sms", ok: false, skipped: true, detail: "Nessun provider SMS configurato (Twilio o Brevo)" };
}

async function sendWhatsapp(to: string, msg: AlertMessage): Promise<SendResult> {
  const num = normalizePhone(to);
  const st = providerStatus().whatsapp;
  if (st === "Twilio") {
    const params: Record<string, string> = { To: `whatsapp:${num}`, From: `whatsapp:${normalizePhone(env("TWILIO_WHATSAPP_FROM").replace("whatsapp:", ""))}` };
    // Fuori dalla finestra di 24 ore WhatsApp richiede un template approvato (Content SID).
    if (env("TWILIO_WHATSAPP_CONTENT_SID")) {
      params.ContentSid = env("TWILIO_WHATSAPP_CONTENT_SID");
      params.ContentVariables = JSON.stringify({ "1": msg.subject, "2": msg.dueDate, "3": msg.link });
    } else {
      params.Body = msg.whatsapp;
    }
    const res = await twilio(params);
    return { channel: "whatsapp", provider: "Twilio", ok: res.ok, detail: res.ok ? `Inviato a ${num}` : await readError(res) };
  }
  if (st === "Brevo") {
    const res = await fetch("https://api.brevo.com/v3/whatsapp/sendMessage", {
      method: "POST",
      headers: { "api-key": env("BREVO_API_KEY"), "Content-Type": "application/json" },
      body: JSON.stringify({
        senderNumber: env("BREVO_WHATSAPP_SENDER"),
        contactNumbers: [num.replace("+", "")],
        ...(env("BREVO_WHATSAPP_TEMPLATE_ID") ? { templateId: Number(env("BREVO_WHATSAPP_TEMPLATE_ID")) } : { text: msg.whatsapp }),
      }),
    });
    return { channel: "whatsapp", provider: "Brevo", ok: res.ok, detail: res.ok ? `Inviato a ${num}` : await readError(res) };
  }
  return { channel: "whatsapp", ok: false, skipped: true, detail: "Nessun provider WhatsApp configurato (Twilio o Brevo)" };
}

/** Invia un avviso su tutti i canali attivi nelle impostazioni. */
export async function sendAlert(msg: AlertMessage, s: Settings): Promise<SendResult[]> {
  const jobs: Promise<SendResult>[] = [];
  const guard = (ch: Channel, p: () => Promise<SendResult>) =>
    p().catch((e: unknown) => ({ channel: ch, ok: false, detail: `Errore: ${e instanceof Error ? e.message : String(e)}` }));

  if (s.channels.email) {
    jobs.push(s.email ? guard("email", () => sendEmail(s.email, msg)) : Promise.resolve({ channel: "email", ok: false, skipped: true, detail: "Email destinatario non impostata" }));
  }
  if (s.channels.whatsapp) {
    jobs.push(s.whatsapp ? guard("whatsapp", () => sendWhatsapp(s.whatsapp, msg)) : Promise.resolve({ channel: "whatsapp", ok: false, skipped: true, detail: "Numero WhatsApp non impostato" }));
  }
  if (s.channels.sms) {
    jobs.push(s.sms ? guard("sms", () => sendSms(s.sms, msg)) : Promise.resolve({ channel: "sms", ok: false, skipped: true, detail: "Numero SMS non impostato" }));
  }
  return Promise.all(jobs);
}
