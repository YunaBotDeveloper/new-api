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
import { Landmark, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

import {
  calculateTopupAmount,
  isApiSuccess,
  requestGpmpayPayment,
} from '../api'
import { formatVnd, getPaymentErrorTranslation } from '../lib'
import type { GpmpayOrder, TopupInfo } from '../types'
import { GpmpayQrDialog } from './dialogs/gpmpay-qr-dialog'

interface GpmpayTopupSectionProps {
  topupInfo: TopupInfo
  onPaid: () => void
}

const PREVIEW_DEBOUNCE_MS = 400

function getResponseError(response: { data?: unknown }): string | undefined {
  return (
    getPaymentErrorTranslation(response) ??
    (typeof response.data === 'string' ? response.data : undefined)
  )
}

export function GpmpayTopupSection(props: GpmpayTopupSectionProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const minTopup = props.topupInfo.min_topup || 1
  const presets = props.topupInfo.amount_options ?? []
  const discounts = props.topupInfo.discount ?? {}

  const [amountText, setAmountText] = useState(String(presets[0] ?? minTopup))
  const [payMoney, setPayMoney] = useState<number | null>(null)
  const [previewError, setPreviewError] = useState<string>()
  const [calculating, setCalculating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [order, setOrder] = useState<GpmpayOrder | null>(null)

  const amount = Math.floor(Number(amountText))
  const amountValid = Number.isFinite(amount) && amount >= minTopup

  useEffect(() => {
    if (!amountValid) {
      setPayMoney(null)
      setPreviewError(undefined)
      return
    }
    let cancelled = false
    setCalculating(true)
    const timer = window.setTimeout(async () => {
      try {
        const response = await calculateTopupAmount(amount)
        if (cancelled) return
        if (isApiSuccess(response) && response.data) {
          setPayMoney(Number.parseFloat(response.data))
          setPreviewError(undefined)
        } else {
          setPayMoney(null)
          setPreviewError(getResponseError(response))
        }
      } catch {
        if (!cancelled) setPayMoney(null)
      } finally {
        if (!cancelled) setCalculating(false)
      }
    }, PREVIEW_DEBOUNCE_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [amount, amountValid])

  const handlePay = async () => {
    if (!amountValid) return
    setSubmitting(true)
    try {
      const response = await requestGpmpayPayment(amount)
      if (
        isApiSuccess(response) &&
        response.data &&
        typeof response.data === 'object'
      ) {
        setOrder(response.data)
        return
      }
      toast.error(getResponseError(response) ?? t('Payment request failed'))
    } catch {
      toast.error(t('Payment request failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='space-y-4 sm:space-y-5'>
      {presets.length > 0 && (
        <div className='space-y-2.5'>
          <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
            {t('Amount')}
          </Label>
          <div className='grid grid-cols-2 gap-1.5 sm:gap-3 md:grid-cols-4'>
            {presets.map((preset) => {
              const discount = discounts[preset] ?? 1
              const selected = amount === preset
              return (
                <Button
                  key={preset}
                  type='button'
                  variant='outline'
                  aria-pressed={selected}
                  className={cn(
                    'flex min-h-14 flex-col items-start rounded-lg px-3 py-2.5 text-left',
                    selected
                      ? 'border-foreground bg-foreground/5 dark:bg-foreground/10'
                      : 'border-muted'
                  )}
                  onClick={() => setAmountText(String(preset))}
                >
                  <span className='text-base font-semibold'>
                    {formatNumber(preset, locale)}
                  </span>
                  {discount < 1 && (
                    <span className='text-xs font-medium text-green-600'>
                      {t('{{percent}}% OFF', {
                        percent: Math.round((1 - discount) * 100),
                      })}
                    </span>
                  )}
                </Button>
              )
            })}
          </div>
        </div>
      )}

      <div className='space-y-2.5'>
        <Label
          htmlFor='gpmpay-amount'
          className='text-muted-foreground text-xs font-medium tracking-wider uppercase'
        >
          {t('Custom Amount')}
        </Label>
        <div className='grid grid-cols-[minmax(0,1fr)_minmax(120px,0.6fr)] gap-2'>
          <Input
            id='gpmpay-amount'
            type='number'
            inputMode='numeric'
            min={minTopup}
            step={1}
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            placeholder={t('Minimum {{amount}}', { amount: minTopup })}
            aria-invalid={amountText !== '' && !amountValid}
            className='h-10'
          />
          <div className='bg-muted/30 flex min-h-10 items-center justify-between gap-2 rounded-md border px-3'>
            <span className='text-muted-foreground truncate text-xs'>
              {t('Amount to pay:')}
            </span>
            {calculating ? (
              <Skeleton className='h-5 w-20' />
            ) : (
              <span className='text-sm font-semibold'>
                {payMoney == null ? '-' : formatVnd(payMoney, locale)}
              </span>
            )}
          </div>
        </div>
        {amountText !== '' && !amountValid ? (
          <p className='text-destructive text-xs'>
            {t('Minimum {{amount}}', { amount: minTopup })}
          </p>
        ) : null}
        {amountValid && previewError ? (
          <p className='text-destructive text-xs'>{previewError}</p>
        ) : null}
      </div>

      <Button
        className='w-full gap-2'
        onClick={handlePay}
        disabled={!amountValid || submitting || calculating || !!previewError}
      >
        {submitting ? (
          <Loader2 className='h-4 w-4 animate-spin' aria-hidden='true' />
        ) : (
          <Landmark className='h-4 w-4' aria-hidden='true' />
        )}
        {t('Pay with bank transfer (VietQR)')}
      </Button>

      <GpmpayQrDialog
        order={order}
        onOpenChange={(open) => {
          if (!open) setOrder(null)
        }}
        onPaid={props.onPaid}
      />
    </div>
  )
}
