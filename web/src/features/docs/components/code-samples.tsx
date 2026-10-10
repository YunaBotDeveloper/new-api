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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  CodeBlock,
  CodeBlockCopyButton,
} from '@/components/ai-elements/code-block'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  buildSample,
  LANG_HIGHLIGHT,
  LANG_LABELS,
  type Lang,
} from '@/features/pricing/lib/code-samples'

import { DOCS_SAMPLE_ENDPOINTS, SAMPLE_API_KEY_ENV } from '../constants'

type DocsCodeSamplesProps = {
  baseUrl: string
}

export function DocsCodeSamples(props: DocsCodeSamplesProps) {
  const { t } = useTranslation()
  const [endpointType, setEndpointType] = useState<string>(
    DOCS_SAMPLE_ENDPOINTS[0].type
  )
  const [lang, setLang] = useState<Lang>('curl')

  const endpoint =
    DOCS_SAMPLE_ENDPOINTS.find((item) => item.type === endpointType) ??
    DOCS_SAMPLE_ENDPOINTS[0]
  const code = buildSample(lang, endpoint.type, {
    baseUrl: props.baseUrl,
    apiKeyEnv: SAMPLE_API_KEY_ENV,
    modelName: endpoint.model,
    endpointType: endpoint.type,
    endpointPath: endpoint.path,
  })

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <Tabs value={endpointType} onValueChange={setEndpointType}>
          <TabsList className='h-8 p-0.5'>
            {DOCS_SAMPLE_ENDPOINTS.map((item) => (
              <TabsTrigger
                key={item.type}
                value={item.type}
                className='h-7 px-2.5 text-xs'
              >
                {t(item.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Tabs
          value={lang}
          onValueChange={(value) => setLang(value as Lang)}
          className='ml-auto'
        >
          <TabsList className='h-8 p-0.5'>
            {(Object.keys(LANG_LABELS) as Lang[]).map((item) => (
              <TabsTrigger
                key={item}
                value={item}
                className='h-7 px-2.5 text-xs'
              >
                {LANG_LABELS[item]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <CodeBlock code={code} language={LANG_HIGHLIGHT[lang]}>
        <CodeBlockCopyButton />
      </CodeBlock>

      <p className='text-muted-foreground text-xs'>
        {t('Replace')}{' '}
        <code className='bg-muted rounded px-1 py-0.5 font-mono'>
          {'<YOUR_API_KEY>'}
        </code>{' '}
        {t('with the API key from your token settings.')}
      </p>
    </div>
  )
}
