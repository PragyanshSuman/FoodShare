import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";

let transport: Transporter | null | undefined;

function getTransport() {
  if (transport === undefined) transport = env.smtpUrl ? nodemailer.createTransport(env.smtpUrl) : null;
  return transport;
}

export async function sendEmail(to: string, subject: string, html: string, text?: string) {
  const t = getTransport();
  if (!t) {
    console.info(`[email:dev] to=${to} subject="${subject}"\n${text ?? html.replace(/<[^>]+>/g, " ")}`);
    return;
  }
  await t.sendMail({ from: env.emailFrom, to, subject, html, text });
}

/** Minimal, inline-styled layout that renders in every mail client. */
export function emailLayout(title: string, bodyHtml: string, cta?: { label: string; url: string }) {
  const button = cta
    ? `<p style="margin:24px 0"><a href="${cta.url}" style="background:#15803d;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f6f7f6;font-family:Arial,sans-serif;color:#1c2b22">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <p style="font-weight:700;color:#15803d;font-size:18px;margin:0 0 16px">FoodShare</p>
    <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e3e8e4">
      <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>
      ${bodyHtml}${button}
    </div>
    <p style="font-size:12px;color:#6b7a70;margin-top:16px">You get this email because you have a FoodShare account.
    Manage notifications at <a href="${env.appUrl}/dashboard/settings" style="color:#15803d">${env.appUrl}/dashboard/settings</a>.</p>
  </div></body></html>`;
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
