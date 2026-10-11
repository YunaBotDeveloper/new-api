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
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Loader2, TriangleAlert } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { CopyButton } from '@/components/copy-button'
import { Dialog } from '@/components/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { toIntlLocale } from '@/i18n/languages'

import { getUserBillingHistory, isApiSuccess } from '../../api'
import { formatVnd } from '../../lib'
import type { GpmpayOrder } from '../../types'

interface GpmpayQrDialogProps {
  order: GpmpayOrder | null
  onOpenChange: (open: boolean) => void
  onPaid: () => void
}

const POLL_INTERVAL_MS = 3000

export function GpmpayQrDialog(props: GpmpayQrDialogProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const order = props.order
  const notifiedRef = useRef<string | null>(null)

  const statusQuery = useQuery({
    queryKey: ['wallet', 'gpmpay-order-status', order?.trade_no],
    queryFn: async () => {
      const response = await getUserBillingHistory(1, 1, order?.trade_no)
      if (!isApiSuccess(response)) return 'pending'
      return response.data?.items?.[0]?.status ?? 'pending'
    },
    enabled: !!order,
    refetchInterval: (query) =>
      query.state.data === 'pending' || query.state.data === undefined
        ? POLL_INTERVAL_MS
        : false,
    meta: { errorToast: false },
  })
  const status = statusQuery.data ?? 'pending'
  const paid = status === 'success'

  const onPaid = props.onPaid
  useEffect(() => {
    if (!paid || !order || notifiedRef.current === order.trade_no) return
    notifiedRef.current = order.trade_no
    toast.success(t('Payment received. Your balance has been topped up.'))
    onPaid()
  }, [paid, order, onPaid, t])

  const rows = order
    ? [
        { label: t('Account number'), value: order.account_number },
        { label: t('Account name'), value: order.account_name },
        {
          label: t('Amount'),
          display: formatVnd(order.amount_vnd, locale),
          value: String(Math.ceil(order.amount_vnd)),
        },
        { label: t('Transfer content'), value: order.content },
      ]
    : []

  return (
    <Dialog
      open={!!order}
      onOpenChange={props.onOpenChange}
      title={t('Bank transfer (VietQR)')}
      description={t(
        'Scan the QR code with your banking app. Your balance is credited automatically once the transfer arrives.'
      )}
      contentClassName='sm:max-w-md'
      footer={
        <Button
          variant={paid ? 'default' : 'outline'}
          onClick={() => props.onOpenChange(false)}
        >
          {paid ? t('Done') : t('Close')}
        </Button>
      }
    >
      {order && paid ? (
        <div className='flex flex-col items-center gap-3 py-6 text-center'>
          <CheckCircle2 className='text-success h-12 w-12' aria-hidden='true' />
          <p className='font-medium'>
            {t('Payment received. Your balance has been topped up.')}
          </p>
        </div>
      ) : null}

      {order && !paid ? (
        <div className='space-y-4'>
          <img
            src={order.qr_url}
            alt={t('VietQR code for the bank transfer')}
            className='mx-auto aspect-square w-full max-w-64 rounded-lg border bg-white object-contain p-2'
          />

          <dl className='divide-y rounded-lg border'>
            {rows.map((row) => (
              <div
                key={row.label}
                className='flex items-center justify-between gap-3 px-3 py-2'
              >
                <dt className='text-muted-foreground shrink-0 text-xs'>
                  {row.label}
                </dt>
                <dd className='flex min-w-0 items-center gap-1'>
                  <span className='truncate font-mono text-sm font-semibold'>
                    {row.display ?? row.value}
                  </span>
                  <CopyButton
                    value={row.value}
                    size='sm'
                    aria-label={t('Copy {{field}}', { field: row.label })}
                  />
                </dd>
              </div>
            ))}
          </dl>

          <Alert variant='destructive'>
            <TriangleAlert className='h-4 w-4' aria-hidden='true' />
            <AlertDescription>
              {t(
                'Keep the transfer content exactly as shown and transfer the exact amount, otherwise the payment cannot be matched automatically.'
              )}
            </AlertDescription>
          </Alert>

          <p
            className='text-muted-foreground flex items-center justify-center gap-2 text-sm'
            role='status'
          >
            <Loader2 className='h-4 w-4 animate-spin' aria-hidden='true' />
            {t('Waiting for the transfer...')}
          </p>
        </div>
      ) : null}
    </Dialog>
  )
}
