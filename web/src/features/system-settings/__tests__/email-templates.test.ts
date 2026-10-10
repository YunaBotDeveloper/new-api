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
import { describe, expect, it } from 'vitest'

import {
  buildEmailTemplateDraft,
  renderEmailTemplatePreview,
  serializeEmailTemplateDraft,
} from '../integrations/email-templates'

const defaults = {
  en: { subject: 'Code {{code}}', body: '<p>{{code}}</p>' },
  'zh-CN': { subject: '验证码 {{code}}', body: '<p>{{code}}</p>' },
}

describe('email template drafts', () => {
  it('merges stored overrides over defaults and keeps defaults for blank parts', () => {
    const draft = buildEmailTemplateDraft(
      '{"en":{"subject":"Custom","body":""}}',
      defaults
    )

    expect(draft.en).toEqual({ subject: 'Custom', body: '<p>{{code}}</p>' })
    expect(draft['zh-CN']).toEqual(defaults['zh-CN'])
  })

  it('falls back to defaults when the stored value is not a JSON object', () => {
    expect(buildEmailTemplateDraft('[1]', defaults)).toEqual(defaults)
    expect(buildEmailTemplateDraft('not json', defaults)).toEqual(defaults)
  })

  it('serializes only the parts that differ from the defaults', () => {
    const draft = {
      en: { subject: 'Custom', body: '<p>{{code}}</p>' },
      'zh-CN': defaults['zh-CN'],
    }

    expect(serializeEmailTemplateDraft(draft, defaults)).toBe(
      '{"en":{"subject":"Custom","body":""}}'
    )
  })

  it('serializes to an empty string when every language matches the default', () => {
    expect(serializeEmailTemplateDraft(defaults, defaults)).toBe('')
  })

  it('fills known preview variables and leaves unknown ones untouched', () => {
    expect(
      renderEmailTemplatePreview('{{site}} {{code}} {{other}}', {
        site: 'Acme',
        code: '123456',
      })
    ).toBe('Acme 123456 {{other}}')
  })
})
