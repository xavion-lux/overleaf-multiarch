import { useTranslation } from 'react-i18next'
import { memo, useCallback } from 'react'
import { Project } from '../../../../../../../../types/project/dashboard/api'
import { useProjectListContext } from '../../../../context/project-list-context'
import { untrashProject } from '../../../../util/api'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import OLIconButton from '@/features/ui/components/ol/ol-icon-button'
import { bsVersion } from '@/features/utils/bootstrap-5'

type UntrashProjectButtonProps = {
  project: Project
  children: (
    text: string,
    untrashProject: () => Promise<void>
  ) => React.ReactElement
}

function UntrashProjectButton({
  project,
  children,
}: UntrashProjectButtonProps) {
  const { t } = useTranslation()
  const text = t('untrash')
  const { toggleSelectedProject, updateProjectViewData } =
    useProjectListContext()

  const handleUntrashProject = useCallback(async () => {
    await untrashProject(project.id)
    toggleSelectedProject(project.id, false)
    updateProjectViewData({ ...project, trashed: false })
  }, [project, toggleSelectedProject, updateProjectViewData])

  if (!project.trashed) return null

  return children(text, handleUntrashProject)
}

const UntrashProjectButtonTooltip = memo(function UntrashProjectButtonTooltip({
  project,
}: Pick<UntrashProjectButtonProps, 'project'>) {
  return (
    <UntrashProjectButton project={project}>
      {(text, handleUntrashProject) => (
        <OLTooltip
          key={`tooltip-untrash-project-${project.id}`}
          id={`untrash-project-${project.id}`}
          description={text}
          overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
        >
          <span>
            <OLIconButton
              onClick={handleUntrashProject}
              variant="link"
              accessibilityLabel={text}
              className="action-btn"
              icon={
                bsVersion({
                  bs5: 'restore_page',
                  bs3: 'reply',
                }) as string
              }
              bs3Props={{ fw: true }}
            />
          </span>
        </OLTooltip>
      )}
    </UntrashProjectButton>
  )
})

export default memo(UntrashProjectButton)
export { UntrashProjectButtonTooltip }
