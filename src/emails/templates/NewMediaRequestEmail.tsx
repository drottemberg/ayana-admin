import type { CSSProperties } from 'react'
import { EmailButton } from '@/emails/components/EmailButton'
import { EmailLayout } from '@/emails/components/EmailLayout'
import { EmailParagraph } from '@/emails/components/EmailText'

const styles = {
  details: {
    margin: '26px 0 8px',
    width: '100%',
    borderCollapse: 'collapse',
  },
  label: {
    width: 150,
    padding: '2px 0',
    color: '#2b2b2f',
    fontSize: 12,
    lineHeight: '19px',
    fontWeight: 700,
    verticalAlign: 'top',
  },
  value: {
    padding: '2px 0',
    color: '#2b2b2f',
    fontSize: 12,
    lineHeight: '19px',
    textAlign: 'right',
    verticalAlign: 'top',
  },
  divider: {
    height: 1,
    paddingTop: 10,
    borderBottom: '1px solid #dedede',
  },
  costLabel: {
    padding: '11px 0 2px',
    color: '#2b2b2f',
    fontSize: 12,
    lineHeight: '19px',
    textAlign: 'right',
  },
  costValue: {
    padding: '11px 0 2px 16px',
    color: '#2b2b2f',
    fontSize: 14,
    lineHeight: '19px',
    fontWeight: 700,
    textAlign: 'right',
  },
} satisfies Record<string, CSSProperties>

export type NewMediaRequestEmailProps = {
  fullName: string
  mediaName: string
  mediaSize: string
  deviceCount: number
  dataCost: string
  totalCost: string
  confirmUrl: string
  previewUrl?: string
}

export function NewMediaRequestEmail({
  fullName,
  mediaName,
  mediaSize,
  deviceCount,
  dataCost,
  totalCost,
  confirmUrl,
  previewUrl,
}: NewMediaRequestEmailProps) {
  return (
    <EmailLayout previewUrl={previewUrl}>
      <EmailParagraph style={{ fontWeight: 700 }}>Hello {fullName},</EmailParagraph>
      <EmailParagraph>Someone on your team wants to release new content.</EmailParagraph>
      <table style={styles.details}>
        <tbody>
          <tr>
            <td style={styles.label}>Media name:</td>
            <td style={styles.value}>{mediaName}</td>
          </tr>
          <tr>
            <td style={styles.label}>Size:</td>
            <td style={styles.value}>{mediaSize}</td>
          </tr>
          <tr>
            <td style={styles.label}>Broadcast in stores:</td>
            <td style={styles.value}>{deviceCount} devices</td>
          </tr>
          <tr>
            <td colSpan={2} style={styles.divider} />
          </tr>
          <tr>
            <td style={styles.costLabel}>Data cost:</td>
            <td style={styles.costValue}>{dataCost}</td>
          </tr>
          <tr>
            <td style={{ ...styles.costLabel, paddingTop: 2 }}>Total:</td>
            <td style={{ ...styles.costValue, paddingTop: 2 }}>{totalCost}</td>
          </tr>
        </tbody>
      </table>
      <EmailButton href={confirmUrl}>Confirm broadcast</EmailButton>
      <EmailParagraph>
        If you have any questions, please contact us and we will get back to you as soon as possible.
      </EmailParagraph>
      <EmailParagraph style={{ marginTop: 28 }}>Thank you,</EmailParagraph>
      <EmailParagraph style={{ fontWeight: 700 }}>Team Gaudier</EmailParagraph>
    </EmailLayout>
  )
}
