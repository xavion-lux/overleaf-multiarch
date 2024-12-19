import { ReactNode, useEffect } from 'react'
import {
  ProjectListProvider,
  useProjectListContext,
} from '../context/project-list-context'
import {
  SplitTestProvider,
  useSplitTestContext,
} from '@/shared/context/split-test-context'
import { ColorPickerProvider } from '../context/color-picker-context'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { useTranslation } from 'react-i18next'
import useWaitForI18n from '../../../shared/hooks/use-wait-for-i18n'
import LoadingBranded from '../../../shared/components/loading-branded'
import SystemMessages from '../../../shared/components/system-messages'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import { GenericErrorBoundaryFallback } from '@/shared/components/generic-error-boundary-fallback'
import getMeta from '@/utils/meta'
import DefaultNavbar from '@/features/ui/components/bootstrap-5/navbar/default-navbar'
import Footer from '@/features/ui/components/bootstrap-5/footer/footer'
import WelcomePageContent from '@/features/project-list/components/welcome-page-content'
import ProjectListDefault from '@/features/project-list/components/project-list-default'
import { ProjectListDsNav } from '@/features/project-list/components/project-list-ds-nav'

function ProjectListRoot() {
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  return <ProjectListRootInner />
}

export function ProjectListRootInner() {
  return (
    <ProjectListProvider>
      <ColorPickerProvider>
        <SplitTestProvider>
          <ProjectListPageContent />
        </SplitTestProvider>
      </ColorPickerProvider>
    </ProjectListProvider>
  )
}

function DefaultNavbarAndFooter({ children }: { children: ReactNode }) {
  const navbarProps = getMeta('ol-navbar')
  const footerProps = getMeta('ol-footer')

  return (
    <>
      <DefaultNavbar {...navbarProps} />
      <main
        id="main-content"
        className="content content-alt project-list-react"
      >
        {children}
      </main>
      <Footer {...footerProps} />
    </>
  )
}

function DefaultPageContentWrapper({ children }: { children: ReactNode }) {
  return (
    <DefaultNavbarAndFooter>
      <SystemMessages />
      <div className="project-list-wrapper">{children}</div>
    </DefaultNavbarAndFooter>
  )
}

function ProjectListPageContent() {
  const { totalProjectsCount, isLoading, loadProgress } =
    useProjectListContext()

  const { splitTestVariants } = useSplitTestContext()

  useEffect(() => {
    eventTracking.sendMB('loads_v2_dash', {})
  }, [])

  const { t } = useTranslation()

  const hasDsNav =
    splitTestVariants['sidebar-navigation-ui-update'] === 'active'

  if (isLoading) {
    const loadingComponent = (
      <LoadingBranded loadProgress={loadProgress} label={t('loading')} />
    )

    if (hasDsNav) {
      return loadingComponent
    } else {
      return (
        <DefaultNavbarAndFooter>
          <div className="loading-container">{loadingComponent}</div>
        </DefaultNavbarAndFooter>
      )
    }
  }

  if (totalProjectsCount === 0) {
    return (
      <DefaultPageContentWrapper>
        <WelcomePageContent />
      </DefaultPageContentWrapper>
    )
  } else if (hasDsNav) {
    return <ProjectListDsNav />
  } else {
    return (
      <DefaultPageContentWrapper>
        <ProjectListDefault />
      </DefaultPageContentWrapper>
    )
  }
}

export default withErrorBoundary(ProjectListRoot, GenericErrorBoundaryFallback)
