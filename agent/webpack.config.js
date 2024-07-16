/* eslint-disable @typescript-eslint/no-var-requires */

const path = require('path')

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
    devtool: 'inline-source-map',
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
  },
]
