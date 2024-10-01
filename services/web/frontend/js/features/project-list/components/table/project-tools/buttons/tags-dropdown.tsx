import { sortBy } from 'lodash'
import { memo, useCallback } from 'react'
import { Button, Dropdown as BS3Dropdown } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import ControlledDropdown from '../../../../../../shared/components/controlled-dropdown'
import Icon from '../../../../../../shared/components/icon'
import MaterialIcon from '../../../../../../shared/components/material-icon'
import { useProjectListContext } from '../../../../context/project-list-context'
import useTag from '../../../../hooks/use-tag'
import { addProjectsToTag, removeProjectsFromTag } from '../../../../util/api'
import { getTagColor } from '../../../../util/tag'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import {
  Dropdown,
  DropdownDivider,
  DropdownHeader,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'

function TagsDropdown() {
  const {
    tags,
    selectedProjects,
    addProjectToTagInView,
    removeProjectFromTagInView,
  } = useProjectListContext()
  const { t } = useTranslation()
  const { openCreateTagModal, CreateTagModal } = useTag()

  const handleOpenCreateTagModal = useCallback(
    e => {
      e.preventDefault()
      openCreateTagModal()
    },
    [openCreateTagModal]
  )

  const handleAddTagToSelectedProjects = useCallback(
    (e, tagId) => {
      e.preventDefault()
      const tag = tags.find(tag => tag._id === tagId)
      const projectIds = []
      for (const selectedProject of selectedProjects) {
        if (!tag?.project_ids?.includes(selectedProject.id)) {
          addProjectToTagInView(tagId, selectedProject.id)
          projectIds.push(selectedProject.id)
        }
      }
      addProjectsToTag(tagId, projectIds)
    },
    [tags, selectedProjects, addProjectToTagInView]
  )

  const handleRemoveTagFromSelectedProjects = useCallback(
    (e, tagId) => {
      e.preventDefault()
      for (const selectedProject of selectedProjects) {
        removeProjectFromTagInView(tagId, selectedProject.id)
      }
      removeProjectsFromTag(
        tagId,
        selectedProjects.map(project => project.id)
      )
    },
    [selectedProjects, removeProjectFromTagInView]
  )

  const containsAllSelectedProjects = useCallback(
    tag => {
      for (const project of selectedProjects) {
        if (!(tag.project_ids || []).includes(project.id)) {
          return false
        }
      }
      return true
    },
    [selectedProjects]
  )

  const containsSomeSelectedProjects = useCallback(
    tag => {
      for (const project of selectedProjects) {
        if (tag.project_ids?.includes(project.id)) {
          return true
        }
      }
      return false
    },
    [selectedProjects]
  )

  return (
    <>
      <BootstrapVersionSwitcher
        bs3={
          <ControlledDropdown id="tags">
            <BS3Dropdown.Toggle
              bsStyle={null}
              className="btn-secondary"
              aria-label={t('tags')}
            >
              <MaterialIcon type="label" style={{ verticalAlign: 'sub' }} />
            </BS3Dropdown.Toggle>
            <BS3Dropdown.Menu className="dropdown-menu-right">
              <li className="dropdown-header" role="heading" aria-level={3}>
                {t('add_to_tag')}
              </li>
              {sortBy(tags, tag => tag.name?.toLowerCase()).map(tag => {
                return (
                  <li key={tag._id}>
                    <Button
                      className="tag-dropdown-button"
                      onClick={e =>
                        containsAllSelectedProjects(tag)
                          ? handleRemoveTagFromSelectedProjects(e, tag._id)
                          : handleAddTagToSelectedProjects(e, tag._id)
                      }
                      aria-label={t('add_or_remove_project_from_tag', {
                        tagName: tag.name,
                      })}
                    >
                      <Icon
                        type={
                          containsAllSelectedProjects(tag)
                            ? 'check-square-o'
                            : containsSomeSelectedProjects(tag)
                              ? 'minus-square-o'
                              : 'square-o'
                        }
                        className="tag-checkbox"
                      />{' '}
                      <span
                        className="tag-dot"
                        style={{
                          backgroundColor: getTagColor(tag),
                        }}
                      />{' '}
                      {tag.name}
                    </Button>
                  </li>
                )
              })}
              <li className="divider" />
              <li>
                <Button
                  className="tag-dropdown-button"
                  onClick={handleOpenCreateTagModal}
                >
                  {t('create_new_tag')}
                </Button>
              </li>
            </BS3Dropdown.Menu>
          </ControlledDropdown>
        }
        bs5={
          <Dropdown align="end" autoClose="outside">
            <DropdownToggle
              id="project-tools-more-dropdown"
              variant="secondary"
              aria-label={t('tags')}
            >
              <MaterialIcon type="label" className="align-text-top" />
            </DropdownToggle>
            <DropdownMenu
              flip={false}
              data-testid="project-tools-more-dropdown-menu"
            >
              <DropdownHeader>{t('add_to_tag')}</DropdownHeader>
              {sortBy(tags, tag => tag.name?.toLowerCase()).map(
                (tag, index) => (
                  <li role="none" key={tag._id}>
                    <DropdownItem
                      onClick={e =>
                        containsAllSelectedProjects(tag)
                          ? handleRemoveTagFromSelectedProjects(e, tag._id)
                          : handleAddTagToSelectedProjects(e, tag._id)
                      }
                      aria-label={t('add_or_remove_project_from_tag', {
                        tagName: tag.name,
                      })}
                      as="button"
                      tabIndex={-1}
                      leadingIcon={
                        containsAllSelectedProjects(tag) ? (
                          'check'
                        ) : (
                          <DropdownItem.EmptyLeadingIcon />
                        )
                      }
                    >
                      <span
                        className="badge-tag-circle align-self-center ms-0"
                        style={{ backgroundColor: getTagColor(tag) }}
                      />
                      <span className="text-truncate">{tag.name}</span>
                    </DropdownItem>
                  </li>
                )
              )}
              <DropdownDivider />
              <li role="none">
                <DropdownItem
                  onClick={handleOpenCreateTagModal}
                  as="button"
                  tabIndex={-1}
                >
                  {t('create_new_tag')}
                </DropdownItem>
              </li>
            </DropdownMenu>
          </Dropdown>
        }
      />
      <CreateTagModal id="toolbar-create-tag-modal" />
    </>
  )
}

export default memo(TagsDropdown)
