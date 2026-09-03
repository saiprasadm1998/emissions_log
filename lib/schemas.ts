// NFR-01: every input reaching the server validated against an explicit
// schema, with a consistent structured error response on rejection --
// not ad-hoc `if (!x)` checks scattered per-route.
import { z } from "zod";

export const createEventSchema = z.object({
  event_ref: z.string().min(1),
  source_code: z.string().min(1),
  start_datetime: z.string().datetime({ offset: true }),
  end_datetime: z.string().datetime({ offset: true }).nullable().optional(),
  reported_volume: z.number().nullable().optional(),
  volume_unit: z.enum(["Sm3", "kSm3"]).nullable().optional(),
  cause: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;

export const voidEventSchema = z.object({
  void_reason: z.string().min(1, "A reason is required to void an event"),
});

export const createSourceSchema = z.object({
  source_code: z.string().min(1),
  source_name: z.string().min(1),
  source_type: z.enum(["FLARE", "VENT"]),
  process_unit: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "DECOMMISSIONED"]),
});

// Consistent structured error shape (NFR-01) for any route's validation
// failure -- same format everywhere, not a different error shape per route.
export function validationErrorResponse(error: z.ZodError) {
  return Response.json(
    {
      error: "Validation failed",
      details: error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    },
    { status: 400 }
  );
}
