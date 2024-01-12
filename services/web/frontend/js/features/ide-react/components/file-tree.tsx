import React, { useCallback, useState } from 'react'
import { useUserContext } from '@/shared/context/user-context'
import { useReferencesContext } from '@/features/ide-react/context/references-context'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { RefProviders } from '../../../../../types/user'
import FileTreeRoot from '@/features/file-tree/components/file-tree-root'
import { useFileTreeOpenContext } from '@/features/ide-react/context/file-tree-open-context'

export function FileTree() {
  const user = useUserContext()
  const { indexAllReferences } = useReferencesContext()
  const { setStartedFreeTrial } = useIdeReactContext()
  const { isConnected, connectionState } = useConnectionContext()
  const { handleFileTreeInit, handleFileTreeSelect, handleFileTreeDelete } =
    useFileTreeOpenContext()

  const [refProviders, setRefProviders] = useState<RefProviders>(
    () => user.refProviders || {}
  )

  function reindexReferences() {
    indexAllReferences(true)
  }

  const setRefProviderEnabled = useCallback(
    (provider: keyof RefProviders, value = true) => {
      setRefProviders(refProviders => ({ ...refProviders, [provider]: value }))
    },
    []
  )

  return (
    <div className="file-tree">
      <FileTreeRoot
        refProviders={refProviders}
        reindexReferences={reindexReferences}
        setRefProviderEnabled={setRefProviderEnabled}
        setStartedFreeTrial={setStartedFreeTrial}
        isConnected={isConnected || connectionState.reconnectAt !== null}
        onInit={handleFileTreeInit}
        onSelect={handleFileTreeSelect}
        onDelete={handleFileTreeDelete}
      />
    </div>
  )
}
