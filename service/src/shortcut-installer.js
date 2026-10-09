#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const START = '-- Light Verse of the Day shortcut';
const END = '-- End Light Verse of the Day shortcut';
const LABEL = 'Light Verse of the Day';
const DEFAULT_CHORD = 'SUPER + ALT + V';
const LEGACY_CHORD = 'SUPER + B + V';
const DEVELOPMENT_ID = ['local', 'light'].join('.');
const PUBLIC_ID = ['light', 'bible-reader'].join('.');
const DEFAULT_PLUGIN_ID = 'light.bible-reader';
const KNOWN_IDS = new Set([DEVELOPMENT_ID, PUBLIC_ID]);
const GLOBAL_START = '-- Light global shortcut';
const GLOBAL_END = '-- End Light global shortcut';
const GLOBAL_LABEL = 'Light';
const GLOBAL_DEFAULT_CHORD = 'SUPER + B';

const messages = {
  added: 'Added SUPER+ALT+V to show Verse of the Day.',
  conflict: 'SUPER+ALT+V is already bound; leaving the existing user binding unchanged.',
  cleaned: 'Removed blank lines left by older Light installs and preserved the Verse of the Day shortcut.',
  migrated: 'Migrated Light\'s legacy Verse of the Day shortcut to SUPER+ALT+V.',
  preserved: 'Preserved the existing Light Verse of the Day shortcut.',
  repaired: 'Repaired the Light Verse of the Day shortcut markers without changing its key.',
  retargeted: 'Updated the Light shortcut target while preserving its key.',
  unmanaged: 'Found an existing Verse of the Day shortcut; leaving it unchanged.',
};
const globalMessages = {
  added: 'Added SUPER+B to toggle Light from anywhere.',
  conflict: 'SUPER+B is already bound; leaving the existing user binding unchanged.',
  preserved: 'Preserved the existing Light global shortcut.',
  repaired: 'Repaired the Light global shortcut markers without changing its key.',
  retargeted: 'Updated the Light global shortcut target while preserving its key.',
  unmanaged: 'Found an existing Light global shortcut; leaving it unchanged.',
};

function normalizedPluginId(pluginId) {
  return KNOWN_IDS.has(String(pluginId || '')) ? String(pluginId) : DEFAULT_PLUGIN_ID;
}

function verseCommand(pluginId) {
  return `omarchy-shell -q ${normalizedPluginId(pluginId)} verseOfTheDay`;
}

function verseBinding(chord, pluginId) {
  return `o.bind("${chord}", "${LABEL}", "${verseCommand(pluginId)}")`;
}

function globalCommand(pluginId) {
  return `omarchy-shell shell toggle ${normalizedPluginId(pluginId)} '{}'`;
}

function globalBinding(chord, pluginId) {
  return `o.bind("${chord}", "${GLOBAL_LABEL}", "${globalCommand(pluginId)}")`;
}

export function reconcileVerseHotkeySource(source, pluginId = DEFAULT_PLUGIN_ID) {
  const desiredPluginId = normalizedPluginId(pluginId);
  const lines = String(source).split('\n');
  const starts = matchingLineIndices(lines, START);
  const ends = matchingLineIndices(lines, END);

  if (starts.length > 1 || ends.length > 1)
    throw malformedBlock();

  if (starts.length === 1) {
    const start = starts[0];
    const end = ends[0];
    if (end !== undefined && end <= start)
      throw malformedBlock();

    const searchEnd = end ?? Math.min(start + 2, lines.length);
    const managed = [];
    for (let index = start + 1; index < searchEnd; index++) {
      const binding = verseBindingDetails(lines[index]);
      if (binding) managed.push({ index, ...binding });
    }
    const meaningfulBody = lines.slice(start + 1, searchEnd)
      .filter((line) => line.replace(/\r$/, '').trim() !== '');
    if (managed.length !== 1 || meaningfulBody.length !== 1)
      throw malformedBlock();

    const binding = managed[0];
    if (binding.pluginId !== desiredPluginId)
      return { action: 'conflict', changed: false, source };
    let action = 'preserved';
    if (canonicalChord(binding.chord) === canonicalChord(LEGACY_CHORD)) {
      lines[binding.index] = verseBinding(DEFAULT_CHORD, desiredPluginId);
      action = 'migrated';
    } else if (binding.pluginId !== desiredPluginId) {
      lines[binding.index] = verseBinding(binding.chord, desiredPluginId);
      action = 'retargeted';
    }
    if (end === undefined) {
      lines.splice(binding.index + 1, 0, END);
      if (action === 'preserved') action = 'repaired';
    }
    let preceding = start - 1;
    while (preceding >= 0 && lines[preceding].replace(/\r$/, '').trim() === '')
      preceding--;
    const precedingBlankLines = start - preceding - 1;
    if (precedingBlankLines > 1) {
      lines.splice(preceding + 2, precedingBlankLines - 1);
      if (action === 'preserved') action = 'cleaned';
    }
    const next = lines.join('\n');
    return { action, changed: next !== source, source: next };
  }

  if (ends.length > 0)
    throw malformedBlock();

  if (lines.some((line) => anyVerseBinding(line)))
    return { action: 'unmanaged', changed: false, source };

  if (lines.some((line) => canonicalChord(anyBindingChord(line)) === canonicalChord(DEFAULT_CHORD)))
    return { action: 'conflict', changed: false, source };

  const block = `${START}\n${verseBinding(DEFAULT_CHORD, desiredPluginId)}\n${END}`;
  return { action: 'added', changed: true, source: `${String(source).trimEnd()}\n\n${block}\n` };
}

