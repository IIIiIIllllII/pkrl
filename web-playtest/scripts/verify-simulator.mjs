import {createHash} from 'node:crypto'
import {existsSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs'
import {dirname, join, relative, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const vendor = join(root, 'vendor/pokemon-showdown/dist')
const manifestPath = join(root, 'vendor/pokemon-showdown/runtime-sha256.json')
const upstream = resolve(root, '../third_party/pokemon-showdown/dist')

function files(path) {
  return readdirSync(path).flatMap(name => {
    const child = join(path, name)
    return statSync(child).isDirectory() ? files(child) : child.endsWith('.js') ? [child] : []
  })
}
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex')

if (process.argv.includes('--write')) {
  const hashes = Object.fromEntries(files(vendor).sort().map(path => [relative(vendor, path), sha256(path)]))
  writeFileSync(manifestPath, JSON.stringify({pokemon_showdown_commit: '2ddfa0476f8207e12e204b1c69f7c7683b17633c', files: hashes}, null, 2) + '\n')
  console.log(`wrote ${Object.keys(hashes).length} hashes`)
  process.exit(0)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
for (const [name, expected] of Object.entries(manifest.files)) {
  const vendored = join(vendor, name)
  if (!existsSync(vendored) || sha256(vendored) !== expected) throw new Error(`vendored simulator mismatch: ${name}`)
  if (existsSync(upstream) && sha256(join(upstream, name)) !== expected) throw new Error(`training checkout mismatch: ${name}`)
}
console.log(`verified ${Object.keys(manifest.files).length} exact runtime files at ${manifest.pokemon_showdown_commit}`)
