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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Code2, Eye, ShieldAlert } from 'lucide-react'
import * as React from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

import { CopyButton } from '@/components/copy-button'
import { JsonCodeEditor } from '@/components/json-code-editor'
import { RiskAcknowledgementDialog } from '@/components/risk-acknowledgement-dialog'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
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
import { Switch } from '@/components/ui/switch'
import { useStatus } from '@/hooks/use-status'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'

import { confirmPaymentCompliance } from '../api'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'
import { AmountDiscountVisualEditor } from './amount-discount-visual-editor'
import { AmountOptionsVisualEditor } from './amount-options-visual-editor'
import {
  formatJsonForEditor,
  getJsonError,
  normalizeJsonForComparison,
  removeTrailingSlash,
} from './utils'

function isHttpOriginUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return true

  try {
    const url = new URL(trimmed)
    const isHttpProtocol = url.protocol === 'http:' || url.protocol === 'https:'
    const hasNoPath = url.pathname === '' || url.pathname === '/'
    return isHttpProtocol && hasNoPath && !url.search && !url.hash
  } catch {
    return false
  }
}

const paymentSchema = z.object({
  Price: z.coerce.number().min(0),
  MinTopUp: z.coerce.number().min(0),
  CustomCallbackAddress: z
    .string()
    .refine(
      isHttpOriginUrl,
      'Enter only a top-level callback domain, for example https://api.example.com, without any path.'
    ),
  GPMPayWebhookSecret: z.string(),
  GPMPayBankBin: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^\d{6}$/.test(value),
      'Enter the 6-digit NAPAS bank BIN.'
    ),
  GPMPayAccountNumber: z.string().trim(),
  GPMPayAccountName: z.string().trim(),
  GPMPayCodePrefix: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{2,8}$/, 'Use 2-8 uppercase letters or digits.'),
  GPMPayAutoPrice: z.boolean(),
  AmountOptions: z.string().superRefine((value, ctx) => {
    const error = getJsonError(value, (parsed) => Array.isArray(parsed))
    if (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error,
      })
    }
  }),
  AmountDiscount: z.string().superRefine((value, ctx) => {
    const error = getJsonError(
      value,
      (parsed) =>
        !!parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    )
    if (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error,
      })
    }
  }),
})

type PaymentFormValues = z.infer<typeof paymentSchema>

const CURRENT_COMPLIANCE_TERMS_VERSION = 'v1'

const GPMPAY_TEXT_OPTION_KEYS = [
  'GPMPayBankBin',
  'GPMPayAccountNumber',
  'GPMPayAccountName',
  'GPMPayCodePrefix',
] as const

type PaymentComplianceDefaults = {
  confirmed: boolean
  termsVersion: string
  confirmedAt: number
  confirmedBy: number
}

type PaymentSettingsSectionProps = {
  defaultValues: PaymentFormValues
  complianceDefaults: PaymentComplianceDefaults
}

