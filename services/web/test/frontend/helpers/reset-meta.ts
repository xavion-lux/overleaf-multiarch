export function resetMeta() {
  window.metaAttributesCache = new Map()
  window.metaAttributesCache.set('ol-i18n', { currentLangCode: 'en' })
  window.metaAttributesCache.set('ol-ExposedSettings', {
    appName: 'Overleaf',
    maxEntitiesPerProject: 10,
    maxUploadSize: 5 * 1024 * 1024,
    siteUrl: 'https://www.dev-overleaf.com',
    hasLinkUrlFeature: true,
    hasLinkedProjectFileFeature: true,
    hasLinkedProjectOutputFileFeature: true,
    textExtensions: [
      'tex',
      'latex',
      'sty',
      'cls',
      'bst',
      'bib',
      'bibtex',
      'txt',
      'tikz',
      'mtx',
      'rtex',
      'md',
      'asy',
      'lbx',
      'bbx',
      'cbx',
      'm',
      'lco',
      'dtx',
      'ins',
      'ist',
      'def',
      'clo',
      'ldf',
      'rmd',
      'lua',
      'gv',
      'mf',
      'lhs',
      'mk',
      'xmpdata',
      'cfg',
      'rnw',
      'ltx',
      'inc',
    ],
    editableFilenames: ['latexmkrc', '.latexmkrc', 'makefile', 'gnumakefile'],
  })
}
