import type { CSSProperties, ReactNode } from 'react'

const styles = {
  wrap: {
    textAlign: 'center',
    margin: '26px 0',
  },
  button: {
    display: 'inline-block',
    padding: '13px 22px',
    borderRadius: 7,
    backgroundColor: '#111827',
    color: '#ffffff',
    fontSize: 14,
    lineHeight: '18px',
    fontWeight: 700,
    textDecoration: 'none',
  },
} satisfies Record<string, CSSProperties>

export type EmailButtonProps = {
  href: string
  children: ReactNode
}

export function EmailButton({ href, children }: EmailButtonProps) {
  return (
    <div style={styles.wrap}>
      <a href={href} style={styles.button}>
        {children}
      </a>
    </div>
  )
}
