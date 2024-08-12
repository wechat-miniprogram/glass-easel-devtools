/* eslint-disable import/no-extraneous-dependencies */

const fs = require('fs')
const path = require('path')
const archiver = require('archiver')

fs.mkdirSync(path.join(__dirname, 'pkg'), { recursive: true })

const createZip = (outName, dirs, files) =>
  new Promise((resolve) => {
    const output = fs.createWriteStream(path.join(__dirname, 'pkg', outName))
    const archive = archiver('zip', {
      zlib: { level: 9 },
    })
    output.on('close', () => {
      resolve()
    })
    output.on('warning', (err) => {
      throw err
    })
    output.on('error', (err) => {
      throw err
    })
    archive.pipe(output)
    Object.entries(dirs).forEach(([key, value]) => {
      archive.directory(key, value)
    })
    Object.entries(files).forEach(([key, value]) => {
      archive.file(key, { name: value })
    })
    archive.finalize()
  })

createZip(
  'glass-easel-devtools-chrome.zip',
  { dist: 'dist', icons: 'icons' },
  { 'chrome.manifest.json': 'manifest.json' },
)

createZip(
  'glass-easel-devtools-firefox.zip',
  { dist: 'dist', icons: 'icons' },
  { 'firefox.manifest.json': 'manifest.json' },
)

createZip(
  'source.zip',
  {
    src: 'extension/src',
    icons: 'extension/icons',
    '../agent/src': 'agent/src',
    '../panel/src': 'panel/src',
    '../panel/typings': 'panel/typings',
  },
  {
    'README.md': 'README.md',
    'package.json': 'extension/package.json',
    'tsconfig.json': 'extension/tsconfig.json',
    'webpack.config.js': 'extension/webpack.config.js',
    'pack.js': 'extension/pack.js',
    '../package.json': 'package.json',
    '../pnpm-lock.yaml': 'pnpm-lock.yaml',
    '../pnpm-workspace.yaml': 'pnpm-workspace.yaml',
    '../tsconfig.json': 'tsconfig.json',
    '../agent/package.json': 'agent/package.json',
    '../agent/tsconfig.json': 'agent/tsconfig.json',
    '../agent/webpack.config.js': 'agent/webpack.config.js',
    '../agent/wxml_loader.js': 'agent/wxml_loader.js',
    '../panel/package.json': 'panel/package.json',
    '../panel/tsconfig.json': 'panel/tsconfig.json',
    '../panel/webpack.config.js': 'panel/webpack.config.js',
    '../panel/src.d.ts': 'panel/src.d.ts',
  },
)
