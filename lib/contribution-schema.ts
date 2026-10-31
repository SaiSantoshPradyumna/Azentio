import { z } from "zod";

// Section 9 validation, shared by the browser form and the server handler so both agree.

export const CONTRIBUTION_TYPES = [
  "market_observation",
  "emerging_trend",
  "product_gap",
  "operational_challenge",
  "successful_practice",
  "improvement_suggestion",
] as const;

export const EVIDENCE_TYPES = ["anecdotal", "internal_data", "survey", "regulatory"] as const;
export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export const SHARING_CHOICES = ["private", "organisation", "community"] as const;

export type ContributionType = (typeof CONTRIBUTION_TYPES)[number];
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];
export type SharingChoice = (typeof SHARING_CHOICES)[number];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

// industry and region are read from the tenant row and the offering list from the session's
// entitlements, so neither is ever accepted from the request.
const fields = {
  title: z
    .string()
    .trim()
    .min(5, "Give the observation a title of at least 5 characters.")
    .max(120, "Keep the title under 120 characters."),
  body: z
    .string()
    .trim()
    .min(20, "Describe the observation in at least 20 characters.")
    .max(2000, "Keep the body under 2000 characters."),
  type: z.enum(CONTRIBUTION_TYPES, { errorMap: () => ({ message: "Choose one of the observation types." }) }),
  topic: z
    .string()
    .trim()
    .max(60)
    .regex(SLUG, "Use a lowercase topic slug, for example sme-seasonality."),
  offering_slug: z.string().trim().max(60).regex(SLUG, "Choose an entitled offering."),
  period: z.string().regex(PERIOD, "Use the format YYYY-MM."),
  evidence_type: z.enum(EVIDENCE_TYPES, { errorMap: () => ({ message: "Choose an evidence type." }) }),
  confidence: z.enum(CONFIDENCE_LEVELS, { errorMap: () => ({ message: "Choose a confidence level." }) }),
};

export const contributionDraftSchema = z.object({
  ...fields,
  sharing_choice: z.enum(SHARING_CHOICES).default("private"),
  attribution_requested: z.boolean().default(false),
});

export const contributionEditSchema = z.object(fields);

export const contributionSubmitSchema = z.object({
  sharing_choice: z.enum(SHARING_CHOICES),
  attribution_requested: z.boolean().default(false),
});

// Moderation inputs (Section 10). The scanner hint and the state machine, not the caller's text,
// decide whether a publish is possible; these schemas only shape what the moderator supplies.

export const FLAG_RESOLUTIONS = ["redacted", "not_sensitive"] as const;
export type FlagResolutionChoice = (typeof FLAG_RESOLUTIONS)[number];

export const publishInputSchema = z.object({
  summary: z
    .string()
    .trim()
    .min(20, "Write a de-identified summary of at least 20 characters; the original text is never shared.")
    .max(600, "Keep the shared summary under 600 characters."),
  attribution_approved: z.boolean().default(false),
  attribution_text: z.string().trim().max(120).optional(),
  internal_note: z.string().trim().max(500).optional(),
});

export const decisionReasonSchema = z.object({
  reason: z.string().trim().min(5, "A reason is required and shown to the author.").max(500),
  internal_note: z.string().trim().max(500).optional(),
});

export const flagResolveSchema = z.object({
  resolution: z.enum(FLAG_RESOLUTIONS, { errorMap: () => ({ message: "Say whether you redacted it or reviewed it as not sensitive." }) }),
  reason: z.string().trim().min(5, "Record why this hint is closed.").max(500),
});

export const reportSchema = z.object({
  shared_view_id: z.string().trim().min(1, "Name the shared item you are reporting.").max(120),
  reason: z.string().trim().min(5, "Tell the moderator what is wrong with this shared item.").max(500),
});

/** The moderator's decision on an open report: put the copy back in the feed, or keep the item out. */
export const reportResolveSchema = z.object({
  decision: z.enum(["restore", "keep_out"], { errorMap: () => ({ message: "Choose restore or keep_out." }) }),
  note: z.string().trim().max(500).optional(),
});

export type PublishInputValues = z.infer<typeof publishInputSchema>;
export type DecisionReasonValues = z.infer<typeof decisionReasonSchema>;
export type FlagResolveValues = z.infer<typeof flagResolveSchema>;
export type ReportValues = z.infer<typeof reportSchema>;
export type ReportResolveValues = z.infer<typeof reportResolveSchema>;

export type ContributionDraftInput = z.infer<typeof contributionDraftSchema>;
export type ContributionEditInput = z.infer<typeof contributionEditSchema>;
export type ContributionSubmitInput = z.infer<typeof contributionSubmitSchema>;

export const TYPE_LABELS: Record<ContributionType, string> = {
  market_observation: "Market observation",
  emerging_trend: "Emerging trend",
  product_gap: "Product gap",
  operational_challenge: "Operational challenge",
  successful_practice: "Successful practice",
  improvement_suggestion: "Improvement suggestion",
};

export const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  anecdotal: "Anecdotal",
  internal_data: "Internal data",
  survey: "Survey",
  regulatory: "Regulatory",
};

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = { low: "Low", medium: "Medium", high: "High" };

/** Field errors as a plain object, so the form can render the same text the server produced. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
