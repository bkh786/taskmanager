export type SmtpSecure = "auto" | "starttls" | "ssl" | "none";

export type SmtpPreset = {
  id: string;
  label: string;
  host: string;
  port: number;
  secure: SmtpSecure;
  note: string;
};

export const SMTP_PRESETS: SmtpPreset[] = [
  {
    id: "google",
    label: "Google Workspace / Gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: "starttls",
    note: "Use your full address as the username and a Google App Password (not your normal password). Requires 2-step verification.",
  },
  {
    id: "m365",
    label: "Microsoft 365 / Office 365",
    host: "smtp.office365.com",
    port: 587,
    secure: "starttls",
    note: "Authenticated SMTP must be enabled for the mailbox in the Microsoft 365 admin center. Use the mailbox address and its password or app password.",
  },
  {
    id: "outlook",
    label: "Outlook.com / Live",
    host: "smtp-mail.outlook.com",
    port: 587,
    secure: "starttls",
    note: "Use your full Outlook address and an app password.",
  },
  {
    id: "zoho",
    label: "Zoho Mail",
    host: "smtp.zoho.com",
    port: 465,
    secure: "ssl",
    note: "Use smtp.zoho.in for Indian data-center accounts. Create an application-specific password in Zoho security settings.",
  },
  {
    id: "ses",
    label: "Amazon SES",
    host: "email-smtp.ap-south-1.amazonaws.com",
    port: 587,
    secure: "starttls",
    note: "Change the region in the host to match yours. Use the SMTP credentials created in the SES console (not your AWS keys). The From address must be a verified identity.",
  },
  {
    id: "sendgrid",
    label: "SendGrid",
    host: "smtp.sendgrid.net",
    port: 587,
    secure: "starttls",
    note: "The username is the word apikey; the password is your SendGrid API key.",
  },
  {
    id: "custom",
    label: "Custom SMTP Server",
    host: "",
    port: 587,
    secure: "auto",
    note: "Enter your own mail relay, Postfix, cPanel or on-premise Exchange details.",
  },
];

export const SECURE_OPTIONS: { value: SmtpSecure; label: string }[] = [
  { value: "auto", label: "Automatic (SSL on port 465, otherwise STARTTLS if offered)" },
  { value: "starttls", label: "STARTTLS (port 587 / 25), required" },
  { value: "ssl", label: "SSL / TLS (port 465)" },
  { value: "none", label: "None (unencrypted, not recommended)" },
];
