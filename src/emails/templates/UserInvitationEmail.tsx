import { EmailButton } from '@/emails/components/EmailButton'
import { EmailLayout } from '@/emails/components/EmailLayout'
import { EmailHelperText, EmailLink, EmailParagraph } from '@/emails/components/EmailText'

export type UserInvitationEmailProps = {
  customerName: string
  inviteUrl: string
  expiresInHours?: number
  previewUrl?: string
  supportEmail?: string
}

export function UserInvitationEmail({
  customerName,
  inviteUrl,
  expiresInHours = 72,
  previewUrl,
  supportEmail = 'support@gaudier.com',
}: UserInvitationEmailProps) {
  return (
    <EmailLayout previewUrl={previewUrl}>
      <EmailParagraph style={{ fontWeight: 700 }}>
        You have been invited to join Gaudier - {customerName}.
      </EmailParagraph>
      <EmailParagraph>Click below to create your account:</EmailParagraph>
      <EmailButton href={inviteUrl}>Create my account</EmailButton>
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
