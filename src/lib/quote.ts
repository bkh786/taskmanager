import "server-only";

export type Quote = { text: string; author: string };

// Used when the quote service can't be reached.
const FALLBACK: Quote[] = [
  { text: "Quality means doing it right when no one is looking.", author: "Henry Ford" },
  { text: "Alone we can do so little; together we can do so much.", author: "Helen Keller" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Well done is better than well said.", author: "Benjamin Franklin" },
  { text: "Coming together is a beginning; keeping together is progress; working together is success.", author: "Henry Ford" },
  { text: "Small deeds done are better than great deeds planned.", author: "Peter Marshall" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Talent wins games, but teamwork and intelligence win championships.", author: "Michael Jordan" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
];

const WORKPLACE = /\b(work|team|success|goal|effort|persever|progress|discipline|action|focus|courage|improv|achiev|dedicat|commit|excellen|lead|together|hard)/i;

function istDayNumber(): number {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  return Math.floor(ist.getTime() / 86_400_000);
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    // One request a day is plenty; the same quote is shown to everyone all day.
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

type ZenItem = { q?: string; a?: string };

function clean(items: unknown): Quote[] {
  if (!Array.isArray(items)) return [];
  return (items as ZenItem[])
    .filter((i) => i.q && i.a && i.q.length <= 150 && i.a !== "zenquotes.io")
    .map((i) => ({ text: i.q!.trim(), author: i.a!.trim() }));
}

/**
 * One motivational line for the day, pulled from ZenQuotes and narrowed to
 * work/teamwork/effort themes; a curated list steps in if the service is down.
 */
export async function getThoughtOfTheDay(): Promise<Quote> {
  const day = istDayNumber();
  try {
    const all = clean(await fetchJson("https://zenquotes.io/api/quotes"));
    const themed = all.filter((q) => WORKPLACE.test(q.text));
    const pool = themed.length >= 3 ? themed : all;
    if (pool.length > 0) return pool[day % pool.length];
  } catch {
    // fall through
  }
  try {
    const today = clean(await fetchJson("https://zenquotes.io/api/today"));
    if (today.length > 0) return today[0];
  } catch {
    // fall through
  }
  return FALLBACK[day % FALLBACK.length];
}
