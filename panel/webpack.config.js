/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-var-requires */

const path = require('path')
const { DefinePlugin } = require('webpack')
const {
  GlassEaselMiniprogramWebpackPlugin,
  GlassEaselMiniprogramWxmlLoader,
  GlassEaselMiniprogramWxssLoader,
} = require('glass-easel-miniprogram-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

module.exports = [
  {
    mode: 'production',
    entry: './src/bootstrap.ts',
    output: {
      filename: 'bootstrap.js',
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
          // wxml should be explicit handled with a loader
          test: /\.wxml$/,
          use: GlassEaselMiniprogramWxmlLoader,
          exclude: /node_modules/,
        },
        {
          // wxss should be explicit handled like CSS
          test: /\.wxss$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
            GlassEaselMiniprogramWxssLoader,
            // Add more loaders here if you work with less, sass, Stylus, etc.
            // Currently `@import` does not work well without a preprocessor (such as `less`).
            // This is a bug (#113) and will be fixed in future.
            'less-loader',
          ],
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
      new MiniCssExtractPlugin({
        filename: 'index.css',
      }),
      new GlassEaselMiniprogramWebpackPlugin({
        path: path.join(__dirname, 'src'),
        resourceFilePattern: /\.(jpg|jpeg|png|gif)$/,
        customBootstrap: true,
      }),
    ],
  },
]
