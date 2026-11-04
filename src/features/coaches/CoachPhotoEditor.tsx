import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

async function compressPhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const maximumDimension = 1200
  const scale = Math.min(1, maximumDimension / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('Could not prepare this photo for upload.')
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Could not compress this photo.')), 'image/webp', 0.82)
  })
  const name = file.name.replace(/\.[^.]+$/, '') || 'coach-photo'
  return new File([blob], `${name}.webp`, { type: 'image/webp', lastModified: Date.now() })
}

export function CoachPhotoEditor({
  imageUrl,
  disabled = false,
  uploading,
  onUpload,
  onRemove,
}: {
  imageUrl: string | null
  disabled?: boolean
  uploading: boolean
  onUpload: (file: File) => Promise<boolean>
  onRemove: () => Promise<void>
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const previewUrl = useMemo(() => selectedFile ? URL.createObjectURL(selectedFile) : null, [selectedFile])
  const busy = disabled || uploading

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const save = async () => {
    if (!selectedFile) return
    try {
      if (await onUpload(await compressPhoto(selectedFile))) setSelectedFile(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not prepare this photo.')
    }
  }

  return (
    <section className="space-y-3 rounded-xl border p-4">
      <div>
        <h3 className="text-sm font-semibold">Coach photo</h3>
        <p className="mt-1 text-xs text-muted-foreground">Choose a photo, review it, then save. It is compressed to WebP before upload.</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid size-28 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-3xl text-muted-foreground">
          {previewUrl || imageUrl
            ? <img src={previewUrl || imageUrl || ''} alt="Coach profile preview" className="size-full object-cover" />
            : <span aria-hidden="true">👤</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className={`inline-flex min-h-9 cursor-pointer items-center rounded-md border px-3 text-sm hover:bg-muted ${busy ? 'pointer-events-none opacity-50' : ''}`}>
            {imageUrl || selectedFile ? 'Choose / replace photo' : 'Choose photo'}
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              disabled={busy}
              onChange={(event) => {
                setSelectedFile(event.currentTarget.files?.[0] ?? null)
                event.currentTarget.value = ''
              }}
            />
          </label>
          {selectedFile ? <>
            <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>
              {uploading ? 'Saving…' : 'Save photo'}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setSelectedFile(null)}>
              Discard
            </Button>
          </> : null}
          {imageUrl && !selectedFile ? (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void onRemove()}>
              Remove photo
            </Button>
          ) : null}
        </div>
      </div>
      {selectedFile ? <p className="text-xs text-muted-foreground">Preview — not saved yet</p> : null}
    </section>
  )
}
