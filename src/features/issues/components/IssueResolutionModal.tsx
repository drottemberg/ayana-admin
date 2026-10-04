import { useState } from 'react'
import NiceModal from '@ebay/nice-modal-react'
import { HugeiconsIcon } from '@hugeicons/react'
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon'
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon'
import HelpCircleIcon from '@hugeicons/core-free-icons/HelpCircleIcon'

import { BaseModal } from '@/components/modals/BaseModal'
import { Button } from '@/components/ui/button'
import { IssueService } from '@/features/issues/issue-service'
import type { IssueResolutionModalProps } from '@/providers/modal-types'
import { useModalController } from '@/providers/use-overlay-controller'

const IssueResolutionModal = NiceModal.create<IssueResolutionModalProps>(({ issue }) => {
  const modal = useModalController()
  const [stepIndex, setStepIndex] = useState(0)
  const steps = issue.resolutionGuide?.steps ?? []
  const step = steps[stepIndex]
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === steps.length - 1

  const handleDone = async () => {
    await IssueService.markAsResolved([issue])
    await modal.forceClose(true)
  }

  return (
    <BaseModal
      open={modal.open}
      onOpenChange={modal.onOpenChange}
      onClose={() => modal.requestClose(false)}
      className="overflow-hidden p-0 sm:max-w-[650px]"
      showHeader={false}
      bodyClassName="p-0"
    >
      <div className="grid min-h-[420px] min-w-0 grid-rows-[auto_1fr_auto]">
        <div className="border-b border-transparent p-5 pr-14 pb-2">
          <div className="flex min-w-0 items-start gap-2 text-sm leading-5 font-semibold">
            <HugeiconsIcon icon={HelpCircleIcon} strokeWidth={2} className="size-4 shrink-0" />
            <span className="min-w-0 break-words whitespace-normal">{issue.resolutionGuide?.title ?? issue.title}</span>
          </div>
        </div>

        <div className="relative grid min-w-0 content-center justify-items-center gap-5 overflow-hidden px-6 py-4">
          <div className="absolute top-3 right-12 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-sm">
            {stepIndex + 1}
          </div>
          {step?.imageUrl ? (
            <img src={step.imageUrl} alt="" className="max-h-60 max-w-full object-contain" />
          ) : (
            <div className="h-60 w-full max-w-80" />
          )}
          <p className="w-full max-w-[520px] break-words text-center text-sm text-foreground">
            {step?.description ?? issue.title}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 p-5 pt-2">
          {
            !isFirstStep ? (
              <Button variant="outline" onClick={() => setStepIndex((current) => current - 1)}>
                <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} data-icon="inline-start" />
                Previous
              </Button>
            ) : <div></div>
          }

          {isLastStep ? (
            <Button onClick={handleDone}>Done</Button>
          ) : (
            <Button variant="outline" onClick={() => setStepIndex((current) => current + 1)}>
              Next
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" />
            </Button>
          )}
        </div>
      </div>
    </BaseModal>
  )
})

export { IssueResolutionModal }
