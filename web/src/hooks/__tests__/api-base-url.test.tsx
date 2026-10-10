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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useApiBaseUrl } from '../use-api-base-url'

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function baseUrlFor(status: Record<string, unknown>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], status)
  function Wrapper(props: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        {props.children}
      </QueryClientProvider>
    )
  }
  return renderHook(() => useApiBaseUrl(), { wrapper: Wrapper }).result.current
}

describe('useApiBaseUrl', () => {
  it('uses the first API address and strips the /v1 suffix when api_info is set', () => {
    expect(
      baseUrlFor({
        api_info_enabled: true,
        api_info: [{ url: 'https://api.example.com/v1/' }],
        server_address: 'https://console.example.com',
      })
    ).toBe('https://api.example.com')
  })

  it('falls back to server_address when the API address panel is disabled', () => {
    expect(
      baseUrlFor({
        api_info_enabled: false,
        api_info: [{ url: 'https://api.example.com/v1' }],
        server_address: 'https://console.example.com/',
      })
    ).toBe('https://console.example.com')
  })

  it('falls back to the current origin when nothing is configured', () => {
    expect(baseUrlFor({ api_info: [], server_address: '' })).toBe(
      window.location.origin
    )
  })
})
