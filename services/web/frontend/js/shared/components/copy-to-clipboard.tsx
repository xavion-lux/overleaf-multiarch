import { FC, memo, MouseEventHandler, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import OLIconButton from '@/features/ui/components/ol/ol-icon-button'
import { bsVersion } from '@/features/utils/bootstrap-5'

export const CopyToClipboard = memo<{
  content: string
  tooltipId: string
  kind?: 'text' | 'icon'
}>(({ content, tooltipId, kind = 'icon' }) => {
  const { t } = useTranslation()

  const [copied, setCopied] = useState(false)

  const handleClick = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      window.setTimeout(() => {
        setCopied(false)
      }, 1500)
    })
  }, [content])

  if (!navigator.clipboard?.writeText) {
    return null
  }

  return (
    <OLTooltip
      id={tooltipId}
      description={copied ? `${t('copied')}!` : t('copy')}
      overlayProps={{ delay: copied ? 1000 : 250 }}
    >
      <span>
        {kind === 'text' ? (
          <TextButton handleClick={handleClick} />
        ) : (
          <IconButton handleClick={handleClick} copied={copied} />
        )}
      </span>
    </OLTooltip>
  )
})
CopyToClipboard.displayName = 'CopyToClipboard'

const TextButton: FC<{
  handleClick: MouseEventHandler<HTMLButtonElement>
}> = ({ handleClick }) => {
  const { t } = useTranslation()

  return (
    <OLButton
      onClick={handleClick}
      size="small"
      variant="secondary"
      className="copy-button"
      bs3Props={{ bsSize: 'xsmall' }}
    >
      {t('copy')}
    </OLButton>
  )
}

const IconButton: FC<{
  handleClick: MouseEventHandler<HTMLButtonElement>
  copied: boolean
}> = ({ handleClick, copied }) => {
  const { t } = useTranslation()

  return (
    <OLIconButton
      onClick={handleClick}
      variant="link"
      accessibilityLabel={t('copy')}
      className="copy-button"
      bs3Props={{ bsSize: 'xsmall' }}
      icon={
        bsVersion({
          bs5: copied ? 'check' : 'content_copy',
          bs3: copied ? 'check' : 'clipboard',
        }) || ''
      }
    />
  )
}
