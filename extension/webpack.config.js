/* eslint-disable @typescript-eslint/no-var-requires */

const path = require('path')

const config = (input, output) => {
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
  }
  mainFields.entry = input
  mainFields.output.filename = output
  return mainFields
}

module.exports = [
  config('./src/agent/index.ts', 'agent.js'),
  config('./src/background/index.ts', 'background.js'),
  config('./src/content/index.ts', 'content.js'),
  config('./src/devtools/index.ts', 'devtools.js'),
  config('./src/panel/index.ts', 'panel.js'),
  config('./src/stub/index.ts', 'stub.js'),
]
