import NiceModal from '@ebay/nice-modal-react'
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { AppDrawer } from '@/components/app/AppDrawer'
import { FormError } from '@/components/form-error'
import { Button } from '@/components/ui/button'
import { FileInput } from '@/components/ui/file-input'
import {
  deleteDeviceTypeDocumentationRequest,
  getDeviceTypeDocumentationRequest,
  uploadDeviceTypeDocumentationRequest,
  type DeviceTypeAttachment,
  type DeviceTypeConfig,
} from '@/features/device-types/api'
import { deviceTypeConfigsQueryKeys } from '@/features/device-types/query-keys'
import { getDeviceTypeLabel } from '@/features/device-types/utils'
import { useDrawerController } from '@/providers/use-overlay-controller'
import { Modals } from '@/providers/modal'
import { FileUtils } from '@/utils'
import { NO_VALUE_STR } from '@/constants'

export type DeviceTypeDocumentationDrawerProps = {
  config: DeviceTypeConfig
}

function formatAttachmentSize(size?: DeviceTypeAttachment['size']) {
  const parsedSize = typeof size === 'string' ? Number(size) : size
  return typeof parsedSize === 'number' && Number.isFinite(parsedSize)
    ? FileUtils.displayFileSize(parsedSize / 1024)
    : NO_VALUE_STR
}

export const DeviceTypeDocumentationDrawer = NiceModal.create<DeviceTypeDocumentationDrawerProps>(({ config }) => {
  const [files, setFiles] = useState<File[]>([])
  const queryClient = useQueryClient()
  const drawer = useDrawerController()
  const queryKey = [...deviceTypeConfigsQueryKeys.detail(config.id), 'documentation'] as const
  const documentationQuery = useQuery({
    queryKey,
    queryFn: () => getDeviceTypeDocumentationRequest(config.id),
  })
  const invalidateDocumentationViews = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: deviceTypeConfigsQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: deviceTypeConfigsQueryKeys.detail(config.id) }),
      config.groupId
        ? queryClient.invalidateQueries({ queryKey: deviceTypeConfigsQueryKeys.groupDetail(config.groupId) })
        : Promise.resolve(),
    ])
  }
  const uploadMutation = useMutation({
    mutationFn: () => uploadDeviceTypeDocumentationRequest(config.id, files),
    onSuccess: async () => {
      setFiles([])
      await invalidateDocumentationViews()
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) => deleteDeviceTypeDocumentationRequest(config.id, attachmentId),
    onSuccess: invalidateDocumentationViews,
  })
  const error =
    uploadMutation.error instanceof Error
      ? uploadMutation.error.message
      : deleteMutation.error instanceof Error
        ? deleteMutation.error.message
        : undefined
  const isSaving = uploadMutation.isPending
  const isDeleting = deleteMutation.isPending
  const title = `${config.name || getDeviceTypeLabel(config.code)} Documentations.`
  const attachments = documentationQuery.data ?? []

  const handleDelete = async (attachment: DeviceTypeAttachment) => {
    const confirmed = await Modals.confirm({
      title: `Delete ${attachment.name || 'documentation'}?`,
      content: 'This will remove the attachment and delete the file from the cloud.',
      okText: 'Delete',
      cancelText: 'Cancel',
      okButtonProps: { variant: 'destructive' },
    })
    if (!confirmed) return

    await deleteMutation.mutateAsync(attachment.id)
  }

  return (
    <AppDrawer title={title} open={drawer.open} onOpenChange={drawer.onOpenChange} contentClassName="sm:max-w-2xl">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-7 py-2">
          <FileInput
            label="Upload documentations"
            value={files}
            multiple
            maxSizeMb={50}
            onValueChange={setFiles}
            disabled={isSaving}
          />

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Current documentations</h3>
            <div className="flex flex-col gap-2">
              {documentationQuery.isLoading ? (
                <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                  Loading documentations...
                </div>
              ) : attachments.length ? (
                attachments.map((attachment) => (
                  <div key={attachment.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                    <div className="min-w-0">
                      {attachment.url ? (
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-md block font-medium break-words text-foreground underline-offset-2 hover:underline"
                        >
                          {attachment.name || NO_VALUE_STR}
                        </a>
                      ) : (
                        <span className="text-md block font-medium break-words text-foreground">
                          {attachment.name || NO_VALUE_STR}
                        </span>
                      )}
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {formatAttachmentSize(attachment.size)}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-md"
                        aria-label={`Delete ${attachment.name || 'documentation'}`}
                        onClick={() => void handleDelete(attachment)}
                        disabled={isDeleting}
                      >
                        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                  No documentations yet.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="mt-auto flex flex-col gap-3 border-t px-7 py-6">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="lg" onClick={() => drawer.requestClose(false)} disabled={isSaving}>
              Close
            </Button>
            <Button
              size="lg"
              loading={isSaving}
              disabled={!files.length || isSaving}
              onClick={() => uploadMutation.mutate()}
            >
              Upload
            </Button>
          </div>
          <FormError message={error} />
        </div>
      </div>
    </AppDrawer>
  )
})
