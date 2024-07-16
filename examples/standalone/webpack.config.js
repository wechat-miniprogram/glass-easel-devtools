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
  },
]
