import NiceModal from '@ebay/nice-modal-react'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useModalController } from '@/providers/use-overlay-controller'
import type { Media } from '@/types/media'

export type MediaPreviewModalProps = {
  media: Media
}

export const MediaPreviewModal = NiceModal.create<MediaPreviewModalProps>(({ media }) => {
  const modal = useModalController()
  const isVideo = media.mimeType.startsWith('video/')
  const isImage = media.mimeType.startsWith('image/')

  return (
    <Dialog open={modal.open} onOpenChange={modal.onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[min(72rem,calc(100vw-3rem))] gap-0 rounded-none bg-transparent p-0 ring-0 sm:max-w-[min(72rem,calc(100vw-8rem))]"
      >
        <DialogTitle className="sr-only">{media.fileName}</DialogTitle>
        <div className="overflow-hidden rounded-xl bg-black shadow-2xl">
          {isVideo ? (
            <video
              controls
              autoPlay
              className="block max-h-[76vh] w-full object-contain"
              poster={media.thumbnailUrl ?? undefined}
            >
              <source src={media.fileUrl} type={media.mimeType} />
            </video>
          ) : isImage ? (
            <img src={media.fileUrl} alt={media.fileName} className="block max-h-[76vh] w-full object-contain" />
          ) : (
            <div className="grid min-h-80 place-items-center px-10 text-sm text-white">Preview is not available.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
})
