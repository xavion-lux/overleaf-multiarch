import React, { FC, useMemo } from 'react'
import { useThreadsContext } from '../context/threads-context'
import { useTranslation } from 'react-i18next'
import { ReviewPanelResolvedThread } from './review-panel-resolved-thread'
import useProjectRanges from '../hooks/use-project-ranges'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import Icon from '@/shared/components/icon'
import { Change, CommentOperation } from '../../../../../types/change'

export const ReviewPanelResolvedThreadsMenu: FC = () => {
  const { t } = useTranslation()
  const threads = useThreadsContext()
  const { docs } = useFileTreeData()

  const { projectRanges, loading } = useProjectRanges()

  const docNameForThread = useMemo(() => {
    const docNameForThread = new Map<string, string>()

    for (const [docId, ranges] of projectRanges?.entries() ?? []) {
      const docName = docs?.find(doc => doc.doc.id === docId)?.doc.name
      if (docName !== undefined) {
        for (const comment of ranges.comments) {
          const threadId = comment.op.t
          docNameForThread.set(threadId, docName)
        }
      }
    }

    return docNameForThread
  }, [docs, projectRanges])

  const allComments = useMemo(() => {
    const allComments = new Map<string, Change<CommentOperation>>()

    // eslint-disable-next-line no-unused-vars
    for (const [_, ranges] of projectRanges?.entries() ?? []) {
      for (const comment of ranges.comments) {
        allComments.set(comment.op.t, comment)
      }
    }

    return allComments
  }, [projectRanges])

  const resolvedThreads = useMemo(() => {
    if (!threads) {
      return []
    }

    const resolvedThreads = []
    for (const [id, thread] of Object.entries(threads)) {
      if (thread.resolved) {
        resolvedThreads.push({ thread, id })
      }
    }
    return resolvedThreads
  }, [threads])

  if (loading) {
    return (
      <div className="review-panel-resolved-comments-loading">
        <Icon type="spinner" spin />
      </div>
    )
  }

  if (!resolvedThreads.length) {
    return (
      <div className="review-panel-resolved-comments-empty">
        {t('no_resolved_comments')}
      </div>
    )
  }

  return (
    <>
      <div className="review-panel-resolved-comments-header">
        <div className="review-panel-resolved-comments-label">
          {t('resolved_comments')}
        </div>
        <div className="review-panel-resolved-comments-count">
          {resolvedThreads.length}
        </div>
      </div>
      {resolvedThreads.map(thread => {
        const comment = allComments.get(thread.id)
        if (!comment) {
          return null
        }

        return (
          <ReviewPanelResolvedThread
            key={thread.id}
            id={thread.id}
            comment={comment}
            docName={docNameForThread.get(thread.id) ?? t('unknown')}
          />
        )
      })}
    </>
  )
}