export function PaymentSettingsSection({
  defaultValues,
  complianceDefaults,
}: PaymentSettingsSectionProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { status } = useStatus()
  const updateOption = useUpdateOption()
  const initialRef = React.useRef(defaultValues)
  const defaultsSignature = React.useMemo(
    () => JSON.stringify(defaultValues),
    [defaultValues]
  )

  const [amountOptionsVisualMode, setAmountOptionsVisualMode] =
    React.useState(true)
  const [amountDiscountVisualMode, setAmountDiscountVisualMode] =
    React.useState(true)
  const [showComplianceDialog, setShowComplianceDialog] = React.useState(false)

  const complianceStatements = React.useMemo(
    () => [
      t(
        'You have legally obtained authorization for the connected model APIs, accounts, keys, and quotas.'
      ),
      t(
        'You commit to using upstream APIs, accounts, keys, quotas, and service capabilities only within the scope of lawful authorization obtained from upstream service providers, model service providers, or relevant rights holders, and will not conduct unauthorized resale, trafficking, distribution, or other non-compliant commercialization.'
      ),
      t(
        'If you provide generative AI services to the public in mainland China, you will fulfill legal obligations including filing, security assessment, content safety, complaint handling, generated content labeling, log retention, and personal information protection.'
      ),
      t(
        'You commit not to use this system to implement, assist with, or indirectly implement acts that violate applicable laws and regulations, regulatory requirements, platform rules, public interests, or the lawful rights and interests of third parties.'
      ),
      t(
        'You understand and independently bear legal responsibility arising from deployment, operation, and charging behavior.'
      ),
      t(
        'You understand this compliance reminder is only for risk notice and does not constitute legal advice, a compliance review conclusion, or a guarantee of the legality of your use of this system; you should consult professional legal or compliance advisors based on your actual business scenario.'
      ),
    ],
    [t]
  )

  const complianceRequiredText = t(
    'I have read and understood the above compliance reminder, acknowledge the related legal risks, and confirm that I bear legal responsibility arising from deployment, operation, and charging behavior.'
  )
  const complianceRequiredTextParts = React.useMemo(
    () => [
      {
        type: 'input' as const,
        text: t('I have read and understood the above compliance reminder'),
      },
      { type: 'static' as const, text: t('，') },
      {
        type: 'input' as const,
        text: t('acknowledge the related legal risks'),
      },
      { type: 'static' as const, text: t('，and ') },
      {
        type: 'input' as const,
        text: t(
          'confirm that I bear legal responsibility arising from deployment'
        ),
      },
      { type: 'static' as const, text: t('、') },
      {
        type: 'input' as const,
        text: t('operation and charging behavior'),
      },
    ],
    [t]
  )

  const complianceConfirmed =
    complianceDefaults.confirmed &&
    complianceDefaults.termsVersion === CURRENT_COMPLIANCE_TERMS_VERSION

  const confirmComplianceMutation = useMutation({
    mutationFn: confirmPaymentCompliance,
    onSuccess: (data) => {
      if (data.success) {
        toast.success(t('Compliance confirmed successfully'))
        setShowComplianceDialog(false)
        queryClient.invalidateQueries({ queryKey: ['system-options'] })
      } else {
        handleServerError(data, t('Failed to confirm compliance'))
      }
    },
    onError: (error: Error) => {
      handleServerError(error, t('Failed to confirm compliance'))
    },
  })

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema) as Resolver<PaymentFormValues>,
    mode: 'onChange', // Enable real-time validation
    defaultValues: {
      ...defaultValues,
      AmountOptions: formatJsonForEditor(defaultValues.AmountOptions),
      AmountDiscount: formatJsonForEditor(defaultValues.AmountDiscount),
    },
  })

  const { isSubmitting } = form.formState

  React.useEffect(() => {
    const parsedDefaults = JSON.parse(defaultsSignature) as PaymentFormValues
    initialRef.current = parsedDefaults
    form.reset({
      ...parsedDefaults,
      AmountOptions: formatJsonForEditor(parsedDefaults.AmountOptions),
      AmountDiscount: formatJsonForEditor(parsedDefaults.AmountDiscount),
    })
  }, [defaultsSignature, form])

  const onSubmit = async (values: PaymentFormValues) => {
    const sanitized = {
      Price: values.Price,
      MinTopUp: values.MinTopUp,
      CustomCallbackAddress: removeTrailingSlash(values.CustomCallbackAddress),
      AmountOptions: values.AmountOptions.trim(),
      AmountDiscount: values.AmountDiscount.trim(),
    }

    const initial = {
      Price: initialRef.current.Price,
      MinTopUp: initialRef.current.MinTopUp,
      CustomCallbackAddress: removeTrailingSlash(
        initialRef.current.CustomCallbackAddress
      ),
      AmountOptions: initialRef.current.AmountOptions.trim(),
      AmountDiscount: initialRef.current.AmountDiscount.trim(),
    }

    const updates: Array<{ key: string; value: string | number | boolean }> = []

    if (sanitized.Price !== initial.Price) {
      updates.push({ key: 'Price', value: sanitized.Price })
    }

    if (sanitized.MinTopUp !== initial.MinTopUp) {
      updates.push({ key: 'MinTopUp', value: sanitized.MinTopUp })
    }

    if (sanitized.CustomCallbackAddress !== initial.CustomCallbackAddress) {
      updates.push({
        key: 'CustomCallbackAddress',
        value: sanitized.CustomCallbackAddress,
      })
    }

    for (const key of GPMPAY_TEXT_OPTION_KEYS) {
      const value = values[key].trim()
      if (value !== initialRef.current[key].trim()) {
        updates.push({ key, value })
      }
    }

    if (values.GPMPayAutoPrice !== initialRef.current.GPMPayAutoPrice) {
      updates.push({ key: 'GPMPayAutoPrice', value: values.GPMPayAutoPrice })
    }

    // The secret is never returned by the server; blank keeps the stored one.
    const webhookSecret = values.GPMPayWebhookSecret.trim()
    if (webhookSecret) {
      updates.push({ key: 'GPMPayWebhookSecret', value: webhookSecret })
    }

    if (
      normalizeJsonForComparison(sanitized.AmountOptions) !==
      normalizeJsonForComparison(initial.AmountOptions)
    ) {
      updates.push({
        key: 'payment_setting.amount_options',
        value: sanitized.AmountOptions,
      })
    }

    if (
      normalizeJsonForComparison(sanitized.AmountDiscount) !==
      normalizeJsonForComparison(initial.AmountDiscount)
    ) {
      updates.push({
        key: 'payment_setting.amount_discount',
        value: sanitized.AmountDiscount,
      })
    }

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
    if (webhookSecret) form.setValue('GPMPayWebhookSecret', '')
  }

  const callbackBase =
    removeTrailingSlash(form.watch('CustomCallbackAddress').trim()) ||
    (typeof status?.server_address === 'string'
      ? removeTrailingSlash(status.server_address.trim())
      : '') ||
    window.location.origin
  const gpmpayWebhookUrl = `${callbackBase}/api/gpmpay/webhook`
  const autoPrice = form.watch('GPMPayAutoPrice')

  return (
    <SettingsSection title={t('Payment Gateway')}>
      {!complianceConfirmed ? (
        <Alert variant='destructive' className='mb-6'>
          <ShieldAlert className='h-4 w-4' />
          <AlertTitle>{t('Compliance confirmation required')}</AlertTitle>
          <AlertDescription>
            <div className='space-y-3'>
              <p>
                {t(
                  'Payment, redemption codes, subscription plans, and invitation rewards are locked until the root administrator confirms the compliance terms.'
                )}
              </p>
              <ol className='list-decimal space-y-1 pl-5'>
                {complianceStatements.map((statement) => (
                  <li key={statement}>{statement}</li>
                ))}
              </ol>
            </div>
          </AlertDescription>
          <AlertAction>
            <Button
              type='button'
              size='sm'
              variant='destructive'
              onClick={() => setShowComplianceDialog(true)}
            >
              {t('Confirm compliance')}
            </Button>
          </AlertAction>
        </Alert>
      ) : (
        <Alert className='mb-6'>
          <AlertTitle>{t('Compliance confirmed')}</AlertTitle>
          <AlertDescription>
            {t('Confirmed at {{time}} by user #{{userId}}', {
              time: complianceDefaults.confirmedAt
                ? new Date(
                    complianceDefaults.confirmedAt * 1000
                  ).toLocaleString()
                : '-',
              userId: complianceDefaults.confirmedBy || '-',
            })}
          </AlertDescription>
        </Alert>
      )}

      <RiskAcknowledgementDialog
        open={showComplianceDialog}
        onOpenChange={setShowComplianceDialog}
        title={t('Confirm compliance terms')}
        description={t(
          'This confirmation unlocks payment, redemption code, subscription plan, and invitation reward features. Please read the statements carefully.'
        )}
        items={complianceStatements}
        requiredText={complianceRequiredText}
        requiredTextParts={complianceRequiredTextParts}
        inputPrompt={t('Please type the following text to confirm:')}
        inputPlaceholder={t('Type the confirmation text here')}
        mismatchHint={t('The entered text does not match the required text.')}
        confirmText={t('Confirm and enable')}
        isLoading={confirmComplianceMutation.isPending}
        onConfirm={() => confirmComplianceMutation.mutate()}
      />

      <Form {...form}>
        <SettingsForm
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn(
            'gap-y-8',
            !complianceConfirmed && 'pointer-events-none opacity-40'
          )}
          data-no-autosubmit='true'
        >
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            saveLabel='Save all settings'
          />
          <div className='space-y-4'>
            <div className='grid gap-6 md:grid-cols-2'>
              <FormField
                control={form.control}
                name='Price'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Price (local currency / USD)')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        step='0.01'
                        min={0}
                        disabled={autoPrice}
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    {autoPrice && (
                      <FormDescription>
                        {t(
                          'Updated automatically from the Vietcombank USD sell rate.'
                        )}
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='MinTopUp'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Minimum top-up (USD)')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        step='0.01'
                        min={0}
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='CustomCallbackAddress'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Callback address')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('https://gateway.example.com')}
                      {...field}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='space-y-4 rounded-lg border p-4'>
              <div className='space-y-1'>
                <h3 className='font-medium'>
                  {t('GPMPay (VietQR bank transfer)')}
                </h3>
                <p className='text-muted-foreground text-sm'>
                  {t(
                    'In the GPMPay dashboard, add an HTTP webhook with HMAC verification and paste the same secret here. Set "Price" to the VND amount for 1 USD of quota, for example 26000.'
                  )}
                </p>
              </div>

              <FormField
                control={form.control}
                name='GPMPayAutoPrice'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>
                        {t('Use Vietcombank exchange rate for Price')}
                      </FormLabel>
                      <FormDescription>
                        {t(
                          'Every 10 minutes, set "Price" to the Vietcombank USD sell rate (VND per 1 USD of quota).'
                        )}
                      </FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </SettingsSwitchItem>
                )}
              />

              <div className='space-y-2'>
                <span className='text-sm font-medium'>{t('Webhook URL')}</span>
                <div className='bg-muted/30 flex items-center gap-2 rounded-md border px-3 py-1.5'>
                  <code className='min-w-0 flex-1 truncate text-sm'>
                    {gpmpayWebhookUrl}
                  </code>
                  <CopyButton
                    value={gpmpayWebhookUrl}
                    size='sm'
                    aria-label={t('Copy webhook URL')}
                  />
                </div>
              </div>

              <div className='grid gap-6 md:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='GPMPayWebhookSecret'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Webhook secret')}</FormLabel>
                      <FormControl>
                        <Input
                          type='password'
                          autoComplete='new-password'
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Leave blank to keep the current secret.')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='GPMPayCodePrefix'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Reconciliation code prefix')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='NAP'
                          {...field}
                          onChange={(event) =>
                            field.onChange(event.target.value.toUpperCase())
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Added to every transfer content so payments can be matched to orders.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='GPMPayBankBin'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Bank BIN')}</FormLabel>
                      <FormControl>
                        <Input
                          inputMode='numeric'
                          placeholder='970436'
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('6-digit NAPAS code of the receiving bank.')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='GPMPayAccountNumber'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Account number')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='GPMPayAccountName'
                  render={({ field }) => (
                    <FormItem className='md:col-span-2'>
                      <FormLabel>{t('Account name')}</FormLabel>
                      <FormControl>
                        <Input placeholder='NGUYEN VAN A' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className='grid gap-6 md:grid-cols-2 md:items-start'>
              <FormField
                control={form.control}
                name='AmountOptions'
                render={({ field }) => (
                  <FormItem>
                    <div className='mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                      <FormLabel>{t('Top-up amount options')}</FormLabel>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() =>
                          setAmountOptionsVisualMode(!amountOptionsVisualMode)
                        }
                        className='w-full sm:w-auto'
                      >
                        {amountOptionsVisualMode ? (
                          <>
                            <Code2 className='mr-2 h-3 w-3' />
                            {t('JSON Editor')}
                          </>
                        ) : (
                          <>
                            <Eye className='mr-2 h-3 w-3' />
                            {t('Visual Editor')}
                          </>
                        )}
                      </Button>
                    </div>
                    <FormControl>
                      {amountOptionsVisualMode ? (
                        <AmountOptionsVisualEditor
                          value={field.value}
                          onChange={field.onChange}
                        />
                      ) : (
                        <JsonCodeEditor
                          value={field.value}
                          onChange={field.onChange}
                          name={field.name}
                          onBlur={field.onBlur}
                          textareaRef={field.ref}
                          placeholder='[10, 20, 50, 100]'
                          heightClassName='h-40 min-h-40 max-h-40'
                          aria-invalid={Boolean(
                            form.formState.errors.AmountOptions
                          )}
                        />
                      )}
                    </FormControl>
                    <FormDescription>
                      {t('Preset recharge amounts (JSON array)')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='AmountDiscount'
                render={({ field }) => (
                  <FormItem>
                    <div className='mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                      <FormLabel>{t('Amount discount')}</FormLabel>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() =>
                          setAmountDiscountVisualMode(!amountDiscountVisualMode)
                        }
                        className='w-full sm:w-auto'
                      >
                        {amountDiscountVisualMode ? (
                          <>
                            <Code2 className='mr-2 h-3 w-3' />
                            {t('JSON Editor')}
                          </>
                        ) : (
                          <>
                            <Eye className='mr-2 h-3 w-3' />
                            {t('Visual Editor')}
                          </>
                        )}
                      </Button>
                    </div>
                    <FormControl>
                      {amountDiscountVisualMode ? (
                        <AmountDiscountVisualEditor
                          value={field.value}
                          onChange={field.onChange}
                        />
                      ) : (
                        <JsonCodeEditor
                          value={field.value}
                          onChange={field.onChange}
                          name={field.name}
                          onBlur={field.onBlur}
                          textareaRef={field.ref}
                          placeholder='{"100":0.95,"200":0.9}'
                          heightClassName='h-40 min-h-40 max-h-40'
                          aria-invalid={Boolean(
                            form.formState.errors.AmountDiscount
                          )}
                        />
                      )}
                    </FormControl>
                    <FormDescription>
                      {t('Discount map by recharge amount (JSON object)')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
