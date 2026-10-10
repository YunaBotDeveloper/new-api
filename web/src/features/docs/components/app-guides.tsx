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
import { useTranslation } from 'react-i18next'

import {
  CodeBlock,
  CodeBlockCopyButton,
} from '@/components/ai-elements/code-block'
import { CopyButton } from '@/components/copy-button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { SAMPLE_API_KEY_ENV, SAMPLE_CHAT_MODEL } from '../constants'

type DocsAppGuidesProps = {
  baseUrl: string
}

export function DocsAppGuides(props: DocsAppGuidesProps) {
  const { t } = useTranslation()
  const apiUrl = `${props.baseUrl}/v1`

  const codexConfig = [
    `model = "${SAMPLE_CHAT_MODEL}"`,
    `model_provider = "newapi"`,
    '',
    '[model_providers.newapi]',
    `name = "New API"`,
    `base_url = "${apiUrl}"`,
    `env_key = "${SAMPLE_API_KEY_ENV}"`,
    `wire_api = "responses"`,
  ].join('\n')
  const codexShell = [
    `export ${SAMPLE_API_KEY_ENV}="<YOUR_API_KEY>"`,
    'codex',
  ].join('\n')
  const claudeShell = [
    `export ANTHROPIC_BASE_URL="${props.baseUrl}"`,
    `export ANTHROPIC_AUTH_TOKEN="<YOUR_API_KEY>"`,
    `export ANTHROPIC_MODEL="${SAMPLE_CHAT_MODEL}"`,
    'claude',
  ].join('\n')
  const clientFields = [
    { label: t('API address'), value: apiUrl },
    { label: t('API key'), value: '<YOUR_API_KEY>' },
    { label: t('Model'), value: SAMPLE_CHAT_MODEL },
  ]

  return (
    <Tabs defaultValue='codex' className='flex flex-col gap-3'>
      <TabsList className='h-8 w-fit p-0.5'>
        <TabsTrigger value='codex' className='h-7 px-2.5 text-xs'>
          Codex CLI
        </TabsTrigger>
        <TabsTrigger value='claude-code' className='h-7 px-2.5 text-xs'>
          Claude Code
        </TabsTrigger>
        <TabsTrigger value='clients' className='h-7 px-2.5 text-xs'>
          {t('Other clients')}
        </TabsTrigger>
      </TabsList>

      <TabsContent value='codex' className='flex flex-col gap-3'>
        <p className='text-muted-foreground text-sm'>
          {t('Add a custom provider to the Codex config file:')}
        </p>
        <CodeBlock
          code={codexConfig}
          language='toml'
          filename='config.toml'
          title='~/.codex/config.toml'
          showToolbar
        >
          <CodeBlockCopyButton />
        </CodeBlock>
        <p className='text-muted-foreground text-sm'>
          {t('Then export your API key and start Codex:')}
        </p>
        <CodeBlock code={codexShell} language='bash'>
          <CodeBlockCopyButton />
        </CodeBlock>
      </TabsContent>

      <TabsContent value='claude-code' className='flex flex-col gap-3'>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Point Claude Code at this gateway with environment variables. The base URL has no /v1 suffix.'
          )}
        </p>
        <CodeBlock code={claudeShell} language='bash'>
          <CodeBlockCopyButton />
        </CodeBlock>
      </TabsContent>

      <TabsContent value='clients' className='flex flex-col gap-3'>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Most OpenAI-compatible apps (Cherry Studio, LobeChat, Chatbox, etc.) need only three fields:'
          )}
        </p>
        <ItemGroup>
          {clientFields.map((field) => (
            <Item key={field.label} variant='muted' size='sm'>
              <ItemContent className='min-w-0'>
                <ItemTitle>{field.label}</ItemTitle>
                <code className='text-muted-foreground font-mono text-sm break-all'>
                  {field.value}
                </code>
              </ItemContent>
              <ItemActions>
                <CopyButton
                  value={field.value}
                  size='sm'
                  aria-label={`${t('Copy')}: ${field.label}`}
                />
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
        <p className='text-muted-foreground text-sm'>
          {t(
            'On the API Keys page you can also send a key to CC Switch in one click.'
          )}
        </p>
      </TabsContent>
    </Tabs>
  )
}
