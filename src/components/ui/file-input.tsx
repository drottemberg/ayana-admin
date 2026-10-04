import { useId, useMemo, useRef, useState } from 'react'
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon'
import Upload04Icon from '@hugeicons/core-free-icons/Upload04Icon'
import { HugeiconsIcon } from '@hugeicons/react'

import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

type FileInputMode = 'dropzone' | 'button'

type FileInputProps = {
  label?: string
  value?: File[]
  onValueChange?: (files: File[]) => void
  formats?: string[]
  maxSizeMb?: number
  multiple?: boolean
  mode?: FileInputMode
  isLoading?: boolean
  disabled?: boolean
  required?: boolean
  error?: string
  className?: string
  inputName?: string
  onBlur?: () => void
  title?: string
  description?: string
  buttonLabel?: string
}

function formatFileSize(sizeInBytes: number) {
  const units = ['KB', 'MB', 'GB'] as const
  let size = sizeInBytes / 1024
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: size < 10 ? 1 : 0 }).format(size)} ${units[unitIndex]}`
}

function getAcceptedTokens(accept?: string) {
  return accept
    ?.split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
}

function normalizeFormat(format: string) {
  const trimmedFormat = format.trim()

  if (!trimmedFormat) return ''
  if (trimmedFormat.includes('/') || trimmedFormat.startsWith('.')) return trimmedFormat

  return `.${trimmedFormat}`
}

function isAcceptedFile(file: File, acceptedTokens?: string[]) {
  if (!acceptedTokens?.length) return true

  const fileName = file.name.toLowerCase()
  const fileType = file.type.toLowerCase()

  return acceptedTokens.some((token) => {
    if (token.endsWith('/*')) return fileType.startsWith(token.slice(0, -1))
    if (token.startsWith('.')) return fileName.endsWith(token)
    return fileType === token
  })
}

function FileItem({ file, onRemove, disabled }: { file: File; onRemove: () => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4">
      <span className="text-md truncate font-medium text-foreground">{file.name}</span>
      <span className="text-sm text-muted-foreground">{formatFileSize(file.size)}</span>
      <Button
        type="button"
        variant="outline"
        size="icon-md"
        aria-label={`Remove ${file.name}`}
        onClick={onRemove}
        disabled={disabled}
      >
        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
      </Button>
    </div>
  )
}

function FileInput({
  label,
  value = [],
  onValueChange,
  formats = [],
  maxSizeMb,
  multiple = false,
  mode = 'dropzone',
  isLoading = false,
  disabled = false,
  required = false,
  error,
  className,
  inputName,
  onBlur,
  title,
  description = 'Drag and drop',
  buttonLabel = 'Browse computer',
}: FileInputProps) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [validationError, setValidationError] = useState<string>()
  const normalizedFormats = useMemo(() => formats.map(normalizeFormat).filter(Boolean), [formats])
  const accept = useMemo(() => normalizedFormats.join(','), [normalizedFormats])
  const formatsLabel = useMemo(() => normalizedFormats.join(' / '), [normalizedFormats])
  const acceptedTokens = useMemo(() => getAcceptedTokens(accept), [accept])
  const currentError = error ?? validationError
  const hasFiles = value.length > 0

  const setFiles = (files: FileList | File[]) => {
    const incomingFiles = Array.from(files)
    const maxSizeBytes = maxSizeMb ? maxSizeMb * 1024 * 1024 : undefined
    const validFiles = incomingFiles.filter((file) => {
      if (!isAcceptedFile(file, acceptedTokens)) return false
      if (maxSizeBytes && file.size > maxSizeBytes) return false
      return true
    })

    if (validFiles.length !== incomingFiles.length) {
      setValidationError(`Some files were skipped. Check format${maxSizeMb ? ` and ${maxSizeMb}MB limit` : ''}.`)
    } else {
      setValidationError(undefined)
    }

    if (!validFiles.length) return

    onValueChange?.(multiple ? [...value, ...validFiles] : [validFiles[0]])
    if (inputRef.current) inputRef.current.value = ''
  }

  const validateRequired = () => {
    if (required && !value.length) {
      setValidationError('File is required.')
    }

    onBlur?.()
  }

  const removeFile = (fileIndex: number) => {
    const nextFiles = value.filter((_, index) => index !== fileIndex)

    setValidationError(required && !nextFiles.length ? 'File is required.' : undefined)
    onValueChange?.(nextFiles)
  }

  const openPicker = () => {
    if (!disabled && !isLoading) inputRef.current?.click()
  }

  const input = (
    <input
      ref={inputRef}
      id={id}
      name={inputName}
      className="sr-only"
      type="file"
      accept={accept}
      multiple={multiple}
      required={required}
      aria-invalid={!!currentError}
      disabled={disabled || isLoading}
      onChange={(event) => event.target.files && setFiles(event.target.files)}
      onBlur={validateRequired}
    />
  )

  if (hasFiles) {
    return (
      <Field className={className}>
        {label ? <FieldLabel required={required}>{label}</FieldLabel> : null}
        {input}
        <div className="mb-2 flex flex-col gap-2">
          {value.map((file, index) => (
            <FileItem
              key={`${file.name}-${file.lastModified}-${index}`}
              file={file}
              onRemove={() => removeFile(index)}
              disabled={disabled || isLoading}
            />
          ))}
        </div>
        {multiple ? (
          <div>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-auto"
              onClick={openPicker}
              disabled={disabled || isLoading}
            >
              {buttonLabel}
            </Button>
          </div>
        ) : null}
        <FieldError>{currentError}</FieldError>
      </Field>
    )
  }

  return (
    <Field orientation="vertical" className={className}>
      {label ? (
        <FieldLabel htmlFor={id} required={required}>
          {label}
        </FieldLabel>
      ) : null}
      {input}
      {mode === 'button' ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-fit"
          onClick={openPicker}
          disabled={disabled || isLoading}
        >
          {buttonLabel}
        </Button>
      ) : (
        <div
          role="button"
          tabIndex={disabled || isLoading ? -1 : 0}
          aria-disabled={disabled || isLoading}
          aria-invalid={!!currentError}
          className={cn(
            'flex min-h-30 cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border p-4 text-center transition-colors',
            'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            currentError && 'border-destructive',
            isDragging && 'border-primary bg-muted/60',
            (disabled || isLoading) && 'cursor-not-allowed opacity-60',
          )}
          onClick={openPicker}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              openPicker()
            }
          }}
          onDragEnter={(event) => {
            event.preventDefault()
            if (!disabled && !isLoading) setIsDragging(true)
          }}
          onDragOver={(event) => {
            event.preventDefault()
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            if (event.currentTarget === event.target) setIsDragging(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragging(false)
            if (!disabled && !isLoading) setFiles(event.dataTransfer.files)
          }}
          onBlur={validateRequired}
        >
          {isLoading ? (
            <>
              <Spinner className="size-10 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </>
          ) : (
            <>
              <HugeiconsIcon icon={Upload04Icon} strokeWidth={1.8} className="size-9 text-muted-foreground/50" />
              <div className="flex flex-col items-center gap-1">
                {title ? <span className="font-semibold text-foreground">{title}</span> : null}
                {description ? <span className="font-semibold text-muted-foreground/60">{description}</span> : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="lg"
                tabIndex={-1}
                disabled={disabled || isLoading}
                onClick={(event) => {
                  event.stopPropagation()
                  openPicker()
                }}
              >
                {buttonLabel}
              </Button>
            </>
          )}
        </div>
      )}
      <FieldError>{currentError}</FieldError>
      {formatsLabel || maxSizeMb ? (
        <p className="text-sm text-muted-foreground">
          {formatsLabel}
          {formatsLabel && maxSizeMb ? <br /> : null}
          {maxSizeMb ? `${maxSizeMb}MB max.` : null}
        </p>
      ) : null}
    </Field>
  )
}

export { FileInput }
export type { FileInputMode, FileInputProps }
