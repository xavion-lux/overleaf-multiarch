import { useTranslation } from 'react-i18next'
import { Badge, BadgeProps } from 'react-bootstrap-5'
import MaterialIcon from '@/shared/components/material-icon'
import { MergeAndOverride } from '../../../../../../types/utils'
import classnames from 'classnames'

type TagProps = MergeAndOverride<
  BadgeProps,
  {
    prepend?: React.ReactNode
    contentProps?: React.ComponentProps<'button'>
    closeBtnProps?: React.ComponentProps<'button'>
  }
>

function Tag({
  prepend,
  children,
  contentProps,
  closeBtnProps,
  className,
  ...rest
}: TagProps) {
  const { t } = useTranslation()

  const content = (
    <>
      {prepend && <span className="badge-prepend">{prepend}</span>}
      <span className="badge-content">{children}</span>
    </>
  )

  return (
    <Badge bg="light" className={classnames('badge-tag', className)} {...rest}>
      {contentProps?.onClick ? (
        <button
          type="button"
          className="badge-tag-content badge-tag-content-btn"
          {...contentProps}
        >
          {content}
        </button>
      ) : (
        <span className="badge-tag-content" {...contentProps}>
          {content}
        </span>
      )}
      {closeBtnProps && (
        <button
          type="button"
          className="badge-close"
          aria-label={t('remove_tag', { tagName: children })}
          {...closeBtnProps}
        >
          <MaterialIcon className="badge-close-icon" type="close" />
        </button>
      )}
    </Badge>
  )
}

export default Tag
