import { useId, useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { isNameInput, NAME_ERROR, NAME_PATTERN } from "@/lib/name-validation";

export function NameInput({ onChange, ...props }: ComponentProps<typeof Input>) {
  const [rejected, setRejected] = useState(false);
  const errorId = useId();
  return <div className="min-w-0">
    <Input {...props} maxLength={props.maxLength ?? 100} pattern={NAME_PATTERN} title={NAME_ERROR}
      aria-invalid={rejected || props["aria-invalid"]}
      aria-describedby={[props["aria-describedby"], rejected ? errorId : undefined].filter(Boolean).join(" ") || undefined}
      onChange={(event) => {
        if (!isNameInput(event.target.value)) {
          event.currentTarget.value = String(props.value ?? "");
          setRejected(true);
          return;
        }
        setRejected(false);
        onChange?.(event);
      }} />
    {rejected && <p id={errorId} role="alert" className="mt-1 text-sm text-destructive">{NAME_ERROR}</p>}
  </div>;
}