import { cp, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const standalone = path.join(root, '.next', 'standalone')

async function copyDirectory(source, destination) {
  try {
    if (!(await stat(source)).isDirectory()) return
  } catch {
    return
  }

  await mkdir(path.dirname(destination), { recursive: true })
  await cp(source, destination, { recursive: true, force: true })
}

await copyDirectory(path.join(root, 'public'), path.join(standalone, 'public'))
await copyDirectory(
  path.join(root, '.next', 'static'),
  path.join(standalone, '.next', 'static'),
)

process.env.HOSTNAME ||= '0.0.0.0'
process.env.PORT ||= '4040'

await import(pathToFileURL(path.join(standalone, 'server.js')).href)
