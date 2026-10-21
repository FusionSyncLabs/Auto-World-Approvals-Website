import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  /** Anything with a created_at timestamp. */
  leads: { created_at: string }[];
  /** Optional: fires with a YYYY-MM-DD key when a day is clicked. Clicking the same day again clears it (null). */
  onPickDay?: (day: string | null) => void;
  /** Externally controlled selected day (YYYY-MM-DD) so the parent can reflect its own filter state. */
  selectedDay?: string | null;
};

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function LeadsCalendar({ leads, onPickDay, selectedDay }: Props) {
  const todayKey = dayKey(new Date());
  const [viewMonth, setViewMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [internalDay, setInternalDay] = useState<string | null>(null);
  const activeDay = selectedDay !== undefined ? selectedDay : internalDay;

  const countsByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of leads) {
      const d = new Date(l.created_at);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKey(d);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [leads]);

  const [year, month] = viewMonth.split("-").map(Number) as [number, number];
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay(); // Sunday-first grid
  const monthLabel = firstOfMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const monthTotal = useMemo(() => {
    let n = 0;
    for (let d = 1; d <= daysInMonth; d++) n += countsByDay.get(dayKey(new Date(year, month - 1, d))) ?? 0;
    return n;
  }, [countsByDay, year, month, daysInMonth]);
  const maxCount = useMemo(() => Math.max(1, ...countsByDay.values()), [countsByDay]);

  const shift = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const pick = (k: string) => {
    const next = activeDay === k ? null : k;
    setInternalDay(next);
    onPickDay?.(next);
  };

  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{monthLabel}</p>
          <p className="text-xs text-muted-foreground">
            {monthTotal} lead{monthTotal === 1 ? "" : "s"} this month
            {activeDay ? ` · ${countsByDay.get(activeDay) ?? 0} on selected day` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => shift(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => {
            const n = new Date();
            setViewMonth(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`);
          }}>
            Today
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => shift(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="pb-1 text-[17px] font-bold uppercase tracking-wide text-muted-foreground">
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`b${i}`} />;
          const k = dayKey(new Date(year, month - 1, day));
          const count = countsByDay.get(k) ?? 0;
          const isToday = k === todayKey;
          const isActive = k === activeDay;
          const intensity = count / maxCount;
          return (
            <button
              key={k}
              type="button"
              onClick={() => pick(k)}
              title={`${day} ${monthLabel.split(" ")[0]} — ${count} lead${count === 1 ? "" : "s"}`}
              className={`relative flex h-9 flex-col items-center justify-center rounded-md text-xs font-semibold transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isToday
                    ? "border border-primary/50 text-foreground"
                    : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {day}
              {count > 0 && (
                <span
                  className={`mt-0.5 rounded-full px-1 text-[9px] font-black leading-3 ${
                    isActive ? "bg-primary-foreground/25 text-primary-foreground" : "bg-primary/15 text-primary"
                  }`}
                  style={!isActive ? { opacity: 0.6 + intensity * 0.4 } : undefined}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {activeDay && onPickDay && (
        <button
          type="button"
          onClick={() => { setInternalDay(null); onPickDay(null); }}
          className="mt-2 text-xs font-semibold text-primary hover:underline"
        >
          Clear day filter
        </button>
      )}
    </div>
  );
}
