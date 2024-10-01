import { ConfirmEmailForm } from './confirm-email'
import { useTranslation } from 'react-i18next'

export default function ConfirmSecondaryEmailForm() {
  const { t } = useTranslation()

  const successMessage = (
    <>
      <h1 className="h3 interstitial-header">
        {t('thanks_for_confirming_your_email_address')}
      </h1>
    </>
  )

  return (
    <ConfirmEmailForm
      successMessage={successMessage}
      successButtonText={t('go_to_overleaf')}
      confirmationEndpoint="/user/emails/confirm-secondary"
      resendEndpoint="/user/emails/resend-secondary-confirmation"
      flow="secondary"
    />
  )
}