export function reconcileGlobalHotkeySource(source, pluginId = DEFAULT_PLUGIN_ID) {
  const desiredPluginId = normalizedPluginId(pluginId);
  const lines = String(source).split('\n');
  const starts = matchingLineIndices(lines, GLOBAL_START);
  const ends = matchingLineIndices(lines, GLOBAL_END);
  if (starts.length > 1 || ends.length > 1) throw malformedBlock();

  if (starts.length === 1) {
    const start = starts[0];
    const end = ends[0];
    if (end !== undefined && end <= start) throw malformedBlock();
    const searchEnd = end ?? Math.min(start + 2, lines.length);
    const meaningfulBody = lines.slice(start + 1, searchEnd)
      .filter((line) => line.replace(/\r$/, '').trim() !== '');
    const binding = meaningfulBody.length === 1
      ? globalBindingDetails(meaningfulBody[0])
      : null;
    if (!binding) throw malformedBlock();
    if (binding.pluginId !== desiredPluginId)
      return { action: 'conflict', changed: false, source };
    let action = 'preserved';
    const bindingIndex = start + 1 + lines.slice(start + 1, searchEnd)
      .findIndex((line) => line.replace(/\r$/, '').trim() !== '');
    if (binding.pluginId !== desiredPluginId) {
      lines[bindingIndex] = globalBinding(binding.chord, desiredPluginId);
      action = 'retargeted';
    }
    if (end === undefined) {
      lines.splice(bindingIndex + 1, 0, GLOBAL_END);
      if (action === 'preserved') action = 'repaired';
    }
    const next = lines.join('\n');
    return { action, changed: next !== source, source: next };
  }

  if (ends.length > 0) throw malformedBlock();
  if (lines.some((line) => anyGlobalBinding(line)))
    return { action: 'unmanaged', changed: false, source };
  if (lines.some((line) => canonicalChord(anyBindingChord(line)) === canonicalChord(GLOBAL_DEFAULT_CHORD)))
    return { action: 'conflict', changed: false, source };
  const block = `${GLOBAL_START}\n${globalBinding(GLOBAL_DEFAULT_CHORD, desiredPluginId)}\n${GLOBAL_END}`;
  return { action: 'added', changed: true, source: `${String(source).trimEnd()}\n\n${block}\n` };
}

function matchingLineIndices(lines, expected) {
  const indices = [];
  lines.forEach((line, index) => {
    if (line.replace(/\r$/, '') === expected) indices.push(index);
  });
  return indices;
}

function verseBindingDetails(line) {
  const match = String(line || '').replace(/\r$/, '').match(
    new RegExp(`^[ \\t]*o\\.bind\\("([^"\\r\\n]+)", "${escapeRegex(LABEL)}", "([^"\\r\\n]+)"\\)[ \\t]*$`),
  );
  if (!match) return null;
  const pluginId = [...KNOWN_IDS].find((id) => match[2] === verseCommand(id));
  return pluginId ? { chord: match[1], pluginId } : null;
}

function globalBindingDetails(line) {
  const match = String(line || '').replace(/\r$/, '').match(
    new RegExp(`^[ \\t]*o\\.bind\\("([^"\\r\\n]+)", "${escapeRegex(GLOBAL_LABEL)}", "([^"\\r\\n]+)"\\)[ \\t]*$`),
  );
  if (!match) return null;
  const pluginId = [...KNOWN_IDS].find((id) => match[2] === globalCommand(id));
  return pluginId ? { chord: match[1], pluginId } : null;
}

function anyBindingChord(line) {
  return String(line || '').replace(/\r$/, '').match(/^[ \t]*o\.bind\(["']([^"']+)["']/)?.[1] || '';
}

function anyVerseBinding(line) {
  const escapedLabel = escapeRegex(LABEL);
  return new RegExp(`^[ \\t]*o\\.bind\\([^\\r\\n]*["']${escapedLabel}["']`).test(String(line || ''));
}

function anyGlobalBinding(line) {
  const escapedLabel = escapeRegex(GLOBAL_LABEL);
  return new RegExp(`^[ \\t]*o\\.bind\\([^\\r\\n]*["']${escapedLabel}["']`).test(String(line || ''));
}

function canonicalChord(value) {
  return String(value || '').toUpperCase().split('+').map((part) => part.trim()).filter(Boolean).sort().join('+');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function malformedBlock() {
  return new Error('The Light Verse of the Day shortcut block has changed; repair it before reinstalling.');
}

function reconcileBindingsFile(bindingsPath) {
  const source = readFileSync(bindingsPath, 'utf8');
  const pluginId = normalizedPluginId(process.argv[3]);
  const verse = reconcileVerseHotkeySource(source, pluginId);
  const global = reconcileGlobalHotkeySource(verse.source, pluginId);
  if (global.changed || verse.changed)
    writeFileSync(bindingsPath, global.source, 'utf8');
  process.stdout.write(`${messages[verse.action]}\n${globalMessages[global.action]}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    reconcileBindingsFile(process.argv[2]);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
