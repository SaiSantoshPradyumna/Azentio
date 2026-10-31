import type { SharingChoice } from "./contribution-schema";

// Plain-language copy and the consent purposes. This module holds no database code so that client
// components can render exactly the same words the server records.

export const CONSENT_PURPOSES = ["process", "publish", "attribute", "train"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const SHARING_LABELS: Record<SharingChoice, string> = {
  private: "Private to me",
  organisation: "My organisation",
  community: "Shared learning, after review",
};

export const SHARING_EXPLAIN: Record<SharingChoice, string> = {
  private:
    "Only you can open it. A moderator sees it once you submit it for review. It never reaches another organisation.",
  organisation:
    "Colleagues in your organisation who hold organisation access can open it. It never reaches another organisation.",
  community:
    "A moderator reviews and de-identifies it first. Only the approved summary, with region and period coarsened, reaches other organisations. Sharing is never automatic.",
};

export const CONSENT_USAGE: Record<ConsentPurpose, string> = {
  process: "Used to operate this demo portal.",
  publish: "May be published to the shared learning feed, but only after moderator review.",
  attribute: "Your name or organisation may be credited on the shared summary.",
  train: "No model training programme is enabled.",
};

export const NO_TRAINING_NOTE = "No model training programme is enabled. The train purpose is always refused.";

/**
 * Section 11 table, expressed once. The form preview and the server-side record keep the same
 * meaning because both call this function.
 */
export function consentMatrix(sharing: SharingChoice, attributionRequested: boolean): Record<ConsentPurpose, boolean> {
  if (sharing === "community") {
    return { process: true, publish: true, attribute: attributionRequested, train: false };
  }
  return { process: true, publish: false, attribute: false, train: false };
}
