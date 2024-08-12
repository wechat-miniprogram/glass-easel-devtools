/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-var-requires */

const path = require('path')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

module.exports = [
  {
    mode: 'production',
    entry: './src/agent.ts',
    output: {
      filename: 'agent.js',
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
  },
  {
    mode: 'production',
    entry: './src/panel.ts',
    output: {
      filename: 'panel.js',
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
  },
]
