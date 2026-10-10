import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionHotkeys } from '../src/session-hotkeys.js';

function desktop(initial = []) {
  let bindings = [...initial];
  const calls = [];
  const run = (command, args) => {
    assert.equal(command, 'hyprctl');
    calls.push(args);
    if (args[0] === 'binds') return JSON.stringify(bindings);
    const [mods, key, description, dispatcher, ...arg] = args[2].split(',');
    const mask = mods.split(' ').reduce((n, m) => n | ({ SUPER: 64, CTRL: 4, ALT: 8, SHIFT: 1 }[m] || 0), 0);
    if (args[1] === 'unbind') bindings = bindings.filter(b => b.modmask !== mask || b.key.toUpperCase() !== key);
    else bindings.push({ modmask: mask, key, description, dispatcher, arg: arg.join(',') });
    return 'ok\n';
  };
  return { manager: new SessionHotkeys({ run }), calls, get bindings() { return bindings; },
    clear() { bindings = []; } };
}
test('session shortcuts preserve conflicts, rebind safely and are removed on disable', () => {
  const user = { key: 'B', modmask: 64, description: 'User app', dispatcher: 'exec', arg: 'other-app' };
  const d = desktop([user]);
  assert.throws(() => d.manager.set('globalToggle', 'Super+B'), /already used/);
  d.manager.set('globalToggle', 'Super+L');
  d.manager.set('globalToggle', 'Super+N');
  assert.equal(d.bindings.length, 2);
  assert.deepEqual(d.bindings[0], user);
  assert.equal(d.bindings[1].key, 'N');
  d.manager.close();
  assert.deepEqual(d.bindings, [user]);
  assert.ok(d.calls.every(args => ['binds', 'keyword'].includes(args[0])));
});
test('session shortcuts recover after compositor reload and retain user-installed Light bindings', () => {
  const d = desktop();
  d.manager.set('globalToggle', 'Super+B');
  d.clear();
  d.manager.set('globalToggle', 'Super+B');
  assert.equal(d.bindings.length, 1);
  d.manager.close();
  assert.equal(d.bindings.length, 0);
  const legacy = { key: 'B', modmask: 64, dispatcher: 'exec', arg: "omarchy-shell shell toggle light.bible-reader '{}'" };
  const existing = desktop([legacy]);
  existing.manager.set('globalToggle', 'Super+B');
  existing.manager.close();
  assert.deepEqual(existing.bindings, [legacy]);
});
test('cleanup leaves a chord alone if another owner has added a binding', () => {
  const d = desktop();
  d.manager.set('globalToggle', 'Super+B');
  d.bindings.push({ key: 'B', modmask: 64, dispatcher: 'exec', arg: 'user-app' });
  d.manager.close();
  assert.equal(d.bindings.length, 2);
});
test('a restarted backend takes responsibility for an orphaned session binding', () => {
  const stale = { key: 'B', modmask: 64, dispatcher: 'exec', description: 'Light session 123 globalToggle',
    arg: "omarchy-shell shell toggle light.bible-reader '{}'" };
  const d = desktop([stale]);
  d.manager.set('globalToggle', 'Super+B');
  d.manager.close();
  assert.equal(d.bindings.length, 0);
});
