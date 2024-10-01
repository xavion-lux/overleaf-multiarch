import { useState, useEffect, useMemo, MouseEventHandler } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { useShareProjectContext } from './share-project-modal'
import TransferOwnershipModal from './transfer-ownership-modal'
import { removeMemberFromProject, updateMember } from '../../utils/api'
import { Button, Col, Form, FormGroup } from 'react-bootstrap'
import Icon from '@/shared/components/icon'
import { useProjectContext } from '@/shared/context/project-context'
import { sendMB } from '@/infrastructure/event-tracking'
import { Select } from '@/shared/components/select'
import type { ProjectContextMember } from '@/shared/context/types/project-context'
import { PermissionsLevel } from '@/features/ide-react/types/permissions'
import { linkSharingEnforcementDate } from '../../utils/link-sharing'

type PermissionsOption = PermissionsLevel | 'removeAccess' | 'downgraded'

type EditMemberProps = {
  member: ProjectContextMember
  hasExceededCollaboratorLimit: boolean
  hasBeenDowngraded: boolean
  canAddCollaborators: boolean
}

type Privilege = {
  key: PermissionsOption
  label: string
}

export default function EditMember({
  member,
  hasExceededCollaboratorLimit,
  hasBeenDowngraded,
  canAddCollaborators,
}: EditMemberProps) {
  const [privileges, setPrivileges] = useState<PermissionsOption>(
    member.privileges
  )
  const [confirmingOwnershipTransfer, setConfirmingOwnershipTransfer] =
    useState(false)
  const [privilegeChangePending, setPrivilegeChangePending] = useState(false)
  const { t } = useTranslation()

  // update the local state if the member's privileges change externally
  useEffect(() => {
    setPrivileges(member.privileges)
  }, [member.privileges])

  const { updateProject, monitorRequest } = useShareProjectContext()
  const { _id: projectId, members, invites } = useProjectContext()

  // Immediately commit this change if it's lower impact (eg. editor > viewer)
  // but show a confirmation button for removing access
  function handlePrivilegeChange(newPrivileges: PermissionsOption) {
    setPrivileges(newPrivileges)
    if (newPrivileges !== 'removeAccess') {
      commitPrivilegeChange(newPrivileges)
    } else {
      setPrivilegeChangePending(true)
    }
  }

  function shouldWarnMember() {
    return hasExceededCollaboratorLimit && privileges === 'readAndWrite'
  }

  function commitPrivilegeChange(newPrivileges: PermissionsOption) {
    setPrivileges(newPrivileges)
    setPrivilegeChangePending(false)

    if (newPrivileges === 'owner') {
      setConfirmingOwnershipTransfer(true)
    } else if (newPrivileges === 'removeAccess') {
      monitorRequest(() => removeMemberFromProject(projectId, member)).then(
        () => {
          const updatedMembers = members.filter(existing => existing !== member)
          updateProject({
            members: updatedMembers,
          })
          sendMB('collaborator-removed', {
            project_id: projectId,
            current_collaborators_amount: updatedMembers.length,
            current_invites_amount: invites.length,
          })
        }
      )
    } else if (
      newPrivileges === 'readAndWrite' ||
      newPrivileges === 'readOnly'
    ) {
      monitorRequest(() =>
        updateMember(projectId, member, {
          privilegeLevel: newPrivileges,
        })
      ).then(() => {
        updateProject({
          members: members.map(item =>
            item._id === member._id ? { ...item, newPrivileges } : item
          ),
        })
      })
    }
  }

  if (confirmingOwnershipTransfer) {
    return (
      <TransferOwnershipModal
        member={member}
        cancel={() => {
          setConfirmingOwnershipTransfer(false)
          setPrivileges(member.privileges)
        }}
      />
    )
  }

  return (
    <Form
      horizontal
      id="share-project-form"
      onSubmit={e => {
        e.preventDefault()
        commitPrivilegeChange(privileges)
      }}
    >
      <FormGroup className="project-member">
        <Col xs={7}>
          <div className="project-member-email-icon">
            <Icon
              type={
                shouldWarnMember() || member.pendingEditor ? 'warning' : 'user'
              }
              fw
            />
            <div className="email-warning">
              {member.email}
              {member.pendingEditor && (
                <div className="subtitle">{t('view_only_downgraded')}</div>
              )}
              {shouldWarnMember() && (
                <div className="subtitle">
                  {t('will_lose_edit_access_on_date', {
                    date: linkSharingEnforcementDate,
                  })}
                </div>
              )}
            </div>
          </div>
        </Col>

        <Col xs={1}>
          {privileges !== member.privileges && privilegeChangePending && (
            <ChangePrivilegesActions
              handleReset={() => setPrivileges(member.privileges)}
            />
          )}
        </Col>

        <Col xs={4} className="project-member-select">
          {hasBeenDowngraded && <Icon type="warning" fw />}

          <SelectPrivilege
            value={privileges}
            handleChange={value => {
              if (value) {
                handlePrivilegeChange(value.key)
              }
            }}
            hasBeenDowngraded={hasBeenDowngraded}
            canAddCollaborators={canAddCollaborators}
          />
        </Col>
      </FormGroup>
    </Form>
  )
}
EditMember.propTypes = {
  member: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    privileges: PropTypes.string.isRequired,
  }),
  hasExceededCollaboratorLimit: PropTypes.bool.isRequired,
  canAddCollaborators: PropTypes.bool.isRequired,
}

