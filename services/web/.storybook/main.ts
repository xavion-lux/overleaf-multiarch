import type { StorybookConfig } from '@storybook/react-webpack5'
import path from 'node:path'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'

const rootDir = path.resolve(__dirname, '..')

// NOTE: must be set before webpack config is imported
process.env.OVERLEAF_CONFIG = path.join(rootDir, 'config/settings.webpack.js')

function getAbsolutePath(value: string): any {
  return path.dirname(require.resolve(path.join(value, 'package.json')))
}

const config: StorybookConfig = {
  core: {
    disableTelemetry: true,
  },
  staticDirs: [path.join(rootDir, 'public')],
  stories: [
    path.join(rootDir, 'frontend/stories/**/*.stories.{js,jsx,ts,tsx}'),
    path.join(rootDir, 'modules/**/stories/**/*.stories.{js,jsx,ts,tsx}'),
  ],
  addons: [
    getAbsolutePath('@storybook/addon-links'),
    getAbsolutePath('@storybook/addon-essentials'),
    getAbsolutePath('@storybook/addon-interactions'),
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@storybook/addon-webpack5-compiler-babel'),
    {
      name: getAbsolutePath('@storybook/addon-styling-webpack'),
      options: {
        rules: [
          {
            test: /\.css$/,
            use: [
              { loader: MiniCssExtractPlugin.loader },
              { loader: 'css-loader' },
            ],
          },
          {
            test: /\.less$/,
            use: [
              { loader: MiniCssExtractPlugin.loader },
              { loader: 'css-loader' },
              { loader: 'less-loader' },
            ],
          },
        ],
        plugins: [new MiniCssExtractPlugin()],
      },
    },
  ],
  framework: {
    name: getAbsolutePath('@storybook/react-webpack5'),
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  babel: (options: Record<string, any>) => {
    return {
      ...options,
      plugins: [
        // ensure that TSX files are transformed before other plugins run
        ['@babel/plugin-transform-typescript', { isTSX: true }],
        ...(options.plugins ?? []),
      ],
    }
  },
  webpackFinal: storybookConfig => {
    return {
      ...storybookConfig,
      resolve: {
        ...storybookConfig.resolve,
        fallback: {
          ...storybookConfig.resolve?.fallback,
          fs: false,
          os: false,
          module: false,
        },
        extensions: ['.js', '.jsx', '.mjs', '.ts', '.tsx', '.json'],
        alias: {
          ...storybookConfig.resolve?.alias,
          // custom prefixes for import paths
          '@': path.join(rootDir, 'frontend/js/'),
        },
      },
    }
  },
}
export default config
