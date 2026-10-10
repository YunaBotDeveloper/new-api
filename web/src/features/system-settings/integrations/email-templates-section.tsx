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
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { type FieldErrors, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { RichContent } from '@/components/rich-content'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useStatus } from '@/hooks/use-status'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getEmailTemplateDefaults } from '../api'
import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  buildEmailTemplateDraft,
  EMAIL_TEMPLATE_KINDS,
  EMAIL_TEMPLATE_LABEL_KEYS,
  emailTemplateOptionKey,
  renderEmailTemplatePreview,
  serializeEmailTemplateDraft,
  type EmailTemplateDrafts,
  type EmailTemplateKind,
} from './email-templates'

// Language names are shown in their own script, not translated.
const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
}

type EmailTemplateCatalog = {
  languages: string[]
  defaults: EmailTemplateDrafts
  placeholders: Record<string, string[]>
}

type EmailTemplatesSectionProps = {
  defaultValues: Record<string, string>
}

export function EmailTemplatesSection(props: EmailTemplatesSectionProps) {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['email-template-defaults'],
    queryFn: async () => requireServerSuccess(await getEmailTemplateDefaults()),
    staleTime: Infinity,
  })

  const catalog = query.data?.data
  if (query.isLoading) {
    return (
      <SettingsSection title={t('Email Templates')}>
        <LoadingState message={t('Loading...')} />
      </SettingsSection>
    )
  }
  if (!catalog) {
    return (
      <SettingsSection title={t('Email Templates')}>
        <ErrorState
          title={t('Failed to load email templates')}
          onRetry={() => void query.refetch()}
        />
      </SettingsSection>
    )
  }

  // Remount the editor when saved values change so the form re-seeds.
  return (
    <EmailTemplatesEditor
      key={JSON.stringify(props.defaultValues)}
      stored={props.defaultValues}
      catalog={catalog}
    />
  )
}

function createEmailTemplatesSchema(
  t: (key: string, options?: Record<string, string>) => string,
  placeholders: Record<string, string[]>
) {
  const template = z.object({
    subject: z
      .string()
      .refine(
        (value) => !/[\r\n]/.test(value),
        t('Subject must be a single line')
      ),
    body: z.string(),
  })
  return z
    .record(z.string(), z.record(z.string(), template))
    .superRefine((drafts, ctx) => {
      for (const [kind, byLang] of Object.entries(drafts)) {
        const required = placeholders[kind]?.[0]
        for (const [lang, draft] of Object.entries(byLang)) {
          if (!required || !draft.body.trim()) continue
          if (draft.body.includes(required)) continue
          ctx.addIssue({
            code: 'custom',
            path: [kind, lang, 'body'],
            message: t('The body must contain {{placeholder}}', {
              placeholder: required,
            }),
          })
        }
      }
    })
}

type EmailTemplatesEditorProps = {
  stored: Record<string, string>
  catalog: EmailTemplateCatalog
}

