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
import { useStatus } from '@/hooks/use-status'

/**
 * Base URL (without a trailing `/v1`) that API clients should call.
 *
 * Order: first configured API address (`api_info`), then `server_address`,
 * then the current origin. The console and the relay API may live on
 * different domains, so `api_info` wins over `server_address`.
 */
export function useApiBaseUrl(): string {
  const { status } = useStatus()
  const record = (status ?? {}) as Record<string, unknown>
  const legacy = (record.data ?? {}) as Record<string, unknown>

  const apiInfo =
    record.api_info_enabled !== false && Array.isArray(record.api_info)
      ? (record.api_info as Array<{ url?: unknown }>)
      : []
  const candidates = [
    apiInfo[0]?.url,
    record.server_address,
    legacy.server_address,
  ]
  const configured = candidates.find(
    (value): value is string => typeof value === 'string' && !!value.trim()
  )
  const url = configured ?? window.location.origin

  return url.trim().replace(/\/+$/, '').replace(/\/v1$/, '')
}
