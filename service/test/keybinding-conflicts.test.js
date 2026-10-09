import assert from 'node:assert/strict';
import test from 'node:test';
import { checkSystemKeybindingConflicts } from '../src/keybinding-conflicts.js';
import { DEFAULT_KEYBINDINGS, normalizeKeybindings } from '../src/user-data-manager.js';

test('new section and skin shortcuts merge into saved bindings and remain rebindable', () => {
  const merged = normalizeKeybindings({ openSettings: 'Ctrl+P' });
  assert.equal(merged.openSettings, 'Ctrl+P');
  for (const [index, section] of ['Reading', 'Account', 'Backup', 'Appearance', 'Radio', 'Shortcuts', 'Languages'].entries())
    assert.equal(merged['settings' + section], 'Ctrl+Shift+' + (index + 1));
  assert.equal(merged.cycleRadioSkin, 'Ctrl+Shift+M');
  const rebound = normalizeKeybindings({ ...merged, settingsReading: 'Ctrl+R', cycleRadioSkin: 'Ctrl+K' });
  assert.equal(rebound.settingsReading, 'Ctrl+R');
  assert.equal(rebound.cycleRadioSkin, 'Ctrl+K');
  assert.throws(() => normalizeKeybindings({ ...merged, settingsAccount: merged.settingsReading }),
    (error) => error.code === 'KEYBINDING_CONFLICT');
});

test('Light rejects a duplicate shortcut and names the occupied action', () => {
  assert.throws(() => normalizeKeybindings({ ...DEFAULT_KEYBINDINGS, openRadio: 'Ctrl+S' }),
    (error) => error.code === 'KEYBINDING_CONFLICT' && /openSettings/.test(error.message));
});

test('Omarchy conflicts reject the new shortcut before it is saved', () => {
  const changed = { ...DEFAULT_KEYBINDINGS, openRadio: 'Super+L' };
  const active = [{ modmask: 64, key: 'L', description: 'Lock screen', mouse: false, submap: '' }];
  assert.throws(() => checkSystemKeybindingConflicts(changed, DEFAULT_KEYBINDINGS, active),
    (error) => error.code === 'KEYBINDING_CONFLICT' && /Lock screen/.test(error.message));
  assert.doesNotThrow(() => checkSystemKeybindingConflicts(DEFAULT_KEYBINDINGS, DEFAULT_KEYBINDINGS, active));
});

test('shifted equals is recognized as a plus-key collision', () => {
  const changed = { ...DEFAULT_KEYBINDINGS, openRadio: 'Super++' };
  const active = [{ modmask: 65, key: 'equal', description: 'Desktop zoom', mouse: false, submap: '' }];
  assert.throws(() => checkSystemKeybindingConflicts(changed, DEFAULT_KEYBINDINGS, active),
    (error) => error.code === 'KEYBINDING_CONFLICT');
});
