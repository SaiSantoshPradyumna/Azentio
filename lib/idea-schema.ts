import { z } from "zod";
import { IDEA_PRIORITIES, IDEA_STATUSES } from "./idea-lifecycle";

// Section 14 inputs, shaped with the same zod-on-both-sides rule as ./contribution-schema.ts. The
// status, the offering and the theme are checked against the database in lib/idea-writes.ts, because
// a slug that parses is not necessarily a row that exists.

export { fieldErrors } from "./contribution-schema";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const fields = {
  title: z
    .string()
    .trim()
    .min(5, "Give the idea a title of at least 5 characters.")
    .max(120, "Keep the idea title under 120 characters."),
  problem: z
    .string()
    .trim()
    .min(20, "Describe the problem in at least 20 characters.")
    .max(1500, "Keep the problem under 1500 characters."),
  outcome: z
    .string()
    .trim()
    .min(20, "Say what a good outcome looks like in at least 20 characters.")
    .max(1500, "Keep the outcome under 1500 characters."),
  owner_team: z
    .string()
    .trim()
    .min(3, "Name the owning team.")
    .max(120, "Keep the team name under 120 characters."),
  offering_slug: z.string().trim().max(60).regex(SLUG, "Choose one of the product slugs."),
  priority: z.enum(IDEA_PRIORITIES, { errorMap: () => ({ message: "Choose an internal priority." }) }),
  theme_id: z.string().trim().max(80).optional(),
};

export const ideaCreateSchema = z.object(fields);

/** Every field is optional on an edit, and the status is not one of them: it moves through ./idea-lifecycle. */
export const ideaEditSchema = z
  .object({
    title: fields.title.optional(),
    problem: fields.problem.optional(),
    outcome: fields.outcome.optional(),
    owner_team: fields.owner_team.optional(),
    priority: fields.priority.optional(),
    theme_id: z.string().trim().max(80).nullable().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, { message: "Nothing to change" });

export const ideaStatusSchema = z.object({
  status: z.enum(IDEA_STATUSES, { errorMap: () => ({ message: "Choose one of the idea statuses." }) }),
  reason: z.string().trim().min(5, "A reason is required and stays in the internal history.").max(500),
});

export const ideaEvidenceSchema = z.object({
  shared_view_id: z.string().trim().min(1, "Name the shared item to attach.").max(120),
});

export const ideaUpdateSchema = z.object({
  text: z
    .string()
    .trim()
    .min(20, "Write the client-facing update in at least 20 characters.")
    .max(600, "Keep the client-facing update under 600 characters."),
});

export const ideaUpdateApprovalSchema = z.object({
  update_id: z.string().trim().min(1, "Name the update you are approving.").max(80),
});

export type IdeaCreateInput = z.infer<typeof ideaCreateSchema>;
export type IdeaEditInput = z.infer<typeof ideaEditSchema>;
export type IdeaStatusInput = z.infer<typeof ideaStatusSchema>;
export type IdeaEvidenceInput = z.infer<typeof ideaEvidenceSchema>;
