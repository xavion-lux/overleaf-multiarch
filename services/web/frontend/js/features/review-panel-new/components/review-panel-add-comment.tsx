import { FC, FormEventHandler, useCallback, useState, useRef } from 'react'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from '@/features/source-editor/components/codemirror-context'
import { EditorSelection } from '@codemirror/state'
import { useTranslation } from 'react-i18next'
import { useThreadsActionsContext } from '../context/threads-context'
import { removeNewCommentRangeEffect } from '@/features/source-editor/extensions/add-comment'
import useSubmittableTextInput from '../hooks/use-submittable-text-input'
import AutoExpandingTextArea from '@/shared/components/auto-expanding-text-area'
import { Button } from 'react-bootstrap'
import { ReviewPanelEntry } from './review-panel-entry'
import { ThreadId } from '../../../../../types/review-panel/review-panel'
import { Decoration } from '@codemirror/view'

export const ReviewPanelAddComment: FC<{
  docId: string
  from: number
  to: number
  value: Decoration
  top: number | undefined
}> = ({ from, to, value, top, docId }) => {
  const { t } = useTranslation()
  const view = useCodeMirrorViewContext()
  const state = useCodeMirrorStateContext()
  const { addComment } = useThreadsActionsContext()
  const [error, setError] = useState<Error>()
  const [submitting, setSubmitting] = useState(false)

  const handleClose = useCallback(() => {
    view.dispatch({
      effects: removeNewCommentRangeEffect.of(value),
    })
  }, [view, value])

  const submitForm = useCallback(
    message => {
      setSubmitting(true)

      const content = view.state.sliceDoc(from, to)

      addComment(from, content, message)
        .catch(setError)
        .finally(() => setSubmitting(false))

      view.dispatch({
        selection: EditorSelection.cursor(view.state.selection.main.anchor),
      })

      handleClose()
    },
    [addComment, view, handleClose, from, to]
  )

  const { handleChange, handleKeyPress, content } =
    useSubmittableTextInput(submitForm)

  const handleBlur = useCallback(() => {
    if (content === '') {
      handleClose()
    }
  }, [content, handleClose])

  const handleSubmit = useCallback<FormEventHandler>(
    event => {
      event.preventDefault()
      submitForm(content)
    },
    [submitForm, content]
  )

  // We only ever want to focus the element once
  const hasBeenFocused = useRef(false)

  // Auto-focus the textarea once the element has been correctly positioned.
  // We cannot use the autofocus attribute as we need to wait until the parent element
  // has been positioned (with the "top" attribute) to avoid scrolling to the initial
  // position of the element
  const observerCallback = useCallback(mutationList => {
    if (hasBeenFocused.current) {
      return
    }

    for (const mutation of mutationList) {
      if (mutation.target.style.top) {
        const textArea = mutation.target.getElementsByTagName('textarea')[0]
        if (textArea) {
          textArea.focus()
          hasBeenFocused.current = true
        }
      }
    }
  }, [])

  const handleElement = useCallback(
    (element: HTMLElement | null) => {
      if (element) {
        element.dispatchEvent(new Event('review-panel:position'))

        const observer = new MutationObserver(observerCallback)
        const entryWrapper = element.closest('.review-panel-entry')
        if (entryWrapper) {
          observer.observe(entryWrapper, {
            attributes: true,
            attributeFilter: ['style'],
          })
          return () => observer.disconnect()
        }
      }
    },
    [observerCallback]
  )

  return (
    <ReviewPanelEntry
      docId={docId}
      top={top}
      position={from}
      op={{
        p: from,
        c: state.sliceDoc(from, to),
        t: value.spec.id as ThreadId,
      }}
      selectLineOnFocus={false}
    >
      <form
        className="review-panel-entry-content"
        onBlur={handleBlur}
        onSubmit={handleSubmit}
        ref={handleElement}
      >
        <AutoExpandingTextArea
          name="message"
          className="review-panel-add-comment-textarea"
          onChange={handleChange}
          onKeyDown={handleKeyPress}
          placeholder={t('add_your_comment_here')}
          value={content}
          disabled={submitting}
        />
        <div className="review-panel-add-comment-buttons">
          <Button
            bsSize="sm"
            bsStyle={null}
            className="review-panel-add-comment-cancel-button"
            disabled={submitting}
            onClick={handleClose}
          >
            {t('cancel')}
          </Button>
          <Button
            type="submit"
            bsSize="sm"
            className="btn-primary"
            disabled={content === '' || submitting}
          >
            {t('comment')}
          </Button>
        </div>
        {error && <div>{error.message}</div>}
      </form>
    </ReviewPanelEntry>
  )
}
