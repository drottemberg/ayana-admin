import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { NO_VALUE_STR } from '@/constants'
import type { CoachProfile } from './types'

export const coachColumns: ColumnDef<CoachProfile>[] = [
  {
    accessorKey: 'coachName',
    header: 'Coach',
    cell: ({ row }) => <Link className="font-medium underline-offset-2 hover:underline" to={`/coaches/${row.original.customerId}/${row.original.userId}`}>{row.original.coachName || row.original.email || 'Instructor'}</Link>,
  },
  { accessorKey: 'email', header: 'Email', cell: ({ row }) => row.original.email || NO_VALUE_STR },
  {
    accessorKey: 'locationScope',
    header: 'Locations',
    cell: ({ row }) => row.original.locationScope === 'ALL'
      ? 'All locations'
      : row.original.locations.length
        ? row.original.locations.map((location) => location.name).join(', ')
        : 'No locations assigned',
  },
  {
    id: 'classTypes',
    header: 'Class types',
    cell: ({ row }) => row.original.classTypes.length
      ? row.original.classTypes.map((classType) => classType.name).join(', ')
      : NO_VALUE_STR,
  },
  { accessorKey: 'languages', header: 'Languages taught', cell: ({ row }) => row.original.languages.join(', ') || NO_VALUE_STR },
]
