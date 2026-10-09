import { ServiceError } from './service.js';
import { normalizeCustomRadioStations } from './user-data-manager.js';

const fail = (message) => { throw new ServiceError(message, { code: 'BAD_REQUEST', status: 400 }); };
function normalizeRadioSkinOrder(value) {
  const source = Array.isArray(value) ? value : [];
  const result = [];
  for (const item of source) {
    if (!Number.isSafeInteger(item) || item < 1 || item > 7 || result.includes(item)) continue;
    result.push(item);
  }
  for (let skin = 1; skin <= 7; skin++) if (!result.includes(skin)) result.push(skin);
  return result;
}
function reference(value) {
  const version = Number(value?.version);
  const passage = String(value?.passage || '').toUpperCase();
  if (!Number.isSafeInteger(version) || version < 1
      || !/^[A-Z0-9]{3}\.\d+(?:\.\d+(?:-\d+)?)?$/.test(passage)) fail('Invalid passage reference.');
  return { version, passage, label: String(value.label || passage).slice(0, 200),
    preview: String(value.preview || '').slice(0, 500) };
}
export class StudyData {
  constructor(userData) {
    this.userData = userData;
    this.db = userData.database;
    this.db.exec(`CREATE TABLE IF NOT EXISTS light_study_state (
      key TEXT PRIMARY KEY, value TEXT NOT NULL
    )`);
  }
  read(key, fallback) {
    const row = this.db.prepare('SELECT value FROM light_study_state WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : fallback;
  }
  write(key, value) {
    this.db.prepare('INSERT INTO light_study_state VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run(key, JSON.stringify(value));
    return value;
  }
  importRadio(data) {
    if (data?.format !== "light-radio" || data.version !== 1) fail("Not a supported radio collection.");
    const incoming = normalizeCustomRadioStations(data.stations);
    const stations = this.userData.getCustomRadioStations();
    const seen = new Set(stations.map(station => station.streamUrl.toLowerCase()));
    for (const station of incoming) {
      const key = station.streamUrl.toLowerCase();
      if (!seen.has(key)) { stations.push(station); seen.add(key); }
    }
    return this.userData.setCustomRadioStations(stations);
  }

  options() {
    const stored = this.read('options', {});
    return {
      resumeReading: stored.resumeReading !== false,
      autoOpenReferences: stored.autoOpenReferences === true,
      nightMode: stored.nightMode === true,
      textBrightness: Number.isFinite(stored.textBrightness)
        ? Math.max(0.2, Math.min(1, stored.textBrightness)) : 1,
      favoriteStations: Array.isArray(stored.favoriteStations) ? stored.favoriteStations : [],
      radioSkin: Number.isSafeInteger(stored.radioSkin) && stored.radioSkin >= 1 && stored.radioSkin <= 7
        ? stored.radioSkin : 1,
      radioSkinOrder: normalizeRadioSkinOrder(stored.radioSkinOrder),
    };
  }
  setOptions(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) fail("Invalid reading options.");
    const next = { ...this.options() };
    if ('textBrightness' in value) {
      if (typeof value.textBrightness !== 'number' || !Number.isFinite(value.textBrightness)
          || value.textBrightness < 0.2 || value.textBrightness > 1)
        fail('Text brightness must be between 20% and 100%.');
      next.textBrightness = Math.round(value.textBrightness * 100) / 100;
    }
    if ('nightMode' in value) {
      if (typeof value.nightMode !== 'boolean') fail('Night mode must be a boolean.');
      next.nightMode = value.nightMode;
    }
    if ('autoOpenReferences' in value) {
      if (typeof value.autoOpenReferences !== 'boolean') fail('Automatic reference opening must be a boolean.');
      next.autoOpenReferences = value.autoOpenReferences;
    }
    if ('resumeReading' in value) {
      if (typeof value.resumeReading !== 'boolean') fail('Compacted search must be a boolean.');
      next.resumeReading = value.resumeReading;
    }
    if ('favoriteStations' in value) {
      if (!Array.isArray(value.favoriteStations) || value.favoriteStations.some(
        key => typeof key !== 'string' || !/^(?:builtin:[a-z0-9-]+|custom:https?:\/\/\S{1,512})$/.test(key),
      )) fail('Invalid favorite stations.');
      next.favoriteStations = [...new Set(value.favoriteStations)];
    }
    if ('radioSkin' in value) {
      if (!Number.isSafeInteger(value.radioSkin) || value.radioSkin < 1 || value.radioSkin > 7)
        fail('Radio skin must be an integer from 1 through 7.');
      next.radioSkin = value.radioSkin;
    }
    if ('radioSkinOrder' in value) {
      if (!Array.isArray(value.radioSkinOrder) || value.radioSkinOrder.length !== 7
          || new Set(value.radioSkinOrder).size !== 7
          || value.radioSkinOrder.some(skin => !Number.isSafeInteger(skin) || skin < 1 || skin > 7))
        fail('Radio skin order must contain each skin once.');
      next.radioSkinOrder = normalizeRadioSkinOrder(value.radioSkinOrder);
    }
    return this.write('options', next);
  }
  visit(value) {
    const item = reference(value);
    return this.write('history', [item, ...this.read('history', []).filter(
      old => old.version !== item.version || old.passage !== item.passage,
    )].slice(0, 50));
  }
  bookmark(value) {
    const item = reference(value);
    const items = this.read('bookmarks', []);
    const rest = items.filter(old => old.version !== item.version || old.passage !== item.passage);
    if (value.remove !== true) rest.unshift(item);
    return this.write('bookmarks', rest);
  }
  library() {
    const session = this.userData.authentication.getSessionId();
    return { history: this.read('history', []), entries: [
      ...this.read('bookmarks', []).map(item => ({ ...item, kind: 'bookmark' })),
      ...this.db.prepare('SELECT * FROM user_notes ORDER BY updated_at DESC').all()
        .map(row => ({ kind: 'note', id: row.id, version: row.version_id, passage: row.passage_id,
          label: row.passage_id, preview: row.body, updatedAt: row.updated_at })),
      ...this.db.prepare("SELECT * FROM user_highlights WHERE session_id = ? AND sync_state != 'pending_delete' ORDER BY updated_at DESC").all(session)
        .map(row => ({ kind: 'highlight', version: row.version_id, passage: row.passage_id,
          label: row.passage_id, preview: '', color: row.color, updatedAt: row.updated_at })),
    ] };
  }
  async libraryWithPreviews(service) {
    const library = this.library();
    if (!service?.passage) return library;
    const previews = new Map();
    const expandedHighlightKeys = new Set(library.entries
      .filter((item) => item.kind === 'highlight')
      .slice(0, 7)
      .map((item) => item.version + ':' + item.passage));
    for (const item of [...library.entries, ...library.history]) {
      if (item.preview) continue;
      const key = item.version + ":" + item.passage;
      // The Library immediately displays the seven newest highlights. Fetch
      // only those through the permitted passage API; older highlights load
      // on demand when the reader expands them in place.
      if (item.kind === 'highlight' && !expandedHighlightKeys.has(key)) continue;
      if (!previews.has(key)) {
        try {
          const fullHighlight = expandedHighlightKeys.has(key);
          const result = await service.passage(item.version, item.passage, {
            mode: fullHighlight ? "auto" : "offline", format: fullHighlight ? "html" : "text",
          });
          const text = String(result?.data?.content || "");
          previews.set(key, {
            // The Library shows the seven newest highlights in full, so do
            // not discard the saved passage text before the interface sees it.
            preview: fullHighlight ? text : text.slice(0, 500),
            previewFormat: fullHighlight ? 'html' : 'text',
            fullPreview: fullHighlight,
            label: String(result?.data?.reference || item.label),
          });
        } catch { previews.set(key, null); }
      }
      Object.assign(item, previews.get(key) || {});
    }
    return library;
  }

  exportBackup() {
    return { format: 'light-backup', version: 2, createdAt: new Date().toISOString(),
      bookmarks: this.read('bookmarks', []), history: this.read('history', []),
      notes: this.db.prepare('SELECT id, version_id AS version, passage_id AS passage, body FROM user_notes').all(),
    };
  }
  restoreBackup(data) {
    const allowed = new Set(['format', 'version', 'createdAt', 'bookmarks', 'history', 'notes']);
    if (data?.format !== 'light-backup' || data.version !== 2
        || !Array.isArray(data.notes) || !Array.isArray(data.bookmarks)
        || !Array.isArray(data.history) || Object.keys(data).some(key => !allowed.has(key)))
      fail('Not a supported Light backup.');
    // A single transaction makes malformed imports harmless, including a late
    // validation failure. Existing notes and bookmarks are merged, not erased.
    this.db.exec('BEGIN');
    try {
      for (const item of data.bookmarks) this.bookmark(item);
      for (const item of [...data.history].reverse()) this.visit(item);
      for (const note of data.notes) {
        const item = reference(note);
        if (typeof note.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(note.id)
            || typeof note.body !== 'string' || !note.body.trim() || note.body.length > 10000)
          fail('Invalid note in backup.');
        // Preserve a conflicting local note rather than silently overwriting it.
        const old = this.db.prepare('SELECT body, version_id, passage_id FROM user_notes WHERE id = ?').get(note.id);
        if (old && (old.body !== note.body || old.version_id !== item.version || old.passage_id !== item.passage)) fail('A local note conflicts with this backup. No changes were restored.');
        const now = Date.now();
        this.db.prepare('INSERT OR IGNORE INTO user_notes VALUES (?, ?, ?, ?, ?, ?)')
          .run(note.id, item.version, item.passage, note.body, now, now);
      }
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return { restored: true };
  }
}
