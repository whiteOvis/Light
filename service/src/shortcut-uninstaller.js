#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFINITIONS = [
  {
    start: '-- Light global shortcut',
    end: '-- End Light global shortcut',
    label: 'Light',
    command: "omarchy-shell shell toggle light.bible-reader '{}'",
  },
  {
    start: '-- Light Verse of the Day shortcut',
    end: '-- End Light Verse of the Day shortcut',
    label: 'Light Verse of the Day',
    command: 'omarchy-shell -q light.bible-reader verseOfTheDay',
  },
];

// Public bindings use separate markers when an LHT binding already exists.
DEFINITIONS.push(...DEFINITIONS.map(definition => ({
  ...definition,
  start: definition.start.replace('Light ', 'Light public '),
  end: definition.end.replace('Light ', 'Light public '),
})));

export function removeLightHotkeysSource(source) {
  let lines = String(source).split('\n');
  let removed = 0;

  for (const definition of DEFINITIONS) {
    const starts = matchingLineIndices(lines, definition.start);
    const ends = matchingLineIndices(lines, definition.end);
    if (starts.length === 0 && ends.length === 0) continue;
    if (starts.length !== 1 || ends.length > 1)
      throw malformedBlock(definition.label);

    const start = starts[0];
    const end = ends[0];
    if (end !== undefined && end <= start)
      throw malformedBlock(definition.label);

    const bodyEnd = end ?? Math.min(start + 2, lines.length);
    const meaningfulBody = lines.slice(start + 1, bodyEnd)
      .filter((line) => line.replace(/\r$/, '').trim() !== '');
    if (meaningfulBody.length === 1 && meaningfulBody[0].includes("local.light")) continue;
    if (meaningfulBody.length !== 1
        || !managedBinding(meaningfulBody[0], definition))
      throw malformedBlock(definition.label);

    let removeStart = start;
    let removeEnd = end === undefined ? bodyEnd : end + 1;
    if (removeStart > 0 && lines[removeStart - 1].trim() === '') removeStart--;
    else if (removeEnd < lines.length && lines[removeEnd].trim() === '') removeEnd++;
    lines.splice(removeStart, removeEnd - removeStart);
    removed++;
  }

  const next = lines.join('\n');
  return { changed: next !== source, removed, source: next };
}

function matchingLineIndices(lines, expected) {
  const indices = [];
  lines.forEach((line, index) => {
    if (line.replace(/\r$/, '') === expected) indices.push(index);
  });
  return indices;
}

function managedBinding(line, definition) {
  const escapedLabel = escapeRegex(definition.label);
  const escapedCommand = escapeRegex(definition.command);
  return new RegExp(
    `^[ \\t]*o\\.bind\\("[^"\\r\\n]+", "${escapedLabel}", "${escapedCommand}"\\)[ \\t]*$`,
  ).test(String(line || '').replace(/\r$/, ''));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function malformedBlock(label) {
  return new Error(`The managed ${label} shortcut block has changed; it was left untouched.`);
}

function removeBindingsFile(bindingsPath) {
  const source = readFileSync(bindingsPath, 'utf8');
  const result = removeLightHotkeysSource(source);
  if (result.changed) writeFileSync(bindingsPath, result.source, 'utf8');
  process.stdout.write(result.removed > 0
    ? `Removed ${result.removed} Light-managed shortcut block(s).\n`
    : 'No Light-managed shortcut blocks were present.\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    removeBindingsFile(process.argv[2]);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
