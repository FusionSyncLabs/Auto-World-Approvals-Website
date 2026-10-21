import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Retired public event relay: a client-selected event is not a saved application.
// Keep the callable contract for stale clients but transmit nothing.
export const trackPixelEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ event_id: z.string().min(1).max(120), event_name: z.enum(["PageView", "Lead"]).optional() }).passthrough().parse(input))
  .handler(async () => ({ ok: false, reason: "dataset_eligibility_unverified" as const }));
