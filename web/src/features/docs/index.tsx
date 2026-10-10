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
import { Link } from '@tanstack/react-router'
import { KeyRound, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  CodeBlock,
  CodeBlockCopyButton,
} from '@/components/ai-elements/code-block'
import { CopyButton } from '@/components/copy-button'
import { PublicLayout } from '@/components/layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { buildChatSample } from '@/features/pricing/lib/code-samples'
import { useApiBaseUrl } from '@/hooks/use-api-base-url'

import { DocsAppGuides } from './components/app-guides'
import { DocsCodeSamples } from './components/code-samples'
import {
  DocsEndpointsTable,
  DocsErrorsTable,
} from './components/reference-tables'
import { SAMPLE_API_KEY_ENV, SAMPLE_CHAT_MODEL } from './constants'

type DocsSectionProps = {
  id: string
  title: string
  children: React.ReactNode
}

function DocsSection(props: DocsSectionProps) {
  return (
    <section
      id={props.id}
      aria-labelledby={`${props.id}-title`}
      className='flex scroll-mt-24 flex-col gap-4'
    >
      <h2
        id={`${props.id}-title`}
        className='text-2xl font-semibold tracking-tight'
      >
        {props.title}
      </h2>
      {props.children}
    </section>
  )
}

export function Docs() {
  const { t } = useTranslation()
  const baseUrl = useApiBaseUrl()
  const apiUrl = `${baseUrl}/v1`
  const firstRequest = buildChatSample('curl', {
    baseUrl,
    apiKeyEnv: SAMPLE_API_KEY_ENV,
    modelName: SAMPLE_CHAT_MODEL,
    endpointType: 'openai',
    endpointPath: '/v1/chat/completions',
  })

  const sections = [
    { id: 'quick-start', title: t('Quick start') },
    { id: 'authentication', title: t('Authentication') },
    { id: 'endpoints', title: t('Endpoints') },
    { id: 'code-samples', title: t('Code samples') },
    { id: 'apps', title: t('Use with apps') },
    { id: 'errors', title: t('Errors') },
  ]

  return (
    <PublicLayout>
      <div className='mx-auto grid max-w-6xl gap-10 py-6 lg:grid-cols-[12rem_minmax(0,1fr)]'>
        <aside className='hidden lg:block'>
          <nav
            aria-label={t('On this page')}
            className='sticky top-24 flex flex-col gap-1 text-sm'
          >
            <p className='mb-1 font-medium'>{t('On this page')}</p>
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className='text-muted-foreground hover:text-foreground rounded-sm py-1 transition-colors'
              >
                {section.title}
              </a>
            ))}
          </nav>
        </aside>

        <div className='flex min-w-0 flex-col gap-12'>
          <header className='flex flex-col gap-3'>
            <h1 className='text-3xl font-semibold tracking-tight md:text-4xl'>
              {t('API documentation')}
            </h1>
            <p className='text-muted-foreground max-w-2xl'>
              {t(
                'One API key for OpenAI, Claude and image models. Use the OpenAI or Anthropic SDKs you already have; only the base URL changes.'
              )}
            </p>
          </header>

          <DocsSection id='quick-start' title={t('Quick start')}>
            <ol className='flex list-decimal flex-col gap-4 pl-5'>
              <li className='pl-1'>
                <div className='flex flex-col items-start gap-2'>
                  <span>
                    {t('Sign in and create an API key in the console.')}
                  </span>
                  <Button size='sm' render={<Link to='/keys' />}>
                    <KeyRound aria-hidden='true' />
                    {t('Create API Key')}
                  </Button>
                </div>
              </li>
              <li className='pl-1'>
                <div className='flex flex-col gap-2'>
                  <span>{t('Use this base URL in your client:')}</span>
                  <div className='bg-muted/50 flex max-w-xl items-center gap-2 rounded-lg border px-3 py-2'>
                    <code className='min-w-0 flex-1 font-mono text-sm break-all'>
                      {apiUrl}
                    </code>
                    <CopyButton
                      value={apiUrl}
                      size='sm'
                      tooltip={t('Copy API URL')}
                      aria-label={`${t('Copy API URL')}: ${apiUrl}`}
                    />
                  </div>
                </div>
              </li>
              <li className='min-w-0 pl-1'>
                <div className='flex min-w-0 flex-col gap-2'>
                  <span>{t('Send your first request:')}</span>
                  <CodeBlock code={firstRequest} language='bash'>
                    <CodeBlockCopyButton />
                  </CodeBlock>
                </div>
              </li>
            </ol>
          </DocsSection>

          <DocsSection id='authentication' title={t('Authentication')}>
            <p className='text-muted-foreground'>
              {t(
                'Send your API key in the Authorization header. Claude-format requests may use the x-api-key header instead.'
              )}
            </p>
            <CodeBlock
              code={[
                'Authorization: Bearer <YOUR_API_KEY>',
                'x-api-key: <YOUR_API_KEY>',
              ].join('\n')}
              language='http'
            />
            <Alert>
              <ShieldAlert aria-hidden='true' />
              <AlertTitle>{t('Keep your key secret')}</AlertTitle>
              <AlertDescription>
                {t(
                  'Never expose API keys in browser or mobile app code. If a key leaks, delete it in the console and create a new one.'
                )}
              </AlertDescription>
            </Alert>
          </DocsSection>

          <DocsSection id='endpoints' title={t('Endpoints')}>
            <p className='text-muted-foreground'>
              {t(
                'All endpoints are relative to the base URL. Add "stream": true to the request body to receive server-sent events.'
              )}
            </p>
            <DocsEndpointsTable />
            <p className='text-muted-foreground text-sm'>
              {t('Available model names and prices are listed in the')}{' '}
              <Link
                to='/pricing'
                className='text-foreground font-medium underline underline-offset-4'
              >
                {t('Model Square')}
              </Link>
              .
            </p>
          </DocsSection>

          <DocsSection id='code-samples' title={t('Code samples')}>
            <DocsCodeSamples baseUrl={baseUrl} />
          </DocsSection>

          <DocsSection id='apps' title={t('Use with apps')}>
            <DocsAppGuides baseUrl={baseUrl} />
          </DocsSection>

          <DocsSection id='errors' title={t('Errors')}>
            <p className='text-muted-foreground'>
              {t(
                'Errors return a JSON body with an error.message field explaining the cause.'
              )}
            </p>
            <DocsErrorsTable />
          </DocsSection>
        </div>
      </div>
    </PublicLayout>
  )
}
