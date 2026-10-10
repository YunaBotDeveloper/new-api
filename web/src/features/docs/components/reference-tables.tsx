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
  StaticDataTable,
  staticDataTableClassNames as tableStyles,
} from '@/components/data-table'
import { Badge } from '@/components/ui/badge'

import { DOCS_ENDPOINTS, DOCS_ERRORS } from '../constants'

export function DocsEndpointsTable() {
  const { t } = useTranslation()

  return (
    <StaticDataTable
      className={tableStyles.sectionContainer}
      headerRowClassName={tableStyles.mutedHeaderRow}
      data={[...DOCS_ENDPOINTS]}
      getRowKey={(row) => row.path}
      columns={[
        {
          id: 'method',
          header: t('Method'),
          className: 'h-9 w-24',
          cellClassName: tableStyles.topCell,
          cell: (row) => (
            <Badge variant='secondary' className='font-mono'>
              {row.method}
            </Badge>
          ),
        },
        {
          id: 'path',
          header: t('Path'),
          className: 'h-9 w-56',
          cellClassName: tableStyles.topCell,
          cell: (row) => (
            <code className='font-mono text-sm break-all'>{row.path}</code>
          ),
        },
        {
          id: 'description',
          header: t('Description'),
          className: 'h-9',
          cellClassName: tableStyles.topMutedCell,
          cell: (row) => t(row.descriptionKey),
        },
      ]}
    />
  )
}

export function DocsErrorsTable() {
  const { t } = useTranslation()

  return (
    <StaticDataTable
      className={tableStyles.sectionContainer}
      headerRowClassName={tableStyles.mutedHeaderRow}
      data={[...DOCS_ERRORS]}
      getRowKey={(row) => row.code}
      columns={[
        {
          id: 'code',
          header: t('Status code'),
          className: 'h-9 w-28',
          cellClassName: tableStyles.topCell,
          cell: (row) => (
            <Badge variant='outline' className='font-mono'>
              {row.code}
            </Badge>
          ),
        },
        {
          id: 'description',
          header: t('Meaning'),
          className: 'h-9',
          cellClassName: tableStyles.topMutedCell,
          cell: (row) => t(row.descriptionKey),
        },
      ]}
    />
  )
}
