import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { ServiceError } from './service.js';

const LIGHT_TOGGLE = {
  start: '-- Light global shortcut',
  end: '-- End Light global shortcut',
  label: 'Light',
  command: "omarchy-shell shell toggle light.bible-reader '{}'",
  resultKey: 'globalToggle',
};
const VERSE_OF_THE_DAY = {
  start: '-- Light Verse of the Day shortcut',
  end: '-- End Light Verse of the Day shortcut',
  label: 'Light Verse of the Day',
  command: 'omarchy-shell -q light.bible-reader verseOfTheDay',
  resultKey: 'verseOfTheDay',
};

export function setLightGlobalHotkey(shortcut, {
  bindingsPath = join(process.env.XDG_CONFIG_HOME || join(process.env.HOME || '', '.config'), 'hypr', 'bindings.lua'),
  run = (command, args) => execFileSync(command, args, { encoding: 'utf8' }),
} = {}) {
  return setLightHotkey(shortcut, LIGHT_TOGGLE, { bindingsPath, run });
}

export function setLightVerseOfTheDayHotkey(shortcut, {
  bindingsPath = join(process.env.XDG_CONFIG_HOME || join(process.env.HOME || '', '.config'), 'hypr', 'bindings.lua'),
  run = (command, args) => execFileSync(command, args, { encoding: 'utf8' }),
} = {}) {
  return setLightHotkey(shortcut, VERSE_OF_THE_DAY, { bindingsPath, run });
}

function setLightHotkey(shortcut, definition, { bindingsPath, run }) {
  const chord = hyprlandChord(shortcut);
  const block = `${definition.start}\no.bind("${chord}", "${definition.label}", "${definition.command}")\n${definition.end}`;
  let source;
  try {
    source = readFileSync(bindingsPath, 'utf8');
  } catch {
    throw new ServiceError('Light could not find your Hyprland bindings file.', {
      code: 'KEYBINDINGS_UNAVAILABLE', status: 503,
    });
  }
  // Only replace the one binding we own, including the legacy block without
  // an end marker. Never consume an unrelated line after a stale marker.
  const existing = new RegExp(`${escapeRegex(definition.start)}\\r?\\n[ \\t]*o\\.bind\\([^\\n]*"${escapeRegex(definition.label)}"[^\\n]*\\)(?:\\r?\\n${escapeRegex(definition.end)})?`);
  if (source.includes(definition.start) && !existing.test(source)) {
    throw new ServiceError('The Light shortcut block has changed; repair it before rebinding.', {
      code: 'KEYBINDINGS_UNAVAILABLE', status: 409,
    });
  }
  const managed = source.match(existing)?.[0];
  if (managed && !managed.includes(definition.command)) {
    if (managed.includes('local.light') && !definition.start.includes('Light public ')) {
      return setLightHotkey(shortcut, {
        ...definition,
        start: definition.start.replace('Light ', 'Light public '),
        end: definition.end.replace('Light ', 'Light public '),
      }, { bindingsPath, run });
    }
    throw new ServiceError('That shortcut belongs to another plugin.', {
      code: 'KEYBINDING_CONFLICT', status: 409,
    });
  }
  const unmanaged = source.replace(existing, '');
  for (const match of unmanaged.matchAll(/^\s*o\.bind\(["']([^"']+)["']/gm)) {
    const canonical = (value) => value.toUpperCase().split('+').map((part) => part.trim()).sort().join('+');
    if (canonical(match[1]) === canonical(chord)) {
      throw new ServiceError('That shortcut is already used in your bindings file.', {
        code: 'KEYBINDING_CONFLICT', status: 409,
      });
    }
  }
  const next = existing.test(source)
    ? source.replace(existing, block)
    : `${source.trimEnd()}\n\n${block}\n`;
  writeFileSync(bindingsPath, next, 'utf8');
  try {
    run('hyprctl', ['reload']);
    const errors = String(run('hyprctl', ['configerrors']) || '').trim();
    if (errors) throw new Error(errors);
  } catch (error) {
    writeFileSync(bindingsPath, source, 'utf8');
    try { run('hyprctl', ['reload']); } catch {}
    throw new ServiceError('Hyprland rejected that global shortcut.', {
      code: 'KEYBINDING_INVALID', status: 400,
    });
  }
  return { [definition.resultKey]: shortcut, hyprlandChord: chord };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function hyprlandChord(value) {
  const match = String(value || '').trim().match(/^(.*)\+(.+)$/);
  const parts = match ? match[1].split('+') : [];
  const key = match ? match[2] : '';
  const modifierMap = { ctrl: 'CTRL', alt: 'ALT', shift: 'SHIFT', super: 'SUPER', meta: 'SUPER' };
  const modifiers = parts.map((part) => modifierMap[part.toLowerCase()]);
  const keyMap = { comma: 'COMMA', period: 'PERIOD', space: 'SPACE', tab: 'TAB', escape: 'ESCAPE', enter: 'RETURN', minus: 'MINUS', '-': 'MINUS', plus: 'PLUS', '+': 'PLUS', equal: 'EQUAL', '=': 'EQUAL' };
  const normalizedKey = keyMap[String(key || '').toLowerCase()] || String(key || '').toUpperCase();
  if (!key || modifiers.length === 0 || modifiers.some((modifier) => !modifier)
      || !/^[A-Z0-9]+$/.test(normalizedKey)) {
    throw new ServiceError('Use a modifier and key, such as Super+B.', {
      code: 'KEYBINDING_INVALID', status: 400,
    });
  }
  return [...new Set(modifiers), normalizedKey].join(' + ');
}
