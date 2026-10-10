/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

// Email template overrides are stored per email as JSON keyed by language
// ({"en":{"subject":"","body":""}}); blank parts use the built-in default.
// The editor works on full drafts (default merged with override) and saves
// only the parts that differ from the default.

export const EMAIL_TEMPLATE_KINDS = [
  'verification',
  'password_reset',
  'email_binding',
  'email_change',
  'security_notice',
] as const

export type EmailTemplateKind = (typeof EMAIL_TEMPLATE_KINDS)[number]

export type EmailTemplate = { subject: string; body: string }

/** Templates of one email, keyed by language. */
export type EmailTemplatesByLang = Record<string, EmailTemplate>

export type EmailTemplateDrafts = Record<string, EmailTemplatesByLang>

export const EMAIL_TEMPLATE_LABEL_KEYS: Record<EmailTemplateKind, string> = {
  verification: 'Sign-up verification',
  password_reset: 'Password reset',
  email_binding: 'Link email address',
  email_change: 'Confirm email change',
  security_notice: 'Security notification',
}

export function emailTemplateOptionKey(kind: EmailTemplateKind): string {
  return `email_template.${kind}`
}

export function parseEmailTemplateOverrides(raw: string): EmailTemplatesByLang {
  if (!raw.trim()) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    return parsed as EmailTemplatesByLang
  } catch {
    return {}
  }
}

/** Merge stored overrides over the defaults; blank override parts keep the default. */
export function buildEmailTemplateDraft(
  raw: string,
  defaults: EmailTemplatesByLang
): EmailTemplatesByLang {
  const overrides = parseEmailTemplateOverrides(raw)
  const draft: EmailTemplatesByLang = {}
  for (const [lang, fallback] of Object.entries(defaults)) {
    const override = overrides[lang]
    draft[lang] = {
      subject: override?.subject?.trim() ? override.subject : fallback.subject,
      body: override?.body?.trim() ? override.body : fallback.body,
    }
  }
  return draft
}

/** Serialize only the parts that differ from the defaults ('' when none do). */
export function serializeEmailTemplateDraft(
  draft: EmailTemplatesByLang,
  defaults: EmailTemplatesByLang
): string {
  const overrides: EmailTemplatesByLang = {}
  for (const lang of Object.keys(defaults).sort()) {
    const current = draft[lang]
    if (!current) continue
    const subject =
      current.subject === defaults[lang].subject ? '' : current.subject
    const body = current.body === defaults[lang].body ? '' : current.body
    if (subject || body) overrides[lang] = { subject, body }
  }
  return Object.keys(overrides).length ? JSON.stringify(overrides) : ''
}

/** Fill a template with sample values for the editor preview. */
export function renderEmailTemplatePreview(
  template: string,
  values: Record<string, string>
): string {
  return template.replaceAll(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in values ? values[key] : match
  )
}
