import type { Preview } from '@storybook/react'

// Storybook does not (currently) support async loading of "stories". Therefore
// the strategy in frontend/js/i18n.js does not work (because we cannot wait on
// the promise to resolve).
// Therefore we have to use the synchronous method for configuring
// react-i18next. Because this, we can only hard-code a single language.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
// @ts-ignore
import en from '../../../services/web/locales/en.json'
import { bootstrapVersionArg } from './utils/with-bootstrap-switcher'

function resetMeta(bootstrapVersion?: 3 | 5) {
  window.metaAttributesCache = new Map()
  window.metaAttributesCache.set('ol-i18n', { currentLangCode: 'en' })
  if (bootstrapVersion) {
    window.metaAttributesCache.set('ol-bootstrapVersion', bootstrapVersion)
  }
  window.metaAttributesCache.set('ol-ExposedSettings', {
    adminEmail: 'placeholder@example.com',
    appName: 'Overleaf',
    cookieDomain: '.overleaf.stories',
    dropboxAppName: 'Overleaf-Stories',
    emailConfirmationDisabled: false,
    enableSubscriptions: true,
    hasAffiliationsFeature: false,
    hasLinkUrlFeature: true,
    hasLinkedProjectFileFeature: true,
    hasLinkedProjectOutputFileFeature: true,
    hasSamlFeature: true,
    ieeeBrandId: 15,
    isOverleaf: true,
    labsEnabled: true,
    maxEntitiesPerProject: 10,
    maxUploadSize: 5 * 1024 * 1024,
    recaptchaDisabled: {
      invite: true,
      login: true,
      passwordReset: true,
      register: true,
      addEmail: true,
    },
    sentryAllowedOriginRegex: '',
    siteUrl: 'http://localhost',
    templateLinks: [],
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
    validRootDocExtensions: ['tex', 'Rtex', 'ltx', 'Rnw'],
    fileIgnorePattern:
      '**/{{__MACOSX,.git,.texpadtmp,.R}{,/**},.!(latexmkrc),*.{dvi,aux,log,toc,out,pdfsync,synctex,synctex(busy),fdb_latexmk,fls,nlo,ind,glo,gls,glg,bbl,blg,doc,docx,gz,swp}}',
    projectUploadTimeout: 12000,
  })
}

i18n.use(initReactI18next).init({
  lng: 'en',

  // still using the v3 plural suffixes
  compatibilityJSON: 'v3',

  resources: {
    en: { translation: en },
  },

  react: {
    useSuspense: false,
    transSupportBasicHtmlNodes: false,
  },

  interpolation: {
    prefix: '__',
    suffix: '__',
    unescapeSuffix: 'HTML',
    skipOnVariables: true,
    escapeValue: false,
    defaultVariables: {
      appName: 'Overleaf',
    },
  },
})

const preview: Preview = {
  parameters: {
    // Automatically mark prop-types like onClick, onToggle, etc as Storybook
    // "actions", so that they are logged in the Actions pane at the bottom of the
    // viewer
    actions: { argTypesRegex: '^on.*' },
    docs: {
      // render stories in iframes, to isolate modals
      inlineStories: false,
    },
    // Default to Bootstrap 3 styles
    bootstrap5: false,
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Editor theme',
      defaultValue: 'main-',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'main-', title: 'Default' },
          { value: 'main-light-', title: 'Light' },
          { value: 'main-ieee-', title: 'IEEE' },
        ],
      },
    },
  },
  loaders: [
    async ({ globals }) => {
      const { theme } = globals

      return {
        // NOTE: this uses `${theme}style.less` rather than `${theme}.less`
        // so that webpack only bundles files ending with "style.less"
        bootstrap3Style: await import(
          `!!to-string-loader!css-loader!less-loader!../../../services/web/frontend/stylesheets/${theme}style.less`
        ),
        // NOTE: this uses `${theme}style.scss` rather than `${theme}.scss`
        // so that webpack only bundles files ending with "style.scss"
        bootstrap5Style: await import(
          `!!to-string-loader!css-loader!resolve-url-loader!sass-loader!../../../services/web/frontend/stylesheets/bootstrap-5/${theme}style.scss`
        ),
      }
    },
  ],
  decorators: [
    (Story, context) => {
      const { bootstrap3Style, bootstrap5Style } = context.loaded
      const bootstrapVersion = Number(
        context.args[bootstrapVersionArg] ||
          (context.parameters.bootstrap5 ? 5 : 3)
      ) as 3 | 5
      const activeStyle =
        bootstrapVersion === 5 ? bootstrap5Style : bootstrap3Style

      resetMeta(bootstrapVersion)

      return (
        <>
          {activeStyle && <style>{activeStyle.default}</style>}
          <Story
            {...context}
            // force re-renders when switching between Bootstrap versions
            key={bootstrapVersion}
          />
        </>
      )
    },
  ],
}

export default preview

// Populate meta for top-level access in modules on import
resetMeta()
