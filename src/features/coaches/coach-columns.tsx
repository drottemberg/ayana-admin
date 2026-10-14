import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { NO_VALUE_STR } from '@/constants'
import type { CoachProfile } from './types'

export const coachColumns: ColumnDef<CoachProfile>[] = [
  {
    accessorKey: 'coachName',
    header: 'Instructor',
    cell: ({ row }) => <Link className="font-medium underline-offset-2 hover:underline" to={`/users/${row.original.userId}`}>{row.original.coachName || row.original.userId}</Link>,
  },
  { accessorKey: 'userId', header: 'User ID', cell: ({ row }) => <Link className="font-mono text-xs underline-offset-2 hover:underline" to={`/users/${row.original.userId}`}>{row.original.userId}</Link> },
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
  { accessorKey: 'specialties', header: 'Specialties', cell: ({ row }) => row.original.specialties.join(', ') || NO_VALUE_STR },
]