type SelectPrivilegeProps = {
  value: string
  handleChange: (item: Privilege | null | undefined) => void
  hasBeenDowngraded: boolean
  canAddCollaborators: boolean
}

function SelectPrivilege({
  value,
  handleChange,
  hasBeenDowngraded,
  canAddCollaborators,
}: SelectPrivilegeProps) {
  const { t } = useTranslation()
  const { features } = useProjectContext()

  const privileges = useMemo(
    (): Privilege[] => [
      { key: 'owner', label: t('make_owner') },
      { key: 'readAndWrite', label: t('editor') },
      { key: 'readOnly', label: t('viewer') },
      { key: 'removeAccess', label: t('remove_access') },
    ],
    [t]
  )

  const downgradedPseudoPrivilege: Privilege = {
    key: 'downgraded',
    label: t('select_access_level'),
  }

  function getPrivilegeSubtitle(privilege: PermissionsOption) {
    if (!hasBeenDowngraded) {
      return !canAddCollaborators &&
        privilege === 'readAndWrite' &&
        value !== 'readAndWrite'
        ? t('limited_to_n_editors_per_project', {
            count: features.collaborators,
          })
        : ''
    }

    return privilege === 'readAndWrite'
      ? t('limited_to_n_editors', {
          count: features.collaborators,
        })
      : ''
  }

  function isPrivilegeDisabled(privilege: PermissionsOption) {
    return (
      !canAddCollaborators &&
      privilege === 'readAndWrite' &&
      (hasBeenDowngraded || value !== 'readAndWrite')
    )
  }

  return (
    <Select
      items={privileges}
      itemToKey={item => item.key}
      itemToString={item => (item ? item.label : '')}
      itemToSubtitle={item => (item ? getPrivilegeSubtitle(item.key) : '')}
      itemToDisabled={item => (item ? isPrivilegeDisabled(item.key) : false)}
      defaultItem={privileges.find(item => item.key === value)}
      selected={
        hasBeenDowngraded
          ? downgradedPseudoPrivilege
          : privileges.find(item => item.key === value)
      }
      name="privileges"
      onSelectedItemChanged={handleChange}
      selectedIcon
    />
  )
}

type ChangePrivilegesActionsProps = {
  handleReset: MouseEventHandler<Button>
}
function ChangePrivilegesActions({
  handleReset,
}: ChangePrivilegesActionsProps) {
  const { t } = useTranslation()

  return (
    <div className="text-center">
      <Button type="submit" bsSize="sm" bsStyle="primary">
        {t('change_or_cancel-change')}
      </Button>
      <div className="text-sm">
        {t('change_or_cancel-or')}
        &nbsp;
        <Button type="button" className="btn-inline-link" onClick={handleReset}>
          {t('change_or_cancel-cancel')}
        </Button>
      </div>
    </div>
  )
}
