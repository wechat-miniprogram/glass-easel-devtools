/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-var-requires */

const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')

const config = (input, output, copyRes) => {
  const mainFields = {
    mode: 'production',
    entry: '[INPUT]',
    output: {
      filename: '[OUTPUT]',
      path: path.join(__dirname, 'dist'),
      module: false,
      iife: true,
    },
    devtool: 'source-map',
    resolve: {
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          loader: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    performance: {
      hints: false,
      maxEntrypointSize: 4 * 1024 * 1024,
      maxAssetSize: 4 * 1024 * 1024,
    },
    plugins: [],
  }
  mainFields.entry = input
  mainFields.output.filename = output
  if (copyRes) {
    mainFields.plugins.push(new CopyPlugin(copyRes))
  }
  return mainFields
}

module.exports = [
  config('./src/agent/index.ts', 'agent.js'),
  config('./src/background/index.ts', 'background.js'),
  config('./src/content/index.ts', 'content.js'),
  config('./src/devtools/index.ts', 'devtools.js', {
    patterns: [
      {
        from: 'src/devtools/index.html',
        to: 'devtools.html',
        toType: 'file',
      },
    ],
  }),
  config('./src/panel/index.ts', 'panel.js', {
    patterns: [
      {
        from: '**/*.+(jpg|jpeg|png|gif|css)',
        to: '',
        context: 'node_modules/glass-easel-devtools-panel/dist/',
      },
      {
        from: 'src/panel/index.html',
        to: 'panel.html',
        toType: 'file',
      },
    ],
  }),
  config('./src/stub/index.ts', 'stub.js'),
]
