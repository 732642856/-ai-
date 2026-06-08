#!/usr/bin/env node
import { existsSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const root = process.cwd()
const webDir = join(root, 'apps', 'web')
const requestedPort = Number(process.env.PORT || process.argv.find((arg) => /^\d+$/.test(arg)) || 3100)

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => server.close(() => resolve(true)))
    server.listen(port, '0.0.0.0')
  })
}

async function findFreePort(start) {
  for (let port = start; port < start + 20; port += 1) {
    if (await isPortFree(port)) return port
  }
  throw new Error(`No free port found from ${start} to ${start + 19}`)
}

const nextLock = join(webDir, '.next', 'dev', 'lock')
if (existsSync(nextLock)) {
  try {
    rmSync(nextLock, { force: true })
    console.log(`[starcanvas-dev-safe] removed stale lock: ${nextLock}`)
  } catch (error) {
    console.warn(`[starcanvas-dev-safe] could not remove stale lock: ${error.message}`)
  }
}

const port = await findFreePort(requestedPort)
if (port !== requestedPort) {
  console.log(`[starcanvas-dev-safe] port ${requestedPort} is busy, using ${port}`)
}
console.log(`[starcanvas-dev-safe] starting StarCanvas at http://localhost:${port}/canvas`)

const child = spawn('pnpm', ['-C', 'apps/web', 'exec', 'next', 'dev', '--webpack', '-p', String(port)], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PORT: String(port) },
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})
