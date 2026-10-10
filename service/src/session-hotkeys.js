import { execFileSync } from 'node:child_process';
import { hyprlandChord } from './global-hotkey.js';
import { ServiceError } from './service-error.js';

const commands = {
  globalToggle: "omarchy-shell shell toggle light.bible-reader '{}'",
  verseOfTheDay: 'omarchy-shell -q light.bible-reader verseOfTheDay',
};
const masks = { SUPER: 64, CTRL: 4, ALT: 8, SHIFT: 1 };
const aliases = { return: 'enter', kp_enter: 'enter', plus: '+', minus: '-', comma: ',', period: '.' };
function identity(shortcut) {
  const parts = hyprlandChord(shortcut).split(' + ');
  const key = parts.pop();
  return { key, modifiers: parts.join(' '), mask: parts.reduce((sum, part) => sum | masks[part], 0) };
}
function matches(binding, chord) {
  const key = String(binding.key).toLowerCase();
  return !binding.mouse && (!binding.submap || binding.submap === 'reset')
    && (aliases[key] || key) === (aliases[chord.key.toLowerCase()] || chord.key.toLowerCase())
    && Number(binding.modmask) === chord.mask;
}

// Runtime-only compositor bindings: no files are edited and no reload is issued.
// Never unbind a chord that has acquired another owner's binding.
export class SessionHotkeys {
  constructor({ run = (command, args) => execFileSync(command, args, { encoding: 'utf8', timeout: 3000 }) } = {}) {
    this.run = run;
    this.owned = new Map();
  }
  list() { return JSON.parse(this.run('hyprctl', ['binds', '-j'])); }
  remove(name) {
    const record = this.owned.get(name);
    if (!record) return;
    const bindings = this.list().filter(binding => matches(binding, record.chord));
    if (bindings.length === 1 && bindings[0].dispatcher === 'exec'
        && bindings[0].arg === commands[name] && bindings[0].description === record.description)
      this.run('hyprctl', ['keyword', 'unbind', `${record.chord.modifiers},${record.chord.key}`]);
    this.owned.delete(name);
  }
  set(name, shortcut) {
    if (!Object.hasOwn(commands, name)) throw new Error('Unknown Light global shortcut.');
    const chord = identity(shortcut);
    const bindings = this.list().filter(binding => matches(binding, chord));
    if (bindings.length) {
      if (bindings.every(binding => binding.dispatcher === 'exec' && binding.arg === commands[name])) {
        const old = this.owned.get(name);
        if (old && (old.chord.key !== chord.key || old.chord.mask !== chord.mask)) this.remove(name);
        // Recover our session binding after an abrupt shell/process crash.
        // Ordinary user and legacy bindings never acquire runtime ownership.
        if (bindings.length === 1 && new RegExp(`^Light session [0-9]+ ${name}$`).test(bindings[0].description))
          this.owned.set(name, { chord, description: bindings[0].description });
        return { [name]: shortcut };
      }
      throw new ServiceError(`${shortcut} is already used by another desktop action.`, {
        code: 'KEYBINDING_CONFLICT', status: 409,
      });
    }
    const description = `Light session ${process.pid} ${name}`;
    const result = String(this.run('hyprctl', ['keyword', 'bindd',
      `${chord.modifiers},${chord.key},${description},exec,${commands[name]}`])).trim();
    if (result !== 'ok') throw new ServiceError('Hyprland rejected that global shortcut.', {
      code: 'KEYBINDING_INVALID', status: 400,
    });
    // Install the new chord first so a failed bind leaves the previous one intact.
    const old = this.owned.get(name);
    if (old && (old.chord.key !== chord.key || old.chord.mask !== chord.mask)) this.remove(name);
    this.owned.set(name, { chord, description });
    return { [name]: shortcut };
  }
  reconcile(bindings) {
    for (const name of Object.keys(commands)) {
      try { this.set(name, bindings[name]); } catch {} // Conflicts leave user bindings intact.
    }
  }
  close() {
    for (const name of this.owned.keys()) { try { this.remove(name); } catch {} }
  }
}
