import { execFileSync } from 'node:child_process';
import { ServiceError } from './service-error.js';

export function activeSystemBindings() {
  try {
    return JSON.parse(execFileSync('hyprctl', ['binds', '-j'], { encoding: 'utf8' }));
  } catch (error) {
    throw new ServiceError('Could not check Omarchy shortcuts. Try again when the desktop is available.', {
      code: 'KEYBINDING_CHECK_FAILED', status: 503, cause: error,
    });
  }
}

function chord(value) {
  const pieces = String(value).split('+').filter(Boolean);
  const key = String(value).endsWith('++') ? '+' : pieces.pop();
  const modifiers = new Set(pieces.map((piece) => piece.toLowerCase()));
  const mask = (modifiers.has('shift') ? 1 : 0) | (modifiers.has('ctrl') ? 4 : 0)
    | (modifiers.has('alt') ? 8 : 0) | (modifiers.has('super') || modifiers.has('meta') ? 64 : 0);
  return { key: String(key).toLowerCase(), mask };
}

function systemKey(key) {
  const aliases = { escape: 'escape', esc: 'escape', return: 'enter', kp_enter: 'enter',
    space: 'space', plus: '+', minus: '-', equal: '=', backspace: 'backspace' };
  const lower = String(key).toLowerCase();
  return aliases[lower] || lower;
}

export function checkSystemKeybindingConflicts(bindings, previous, systemBindings) {
  for (const [name, shortcut] of Object.entries(bindings)) {
    if (shortcut === previous[name]) continue;
    const candidate = chord(shortcut);
    const conflict = systemBindings.find((binding) => {
      if (binding.mouse || (binding.submap && binding.submap !== 'reset')) return false;
      const key = systemKey(binding.key);
      const systemMask = Number(binding.modmask);
      const matchingKey = key === candidate.key
        || (candidate.key === '+' && key === '=' && Boolean(systemMask & 1));
      const matchingModifiers = systemMask === candidate.mask
        || (candidate.key === '+' && (systemMask ^ candidate.mask) === 1);
      return matchingKey && matchingModifiers;
    });
    if (conflict) {
      throw new ServiceError(`${shortcut} is already used by Omarchy${conflict.description ? `: ${conflict.description}` : '.'}`, {
        code: 'KEYBINDING_CONFLICT', status: 409,
      });
    }
  }
}
