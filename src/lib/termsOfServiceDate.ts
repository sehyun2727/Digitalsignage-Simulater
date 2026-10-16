/**
 * v2-P3 A7: ToS effective + revised dates live in ONE place.
 *
 * The ja/ko/en i18n keys `termsOfServiceEffectiveDate` and
 * `termsOfServiceRevisedDate` carry **templates** with `{date}` placeholders. The
 * modal reads the raw template, substitutes the constant below (or hides the row if
 * the constant is empty), so a legal-approved date is a single edit here instead of
 * three locale updates. Operations guide: `docs/v2/release-notes.md`.
 *
 * Format: ISO-ish `YYYY年M月D日` / `YYYY-MM-DD` / `YYYY년 M월 D일` substitution is
 * handled by the locale string's surrounding text. We keep ONE canonical string
 * value and feed it verbatim into each locale's template.
 *
 * When a date is empty (""), the row is hidden entirely (TermsOfServiceModal checks
 * both effective and revised; if a given string substitutes to empty, that <span>
 * is omitted). This avoids the "2026年月日" broken appearance the old locale had.
 */
export const TOS_EFFECTIVE_DATE = '2026/9/28' as const;
export const TOS_REVISED_DATE = '' as const;

/** Fill a `{date}` placeholder in a template; return `null` if the date is empty so
 *  callers can skip rendering the row. */
export function formatTosDate(template: string, date: string): string | null {
  if (!date) return null;
  return template.replace('{date}', date);
}
