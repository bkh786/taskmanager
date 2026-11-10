import "server-only";
import dns from "node:dns/promises";
import net from "node:net";
import nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getEventDef,
  parseEmailList,
  renderBodyHtml,
  renderBodyText,
  renderSubject,
  isValidEmail,
  type EmailEventId,
  type Vars,
} from "@/lib/email-events";

/** Everything needed to connect and compose; loaded with the service role (credentials are not readable via the API). */
export type OrgEmailConfig = {
  id: string;
  name: string;
  slug: string;
  custom_login_domain: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password: string | null;
  smtp_from_email: string | null;
  smtp_secure: string;
  smtp_from_name: string | null;
  smtp_cc_enabled: boolean;
  smtp_cc: string | null;
  smtp_bcc_enabled: boolean;
  smtp_bcc: string | null;
  email_signature: string | null;
};

const CONFIG_COLUMNS =
  "id, name, slug, custom_login_domain, smtp_host, smtp_port, smtp_username, smtp_password, smtp_from_email, smtp_secure, smtp_from_name, smtp_cc_enabled, smtp_cc, smtp_bcc_enabled, smtp_bcc, email_signature";

export async function loadOrgEmailConfig(orgId: string): Promise<OrgEmailConfig | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select(CONFIG_COLUMNS)
    .eq("id", orgId)
    .maybeSingle();
  return (data as OrgEmailConfig | null) ?? null;
}

export function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

// ---------------------------------------------------------------- SMTP safety

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  const inRange = (base: string, bits: number) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (n & mask) >>> 0 === (ipv4ToInt(base) & mask) >>> 0;
  };
  return (
    inRange("0.0.0.0", 8) ||
    inRange("10.0.0.0", 8) ||
    inRange("100.64.0.0", 10) ||
    inRange("127.0.0.0", 8) ||
    inRange("169.254.0.0", 16) ||
    inRange("172.16.0.0", 12) ||
    inRange("192.0.0.0", 24) ||
    inRange("192.168.0.0", 16) ||
    inRange("198.18.0.0", 15) ||
    inRange("224.0.0.0", 3)
  );
}

function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIPv4(mapped[1]);
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb")
    );
  }
  return true;
}

/**
 * Resolve the SMTP host once, refuse internal/private targets (an org admin
 * must not be able to point the server at localhost or the cloud metadata
 * address), and return the address to connect to -- connecting to the vetted
 * IP rather than re-resolving avoids DNS-rebinding tricks.
 */
export async function resolveSmtpHost(host: string): Promise<{ address: string; family: number }> {
  const clean = host.trim().toLowerCase();
  if (!clean || clean === "localhost" || clean.endsWith(".local") || clean.endsWith(".internal")) {
    throw new Error("That SMTP host is not allowed.");
  }
  if (net.isIP(clean)) {
    if (isPrivateAddress(clean)) throw new Error("SMTP hosts on private or internal addresses are not allowed.");
    return { address: clean, family: net.isIPv6(clean) ? 6 : 4 };
  }
  let addrs: { address: string; family: number }[];
  try {
    addrs = await dns.lookup(clean, { all: true });
  } catch {
    throw new Error(`Could not find the SMTP host "${host}". Check the spelling.`);
  }
  if (addrs.length === 0) throw new Error(`Could not find the SMTP host "${host}".`);
  if (addrs.some((a) => isPrivateAddress(a.address))) {
    throw new Error("That SMTP host resolves to a private or internal address, which is not allowed.");
  }
  return addrs.find((a) => a.family === 4) ?? addrs[0];
}

type SmtpConnection = Pick<
  OrgEmailConfig,
  "smtp_host" | "smtp_port" | "smtp_username" | "smtp_password" | "smtp_secure"
>;

