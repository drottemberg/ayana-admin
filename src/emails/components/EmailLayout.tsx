import type { CSSProperties, ReactNode } from 'react'

const colors = {
  background: '#f2f2f2',
  surface: '#ffffff',
  text: '#2b2b2f',
  muted: '#767676',
  border: '#dedede',
  button: '#111827',
  link: '#788902',
  footer: '#000000',
}

const styles = {
  page: {
    margin: 0,
    backgroundColor: colors.background,
    color: colors.text,
    fontFamily: "'DM Sans', Arial, Helvetica, sans-serif",
  },
  container: {
    width: '100%',
    maxWidth: 640,
    margin: '0 auto',
    backgroundColor: colors.surface,
  },
  browserLink: {
    padding: '20px 32px 10px',
    textAlign: 'center',
    color: colors.muted,
    fontSize: 11,
    lineHeight: '16px',
  },
  body: {
    padding: '24px 36px 40px',
  },
  logo: {
    margin: '0 0 40px',
    color: '#1d1d22',
    fontSize: 34,
    lineHeight: '40px',
    fontWeight: 700,
    letterSpacing: '-1px',
  },
  divider: {
    height: 1,
    margin: '34px 0 34px',
    backgroundColor: colors.border,
  },
  safetyText: {
    margin: 0,
    color: colors.muted,
    fontSize: 13,
    lineHeight: '18px',
  },
  footer: {
    padding: '30px 28px 32px',
    textAlign: 'center',
    backgroundColor: colors.footer,
    color: '#ffffff',
  },
  footerLogo: {
    margin: '0 0 14px',
    fontSize: 20,
    lineHeight: '24px',
    fontWeight: 700,
  },
  footerLinks: {
    margin: '0 0 14px',
    color: '#ffffff',
    fontSize: 11,
    lineHeight: '16px',
  },
  footerLink: {
    color: '#ffffff',
    textDecoration: 'none',
  },
  address: {
    margin: '0 0 4px',
    color: '#a8a8a8',
    fontSize: 10,
    lineHeight: '14px',
  },
} satisfies Record<string, CSSProperties>

export type EmailLayoutProps = {
  children: ReactNode
  previewUrl?: string
  unsubscribeUrl?: string
  legalUrl?: string
  privacyUrl?: string
}

export function EmailLayout({
  children,
  previewUrl,
  unsubscribeUrl = '#',
  legalUrl = '#',
  privacyUrl = '#',
}: EmailLayoutProps) {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.browserLink}>
          <a href={previewUrl ?? '#'} style={{ color: colors.muted }}>
            If this email is not displaying correctly, please follow this link to view it in your browser.
          </a>
        </div>
        <main style={styles.body}>
          <h1 style={styles.logo}>Gaudier</h1>
          {children}
          <div style={styles.divider} />
          <p style={styles.safetyText}>
            If you did not request to sign up for Gaudier, you can safely ignore this email. Someone else may have
            entered your email address by mistake.
          </p>
        </main>
        <footer style={styles.footer}>
          <p style={styles.footerLogo}>Gaudier</p>
          <p style={styles.footerLinks}>
            <a href={unsubscribeUrl} style={styles.footerLink}>
              Unsubscribe
            </a>{' '}
            &nbsp;|&nbsp;{' '}
            <a href={legalUrl} style={styles.footerLink}>
              Legal Notices
            </a>{' '}
            &nbsp;|&nbsp;{' '}
            <a href={privacyUrl} style={styles.footerLink}>
              Privacy Policy
            </a>
          </p>
          <p style={styles.address}>10 Rue de Penthievre - 75009 Paris, France</p>
          <p style={styles.address}>© 2026 Gaudier</p>
        </footer>
      </div>
    </div>
  )
}
