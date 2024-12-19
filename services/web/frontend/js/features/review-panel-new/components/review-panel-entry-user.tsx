import { memo } from 'react'
import { buildName } from '../utils/build-name'
import { ReviewPanelUser } from '../../../../../types/review-panel/review-panel'
import { ChangesUser } from '../context/changes-users-context'
import ColorManager from '@/ide/colors/ColorManager'

const ReviewPanelEntryUser = ({
  user,
}: {
  user?: ReviewPanelUser | ChangesUser
}) => {
  const userName = buildName(user)
  const hue = ColorManager.getHueForUserId(user?.id) || 100

  return (
    <div className="review-panel-entry-user">
      <span
        className="review-panel-entry-user-color-badge"
        style={{ backgroundColor: `hsl(${hue}, 70%, 50%)` }}
      />
      {userName}
    </div>
  )
}

export default memo(ReviewPanelEntryUser)
