import type { Enums } from "@/types/database.types";

const CODE: Record<Enums<"recurrence_kind">, string> = {
  one_time: "1",
  daily: "D",
  weekly: "W",
  monthly: "M",
};

const TITLE: Record<Enums<"recurrence_kind">, string> = {
  one_time: "One-time task",
  daily: "Repeats daily",
  weekly: "Repeats weekly",
  monthly: "Repeats monthly",
};

export function RecurrenceBadge({
  isRecurring,
  recurrenceKind,
}: {
  isRecurring: boolean;
  recurrenceKind: Enums<"recurrence_kind">;
}) {
  const kind = isRecurring ? recurrenceKind : "one_time";
  return (
    <span
      title={TITLE[kind]}
      className="inline-flex items-center justify-center w-[18px] h-[18px] rounded text-[10.5px] font-bold bg-chip-bg text-text-sub shrink-0"
    >
      {CODE[kind]}
    </span>
  );
}