async function buildTransport(cfg: SmtpConnection) {
  const host = cfg.smtp_host!;
  const port = cfg.smtp_port ?? 587;
  const mode = cfg.smtp_secure;
  const target = await resolveSmtpHost(host);

  return nodemailer.createTransport({
    host: target.address,
    port,
    secure: mode === "ssl" || (mode === "auto" && port === 465),
    requireTLS: mode === "starttls",
    ignoreTLS: mode === "none",
    // Connect to the vetted IP but validate the certificate against the real hostname.
    tls: net.isIP(host) ? undefined : { servername: host },
    auth: cfg.smtp_username ? { user: cfg.smtp_username, pass: cfg.smtp_password ?? "" } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

function fromHeader(cfg: Pick<OrgEmailConfig, "smtp_from_email" | "smtp_from_name">) {
  return cfg.smtp_from_name
    ? { name: cfg.smtp_from_name.replace(/[\r\n"<>]/g, " ").trim(), address: cfg.smtp_from_email! }
    : cfg.smtp_from_email!;
}

export function isSmtpConfigured(cfg: OrgEmailConfig | null): boolean {
  return !!cfg && !!cfg.smtp_host && !!cfg.smtp_port && !!cfg.smtp_from_email;
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "unknown error";
  return msg.replace(/\s+/g, " ").slice(0, 220);
}

// ---------------------------------------------------------------- logging

async function logNotification(entry: {
  orgId: string;
  notifType: string;
  to: string;
  status: string;
  taskInstanceId?: string | null;
}) {
  const admin = createAdminClient();
  await admin.from("notification_log").insert({
    org_id: entry.orgId,
    task_instance_id: entry.taskInstanceId ?? null,
    notif_type: entry.notifType,
    recipient_email: entry.to,
    status: entry.status.slice(0, 250),
  });
}

// ---------------------------------------------------------------- sending

export type SendResult = { ok: boolean; skipped?: "disabled" | "no_smtp"; error?: string };

/**
 * Low-level send through the org's SMTP, with CC/BCC, and an outcome row in
 * notification_log. Never throws -- email is a side effect of other actions.
 */
export async function sendOrgEmail(
  cfg: OrgEmailConfig,
  opts: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    cc?: string[];
    bcc?: string[];
    notifType: string;
    taskInstanceId?: string | null;
  }
): Promise<SendResult> {
  if (!isSmtpConfigured(cfg)) {
    await logNotification({
      orgId: cfg.id,
      notifType: opts.notifType,
      to: opts.to,
      taskInstanceId: opts.taskInstanceId,
      status: "skipped_no_smtp_config",
    });
    return { ok: false, skipped: "no_smtp" };
  }

  try {
    const transport = await buildTransport(cfg);
    await transport.sendMail({
      from: fromHeader(cfg),
      to: opts.to,
      cc: opts.cc?.length ? opts.cc : undefined,
      bcc: opts.bcc?.length ? opts.bcc : undefined,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    await logNotification({
      orgId: cfg.id,
      notifType: opts.notifType,
      to: opts.to,
      taskInstanceId: opts.taskInstanceId,
      status: "sent",
    });
    return { ok: true };
  } catch (err) {
    const error = friendlyError(err);
    await logNotification({
      orgId: cfg.id,
      notifType: opts.notifType,
      to: opts.to,
      taskInstanceId: opts.taskInstanceId,
      status: `failed: ${error}`,
    });
    return { ok: false, error };
  }
}

/**
 * One-time link that lets a user choose a new password (welcome + reset
 * emails). It points at this app's own /auth/confirm page, which exchanges the
 * token in the browser -- so it works whatever redirect URLs the Supabase
 * project allows, and email link-scanners can't consume it by prefetching.
 */
export async function createPasswordLink(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  const hash = data?.properties?.hashed_token;
  if (error || !hash) return null;
  return `${appBaseUrl()}/auth/confirm?token_hash=${encodeURIComponent(hash)}&type=recovery`;
}

/** The recipient's reporting managers' emails: L1 (direct) and L2 (their manager's manager). */
async function managerEmails(orgId: string, toEmail: string): Promise<{ l1?: string; l2?: string }> {
  const admin = createAdminClient();
  const { data: person } = await admin
    .from("app_users")
    .select("reports_to")
    .eq("org_id", orgId)
    .eq("email", toEmail)
    .maybeSingle();
  if (!person?.reports_to) return {};
  const { data: l1 } = await admin
    .from("app_users")
    .select("email, reports_to, is_active")
    .eq("id", person.reports_to)
    .maybeSingle();
  if (!l1) return {};
  const out: { l1?: string; l2?: string } = l1.is_active === false ? {} : { l1: l1.email.toLowerCase() };
  if (l1.reports_to) {
    const { data: l2 } = await admin
      .from("app_users")
      .select("email, is_active")
      .eq("id", l1.reports_to)
      .maybeSingle();
    if (l2 && l2.is_active !== false) out.l2 = l2.email.toLowerCase();
  }
  return out;
}

/**
 * Sends one of the app's emails using the org's template (or the built-in
 * default) and SMTP. Respects the per-event on/off switch, adds the org-wide
 * CC/BCC and signature, plus any task-level CC. Never throws.
 */
export async function sendOrgEvent(opts: {
  orgId: string;
  event: EmailEventId;
  to: string;
  vars?: Vars;
  taskInstanceId?: string | null;
  /** Extra CC addresses for this message (e.g. a task creator's own list). */
  extraCc?: string[];
  /**
   * Whose reporting managers the L1/L2 Cc/Bcc ticks refer to: the person the
   * email is ABOUT. Defaults to the recipient (right for account and reminder
   * emails); task-completed and date-change emails pass the assignee.
   */
  subjectEmail?: string;
}): Promise<SendResult> {
  try {
    const def = getEventDef(opts.event);
    const cfg = await loadOrgEmailConfig(opts.orgId);
    if (!def || !cfg) return { ok: false, error: "unknown event or organization" };
    if (!isValidEmail(opts.to)) return { ok: false, error: "invalid recipient" };

    const admin = createAdminClient();
    const { data: tpl } = await admin
      .from("org_email_templates")
      .select("*")
      .eq("org_id", cfg.id)
      .eq("event", opts.event)
      .maybeSingle();

    if (tpl && tpl.enabled === false) {
      await logNotification({
        orgId: cfg.id,
        notifType: opts.event,
        to: opts.to,
        taskInstanceId: opts.taskInstanceId,
        status: "skipped_disabled",
      });
      return { ok: false, skipped: "disabled" };
    }

    const subjectTpl = tpl?.subject?.trim() || def.defaultSubject;
    const bodyTpl = tpl?.body?.trim() || def.defaultBody;

    const vars: Vars = {
      org_name: cfg.name,
      login_url: cfg.custom_login_domain
        ? `${cfg.custom_login_domain.replace(/\/+$/, "")}/login`
        : `${appBaseUrl()}/login?org=${cfg.slug}`,
      ...opts.vars,
    };

    // Only mint a password link when the template actually uses one.
    if (!vars.set_password_link && /\{\{\s*set_password_link\s*\}\}/i.test(subjectTpl + bodyTpl)) {
      vars.set_password_link =
        (await createPasswordLink(opts.to)) ?? `${vars.login_url} (use "Forgot password?")`;
    }

    const cc = new Set<string>();
    if (cfg.smtp_cc_enabled) parseEmailList(cfg.smtp_cc).forEach((e) => cc.add(e));
    (opts.extraCc ?? []).forEach((e) => isValidEmail(e) && cc.add(e.toLowerCase()));
    cc.delete(opts.to.toLowerCase());
    const bcc = new Set<string>(cfg.smtp_bcc_enabled ? parseEmailList(cfg.smtp_bcc) : []);

    // Per-notification copies to the recipient's reporting managers (L1 = who
    // they report to, L2 = that person's manager).
    const t = tpl as { cc_l1?: boolean; cc_l2?: boolean; bcc_l1?: boolean; bcc_l2?: boolean } | null;
    if (t && (t.cc_l1 || t.cc_l2 || t.bcc_l1 || t.bcc_l2)) {
      const mgr = await managerEmails(cfg.id, opts.subjectEmail ?? opts.to);
      if (t.cc_l1 && mgr.l1) cc.add(mgr.l1);
      if (t.cc_l2 && mgr.l2) cc.add(mgr.l2);
      if (t.bcc_l1 && mgr.l1) bcc.add(mgr.l1);
      if (t.bcc_l2 && mgr.l2) bcc.add(mgr.l2);
      cc.delete(opts.to.toLowerCase());
    }
    for (const c of cc) bcc.delete(c);
    bcc.delete(opts.to.toLowerCase());

    return await sendOrgEmail(cfg, {
      to: opts.to,
      cc: [...cc],
      bcc: [...bcc],
      subject: renderSubject(subjectTpl, vars),
      html: renderBodyHtml(bodyTpl, vars, cfg.email_signature),
      text: renderBodyText(bodyTpl, vars, cfg.email_signature),
      notifType: opts.event,
      taskInstanceId: opts.taskInstanceId,
    });
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  }
}

/**
 * Settings-page "Send test email": verifies the connection and login first so
 * the admin gets a precise error, then sends a short message. Uses the values
 * as typed (not yet saved). Not logged to notification_log.
 */
export async function sendTestEmail(
  cfg: SmtpConnection &
    Pick<OrgEmailConfig, "smtp_from_email" | "smtp_from_name" | "email_signature" | "name">,
  to: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!cfg.smtp_host || !cfg.smtp_from_email) {
    return { ok: false, error: "Enter an SMTP host and a From email first." };
  }
  if (!isValidEmail(to)) return { ok: false, error: "Your account has no valid email address." };
  try {
    const transport = await buildTransport(cfg);
    await transport.verify();
    const vars = { org_name: cfg.name };
    const body = "This is a test email from your Task Manager.\n\nIf you can read this, your SMTP settings work.";
    await transport.sendMail({
      from: fromHeader(cfg),
      to,
      subject: renderSubject("Test email from {{org_name}} Task Manager", vars),
      html: renderBodyHtml(body, vars, cfg.email_signature),
      text: renderBodyText(body, vars, cfg.email_signature),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  }
}
