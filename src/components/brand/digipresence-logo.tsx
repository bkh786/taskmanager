/**
 * Digi Presence Solutions brand mark. Uses the logo image published on
 * www.digipresence.in when there is one; otherwise draws the same wordmark the
 * website uses (ink, gold and blue).
 */
export function DigiPresenceLogo({
  remoteLogoUrl = null,
  tone = "light",
  showTagline = true,
}: {
  remoteLogoUrl?: string | null;
  /** "light" = for white backgrounds, "dark" = for dark backgrounds. */
  tone?: "light" | "dark";
  showTagline?: boolean;
}) {
  if (remoteLogoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external brand asset, may be SVG
      <img src={remoteLogoUrl} alt="Digi Presence Solutions" className="h-11 w-auto max-w-[260px] object-contain" />
    );
  }
  const text = tone === "light" ? "#0b0b0c" : "#ffffff";
  return (
    <div className="flex items-center gap-3" aria-label="Digi Presence Solutions">
      <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden="true">
        <rect width="42" height="42" rx="11" fill="#050505" />
        <path d="M14 11v20h6.5a10 10 0 000-20z" fill="none" stroke="#D4AF37" strokeWidth="3.4" strokeLinejoin="round" />
        <circle cx="31" cy="31" r="3.2" fill="#0A84FF" />
      </svg>
      <div className="leading-tight">
        <div className="font-extrabold text-[17px] tracking-tight" style={{ color: text }}>
          Digi Presence Solutions
        </div>
        {showTagline ? (
          <div className="text-[9.5px] uppercase tracking-[0.2em] font-semibold" style={{ color: tone === "light" ? "#6b6b64" : "#A1A1A1" }}>
            Digital Transformation Partner
          </div>
        ) : null}
      </div>
    </div>
  );
}
