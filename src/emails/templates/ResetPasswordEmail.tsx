import { EmailButton } from '@/emails/components/EmailButton'
import { EmailLayout } from '@/emails/components/EmailLayout'
import { EmailHelperText, EmailLink, EmailParagraph } from '@/emails/components/EmailText'

export type ResetPasswordEmailProps = {
  fullName: string
  resetUrl: string
  expiresInHours?: number
  previewUrl?: string
  supportEmail?: string
}

export function ResetPasswordEmail({
  fullName,
  resetUrl,
  expiresInHours = 72,
  previewUrl,
  supportEmail = 'support@gaudier.com',
}: ResetPasswordEmailProps) {
  return (
    <EmailLayout previewUrl={previewUrl}>
      <EmailParagraph style={{ fontWeight: 700 }}>Hello {fullName},</EmailParagraph>
      <EmailParagraph>
        A request to reset your Gaudier password has been made. If you did not make this request, simply ignore this
        email. If you did make this request, please reset your password:
      </EmailParagraph>
      <EmailButton href={resetUrl}>Reset my password</EmailButton>
      <EmailHelperText>
        If the button above does not work, try copying and pasting the URL into your browser. This invitation expires in{' '}
        {expiresInHours} hours. If you continue to have problems, please feel free to contact us at{' '}
        <EmailLink href={`mailto:${supportEmail}`}>{supportEmail}</EmailLink>.
      </EmailHelperText>
      <EmailParagraph style={{ marginTop: 28 }}>Thank you,</EmailParagraph>
      <EmailParagraph style={{ fontWeight: 700 }}>Team Gaudier</EmailParagraph>
    </EmailLayout>
  )
}
