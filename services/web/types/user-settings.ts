import {
  FontFamily,
  LineHeight,
  OverallTheme,
} from '@/features/source-editor/extensions/theme'

export type Keybindings = 'none' | 'default' | 'vim' | 'emacs'
export type PdfViewer = 'pdfjs' | 'native'

export type UserSettings = {
  pdfViewer: PdfViewer
  autoComplete: boolean
  autoPairDelimiters: boolean
  syntaxValidation: boolean
  editorTheme: string
  overallTheme: OverallTheme
  mode: Keybindings
  fontSize: number
  fontFamily: FontFamily
  lineHeight: LineHeight
  mathPreview: boolean
}
