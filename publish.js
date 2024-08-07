/* eslint-disable no-console */

const fs = require('fs')
const childProcess = require('child_process')

const writeFileAndGitAdd = (p, content) => {
  fs.writeFileSync(p, content)
  if (childProcess.spawnSync('git', ['add', p]).status !== 0) {
    throw new Error(`failed to execute git add on ${p}`)
  }
}

// check arguments
const version = process.argv[2]
if (!version) {
  throw new Error('version not given in argv')
}
if (!/[0-9]+\.[0-9]+\.[0-9]+(-alpha\.[0-9]+|-beta\.[0-9]+)?/.test(version)) {
  throw new Error('version illegal')
}

// avoid eslint warnings
;['agent', 'panel', 'extension', 'examples'].forEach((p) => {
  console.info(`Run eslint on ${p}`)
  if (
    childProcess.spawnSync('npx', ['eslint', '-c', '../.eslintrc.js', '.'], {
      cwd: p,
      stdio: 'inherit',
    }).status !== 0
  ) {
    throw new Error('failed to lint modules (are there eslint warnings or errors?)')
  }
})

// check git status
const gitStatusRes = childProcess.spawnSync('git', ['diff', '--name-only'], { encoding: 'utf8' })
if (gitStatusRes.status !== 0 || gitStatusRes.stdout.length > 0) {
  throw new Error('failed to check git status (are there uncommitted changes?)')
}

// change npm version
;[
  'agent/package.json',
  'panel/package.json',
  'extension/package.json',
  'examples/miniprogram/package.json',
  'examples/standalone/package.json',
].forEach((p) => {
  let content = fs.readFileSync(p, { encoding: 'utf8' })
  let oldVersion
  const refVersions = []
  content = content.replace(/"version": "(.+)"/, (_, v) => {
    oldVersion = v
    return `"version": "${version}"`
  })
  if (!oldVersion) {
    throw new Error(`version segment not found in ${p}`)
  }
  console.info(`Update ${p} version from "${oldVersion}" to "${version}"`)
  refVersions.forEach(({ mod, v }) => {
    console.info(`  + dependency ${mod} version from "${v}" to "${version}"`)
  })
  writeFileAndGitAdd(p, content)
})

// pnpm install
console.info('Run pnpm install')
if (childProcess.spawnSync('pnpm', ['install'], { stdio: 'inherit' }).status !== 0) {
  throw new Error('failed to clean glass-easel dist')
}

// compile agent
;['agent', 'panel', 'extension', 'examples/miniprogram', 'examples/standalone'].forEach((p) => {
  console.info(`Compile ${p}`)
  if (childProcess.spawnSync('rm', ['-rf', 'dist'], { cwd: p }).status !== 0) {
    throw new Error('failed to clean dist')
  }
  if (
    childProcess.spawnSync('npm', ['run', 'build'], {
      cwd: p,
      env: { GLASS_EASEL_ARGS: '', ...process.env },
      stdio: 'inherit',
    }).status !== 0
  ) {
    throw new Error(`failed to compile ${p}`)
  }
})

// npm test
console.info('Run pnpm test')
if (childProcess.spawnSync('pnpm', ['test', '-r'], { stdio: 'inherit' }).status !== 0) {
  throw new Error('failed to clean glass-easel dist')
}

// add lock files
;['pnpm-lock.yaml'].forEach((p) => {
  if (childProcess.spawnSync('git', ['add', p]).status !== 0) {
    throw new Error(`failed to execute git add on ${p}`)
  }
})

// git commit
if (
  childProcess.spawnSync('git', ['commit', '--message', `version: ${version}`], {
    stdio: 'inherit',
  }).status !== 0
) {
  throw new Error('failed to execute git commit')
}

// publish js modules
;['agent', 'panel', 'extension', 'examples/miniprogram', 'examples/standalone'].forEach((p) => {
  console.info(`Publish ${p} to npmjs`)
  if (
    childProcess.spawnSync('pnpm', ['publish', '--registry', 'https://registry.npmjs.org'], {
      cwd: p,
      stdio: 'inherit',
    }).status !== 0
  ) {
    throw new Error('failed to publish to npmjs')
  }
})

// add a git tag and push
console.info('Push to git origin')
if (childProcess.spawnSync('git', ['tag', `v${version}`]).status !== 0) {
  throw new Error('failed to execute git tag')
}
if (childProcess.spawnSync('git', ['push'], { stdio: 'inherit' }).status !== 0) {
  throw new Error('failed to execute git push')
}
if (childProcess.spawnSync('git', ['push', '--tags'], { stdio: 'inherit' }).status !== 0) {
  throw new Error('failed to execute git push --tags')
}

console.info('All done!')
