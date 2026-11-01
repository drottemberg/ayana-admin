import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { beautifyCatalogImageRequest } from '@/features/products/api'

async function compressCatalogImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const maximumDimension = 1600
  const scale = Math.min(1, maximumDimension / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('Could not prepare this image for upload.')
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const compressed = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not compress this image.')), 'image/webp', 0.82)
  })
  const name = file.name.replace(/\.[^.]+$/, '') || 'catalog-image'
  return new File([compressed], `${name}.webp`, { type: 'image/webp', lastModified: Date.now() })
}

type ImageAiMode = 'edit' | 'generate'

export function CatalogImageEditor({
  label,
  imageUrl,
  attachmentId,
  customerId,
  emptyIcon,
  disabled = false,
  uploading,
  onUpload,
}: {
  label: string
  imageUrl: string
  attachmentId: string
  customerId: string
  emptyIcon: string
  disabled?: boolean
  uploading: boolean
  onUpload: (file: File) => Promise<boolean>
}) {
  const [useAi, setUseAi] = useState(false)
  const [mode, setMode] = useState<ImageAiMode>(imageUrl && attachmentId ? 'edit' : 'generate')
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [prompt, setPrompt] = useState('Premium AYANA catalog photo, warm cream background, soft natural studio lighting, landscape composition. No text or logos.')
  const [generating, setGenerating] = useState(false)

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  useEffect(() => {
    setMode(imageUrl && attachmentId ? 'edit' : 'generate')
    setSourceFile(null)
    setPreviewFile(null)
    setPreviewUrl('')
  }, [attachmentId, imageUrl])

  const clearPreview = () => {
    setSourceFile(null)
    setPreviewFile(null)
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return ''
    })
  }

  const restoreOriginal = () => {
    if (!sourceFile) {
      clearPreview()
      return
    }
    setPreviewFile(sourceFile)
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return URL.createObjectURL(sourceFile)
    })
  }

  const chooseFile = async (file?: File) => {
    if (!file) return
    clearPreview()
    setMode('edit')
    setSourceFile(file)
    setPreviewFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const generate = async () => {
    if (!prompt.trim() || (mode === 'edit' && !sourceFile && (!imageUrl || !attachmentId))) return
    setGenerating(true)
    try {
      const generated = await beautifyCatalogImageRequest({
        mode,
        prompt: prompt.trim(),
        customerId,
        ...(mode === 'edit' && sourceFile ? { file: await compressCatalogImage(sourceFile) } : {}),
        ...(mode === 'edit' && !sourceFile ? { attachmentId } : {}),
      })
      const bytes = Uint8Array.from(atob(generated.imageBase64), (character) => character.charCodeAt(0))
      const file = new File([bytes], 'ayana-catalog-image.webp', { type: generated.mimeType })
      const nextUrl = URL.createObjectURL(file)
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return nextUrl
      })
      setPreviewFile(file)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not generate an image preview.')
    } finally {
      setGenerating(false)
    }
  }

  const savePreview = async () => {
    if (!previewFile) return
    try {
      if (!(await onUpload(await compressCatalogImage(previewFile)))) return
      clearPreview()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not compress this image.')
    }
  }

  const displayedImage = previewUrl || imageUrl
  const busy = disabled || uploading || generating

  return (
    <div className="grid content-start gap-3 rounded-xl border p-4">
      <div className="grid gap-3">
        <div className="grid aspect-[16/9] max-h-[28rem] min-h-48 w-full place-items-center overflow-hidden rounded-lg bg-muted text-6xl">
          {displayedImage ? <img src={displayedImage} alt={`${label} preview`} className="size-full object-contain" /> : emptyIcon}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold">{label}</span>
          {previewFile ? <span className="text-xs font-medium text-primary">Preview — not saved yet</span> : null}
          <label className={`inline-flex min-h-10 cursor-pointer items-center rounded-md border px-3 text-sm hover:bg-muted ${busy ? 'pointer-events-none opacity-50' : ''}`}>
            {imageUrl || previewFile ? 'Choose / replace image' : 'Choose image'}
            <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy} onChange={(event) => { void chooseFile(event.target.files?.[0]); event.currentTarget.value = '' }} />
          </label>
        </div>
      </div>
      {previewFile ? <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => void savePreview()}>
          {uploading ? 'Saving…' : 'Save image'}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={sourceFile && previewFile !== sourceFile ? restoreOriginal : clearPreview}>
          {sourceFile && previewFile !== sourceFile ? 'Restore original image' : 'Discard preview'}
        </Button>
      </div> : null}
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input type="checkbox" checked={useAi} disabled={busy} onChange={(event) => setUseAi(event.target.checked)} />
        Use AI to create or improve this photo
      </label>
      {useAi ? <>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="AI image source">
          <Button type="button" variant={mode === 'edit' ? 'default' : 'outline'} disabled={(!sourceFile && (!imageUrl || !attachmentId)) || busy} aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}>
            Use existing photo
          </Button>
          <Button type="button" variant={mode === 'generate' ? 'default' : 'outline'} disabled={busy} aria-pressed={mode === 'generate'} onClick={() => setMode('generate')}>
            Create from prompt
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {mode === 'edit'
            ? `AI will use the ${sourceFile ? 'selected' : 'saved'} photo as its source. Your current photo stays unchanged until you save the preview.`
            : 'AI will create a new image from your prompt only. No source photo is needed.'}
        </p>
        <label className="grid gap-1.5 text-sm font-medium">
          Prompt
          <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={3} maxLength={1200} />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={!prompt.trim() || (mode === 'edit' && !sourceFile && !attachmentId) || generating || uploading || disabled} onClick={() => void generate()}>
            {generating ? 'Generating preview…' : previewFile ? 'Regenerate preview' : 'Generate preview'}
          </Button>
        </div>
      </> : null}
    </div>
  )
}
