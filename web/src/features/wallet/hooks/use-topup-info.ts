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
import { useState, useEffect, useCallback } from 'react'

import { handleServerError } from '@/lib/handle-server-error'

import { getTopupInfo } from '../api'
import type { TopupInfo } from '../types'

// ============================================================================
// Topup Info Hook
// ============================================================================

export function useTopupInfo() {
  const [topupInfo, setTopupInfo] = useState<TopupInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchTopupInfo = useCallback(async () => {
    try {
      setLoading(true)

      const response = await getTopupInfo()

      if (!response.success || !response.data) {
        handleServerError(response)
        return
      }

      setTopupInfo(response.data)
    } catch (err) {
      handleServerError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    queueMicrotask(() => {
      if (!cancelled) void fetchTopupInfo()
    })

    return () => {
      cancelled = true
    }
  }, [fetchTopupInfo])

  return {
    topupInfo,
    loading,
    refetch: fetchTopupInfo,
  }
}
