import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  value: string
  onChange: (value: string) => void
  maxLength: number
}

export function CampaignMessageEditor({ value, onChange, maxLength }: Props) {
  const [linkEditorOpen, setLinkEditorOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const lastEditorMarkdown = useRef(value)
  const savedSelection = useRef<{ from: number; to: number } | null>(null)
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: value,
    contentType: 'markdown',
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => {
      const markdown = current.getMarkdown()
      lastEditorMarkdown.current = markdown
      onChange(markdown)
    },
    editorProps: {
      attributes: {
        name: 'campaignMessage',
        autocomplete: 'off',
        'data-1p-ignore': 'true',
        'data-lpignore': 'true',
        class: 'min-h-36 w-full px-3 py-2 text-sm outline-none [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic',
      },
    },
  })

  const selectionState = useEditorState({
    editor,
    selector: ({ editor: current }) => current ? ({
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      strike: current.isActive('strike'),
      link: current.isActive('link'),
      bulletList: current.isActive('bulletList'),
      orderedList: current.isActive('orderedList'),
    }) : null,
  })

  useEffect(() => {
    if (!editor) return
    if (value === lastEditorMarkdown.current || editor.getMarkdown() === value) {
      lastEditorMarkdown.current = value
      return
    }
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false })
    lastEditorMarkdown.current = value
  }, [editor, value])

  if (!editor) return <div className="min-h-36 rounded-b-lg border border-input px-3 py-2 text-sm text-muted-foreground">Loading editor…</div>

  const tools = [
    { label: 'Bold', run: () => editor.chain().focus().toggleBold().run(), active: selectionState?.bold ?? false },
    { label: 'Italic', run: () => editor.chain().focus().toggleItalic().run(), active: selectionState?.italic ?? false },
    { label: 'Strikethrough', run: () => editor.chain().focus().toggleStrike().run(), active: selectionState?.strike ?? false },
    { label: 'Link', run: () => {
      const { from, to } = editor.state.selection
      savedSelection.current = { from, to }
      setLinkUrl(String(editor.getAttributes('link').href ?? ''))
      setLinkEditorOpen((open) => !open)
    }, active: selectionState?.link ?? false },
    { label: 'Bulleted list', run: () => editor.chain().focus().toggleBulletList().run(), active: selectionState?.bulletList ?? false },
    { label: 'Numbered list', run: () => editor.chain().focus().toggleOrderedList().run(), active: selectionState?.orderedList ?? false },
  ]

  const applyLink = () => {
    const input = linkUrl.trim()
    const href = /^https?:\/\//i.test(input) ? input : `https://${input}`
    try {
      const parsed = new URL(href)
      if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return
    } catch {
      return
    }

    const selection = savedSelection.current ?? editor.state.selection
    const chain = editor.chain().focus().setTextSelection(selection)
    if (selection.from === selection.to && !editor.isActive('link')) {
      chain.insertContent({
        type: 'text',
        text: href,
        marks: [{ type: 'link', attrs: { href } }],
      }).run()
    } else {
      chain.extendMarkRange('link').setLink({ href }).run()
    }
    savedSelection.current = null
    setLinkUrl(href)
    setLinkEditorOpen(false)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1 rounded-t-md border border-b-0 border-input bg-muted/40 p-1">
        {tools.map((tool) => (
          <Button
            key={tool.label}
            type="button"
            variant={tool.active ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2 text-xs"
            aria-label={tool.label}
            aria-pressed={tool.active}
            onMouseDown={(event) => {
              event.preventDefault()
              tool.run()
            }}
            onClick={(event) => {
              // Preserve keyboard activation without running the command twice for a pointer click.
              if (event.detail === 0) tool.run()
            }}
          >{tool.label}</Button>
        ))}
      </div>
      {linkEditorOpen ? (
        <div className="flex flex-wrap items-center gap-2 border-x border-input bg-background p-2">
          <Input
            type="url"
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://example.com"
            aria-label="Hyperlink URL"
            className="min-w-48 flex-1"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                applyLink()
              }
              if (event.key === 'Escape') setLinkEditorOpen(false)
            }}
          />
          <Button type="button" size="sm" onMouseDown={(event) => event.preventDefault()} onClick={applyLink}>Apply link</Button>
          {selectionState?.link ? (
            <Button type="button" size="sm" variant="outline" onMouseDown={(event) => event.preventDefault()} onClick={() => {
              editor.chain().focus().extendMarkRange('link').unsetLink().run()
              setLinkEditorOpen(false)
            }}>Remove link</Button>
          ) : null}
        </div>
      ) : null}
      <div className="max-h-80 overflow-y-auto rounded-b-md border border-input bg-background">
        <EditorContent editor={editor} />
      </div>
      <p className="mt-1 text-xs font-normal text-muted-foreground">Rich formatting is converted to Markdown for WhatsApp, Telegram and email. Maximum {maxLength} characters.</p>
    </div>
  )
}
