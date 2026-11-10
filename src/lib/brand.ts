import "server-only";

const SITE = "https://www.digipresence.in";
// Looked up in this order on the master website; the first image found wins.
const CANDIDATES = ["/logo.svg", "/logo.png", "/assets/logo.svg", "/assets/logo.png", "/images/logo.svg", "/images/logo.png"];

/**
 * DigiPresence's logo image from the master website, if it publishes one
 * (checked hourly). The site currently shows its name as a text wordmark with
 * no image file, so this returns null and the app draws the matching wordmark;
 * the day a logo file appears at one of the paths above, it is used everywhere
 * automatically.
 */
export async function getDigiPresenceLogoUrl(): Promise<string | null> {
  for (const path of CANDIDATES) {
    try {
      const res = await fetch(SITE + path, {
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok && (res.headers.get("content-type") ?? "").startsWith("image/")) {
        return SITE + path;
      }
    } catch {
      // try the next one
    }
  }
  return null;
}
