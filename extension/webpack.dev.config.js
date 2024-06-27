/* eslint-disable @typescript-eslint/no-var-requires */

const config = require('./webpack.config')

config.forEach((config) => {
  config.mode = 'development'
  config.resolve.alias['glass-easel'] = 'glass-easel/dist/glass_easel.dev.all.es.js'
})

module.exports = config
