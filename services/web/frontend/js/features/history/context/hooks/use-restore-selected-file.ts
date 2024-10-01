import { useIdeContext } from '../../../../shared/context/ide-context'
import { useLayoutContext } from '../../../../shared/context/layout-context'
import { restoreFileToVersion } from '../../services/api'
import { isFileRemoved } from '../../utils/file-diff'
import { useHistoryContext } from '../history-context'
import type { HistoryContextValue } from '../types/history-context-value'
import { useErrorHandler } from 'react-error-boundary'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { findInTree } from '@/features/file-tree/util/find-in-tree'
import { useCallback, useEffect, useState } from 'react'
import { RestoreFileResponse } from '../../services/types/restore-file'

const RESTORE_FILE_TIMEOUT = 3000

type RestoreState =
  | 'idle'
  | 'restoring'
  | 'waitingForFileTree'
  | 'complete'
  | 'error'
  | 'timedOut'

export function useRestoreSelectedFile() {
  const { projectId } = useHistoryContext()
  const ide = useIdeContext()
  const { setView } = useLayoutContext()
  const handleError = useErrorHandler()
  const { fileTreeData } = useFileTreeData()
  const [state, setState] = useState<RestoreState>('idle')
  const [restoredFileMetadata, setRestoredFileMetadata] =
    useState<RestoreFileResponse | null>(null)

  const isLoading = state === 'restoring' || state === 'waitingForFileTree'

  useEffect(() => {
    if (state === 'waitingForFileTree' && restoredFileMetadata) {
      const result = findInTree(fileTreeData, restoredFileMetadata.id)
      if (result) {
        setState('complete')
        const { _id: id } = result.entity
        setView('editor')

        // Once Angular is gone, these can be replaced with calls to context
        // methods
        if (restoredFileMetadata.type === 'doc') {
          ide.editorManager.openDocId(id)
        } else {
          ide.binaryFilesManager.openFileWithId(id)
        }
      }
    }
  }, [
    state,
    fileTreeData,
    restoredFileMetadata,
    ide.editorManager,
    ide.binaryFilesManager,
    setView,
  ])

  useEffect(() => {
    if (state === 'waitingForFileTree') {
      const timer = window.setTimeout(() => {
        setState('timedOut')
        handleError(new Error('timed out'))
      }, RESTORE_FILE_TIMEOUT)

      return () => {
        window.clearTimeout(timer)
      }
    }
  }, [handleError, state])

  const restoreSelectedFile = useCallback(
    (selection: HistoryContextValue['selection']) => {
      const { selectedFile, files } = selection

      if (selectedFile && selectedFile.pathname) {
        const file = files.find(file => file.pathname === selectedFile.pathname)

        if (file) {
          const deletedAtV = isFileRemoved(file) ? file.deletedAtV : undefined
          const toVersion = deletedAtV ?? selection.updateRange?.toV
          if (!toVersion) {
            return
          }
          setState('restoring')

          restoreFileToVersion(projectId, file.pathname, toVersion).then(
            (data: RestoreFileResponse) => {
              setRestoredFileMetadata(data)
              setState('waitingForFileTree')
            },
            error => {
              setState('error')
              handleError(error)
            }
          )
        }
      }
    },
    [handleError, projectId]
  )

  return { restoreSelectedFile, isLoading }
}
