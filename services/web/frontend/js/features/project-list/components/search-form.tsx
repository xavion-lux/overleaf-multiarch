import { useTranslation } from 'react-i18next'
import { FormControl } from 'react-bootstrap'
import Icon from '../../../shared/components/icon'
import * as eventTracking from '../../../infrastructure/event-tracking'
import classnames from 'classnames'
import { Tag } from '../../../../../app/src/Features/Tags/types'
import { MergeAndOverride } from '../../../../../types/utils'
import { Filter } from '../context/project-list-context'
import { isSmallDevice } from '../../../infrastructure/event-tracking'
import OLForm from '@/features/ui/components/ol/ol-form'
import OLFormGroup from '@/features/ui/components/ol/ol-form-group'
import OLCol from '@/features/ui/components/ol/ol-col'
import OLFormControl from '@/features/ui/components/ol/ol-form-control'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { bsVersion } from '@/features/utils/bootstrap-5'

type SearchFormOwnProps = {
  inputValue: string
  setInputValue: (input: string) => void
  filter: Filter
  selectedTag: Tag | undefined
}

type SearchFormProps = MergeAndOverride<
  React.ComponentProps<typeof OLForm>,
  SearchFormOwnProps
>

function SearchForm({
  inputValue,
  setInputValue,
  filter,
  selectedTag,
  className,
  ...props
}: SearchFormProps) {
  const { t } = useTranslation()
  let placeholderMessage = t('search_projects')
  if (selectedTag) {
    placeholderMessage = `${t('search')} ${selectedTag.name}`
  } else {
    switch (filter) {
      case 'all':
        placeholderMessage = t('search_in_all_projects')
        break
      case 'owned':
        placeholderMessage = t('search_in_your_projects')
        break
      case 'shared':
        placeholderMessage = t('search_in_shared_projects')
        break
      case 'archived':
        placeholderMessage = t('search_in_archived_projects')
        break
      case 'trashed':
        placeholderMessage = t('search_in_trashed_projects')
        break
    }
  }
  const placeholder = `${placeholderMessage}…`

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement & Omit<FormControl, keyof HTMLInputElement>
    >
  ) => {
    eventTracking.sendMB('project-list-page-interaction', {
      action: 'search',
      isSmallDevice,
    })
    setInputValue(e.target.value)
  }

  const handleClear = () => setInputValue('')

  return (
    <OLForm
      className={classnames('project-search', className)}
      role="search"
      onSubmit={e => e.preventDefault()}
      bs3Props={{ horizontal: true }}
      {...props}
    >
      <OLFormGroup
        className={bsVersion({ bs3: 'has-feedback has-feedback-left' })}
      >
        <OLCol>
          <OLFormControl
            type="text"
            value={inputValue}
            onChange={handleChange}
            placeholder={placeholder}
            aria-label={placeholder}
            prepend={BootstrapVersionSwitcher({
              bs3: <Icon type="search" />,
              bs5: <MaterialIcon type="search" />,
            })}
            append={
              inputValue.length > 0 && (
                <button
                  type="button"
                  className={bsVersion({
                    bs3: 'project-search-clear-btn btn-link',
                    bs5: 'project-search-clear-btn',
                  })}
                  aria-label={t('clear_search')}
                  onClick={handleClear}
                >
                  <BootstrapVersionSwitcher
                    bs3={<Icon type="times" />}
                    bs5={<MaterialIcon type="clear" />}
                  />
                </button>
              )
            }
          />
        </OLCol>
      </OLFormGroup>
    </OLForm>
  )
}

export default SearchForm
