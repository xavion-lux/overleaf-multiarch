import { FC, useCallback } from 'react'
import useIsMounted from '@/shared/hooks/use-is-mounted'
import { useFileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { debugConsole } from '@/utils/debugging'

const FileViewPdf: FC<{
  fileId: string
  onLoad: () => void
  onError: () => void
}> = ({ fileId, onLoad, onError }) => {
  const mountedRef = useIsMounted()

  const { previewByPath, pathInFolder } = useFileTreePathContext()

  const handleContainer = useCallback(
    async (element: HTMLDivElement | null) => {
      if (element) {
        const { PDFJS } = await import(
          '../../pdf-preview/util/pdf-js-versions'
        ).then(m => m.default as any)

        // bail out if loading PDF.js took too long
        if (!mountedRef.current) {
          onError()
          return
        }

        const path = pathInFolder(fileId)
        const preview = path ? previewByPath(path) : null

        if (!preview) {
          onError()
          return
        }

        const pdf = await PDFJS.getDocument({
          url: preview.url,
          isEvalSupported: false,
        }).promise

        // bail out if loading the PDF took too long
        if (!mountedRef.current) {
          onError()
          return
        }

        element.textContent = '' // ensure the element is empty

        const scale = window.devicePixelRatio || 1

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const viewport = page.getViewport({ scale })

          const canvas = document.createElement('canvas')
          canvas.classList.add('pdf-page')
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.style.width = `${viewport.width / scale}px`
          canvas.style.height = `${viewport.height / scale}px`

          element.append(canvas)
          page.render({
            canvasContext: canvas.getContext('2d'),
            viewport,
          })
        }

        onLoad()

        return () => {
          pdf.cleanup().catch(debugConsole.error)
          pdf.destroy()
        }
      }
    },
    [mountedRef, pathInFolder, fileId, previewByPath, onLoad, onError]
  )

  return <div className="file-view-pdf" ref={handleContainer} />
}

export default FileViewPdf