function EmailTemplatesEditor(props: EmailTemplatesEditorProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const updateOption = useUpdateOption()
  const languages = props.catalog.languages
  const [kind, setKind] = useState<EmailTemplateKind>('verification')
  const [lang, setLang] = useState(
    languages.includes('en') ? 'en' : (languages[0] ?? 'en')
  )

  const initial = useMemo(() => {
    const drafts: EmailTemplateDrafts = {}
    for (const item of EMAIL_TEMPLATE_KINDS) {
      drafts[item] = buildEmailTemplateDraft(
        props.stored[emailTemplateOptionKey(item)] ?? '',
        props.catalog.defaults[item] ?? {}
      )
    }
    return drafts
  }, [props.stored, props.catalog])

  const form = useForm<EmailTemplateDrafts>({
    resolver: zodResolver(
      createEmailTemplatesSchema(t, props.catalog.placeholders)
    ),
    defaultValues: initial,
  })

  const placeholders = props.catalog.placeholders[kind] ?? []
  const subject = form.watch(`${kind}.${lang}.subject`) ?? ''
  const body = form.watch(`${kind}.${lang}.body`) ?? ''
  const sample = {
    site: String(status?.system_name || 'New API'),
    code: '123456',
    minutes: '10',
    link: `${window.location.origin}/user/reset?email=user@example.com&token=sample`,
    event: 'Password updated',
  }

  const onSubmit = async (values: EmailTemplateDrafts) => {
    for (const item of EMAIL_TEMPLATE_KINDS) {
      const defaults = props.catalog.defaults[item] ?? {}
      const next = serializeEmailTemplateDraft(values[item] ?? {}, defaults)
      const previous = serializeEmailTemplateDraft(initial[item], defaults)
      if (next === previous) continue
      await updateOption.mutateAsync({
        key: emailTemplateOptionKey(item),
        value: next,
      })
    }
  }

  // Errors may sit on a hidden email/language; jump to the first one.
  const onInvalid = (errors: FieldErrors<EmailTemplateDrafts>) => {
    const errorKind = EMAIL_TEMPLATE_KINDS.find((item) => errors[item])
    if (!errorKind) return
    const errorLang = Object.keys(errors[errorKind] ?? {})[0]
    setKind(errorKind)
    if (errorLang) setLang(errorLang)
  }

  const restoreDefault = () => {
    const fallback = props.catalog.defaults[kind]?.[lang]
    if (!fallback) return
    form.setValue(
      `${kind}.${lang}`,
      { ...fallback },
      {
        shouldDirty: true,
        shouldValidate: true,
      }
    )
  }

  const save = form.handleSubmit(onSubmit, onInvalid)

  return (
    <SettingsSection title={t('Email Templates')}>
      <Form {...form}>
        <SettingsForm onSubmit={save} autoComplete='off'>
          <SettingsPageFormActions
            onSave={save}
            isSaving={updateOption.isPending}
            saveLabel='Save email templates'
          />
          <p className='text-muted-foreground text-sm'>
            {t(
              "Emails are sent in the recipient's language: their saved site language, otherwise their browser language. Other languages use English."
            )}
          </p>

          <Tabs
            value={kind}
            onValueChange={(value) => setKind(value as EmailTemplateKind)}
          >
            <TabsList className='h-auto flex-wrap'>
              {EMAIL_TEMPLATE_KINDS.map((item) => (
                <TabsTrigger key={item} value={item}>
                  {t(EMAIL_TEMPLATE_LABEL_KEYS[item])}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className='flex flex-wrap items-center gap-3'>
            <Select
              items={languages.map((item) => ({
                value: item,
                label: LANGUAGE_LABELS[item] ?? item,
              }))}
              value={lang}
              onValueChange={(value) => {
                if (value) setLang(String(value))
              }}
            >
              <SelectTrigger className='w-40' aria-label={t('Language')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {languages.map((item) => (
                    <SelectItem key={item} value={item}>
                      {LANGUAGE_LABELS[item] ?? item}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <div className='flex flex-wrap items-center gap-1.5'>
              <span className='text-muted-foreground text-sm'>
                {t('Variables')}
              </span>
              {placeholders.map((item, index) => (
                <Badge
                  key={item}
                  variant={index === 0 ? 'default' : 'outline'}
                  className='font-mono'
                >
                  {item}
                </Badge>
              ))}
            </div>
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='ml-auto'
              onClick={restoreDefault}
            >
              <RotateCcw data-icon='inline-start' />
              {t('Restore default')}
            </Button>
          </div>

          <FormField
            key={`${kind}.${lang}.subject`}
            control={form.control}
            name={`${kind}.${lang}.subject`}
            render={({ field }) => (
              <FormItem className='lg:col-span-2'>
                <FormLabel>{t('Subject')}</FormLabel>
                <FormControl>
                  <Input autoComplete='off' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            key={`${kind}.${lang}.body`}
            control={form.control}
            name={`${kind}.${lang}.body`}
            render={({ field }) => (
              <FormItem className='lg:col-span-2'>
                <FormLabel>{t('Body (HTML)')}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={14}
                    className='font-mono text-xs'
                    spellCheck={false}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'The highlighted variable is required. Values are inserted safely and cannot change the HTML.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='flex flex-col gap-2 lg:col-span-2'>
            <span className='text-sm font-medium'>{t('Preview')}</span>
            <p className='text-muted-foreground text-sm'>
              {renderEmailTemplatePreview(subject, sample)}
            </p>
            <div className='overflow-hidden rounded-lg border'>
              <RichContent
                mode='html'
                htmlVariant='isolated'
                content={renderEmailTemplatePreview(body, sample)}
              />
            </div>
          </div>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
