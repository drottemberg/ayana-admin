import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useConnect } from '@/features/app/use-connect'
import { getAppMode } from '@/features/app/app-mode'
import { StaffRole } from '@/types/membership'
import { getPlatformSettingsRequest, updatePlatformSettingsRequest } from '@/features/platform-settings/api'

const queryKey = ['platform-settings']

export default function PlatformSettingsPage() {
  const { session, isLoading: connectLoading } = useConnect()
  const queryClient = useQueryClient()
  const allowed = getAppMode() === 'admin' && Boolean(session?.user.isStaff) &&
    (session?.user.staffRole === StaffRole.ADMIN || session?.user.staffRole === StaffRole.SUPER_ADMIN)
  const settingsQuery = useQuery({ queryKey, queryFn: getPlatformSettingsRequest, enabled: allowed })
  const updateMutation = useMutation({
    mutationFn: updatePlatformSettingsRequest,
    onSuccess: async (settings) => {
      queryClient.setQueryData(queryKey, settings)
      toast.success('System settings saved.')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not save system settings.'),
  })

  if (connectLoading) return <PageHeader title="System settings" subtitle="Loading…" />
  if (!allowed) return <Navigate to="/" replace />

  return (
    <div className="space-y-6">
      <PageHeader title="System settings" subtitle="Platform-wide notification behavior." />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Transactional notifications</CardTitle>
          <CardDescription>Choose which channels receive transactional messages across customers.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-start justify-between gap-6">
          <div className="space-y-1">
            <p className="text-base font-medium">WhatsApp notifications</p>
            <p className="text-sm text-muted-foreground">Send transactional WhatsApp messages when the recipient’s 24-hour service window is open.</p>
          </div>
          <Button
            type="button"
            variant={settingsQuery.data?.whatsappNotificationsEnabled ? 'default' : 'outline'}
            disabled={settingsQuery.isLoading || settingsQuery.isError || updateMutation.isPending}
            aria-pressed={settingsQuery.data?.whatsappNotificationsEnabled ?? false}
            onClick={() => updateMutation.mutate({ whatsappNotificationsEnabled: !settingsQuery.data?.whatsappNotificationsEnabled })}
          >
            {settingsQuery.data?.whatsappNotificationsEnabled ? 'Enabled' : 'Disabled'}
          </Button>
        </CardContent>
        {settingsQuery.isError ? <p className="px-6 pb-6 text-sm text-destructive">Could not load system settings.</p> : null}
      </Card>
    </div>
  )
}
