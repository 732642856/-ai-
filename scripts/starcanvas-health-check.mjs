#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const webDir = join(root, 'apps', 'web')
const requiredFiles = [
  'package.json',
  'pnpm-lock.yaml',
  'apps/web/package.json',
  'apps/web/src/app/page.tsx',
  'apps/web/src/app/canvas/page.tsx',
  'apps/web/src/app/canvas/StarCanvas.tsx',
]
const requiredWebDeps = ['next', 'react', 'react-dom', '@xyflow/react', 'zustand', 'mammoth', 'pdfjs-dist']

function step(name, ok, detail = '') {
  const mark = ok ? '✅' : '❌'
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ''}`)
  return ok
}

function run(cmd, args, cwd = root) {
  const result = spawnSync(cmd, args, { cwd, stdio: 'pipe', encoding: 'utf8', shell: false })
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  }
}

console.log('=== StarCanvas Health Check ===')
console.log(`root: ${root}`)

let ok = true
for (const file of requiredFiles) {
  ok = step(`file ${file}`, existsSync(join(root, file))) && ok
}

const webPkgPath = join(webDir, 'package.json')
if (existsSync(webPkgPath)) {
  const webPkg = JSON.parse(readFileSync(webPkgPath, 'utf8'))
  for (const dep of requiredWebDeps) {
    const present = Boolean(webPkg.dependencies?.[dep] || webPkg.devDependencies?.[dep])
    ok = step(`dependency ${dep}`, present, present ? webPkg.dependencies?.[dep] || webPkg.devDependencies?.[dep] : 'missing') && ok
  }
}

const nextLock = join(webDir, '.next', 'dev', 'lock')
if (existsSync(nextLock)) {
  try {
    rmSync(nextLock, { force: true })
    step('stale Next dev lock cleanup', true, nextLock)
  } catch (error) {
    ok = step('stale Next dev lock cleanup', false, error.message) && ok
  }
} else {
  step('stale Next dev lock cleanup', true, 'no lock')
}

const typecheck = run('pnpm', ['-C', 'apps/web', 'exec', 'tsc', '--noEmit', '--skipLibCheck'])
ok = step('TypeScript', typecheck.ok, typecheck.ok ? '0 errors' : `exit ${typecheck.status}`) && ok
if (!typecheck.ok) {
  console.log((typecheck.stdout + typecheck.stderr).split('\n').slice(-60).join('\n'))
}

const build = run('pnpm', ['-C', 'apps/web', 'run', 'build'])
ok = step('Next production build', build.ok, build.ok ? 'compiled' : `exit ${build.status}`) && ok
if (!build.ok) {
  console.log((build.stdout + build.stderr).split('\n').slice(-80).join('\n'))
}

console.log(ok ? '=== HEALTH OK ===' : '=== HEALTH FAILED ===')
process.exit(ok ? 0 : 1)
