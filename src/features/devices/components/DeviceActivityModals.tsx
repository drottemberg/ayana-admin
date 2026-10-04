import NiceModal from '@ebay/nice-modal-react'
import { HugeiconsIcon } from '@hugeicons/react'
import Attachment02Icon from '@hugeicons/core-free-icons/Attachment02Icon'
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon'

import { BaseModal } from '@/components/modals/BaseModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AddCommentModalProps, AddInterventionModalProps } from '@/providers/modal-types'
import { useModalController } from '@/providers/use-overlay-controller'

const AddCommentDialog = NiceModal.create<AddCommentModalProps>(() => {
  const modal = useModalController()

  return (
    <BaseModal
      open={modal.open}
      onOpenChange={modal.onOpenChange}
      onClose={() => modal.requestClose(false)}
      title="Add comment"
      okText="Save"
      okButtonProps={{ disabled: true }}
    >
      <div className="grid gap-4">
        <Field label="Title">
          <Input placeholder="Comment title" />
        </Field>

        <Field label="Comment" hint="500 characters max.">
          <textarea
            placeholder="Comment title"
            maxLength={500}
            className="min-h-28 w-full resize-none rounded-[10px] border border-input bg-white px-3.5 py-3 text-sm outline-none placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/35"
          />
        </Field>

        <AttachmentRow />
      </div>
    </BaseModal>
  )
})

const AddInterventionDialog = NiceModal.create<AddInterventionModalProps>(() => {
  const modal = useModalController()

  return (
    <BaseModal
      open={modal.open}
      onOpenChange={modal.onOpenChange}
      onClose={() => modal.requestClose(false)}
      title="Add intervention"
      okText="Save"
      okButtonProps={{ disabled: true }}
      className="sm:max-w-[565px]"
    >
      <div className="grid gap-4">
        <Field label="Report" hint="500 characters max.">
          <textarea
            placeholder="Comment title"
            maxLength={500}
            className="min-h-28 w-full resize-none rounded-[10px] border border-input bg-white px-3.5 py-3 text-sm outline-none placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/35"
          />
        </Field>

        <Field label="Intervention duration">
          <Input placeholder="00:00" />
        </Field>

        <Field label="Intervention duration">
          <div className="grid grid-cols-[1fr_auto_auto] gap-6">
            <Input placeholder="00:00" />
            <Button variant="outline" className="h-11 min-w-24 text-lg font-semibold">
              +5:00
            </Button>
            <Button variant="outline" className="h-11 min-w-24 text-lg font-semibold">
              -5:00
            </Button>
          </div>
        </Field>

        <AttachmentRow />
      </div>
    </BaseModal>
  )
})

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-sm font-semibold">{label}</Label>
      {children}
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function AttachmentRow() {
  return (
    <div className="grid gap-4 pt-2">
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4">
        <div className="text-base font-semibold">File name.jpg</div>
        <div className="text-sm text-muted-foreground">5 Mo</div>
        <Button variant="outline" size="icon-sm" aria-label="Remove file" className="text-red-500 hover:text-red-500">
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
        </Button>
      </div>

      <Button variant="outline" className="mx-auto h-9 px-4">
        Attach file
        <HugeiconsIcon icon={Attachment02Icon} strokeWidth={2} data-icon="inline-end" />
      </Button>
    </div>
  )
}

export { AddCommentDialog, AddInterventionDialog }
