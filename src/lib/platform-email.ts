import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildTransport, fromHeader, friendlyError, type SmtpConnection } from "@/lib/email";
import {
  isValidEmail,
  parseEmailList,
  renderBodyHtml,
  renderBodyText,
  renderSubject,
  type Vars,
} from "@/lib/email-events";
import { getPlatformEventDef, type PlatformEventId } from "@/lib/platform-email-events";
import type { Tables } from "@/types/database.types";

export type PlatformEmailSettings = Tables<"platform_email_settings">;

export async function loadPlatformEmailSettings(): Promise<PlatformEmailSettings | null> {
  const { data } = await createAdminClient().from("platform_email_settings").select("*").eq("id", 1).maybeSingle();
  return data ?? null;
}

export function isPlatformSmtpConfigured(s: PlatformEmailSettings | null): s is PlatformEmailSettings {
  return !!s && !!s.smtp_host && !!s.smtp_port && !!s.smtp_from_email;
}

function connection(s: PlatformEmailSettings): SmtpConnection {
  return {
    smtp_host: s.smtp_host,
    smtp_port: s.smtp_port,
    smtp_username: s.smtp_username,
    smtp_password: s.smtp_password,
    smtp_secure: s.smtp_secure,
  };
}

export type PlatformSendResult = { ok: boolean; skipped?: "disabled" | "no_smtp"; error?: string };

/**
 * Sends one of the platform's billing / plan / offer emails through the
 * platform SMTP, using the saved template (or the built-in wording). Never throws.
 */
export async function sendPlatformEvent(opts: {
  event: PlatformEventId;
  to: string;
  cc?: string[];
  vars: Vars;
}): Promise<PlatformSendResult> {
  try {
    const def = getPlatformEventDef(opts.event);
    if (!def) return { ok: false, error: "unknown event" };
    if (!isValidEmail(opts.to)) return { ok: false, error: "invalid recipient" };

    const settings = await loadPlatformEmailSettings();
    if (!isPlatformSmtpConfigured(settings)) return { ok: false, skipped: "no_smtp" };

    const admin = createAdminClient();
    const { data: tpl } = await admin.from("platform_email_templates").select("*").eq("event", opts.event).maybeSingle();
    if (tpl && tpl.enabled === false) return { ok: false, skipped: "disabled" };

    const subjectTpl = tpl?.subject?.trim() || def.defaultSubject;
    const bodyTpl = tpl?.body?.trim() || def.defaultBody;

    const cc = new Set<string>(parseEmailList(settings.billing_cc));
    (opts.cc ?? []).forEach((e) => isValidEmail(e) && cc.add(e.toLowerCase()));
    cc.delete(opts.to.toLowerCase());

    const transport = await buildTransport(connection(settings));
    await transport.sendMail({
      from: fromHeader(settings),
      replyTo: settings.reply_to || undefined,
      to: opts.to,
      cc: cc.size ? [...cc] : undefined,
      subject: renderSubject(subjectTpl, opts.vars),
      html: renderBodyHtml(bodyTpl, opts.vars, settings.email_signature),
      text: renderBodyText(bodyTpl, opts.vars, settings.email_signature),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  }
}

/** "Send test email": verifies the connection first, using the values as typed. */
export async function sendPlatformTestEmail(
  cfg: SmtpConnection & Pick<PlatformEmailSettings, "smtp_from_email" | "smtp_from_name" | "email_signature">,
  to: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!cfg.smtp_host || !cfg.smtp_from_email) return { ok: false, error: "Enter an SMTP host and a From email first." };
  if (!isValidEmail(to)) return { ok: false, error: "Your account has no valid email address." };
  try {
    const transport = await buildTransport(cfg);
    await transport.verify();
    const body = "This is a test email from the Task Manager platform.\n\nIf you can read this, your platform SMTP settings work.";
    await transport.sendMail({
      from: fromHeader(cfg),
      to,
      subject: "Platform test email – Task Manager",
      html: renderBodyHtml(body, {}, cfg.email_signature),
      text: renderBodyText(body, {}, cfg.email_signature),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  }
}
