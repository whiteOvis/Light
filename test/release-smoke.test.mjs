import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(join(root, path), 'utf8')

test('public package has its stable identity and complete runtime', () => {
  const manifest = JSON.parse(read('manifest.json'))
  assert.equal(manifest.id, 'light.bible-reader')
  assert.equal(manifest.barWidget.allowMultiple, false)
  for (const path of [
    'BarWidget.qml', 'Panel.qml', 'LightView.qml', 'components/PreferenceUtils.js',
    'components/RadioStations.js', 'components/SettingsToggleRow.qml',
    'service/src/daemon.js',
    'service/src/platform-config.js', 'service/src/oauth-dispatch.js',
    'LICENSE', 'THIRD_PARTY_NOTICES.md', 'install.sh', 'uninstall.sh',
  ]) assert.ok(existsSync(join(root, path)), `missing release file: ${path}`)
  for (const path of [
    'service/assets/kjv-1769.json.gz', 'service/assets/kjv-red-letters.json.gz',
    'service/src/bundled-kjv.js', 'service/src/strongs-study.js',
    'service/src/concordance-index.js', 'service/assets/strongs-study.db',
    'components/StrongsPopup.qml',
  ]) assert.equal(existsSync(join(root, path)), false, `bundled KJV leaked into release: ${path}`)
})

test('public package contains no development plugin identity or private state', () => {
  const production = [
    'manifest.json', 'BarWidget.qml', 'Panel.qml', 'LightView.qml',
    'install.sh', 'uninstall.sh',
  ].map(read).join('\n')
  assert.doesNotMatch(production, /local\.light/)
  for (const path of ['service/.env', 'service/light.sqlite', 'service/token.key'])
    assert.equal(existsSync(join(root, path)), false)
  assert.doesNotMatch(read('service/.env.example'), /YVP_APP_KEY/)
  assert.doesNotMatch(read('install.sh'), /YVP_APP_KEY/)
  assert.match(read('README.md'), /YouVersion’s API requirements/)
  assert.doesNotMatch(read('README.md'), /LOCAL_PATH|LIGHT_KJV_BUILD_SOURCE/)
})

test('optional heavyweight interfaces are loaded only when requested', () => {
  const panel = read('Panel.qml')
  assert.match(panel, /property bool radioPlayerLoaded: false/)
  assert.match(panel, /property bool settingsLoaded: false/)
  assert.match(panel, /id: verseLoader[\s\S]*?active: root\.verseOfTheDayOpened/)
  assert.match(panel, /id: radioLoader[\s\S]*?active: root\.musicPlayerEnabled[\s\S]*?root\.radioPlayerLoaded/)
  assert.match(panel, /id: settingsLoader[\s\S]*?active: root\.settingsLoaded/)
})

test('the shipped Catholic station appears exactly once and wins over legacy custom copies', () => {
  const catalog = read('components/RadioStations.js')
  assert.equal((catalog.match(/name: "Classical Catholic Radio"/g) || []).length, 1)
  const stations = [...catalog.matchAll(/\{ id: "([^"]+)", name: /g)].map((match) => match[1])
  assert.equal(stations[3], 'classical-catholic-radio')
  assert.match(catalog, /function mergedStations\(visibleBuiltIns, customStations, allBuiltIns\)/)
})

test('public reader starts without a Bible version and offers sign-in', () => {
  assert.match(read('components/BibleData.js'), /function defaultVersionOptions\(\) \{\s*return \[\]/)
  assert.match(read('components/BibleSelector.qml'), /property string selectedVersion: ""/)
  assert.match(read('Panel.qml'), /signInToRead/)
})
