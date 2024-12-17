import { useTranslation } from 'react-i18next'
import NavDropdownMenu from '@/features/ui/components/bootstrap-5/navbar/nav-dropdown-menu'
import type { NavbarSessionUser } from '@/features/ui/components/types/navbar'
import NavLinkItem from '@/features/ui/components/bootstrap-5/navbar/nav-link-item'
import { AccountMenuItems } from './account-menu-items'

export default function LoggedInItems({
  sessionUser,
  showSubscriptionLink,
}: {
  sessionUser: NavbarSessionUser
  showSubscriptionLink: boolean
}) {
  const { t } = useTranslation()
  return (
    <>
      <NavLinkItem href="/project" className="nav-item-projects">
        {t('projects')}
      </NavLinkItem>
      <NavDropdownMenu title={t('Account')} className="nav-item-account">
        <AccountMenuItems
          sessionUser={sessionUser}
          showSubscriptionLink={showSubscriptionLink}
        />
      </NavDropdownMenu>
    </>
  )
}
