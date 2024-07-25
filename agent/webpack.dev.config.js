/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-var-requires */

const { DefinePlugin } = require('webpack')
const config = require('./webpack.config')

config[0].mode = 'development'
config[0].devtool = 'inline-source-map'
config[0].plugins[0] = new DefinePlugin({ DEV: 'true' })
// config[0].resolve.alias['glass-easel'] = 'glass-easel/dist/glass_easel.dev.all.es.js'

module.exports = config
