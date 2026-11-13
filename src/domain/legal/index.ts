import { aiConsent, collectionConsent, overseasConsent } from "./consents";
import type { LegalDocId, LegalDocument, LegalLang } from "./legal";
import { privacyPolicy } from "./privacyPolicy";
import { termsOfService } from "./terms";

export * from "./legal";
export { accountDeletionPage, type AccountDeletionPage } from "./accountDeletion";

const BUILDERS: Record<LegalDocId, (lang: LegalLang) => LegalDocument> = {
  terms: termsOfService,
  privacy: privacyPolicy,
  collection: collectionConsent,
  overseas: overseasConsent,
  "ai-recommend": (lang) => aiConsent("recommend", lang),
  "ai-booking": (lang) => aiConsent("booking", lang),
  "ai-pouch": (lang) => aiConsent("pouch", lang),
};

export function legalDocument(id: LegalDocId, lang: LegalLang): LegalDocument {
  return BUILDERS[id](lang);
}

export const LEGAL_DOC_IDS = Object.keys(BUILDERS) as LegalDocId[];
