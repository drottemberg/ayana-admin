import type { CSSProperties, ReactNode } from 'react'

const styles = {
  paragraph: {
    margin: 0,
    color: '#2b2b2f',
    fontSize: 15,
    lineHeight: '24px',
  },
  strong: {
    fontWeight: 700,
  },
  helper: {
    margin: 0,
    color: '#666666',
    fontSize: 13,
    lineHeight: '18px',
  },
  link: {
    color: '#788902',
    textDecoration: 'underline',
  },
} satisfies Record<string, CSSProperties>

export function EmailParagraph({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <p style={{ ...styles.paragraph, ...style }}>{children}</p>
}

export function EmailHelperText({ children }: { children: ReactNode }) {
  return <p style={styles.helper}>{children}</p>
}

export function EmailLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} style={styles.link}>
      {children}
    </a>
  )
}
