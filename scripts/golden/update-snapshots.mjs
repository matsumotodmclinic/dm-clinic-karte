// スナップショット更新用ラッパー（Windows でも `UPDATE_SNAPSHOTS=1 ...` を書かずに済むように）
//   npm run test:update
// 更新後は必ず git diff でプロンプトの変化を目視確認してからコミットすること。
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const r = spawnSync(process.execPath, ['--test', join(HERE, 'prompt.test.mjs')], {
  stdio: 'inherit',
  env: { ...process.env, UPDATE_SNAPSHOTS: '1' },
})
process.exit(r.status ?? 1)
