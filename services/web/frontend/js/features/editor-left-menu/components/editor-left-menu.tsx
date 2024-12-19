import { useLayoutContext } from '../../../shared/context/layout-context'
import LeftMenuMask from './left-menu-mask'
import AccessibleModal from '../../../shared/components/accessible-modal'
import { Modal } from 'react-bootstrap'
import classNames from 'classnames'
import { lazy, memo, Suspense } from 'react'
import { FullSizeLoadingSpinner } from '@/shared/components/loading-spinner'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { Offcanvas } from 'react-bootstrap-5'
import { EditorLeftMenuProvider } from './editor-left-menu-context'

const EditorLeftMenuBody = lazy(() => import('./editor-left-menu-body'))

function EditorLeftMenu() {
  const { leftMenuShown, setLeftMenuShown } = useLayoutContext()

  const closeLeftMenu = () => {
    setLeftMenuShown(false)
  }

  return (
    <BootstrapVersionSwitcher
      bs3={
        <EditorLeftMenuProvider>
          <AccessibleModal
            backdropClassName="left-menu-modal-backdrop"
            keyboard
            onHide={closeLeftMenu}
            id="left-menu-modal"
            show={leftMenuShown}
          >
            <Modal.Body
              className={classNames('full-size', { shown: leftMenuShown })}
              id="left-menu"
            >
              <Suspense fallback={<FullSizeLoadingSpinner delay={500} />}>
                <EditorLeftMenuBody />
              </Suspense>
            </Modal.Body>
          </AccessibleModal>
          {leftMenuShown && <LeftMenuMask />}
        </EditorLeftMenuProvider>
      }
      bs5={
        <EditorLeftMenuProvider>
          <Offcanvas
            show={leftMenuShown}
            onHide={closeLeftMenu}
            backdropClassName="left-menu-modal-backdrop"
            id="left-menu-offcanvas"
          >
            <Offcanvas.Body
              className={classNames('full-size', 'left-menu', {
                shown: leftMenuShown,
              })}
              id="left-menu"
            >
              <Suspense fallback={<FullSizeLoadingSpinner delay={500} />}>
                <EditorLeftMenuBody />
              </Suspense>
            </Offcanvas.Body>
          </Offcanvas>
          {leftMenuShown && <LeftMenuMask />}
        </EditorLeftMenuProvider>
      }
    />
  )
}

export default memo(EditorLeftMenu)
