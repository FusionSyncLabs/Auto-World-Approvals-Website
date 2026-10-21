import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
  /** ISO value: yyyy-mm-dd (may be partial/empty) */
  value: string;
  onChange: (iso: string) => void;
  autoFocus?: boolean;
  onBlur?: () => void;
};

function parse(iso: string) {
  const m = /^(\d{0,4})-?(\d{0,2})-?(\d{0,2})$/.exec(iso ?? "");
  return { yyyy: m?.[1] ?? "", mm: m?.[2] ?? "", dd: m?.[3] ?? "" };
}

export function DobInput({ value, onChange, autoFocus, onBlur }: Props) {
  const init = parse(value);
  const [mm, setMm] = React.useState(init.mm);
  const [dd, setDd] = React.useState(init.dd);
  const [yyyy, setYyyy] = React.useState(init.yyyy);
  const [open, setOpen] = React.useState(false);

  const ddRef = React.useRef<HTMLInputElement>(null);
  const yyRef = React.useRef<HTMLInputElement>(null);
  const mmRef = React.useRef<HTMLInputElement>(null);

  // keep in sync if parent resets the value externally
  React.useEffect(() => {
    const p = parse(value);
    if (`${p.yyyy}${p.mm}${p.dd}` !== `${yyyy}${mm}${dd}`) {
      setMm(p.mm);
      setDd(p.dd);
      setYyyy(p.yyyy);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (m: string, d: string, y: string) => {
    if (m.length === 2 && d.length === 2 && y.length === 4) {
      onChange(`${y}-${m}-${d}`);
    } else {
      onChange("");
    }
  };

  const digits = (s: string, max: number) => s.replace(/\D/g, "").slice(0, max);

  const handleMonth = (raw: string) => {
    let v = digits(raw, 2);
    if (v.length === 1 && Number(v) > 1) v = `0${v}`;
    setMm(v);
    emit(v, dd, yyyy);
    if (v.length === 2) ddRef.current?.focus();
  };

  const handleDay = (raw: string) => {
    let v = digits(raw, 2);
    if (v.length === 1 && Number(v) > 3) v = `0${v}`;
    setDd(v);
    emit(mm, v, yyyy);
    if (v.length === 2) yyRef.current?.focus();
  };

  const handleYear = (raw: string) => {
    const v = digits(raw, 4);
    setYyyy(v);
    emit(mm, dd, v);
  };

  const backspaceTo = (
    e: React.KeyboardEvent<HTMLInputElement>,
    current: string,
    prev: React.RefObject<HTMLInputElement | null>,
  ) => {
    if (e.key === "Backspace" && current === "") {
      e.preventDefault();
      prev.current?.focus();
    }
  };

  const cellClass =
    "h-12 sm:h-14 rounded-xl border border-input bg-background text-center text-lg sm:text-xl font-semibold tabular-nums tracking-normal min-[380px]:tracking-wider sm:tracking-widest outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30";

  const onPaste = (e: React.ClipboardEvent) => {
    const raw = e.clipboardData.getData("text");
    const d = raw.replace(/\D/g, "");
    if (d.length >= 8) {
      e.preventDefault();
      // assume MMDDYYYY when pasted from the fields, else yyyymmdd
      let m: string, day: string, y: string;
      if (/^\d{4}/.test(raw) && raw.indexOf("-") === 4) {
        y = d.slice(0, 4); m = d.slice(4, 6); day = d.slice(6, 8);
      } else {
        m = d.slice(0, 2); day = d.slice(2, 4); y = d.slice(4, 8);
      }
      setMm(m); setDd(day); setYyyy(y);
      emit(m, day, y);
      yyRef.current?.focus();
    }
  };

  const selected =
    mm.length === 2 && dd.length === 2 && yyyy.length === 4
      ? new Date(Number(yyyy), Number(mm) - 1, Number(dd))
      : undefined;

  const today = new Date();
  const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  const minDate = new Date(today.getFullYear() - 100, 0, 1);

  const pick = (date?: Date) => {
    if (!date) return;
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const y = String(date.getFullYear());
    setMm(m); setDd(d); setYyyy(y);
    emit(m, d, y);
    setOpen(false);
  };

  return (
    <div className="grid grid-cols-[1fr_1fr_1.5fr_auto] gap-2 sm:gap-3" onPaste={onPaste}>
      <div>
        <input
          ref={mmRef}
          className={cn(cellClass, "w-full")}
          inputMode="numeric"
          autoComplete="bday-month"
          placeholder="MM"
          aria-label="Birth month"
          autoFocus={autoFocus}
          value={mm}
          onChange={(e) => handleMonth(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={onBlur}
        />
      </div>
      <div>
        <input
          ref={ddRef}
          className={cn(cellClass, "w-full")}
          inputMode="numeric"
          autoComplete="bday-day"
          placeholder="DD"
          aria-label="Birth day"
          value={dd}
          onChange={(e) => handleDay(e.target.value)}
          onKeyDown={(e) => backspaceTo(e, dd, mmRef)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={onBlur}
        />
      </div>
      <div>
        <input
          ref={yyRef}
          className={cn(cellClass, "w-full")}
          inputMode="numeric"
          autoComplete="bday-year"
          placeholder="YYYY"
          aria-label="Birth year"
          value={yyyy}
          onChange={(e) => handleYear(e.target.value)}
          onKeyDown={(e) => backspaceTo(e, yyyy, ddRef)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={onBlur}
        />
      </div>
      <div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              aria-label="Pick date of birth from calendar"
              className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl p-0"
            >
              <CalendarIcon className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 max-w-[calc(100vw-2rem)]" align="end">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={pick}
              defaultMonth={selected ?? maxDate}
              captionLayout="dropdown"
              startMonth={minDate}
              endMonth={maxDate}
              disabled={{ after: maxDate, before: minDate }}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
