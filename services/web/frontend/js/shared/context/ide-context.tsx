import { createContext, FC, useContext, useEffect, useMemo } from 'react'
import { ScopeValueStore } from '../../../../types/ide/scope-value-store'
import { Scope } from '../../../../types/angular/scope'
import getMeta from '@/utils/meta'
import { ScopeEventEmitter } from '../../../../types/ide/scope-event-emitter'

export type Ide = {
  [key: string]: any // TODO: define the rest of the `ide` and `$scope` properties
  $scope: Scope
}

type IdeContextValue = Ide & {
  isReactIde: boolean
  scopeStore: ScopeValueStore
  scopeEventEmitter: ScopeEventEmitter
}

const IdeContext = createContext<IdeContextValue | undefined>(undefined)
const isReactIde: boolean = getMeta('ol-idePageReact')

export const IdeProvider: FC<{
  ide: Ide
  scopeStore: ScopeValueStore
  scopeEventEmitter: ScopeEventEmitter
}> = ({ ide, scopeStore, scopeEventEmitter, children }) => {
  /**
   * Expose scopeStore via `window.overleaf.unstable.store`, so it can be accessed by external extensions.
   *
   * These properties are expected to be available:
   *   - `editor.view`
   *   - `project.spellcheckLanguage`
   *   - `editor.open_doc_name`,
   *   - `editor.open_doc_id`,
   */
  useEffect(() => {
    window.overleaf = {
      ...window.overleaf,
      unstable: {
        ...window.overleaf?.unstable,
        store: scopeStore,
      },
    }
  }, [scopeStore])

  const value = useMemo<IdeContextValue>(() => {
    return {
      ...ide,
      isReactIde,
      scopeStore,
      scopeEventEmitter,
    }
  }, [ide, scopeStore, scopeEventEmitter])

  return <IdeContext.Provider value={value}>{children}</IdeContext.Provider>
}

export function useIdeContext(): IdeContextValue {
  const context = useContext(IdeContext)

  if (!context) {
    throw new Error('useIdeContext is only available inside IdeProvider')
  }

  return context
}
