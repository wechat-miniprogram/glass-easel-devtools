/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-var-requires */

const path = require('path')
const { DefinePlugin } = require('webpack')

module.exports = [
  {
    mode: 'production',
    entry: './src/index.ts',
    output: {
      filename: 'index.js',
      path: path.join(__dirname, 'dist'),
      library: {
        type: 'commonjs2',
      },
    },
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        'glass-easel': 'glass-easel',
      },
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          loader: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.wxml$/,
          loader: path.join(__dirname, 'wxml_loader'),
          exclude: /node_modules/,
        },
      ],
    },
    performance: {
      hints: false,
      maxEntrypointSize: 4 * 1024 * 1024,
      maxAssetSize: 4 * 1024 * 1024,
    },
    plugins: [
      new DefinePlugin({
        DEV: 'false',
      }),
    ],
  },
]
