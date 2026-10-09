import { randomUUID } from 'node:crypto';

import { getHttpStatus } from '@youversion/platform-core';

import { ServiceError } from './service.js';

const DEFAULT_HIGHLIGHT_COLOR = 'fffe00';
const DEFAULT_HIGHLIGHT_OPACITY = 0.45;
const MIN_HIGHLIGHT_OPACITY = 0.2;
const MAX_HIGHLIGHT_OPACITY = 0.75;
const DEFAULT_APP_SCALE = 1.2;
const MIN_APP_SCALE = 0.8;
const MAX_APP_SCALE = 1.6;
const DEFAULT_READER_TEXT_SCALE = 1;
const MIN_READER_TEXT_SCALE = 0.7;
const MAX_READER_TEXT_SCALE = 1.8;
const DEFAULT_READER_FONT_STYLE = 'youversion';
const READER_FONT_STYLES = new Set(['system', 'youversion']);
const DEFAULT_RED_LETTERS = false;
const DEFAULT_VERSE_OF_THE_DAY_ENABLED = false;
// Radio is opt-in: a missing preference means a fresh installation has no
// player affordance or active radio shortcut until the user enables it.
const DEFAULT_MUSIC_PLAYER_ENABLED = false;
const MAX_RADIO_STATION_NAME_LENGTH = 80;
const MAX_RADIO_STREAM_URL_LENGTH = 512;
const MAX_RADIO_STATION_DESCRIPTION_LENGTH = 160;
// Hidden IDs only apply to the finite set of built-in stations.
const MAX_HIDDEN_RADIO_STATIONS = 256;
const DEFAULT_APP_LANGUAGE = 'system';
const APP_LANGUAGES = new Set(['system', 'en-US', 'es-419']);
const MAX_SECONDARY_BIBLE_LANGUAGES = 12;
const MAX_READER_TABS = 7;
const SETTINGS_SECTION_IDS = Object.freeze([
  'reading', 'appearance', 'radio', 'languages', 'account', 'shortcuts', 'backup',
]);
export const DEFAULT_KEYBINDINGS = Object.freeze({
  globalToggle: 'Super+B',
  verseOfTheDay: 'Super+Alt+V',
  openSettings: 'Ctrl+S',
  settingsReading: 'Ctrl+Shift+1',
  settingsAccount: 'Ctrl+Shift+2',
  settingsBackup: 'Ctrl+Shift+3',
  settingsAppearance: 'Ctrl+Shift+4',
  settingsRadio: 'Ctrl+Shift+5',
  settingsShortcuts: 'Ctrl+Shift+6',
  settingsLanguages: 'Ctrl+Shift+7',
  cycleRadioSkin: 'Ctrl+Shift+M',
  openRadio: 'Ctrl+M',
  openLibrary: 'Ctrl+L',
  openHistory: 'Ctrl+H',
  radioPrevious: 'Left',
  radioNext: 'Right',
  radioPlayPause: 'Space',
  closeCurrentPage: 'Escape',
  navigateUp: 'Up', navigateDown: 'Down',
  freshInput: 'Ctrl+Backspace',
  radioVolumeDown: 'Shift+Left', radioVolumeUp: 'Shift+Right',
  textIncrease: 'Ctrl++',
  textDecrease: 'Ctrl+-',
  textIncreaseUp: 'Ctrl+Up', textIncreaseRight: 'Ctrl+Right',
  textDecreaseDown: 'Ctrl+Down', textDecreaseLeft: 'Ctrl+Left',
  brightnessIncrease: 'Ctrl+Alt++', brightnessDecrease: 'Ctrl+Alt+-',
  brightnessIncreaseUp: 'Ctrl+Alt+Up', brightnessIncreaseRight: 'Ctrl+Alt+Right',
  brightnessDecreaseDown: 'Ctrl+Alt+Down', brightnessDecreaseLeft: 'Ctrl+Alt+Left',
  toggleReaderFontStyle: 'Ctrl+F',
  toggleNightMode: 'Ctrl+D',
  appIncrease: 'Alt++',
  appDecrease: 'Alt+-',
  appIncreaseUp: 'Alt+Up', appIncreaseRight: 'Alt+Right',
  appDecreaseDown: 'Alt+Down', appDecreaseLeft: 'Alt+Left',
  newTab: 'Ctrl+T',
  closeTab: 'Ctrl+W',
  nextTab: 'Ctrl+Tab',
  previousTab: 'Ctrl+Shift+Tab',
  tab1: 'Ctrl+1', tab2: 'Ctrl+2', tab3: 'Ctrl+3', tab4: 'Ctrl+4', tab5: 'Ctrl+5',
  tab6: 'Ctrl+6', tab7: 'Ctrl+7',
});
const MAX_NOTE_LENGTH = 10_000;
const MAX_HIGHLIGHT_SELECTION_RANGES = 100;
const MAX_HIGHLIGHT_TEXT_OFFSET = 100_000;

export class UserDataManager {
  constructor({ database, highlightsClient = null, authentication }) {
    if (!database) throw new Error('A SQLite database is required.');
    if (!authentication) throw new Error('An authentication manager is required.');
    this.database = database;
    this.highlightsClient = highlightsClient;
    this.authentication = authentication;

    this.database.exec(`
      CREATE TABLE IF NOT EXISTS user_highlights (
        session_id TEXT NOT NULL,
        version_id INTEGER NOT NULL,
        passage_id TEXT NOT NULL,
        color TEXT NOT NULL,
        sync_state TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        synced_at INTEGER,
        error TEXT,
        PRIMARY KEY (session_id, version_id, passage_id)
      );
      CREATE INDEX IF NOT EXISTS user_highlights_context_idx
        ON user_highlights(session_id, version_id, passage_id);
      CREATE TABLE IF NOT EXISTS user_notes (
        id TEXT PRIMARY KEY,
        version_id INTEGER NOT NULL,
        passage_id TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS user_notes_context_idx
        ON user_notes(version_id, passage_id, updated_at);
      CREATE TABLE IF NOT EXISTS user_preferences (
        preference_key TEXT PRIMARY KEY,
        preference_value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    const highlightColumns = this.database.prepare(
      'PRAGMA table_info(user_highlights)',
    ).all();
    if (!highlightColumns.some((column) => column.name === 'selection_json')) {
      this.database.exec(
        'ALTER TABLE user_highlights ADD COLUMN selection_json TEXT',
      );
    }
  }

  async getContext(versionId, passageId, { refresh = false } = {}) {
    const version = positiveInteger(versionId, 'version');
    const passage = contextPassage(passageId);
    const highlights = await this.getHighlights(version, passage, { refresh });
    return {
      version,
      passage,
      highlights,
      notes: this.getNotes(version, passage),
      preferences: {
        defaultHighlightColor: this.getDefaultHighlightColor(),
        defaultHighlightOpacity: this.getDefaultHighlightOpacity(),
        appScale: this.getAppScale(),
        readerTextScale: this.getReaderTextScale(),
        readerFontStyle: this.getReaderFontStyle(),
        redLetters: this.getRedLetters(),
        verseOfTheDayEnabled: this.getVerseOfTheDayEnabled(),
        musicPlayerEnabled: this.getMusicPlayerEnabled(),
        customRadioStations: this.getCustomRadioStations(),
        hiddenRadioStationIds: this.getHiddenRadioStationIds(),
        radioStationOrder: this.getRadioStationOrder(),
        settingsSectionOrder: this.getSettingsSectionOrder(),
        appLanguage: this.getAppLanguage(),
        secondaryBibleLanguages: this.getSecondaryBibleLanguages(),
        readerTabs: this.getReaderTabs(),
        keybindings: this.getKeybindings(),
      },
      capabilities: { remoteHighlights: true, remoteNotes: false },
    };
  }

  async getHighlights(versionId, passageId, { refresh = false } = {}) {
    const version = positiveInteger(versionId, 'version');
    const passage = contextPassage(passageId);
    if (refresh) await this.syncHighlights(version, passage);
    const sessionId = this.authentication.getSessionId();
    return this.#highlightRows(sessionId, version, passage)
      .filter((row) => row.sync_state !== 'pending_delete')
      .map(highlightRecord);
  }

  async syncHighlights(versionId, passageId) {
    this.#requireRemoteHighlights();
    const version = positiveInteger(versionId, 'version');
    const passage = contextPassage(passageId);
    const sessionId = this.authentication.getSessionId();
    const flush = await this.flushPending();
    const remote = await this.#withAuthentication((token) => (
      this.highlightsClient.getHighlights(
        { version_id: version, passage_id: passage },
        token,
      )
    ));
    const now = Date.now();
    const pattern = `${passage}.%`;

    this.#transaction(() => {
      const savedSelections = new Map(this.database.prepare(`
        SELECT passage_id, selection_json FROM user_highlights
        WHERE session_id = ? AND version_id = ?
          AND sync_state = 'synced'
          AND (passage_id = ? OR passage_id LIKE ?)
      `).all(sessionId, version, passage, pattern).map((row) => (
        [row.passage_id, parseSelectionRanges(row.selection_json)]
      )));
      this.database.prepare(`
        DELETE FROM user_highlights
        WHERE session_id = ? AND version_id = ?
          AND sync_state = 'synced'
          AND (passage_id = ? OR passage_id LIKE ?)
      `).run(sessionId, version, passage, pattern);
      for (const highlight of remote.data || []) {
        const existing = this.database.prepare(`
          SELECT sync_state FROM user_highlights
          WHERE session_id = ? AND version_id = ? AND passage_id = ?
        `).get(sessionId, version, highlight.passage_id);
        if (existing && existing.sync_state !== 'synced') continue;
        this.#upsertHighlight({
          sessionId,
          version,
          passage: highlight.passage_id,
          color: highlight.color,
          syncState: 'synced',
          now,
          syncedAt: now,
          error: null,
          selectionRanges: savedSelections.get(highlight.passage_id) || [],
        });
      }
    });
    return {
      highlights: this.#highlightRows(sessionId, version, passage)
        .filter((row) => row.sync_state !== 'pending_delete')
        .map(highlightRecord),
      flush,
      syncedAt: new Date(now).toISOString(),
    };
  }

  async createHighlight({ versionId, passageId, color, selectionRanges } = {}) {
    const sessionId = this.authentication.getSessionId();
    const version = positiveInteger(versionId, 'version');
    const passage = highlightPassage(passageId);
    const selectedColor = normalizeColor(color || this.getDefaultHighlightColor());
    const selectedRanges = normalizeSelectionRanges(selectionRanges, passage);
    const now = Date.now();
    this.#upsertHighlight({
      sessionId,
      version,
      passage,
      color: selectedColor,
      syncState: 'pending_create',
      now,
      syncedAt: null,
      error: null,
      selectionRanges: selectedRanges,
    });

    try {
      this.#requireRemoteHighlights();
      const remote = await this.#withAuthentication((token) => (
        this.highlightsClient.createHighlight({
          version_id: version,
          passage_id: passage,
          color: selectedColor,
        }, token)
      ));
      this.database.prepare(`
        DELETE FROM user_highlights
        WHERE session_id = ? AND version_id = ? AND passage_id = ?
      `).run(sessionId, version, passage);
      this.#upsertHighlight({
        sessionId,
        version,
        passage: remote.passage_id,
        color: remote.color,
        syncState: 'synced',
        now: Date.now(),
        syncedAt: Date.now(),
        error: null,
        selectionRanges: selectedRanges,
      });
      return { highlight: highlightRecord(this.#getHighlight(sessionId, version, remote.passage_id)), queued: false };
    } catch (error) {
      this.#recordHighlightError(sessionId, version, passage, error);
      return {
        highlight: highlightRecord(this.#getHighlight(sessionId, version, passage)),
        queued: true,
        error: publicError(error),
      };
    }
  }

  async deleteHighlight({ versionId, passageId } = {}) {
    const sessionId = this.authentication.getSessionId();
    const version = positiveInteger(versionId, 'version');
    const passage = highlightPassage(passageId);
    const versePassages = highlightVersePassages(passage);
    const existing = this.#getHighlight(sessionId, version, passage);
    const now = Date.now();
    this.#transaction(() => {
      this.database.prepare(`
        DELETE FROM user_highlights
        WHERE session_id = ? AND version_id = ? AND passage_id = ?
      `).run(sessionId, version, passage);
      for (const versePassage of versePassages) {
        this.#upsertHighlight({
          sessionId,
          version,
          passage: versePassage,
          color: existing?.color || this.getDefaultHighlightColor(),
          syncState: 'pending_delete',
          now,
          syncedAt: existing?.synced_at || null,
          error: null,
        });
      }
    });

    try {
      this.#requireRemoteHighlights();
      for (const versePassage of versePassages) {
        await this.#withAuthentication((token) => (
          this.highlightsClient.deleteHighlight(
            versePassage,
            { version_id: version },
            token,
          )
        ));
        this.database.prepare(`
          DELETE FROM user_highlights
          WHERE session_id = ? AND version_id = ? AND passage_id = ?
        `).run(sessionId, version, versePassage);
      }
      return { deleted: true, queued: false, version, passage };
    } catch (error) {
      for (const versePassage of versePassages) {
        if (this.#getHighlight(sessionId, version, versePassage)?.sync_state === 'pending_delete') {
          this.#recordHighlightError(sessionId, version, versePassage, error);
        }
      }
      return { deleted: true, queued: true, version, passage, error: publicError(error) };
    }
  }

  async flushPending() {
    this.#requireRemoteHighlights();
    const sessionId = this.authentication.getSessionId();
    const pending = this.database.prepare(`
      SELECT version_id, passage_id, color, sync_state, selection_json
      FROM user_highlights
      WHERE session_id = ? AND sync_state IN ('pending_create', 'pending_delete')
      ORDER BY updated_at ASC
    `).all(sessionId);
    const result = { attempted: pending.length, synced: 0, failed: 0 };
    for (const item of pending) {
      try {
        if (item.sync_state === 'pending_delete') {
          await this.#withAuthentication((token) => (
            this.highlightsClient.deleteHighlight(
              item.passage_id,
              { version_id: item.version_id },
              token,
            )
          ));
          this.database.prepare(`
            DELETE FROM user_highlights
            WHERE session_id = ? AND version_id = ? AND passage_id = ?
          `).run(sessionId, item.version_id, item.passage_id);
        } else {
          const remote = await this.#withAuthentication((token) => (
            this.highlightsClient.createHighlight({
              version_id: item.version_id,
              passage_id: item.passage_id,
              color: item.color,
            }, token)
          ));
          this.database.prepare(`
            DELETE FROM user_highlights
            WHERE session_id = ? AND version_id = ? AND passage_id = ?
          `).run(sessionId, item.version_id, item.passage_id);
          this.#upsertHighlight({
            sessionId,
            version: remote.version_id,
            passage: remote.passage_id,
            color: remote.color,
            syncState: 'synced',
            now: Date.now(),
            syncedAt: Date.now(),
            error: null,
            selectionRanges: parseSelectionRanges(item.selection_json),
          });
        }
        result.synced += 1;
      } catch (error) {
        this.#recordHighlightError(
          sessionId,
          item.version_id,
          item.passage_id,
          error,
        );
        result.failed += 1;
      }
    }
    return result;
  }

  getNotes(versionId, passageId) {
    const version = positiveInteger(versionId, 'version');
    const passage = contextPassage(passageId);
    return this.database.prepare(`
      SELECT id, version_id, passage_id, body, created_at, updated_at
      FROM user_notes
      WHERE version_id = ? AND (passage_id = ? OR passage_id LIKE ?)
      ORDER BY updated_at DESC
    `).all(version, passage, `${passage}.%`).map(noteRecord);
  }

  createNote({ versionId, passageId, body } = {}) {
    const version = positiveInteger(versionId, 'version');
    const passage = highlightPassage(passageId);
    const noteBody = String(body || '').trim();
    if (!noteBody || noteBody.length > MAX_NOTE_LENGTH) {
      throw badRequest(`note body must contain 1-${MAX_NOTE_LENGTH} characters.`);
    }
    const id = randomUUID();
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO user_notes(id, version_id, passage_id, body, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, version, passage, noteBody, now, now);
    return noteRecord(this.database.prepare(
      'SELECT * FROM user_notes WHERE id = ?',
    ).get(id));
  }

  deleteNote(id) {
    const changes = this.database.prepare(
      'DELETE FROM user_notes WHERE id = ?',
    ).run(String(id || '')).changes;
    return { deleted: changes > 0, id };
  }

  getDefaultHighlightColor() {
    const row = this.database.prepare(`
      SELECT preference_value FROM user_preferences
      WHERE preference_key = 'default_highlight_color'
    `).get();
    return row?.preference_value || DEFAULT_HIGHLIGHT_COLOR;
  }

  setDefaultHighlightColor(color) {
    const normalized = normalizeColor(color);
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO user_preferences(preference_key, preference_value, updated_at)
      VALUES ('default_highlight_color', ?, ?)
      ON CONFLICT(preference_key) DO UPDATE SET
        preference_value = excluded.preference_value,
        updated_at = excluded.updated_at
    `).run(normalized, now);
    return { defaultHighlightColor: normalized, updatedAt: new Date(now).toISOString() };
  }

  getDefaultHighlightOpacity() {
    const row = this.database.prepare(`
      SELECT preference_value FROM user_preferences
      WHERE preference_key = 'default_highlight_opacity'
    `).get();
    if (!row) return DEFAULT_HIGHLIGHT_OPACITY;
    try {
      return normalizeHighlightOpacity(row.preference_value);
    } catch {
      return DEFAULT_HIGHLIGHT_OPACITY;
    }
  }

  setDefaultHighlightOpacity(opacity) {
    const normalized = normalizeHighlightOpacity(opacity);
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO user_preferences(preference_key, preference_value, updated_at)
      VALUES ('default_highlight_opacity', ?, ?)
      ON CONFLICT(preference_key) DO UPDATE SET
        preference_value = excluded.preference_value,
        updated_at = excluded.updated_at
    `).run(String(normalized), now);
    return { defaultHighlightOpacity: normalized, updatedAt: new Date(now).toISOString() };
  }

  getAppScale() {
    const row = this.database.prepare(`
      SELECT preference_value FROM user_preferences
      WHERE preference_key = 'app_scale'
    `).get();
    if (!row) return DEFAULT_APP_SCALE;
    try {
      return normalizeAppScale(row.preference_value);
    } catch {
      return DEFAULT_APP_SCALE;
    }
  }

  setAppScale(scale) {
    const normalized = normalizeAppScale(scale);
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO user_preferences(preference_key, preference_value, updated_at)
      VALUES ('app_scale', ?, ?)
      ON CONFLICT(preference_key) DO UPDATE SET
        preference_value = excluded.preference_value,
        updated_at = excluded.updated_at
    `).run(String(normalized), now);
    return { appScale: normalized, updatedAt: new Date(now).toISOString() };
  }

  getReaderTextScale() {
    const row = this.database.prepare(`
      SELECT preference_value FROM user_preferences
      WHERE preference_key = 'reader_text_scale'
    `).get();
    if (!row) return DEFAULT_READER_TEXT_SCALE;
    try {
      return normalizeReaderTextScale(row.preference_value);
    } catch {
      return DEFAULT_READER_TEXT_SCALE;
    }
  }

  setReaderTextScale(scale) {
    const normalized = normalizeReaderTextScale(scale);
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO user_preferences(preference_key, preference_value, updated_at)
      VALUES ('reader_text_scale', ?, ?)
      ON CONFLICT(preference_key) DO UPDATE SET
        preference_value = excluded.preference_value,
        updated_at = excluded.updated_at
    `).run(String(normalized), now);
    return { readerTextScale: normalized, updatedAt: new Date(now).toISOString() };
  }

  getReaderFontStyle() {
    const row = this.database.prepare(`
      SELECT preference_value FROM user_preferences
      WHERE preference_key = 'reader_font_style'
    `).get();
    return READER_FONT_STYLES.has(row?.preference_value)
      ? row.preference_value
      : DEFAULT_READER_FONT_STYLE;
  }

  setReaderFontStyle(style) {
    const normalized = String(style || '').trim().toLowerCase();
    if (!READER_FONT_STYLES.has(normalized)) {
      throw badRequest('reader font style must be system or youversion.');
    }
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO user_preferences(preference_key, preference_value, updated_at)
      VALUES ('reader_font_style', ?, ?)
      ON CONFLICT(preference_key) DO UPDATE SET
        preference_value = excluded.preference_value,
        updated_at = excluded.updated_at
    `).run(normalized, now);
    return { readerFontStyle: normalized, updatedAt: new Date(now).toISOString() };
  }

  getRedLetters() {
    const row = this.database.prepare(`
      SELECT preference_value FROM user_preferences
      WHERE preference_key = 'red_letters'
    `).get();
    if (!row) return DEFAULT_RED_LETTERS;
    return row.preference_value === 'true';
  }

  setRedLetters(enabled) {
    if (typeof enabled !== 'boolean') {
      throw badRequest('red letters must be true or false.');
    }
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO user_preferences(preference_key, preference_value, updated_at)
      VALUES ('red_letters', ?, ?)
      ON CONFLICT(preference_key) DO UPDATE SET
        preference_value = excluded.preference_value,
        updated_at = excluded.updated_at
    `).run(String(enabled), now);
    return { redLetters: enabled, updatedAt: new Date(now).toISOString() };
  }

  getVerseOfTheDayEnabled() {
    const row = this.database.prepare(`
      SELECT preference_value FROM user_preferences
      WHERE preference_key = 'verse_of_the_day_enabled'
    `).get();
    return row ? row.preference_value === 'true' : DEFAULT_VERSE_OF_THE_DAY_ENABLED;
  }

  setVerseOfTheDayEnabled(enabled) {
    if (typeof enabled !== 'boolean') {
      throw badRequest('verse of the day must be true or false.');
    }
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO user_preferences(preference_key, preference_value, updated_at)
      VALUES ('verse_of_the_day_enabled', ?, ?)
      ON CONFLICT(preference_key) DO UPDATE SET
        preference_value = excluded.preference_value,
        updated_at = excluded.updated_at
    `).run(String(enabled), now);
    return { verseOfTheDayEnabled: enabled, updatedAt: new Date(now).toISOString() };
  }

  getMusicPlayerEnabled() {
    const row = this.database.prepare(`
      SELECT preference_value FROM user_preferences
      WHERE preference_key = 'music_player_enabled'
    `).get();
    return row ? row.preference_value === 'true' : DEFAULT_MUSIC_PLAYER_ENABLED;
  }

  setMusicPlayerEnabled(enabled) {
    if (typeof enabled !== 'boolean') {
      throw badRequest('Christian radio must be true or false.');
    }
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO user_preferences(preference_key, preference_value, updated_at)
      VALUES ('music_player_enabled', ?, ?)
      ON CONFLICT(preference_key) DO UPDATE SET
        preference_value = excluded.preference_value,
        updated_at = excluded.updated_at
    `).run(String(enabled), now);
    return { musicPlayerEnabled: enabled, updatedAt: new Date(now).toISOString() };
  }

  getCustomRadioStations() {
    const row = this.database.prepare(`
      SELECT preference_value FROM user_preferences
      WHERE preference_key = 'custom_radio_stations'
    `).get();
    if (!row) return [];
    try {
      return normalizeCustomRadioStations(JSON.parse(row.preference_value));
    } catch {
      return [];
    }
  }

  setCustomRadioStations(stations) {
    const normalized = normalizeCustomRadioStations(stations);
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO user_preferences(preference_key, preference_value, updated_at)
      VALUES ('custom_radio_stations', ?, ?)
      ON CONFLICT(preference_key) DO UPDATE SET
        preference_value = excluded.preference_value,
        updated_at = excluded.updated_at
    `).run(JSON.stringify(normalized), now);
    return { customRadioStations: normalized, updatedAt: new Date(now).toISOString() };
  }

  getHiddenRadioStationIds() {
    const row = this.database.prepare(`
      SELECT preference_value FROM user_preferences
      WHERE preference_key = 'hidden_radio_station_ids'
    `).get();
    if (!row) return [];
    try {
      return normalizeHiddenRadioStationIds(JSON.parse(row.preference_value));
    } catch {
      return [];
    }
  }

  setHiddenRadioStationIds(stationIds) {
    const normalized = normalizeHiddenRadioStationIds(stationIds);
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO user_preferences(preference_key, preference_value, updated_at)
      VALUES ('hidden_radio_station_ids', ?, ?)
      ON CONFLICT(preference_key) DO UPDATE SET
        preference_value = excluded.preference_value,
        updated_at = excluded.updated_at
    `).run(JSON.stringify(normalized), now);
    return { hiddenRadioStationIds: normalized, updatedAt: new Date(now).toISOString() };
  }

  getRadioStationOrder() {
    const row = this.database.prepare(`
      SELECT preference_value FROM user_preferences
      WHERE preference_key = 'radio_station_order'
    `).get();
    if (!row) return [];
    try {
      return normalizeRadioStationOrder(JSON.parse(row.preference_value));
    } catch {
      return [];
    }
  }

  setRadioStationOrder(stationKeys) {
    const normalized = normalizeRadioStationOrder(stationKeys);
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO user_preferences(preference_key, preference_value, updated_at)
      VALUES ('radio_station_order', ?, ?)
      ON CONFLICT(preference_key) DO UPDATE SET
        preference_value = excluded.preference_value,
        updated_at = excluded.updated_at
    `).run(JSON.stringify(normalized), now);
    return { radioStationOrder: normalized, updatedAt: new Date(now).toISOString() };
  }

  getSettingsSectionOrder() {
    const row = this.database.prepare(`
      SELECT preference_value FROM user_preferences
      WHERE preference_key = 'settings_section_order'
    `).get();
    if (!row) return [...SETTINGS_SECTION_IDS];
    try {
      return normalizeSettingsSectionOrder(JSON.parse(row.preference_value));
    } catch {
      return [...SETTINGS_SECTION_IDS];
    }
  }

  setSettingsSectionOrder(sectionIds) {
    const normalized = normalizeSettingsSectionOrder(sectionIds);
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO user_preferences(preference_key, preference_value, updated_at)
      VALUES ('settings_section_order', ?, ?)
      ON CONFLICT(preference_key) DO UPDATE SET
        preference_value = excluded.preference_value,
        updated_at = excluded.updated_at
    `).run(JSON.stringify(normalized), now);
    return { settingsSectionOrder: normalized, updatedAt: new Date(now).toISOString() };
  }

  getAppLanguage() {
    const row = this.database.prepare(`
      SELECT preference_value FROM user_preferences
      WHERE preference_key = 'app_language'
    `).get();
    return APP_LANGUAGES.has(row?.preference_value)
      ? row.preference_value
      : DEFAULT_APP_LANGUAGE;
  }

  setAppLanguage(language) {
    const normalized = String(language || '').trim();
    if (!APP_LANGUAGES.has(normalized)) {
      throw badRequest('app language must be system, en-US, or es-419.');
    }
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO user_preferences(preference_key, preference_value, updated_at)
      VALUES ('app_language', ?, ?)
      ON CONFLICT(preference_key) DO UPDATE SET
        preference_value = excluded.preference_value,
        updated_at = excluded.updated_at
    `).run(normalized, now);
    return { appLanguage: normalized, updatedAt: new Date(now).toISOString() };
  }

  getSecondaryBibleLanguages() {
    const row = this.database.prepare(`
      SELECT preference_value FROM user_preferences
      WHERE preference_key = 'secondary_bible_languages'
    `).get();
    if (!row) return [];
    try {
      return normalizeSecondaryBibleLanguages(JSON.parse(row.preference_value));
    } catch {
      return [];
    }
  }

  setSecondaryBibleLanguages(languages) {
    const normalized = normalizeSecondaryBibleLanguages(languages);
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO user_preferences(preference_key, preference_value, updated_at)
      VALUES ('secondary_bible_languages', ?, ?)
      ON CONFLICT(preference_key) DO UPDATE SET
        preference_value = excluded.preference_value,
        updated_at = excluded.updated_at
    `).run(JSON.stringify(normalized), now);
    return {
      secondaryBibleLanguages: normalized,
      updatedAt: new Date(now).toISOString(),
    };
  }

  getReaderTabs() {
    const row = this.database.prepare(`
      SELECT preference_value FROM user_preferences
      WHERE preference_key = 'reader_tabs'
    `).get();
    if (!row) return { tabs: [], activeTabIndex: -1 };
    try {
      return normalizeReaderTabs(JSON.parse(row.preference_value));
    } catch {
      return { tabs: [], activeTabIndex: -1 };
    }
  }

  setReaderTabs(value) {
    const normalized = normalizeReaderTabs(value);
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO user_preferences(preference_key, preference_value, updated_at)
      VALUES ('reader_tabs', ?, ?)
      ON CONFLICT(preference_key) DO UPDATE SET
        preference_value = excluded.preference_value,
        updated_at = excluded.updated_at
    `).run(JSON.stringify(normalized), now);
    return {
      ...normalized,
      updatedAt: new Date(now).toISOString(),
    };
  }

  getKeybindings() {
    const row = this.database.prepare(`
      SELECT preference_value FROM user_preferences
      WHERE preference_key = 'keybindings'
    `).get();
    if (!row) return { ...DEFAULT_KEYBINDINGS };
    try {
      return normalizeKeybindings(JSON.parse(row.preference_value));
    } catch {
      return { ...DEFAULT_KEYBINDINGS };
    }
  }

  setKeybindings(value) {
    const normalized = normalizeKeybindings(value);
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO user_preferences(preference_key, preference_value, updated_at)
      VALUES ('keybindings', ?, ?)
      ON CONFLICT(preference_key) DO UPDATE SET
        preference_value = excluded.preference_value,
        updated_at = excluded.updated_at
    `).run(JSON.stringify(normalized), now);
    return { keybindings: normalized, updatedAt: new Date(now).toISOString() };
  }

  #highlightRows(sessionId, version, passage) {
    return this.database.prepare(`
      SELECT version_id, passage_id, color, sync_state, updated_at, synced_at,
        error, selection_json
      FROM user_highlights
      WHERE session_id = ? AND version_id = ?
        AND (passage_id = ? OR passage_id LIKE ?)
      ORDER BY passage_id ASC
    `).all(sessionId, version, passage, `${passage}.%`);
  }

  #getHighlight(sessionId, version, passage) {
    return this.database.prepare(`
      SELECT version_id, passage_id, color, sync_state, updated_at, synced_at,
        error, selection_json
      FROM user_highlights
      WHERE session_id = ? AND version_id = ? AND passage_id = ?
    `).get(sessionId, version, passage);
  }

  #upsertHighlight({
    sessionId,
    version,
    passage,
    color,
    syncState,
    now,
    syncedAt,
    error,
    selectionRanges = [],
  }) {
    this.database.prepare(`
      INSERT INTO user_highlights(
        session_id, version_id, passage_id, color, sync_state,
        updated_at, synced_at, error, selection_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id, version_id, passage_id) DO UPDATE SET
        color = excluded.color, sync_state = excluded.sync_state,
        updated_at = excluded.updated_at, synced_at = excluded.synced_at,
        error = excluded.error, selection_json = excluded.selection_json
    `).run(
      sessionId,
      version,
      String(passage).toUpperCase(),
      normalizeColor(color),
      syncState,
      now,
      syncedAt,
      error,
      selectionRanges.length > 0 ? JSON.stringify(selectionRanges) : null,
    );
  }

  #recordHighlightError(sessionId, version, passage, error) {
    this.database.prepare(`
      UPDATE user_highlights SET error = ?, updated_at = ?
      WHERE session_id = ? AND version_id = ? AND passage_id = ?
    `).run(String(error?.message || error).slice(0, 500), Date.now(), sessionId, version, passage);
  }

  #requireRemoteHighlights() {
    if (!this.highlightsClient) {
      throw new ServiceError('YouVersion highlight sync is unavailable.', {
        code: 'APP_KEY_MISSING',
        status: 503,
      });
    }
  }

  async #withAuthentication(operation) {
    let token = await this.authentication.getAccessToken();
    let refreshed = false;
    while (true) {
      try {
        return await operation(token);
      } catch (error) {
        const status = getHttpStatus(error);
        if (status === 401 && !refreshed) {
          token = await this.authentication.getAccessToken({ forceRefresh: true });
          refreshed = true;
          continue;
        }
        if (status === 403) {
          throw new ServiceError(
            'Light requires highlights permission. Sign in with the highlights permission.',
            { code: 'HIGHLIGHTS_PERMISSION_REQUIRED', status: 403, cause: error },
          );
        }
        throw new ServiceError(`Light highlight request failed: ${error.message}`, {
          code: 'HIGHLIGHTS_UPSTREAM_ERROR',
          status: 502,
          cause: error,
        });
      }
    }
  }

  #transaction(callback) {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      callback();
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}

function highlightRecord(row) {
  return {
    version: Number(row.version_id),
    passage: row.passage_id,
    color: row.color,
    syncState: row.sync_state,
    updatedAt: new Date(row.updated_at).toISOString(),
    syncedAt: row.synced_at ? new Date(row.synced_at).toISOString() : null,
    error: row.error,
    selectionRanges: parseSelectionRanges(row.selection_json),
  };
}

function noteRecord(row) {
  return {
    id: row.id,
    version: Number(row.version_id),
    passage: row.passage_id,
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    syncState: 'local_only',
  };
}

function contextPassage(value) {
  const passage = String(value || '').toUpperCase();
  if (!/^[A-Z0-9]{3}\.(?:INTRO|\d+)(?:\.\d+)?$/.test(passage)) {
    throw badRequest('passage must be a chapter or single verse USFM reference.');
  }
  return passage;
}

function highlightPassage(value) {
  const passage = String(value || '').toUpperCase();
  if (!/^[A-Z0-9]{3}\.\d+\.\d+(?:-\d+)?$/.test(passage)) {
    throw badRequest('highlight passage must be a verse or same-chapter verse range.');
  }
  return passage;
}

function highlightVersePassages(value) {
  const passage = highlightPassage(value);
  const match = passage.match(/^([A-Z0-9]{3}\.\d+)\.(\d+)(?:-(\d+))?$/);
  const first = Number(match[2]);
  const last = match[3] ? Number(match[3]) : first;
  const passages = [];
  for (let verse = first; verse <= last; verse += 1) {
    passages.push(`${match[1]}.${verse}`);
  }
  return passages;
}

function normalizeColor(value) {
  const color = String(value || '').replace(/^#/, '').toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(color)) {
    throw badRequest('highlight color must be a six-digit hex value.');
  }
  return color;
}

function normalizeHighlightOpacity(value) {
  const opacity = Number(value);
  if (
    !Number.isFinite(opacity)
    || opacity < MIN_HIGHLIGHT_OPACITY
    || opacity > MAX_HIGHLIGHT_OPACITY
  ) {
    throw badRequest(
      `highlight opacity must be from ${MIN_HIGHLIGHT_OPACITY} to ${MAX_HIGHLIGHT_OPACITY}.`,
    );
  }
  return Math.round(opacity * 100) / 100;
}

function normalizeSelectionRanges(value, passageId) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_HIGHLIGHT_SELECTION_RANGES) {
    throw badRequest(
      `selectionRanges must be an array with at most ${MAX_HIGHLIGHT_SELECTION_RANGES} items.`,
    );
  }
  const passage = highlightPassage(passageId);
  const passageMatch = passage.match(/^([A-Z0-9]{3}\.\d+)\.(\d+)(?:-(\d+))?$/);
  const base = passageMatch[1];
  const firstVerse = Number(passageMatch[2]);
  const lastVerse = passageMatch[3] ? Number(passageMatch[3]) : firstVerse;
  const result = [];
  for (const item of value) {
    const rangePassage = String(item?.passage || '').toUpperCase();
    const rangeMatch = rangePassage.match(/^([A-Z0-9]{3}\.\d+)\.(\d+)$/);
    const start = Number(item?.start);
    const end = Number(item?.end);
    if (
      !rangeMatch
      || rangeMatch[1] !== base
      || Number(rangeMatch[2]) < firstVerse
      || Number(rangeMatch[2]) > lastVerse
      || !Number.isSafeInteger(start)
      || !Number.isSafeInteger(end)
      || start < 0
      || end <= start
      || end > MAX_HIGHLIGHT_TEXT_OFFSET
    ) {
      throw badRequest('selectionRanges must contain valid offsets within the highlighted verses.');
    }
    result.push({ passage: rangePassage, start, end });
  }
  return result.sort((left, right) => (
    left.passage.localeCompare(right.passage) || left.start - right.start
  ));
}

function parseSelectionRanges(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeAppScale(value) {
  const scale = Number(value);
  if (!Number.isFinite(scale) || scale < MIN_APP_SCALE || scale > MAX_APP_SCALE) {
    throw badRequest(`app scale must be from ${MIN_APP_SCALE} to ${MAX_APP_SCALE}.`);
  }
  return Math.round(scale * 100) / 100;
}

function normalizeReaderTextScale(value) {
  const scale = Number(value);
  if (
    !Number.isFinite(scale)
    || scale < MIN_READER_TEXT_SCALE
    || scale > MAX_READER_TEXT_SCALE
  ) {
    throw badRequest(
      `reader text scale must be from ${MIN_READER_TEXT_SCALE} to ${MAX_READER_TEXT_SCALE}.`,
    );
  }
  return Math.round(scale * 100) / 100;
}

function normalizeSecondaryBibleLanguages(value) {
  if (!Array.isArray(value)) {
    throw badRequest('secondary Bible languages must be an array.');
  }
  const result = [];
  const seen = new Set();
  for (const item of value) {
    const language = String(item || '').trim();
    if (!/^[a-z]{2,3}(?:-[A-Z][a-z]{3})?$/.test(language)) {
      throw badRequest('secondary Bible languages must use BCP-47 language codes.');
    }
    if (seen.has(language)) continue;
    seen.add(language);
    result.push(language);
  }
  if (result.length > MAX_SECONDARY_BIBLE_LANGUAGES) {
    throw badRequest(
      `no more than ${MAX_SECONDARY_BIBLE_LANGUAGES} secondary Bible languages may be selected.`,
    );
  }
  return result;
}

function normalizeSettingsSectionOrder(value) {
  if (!Array.isArray(value)) {
    throw badRequest('settings section order must be an array.');
  }
  const allowed = new Set(SETTINGS_SECTION_IDS);
  const seen = new Set();
  const result = [];
  for (const raw of value) {
    const section = String(raw || '').trim();
    if (!allowed.has(section)) {
      throw badRequest('settings section order contains an unknown section.');
    }
    if (seen.has(section)) continue;
    seen.add(section);
    result.push(section);
  }
  for (const section of SETTINGS_SECTION_IDS) {
    if (!seen.has(section)) result.push(section);
  }
  return result;
}

function normalizeReaderTabs(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.tabs)) {
    throw badRequest('reader tabs must include a tabs array.');
  }
  if (value.tabs.length > MAX_READER_TABS) {
    throw badRequest(`no more than ${MAX_READER_TABS} reader tabs may be saved.`);
  }
  const tabs = [];
  const seen = new Set();
  for (const item of value.tabs) {
    const version = positiveInteger(item?.version, 'reader tab version');
    const passage = contextPassage(item?.passage);
    if (!/^[A-Z0-9]{3}\.\d+$/.test(passage)) {
      throw badRequest('reader tabs must reference Bible chapters.');
    }
    const key = `${version}:${passage}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const verse = String(item?.verse || '').trim();
    if (verse && !/^\d+(?:-\d+)?$/.test(verse)) {
      throw badRequest('reader tab verses must be a verse number or range.');
    }
    const tab = verse ? { version, passage, verse } : { version, passage };
    if (item?.scrollY !== undefined) {
      if (typeof item.scrollY !== 'number' || !Number.isFinite(item.scrollY)
          || item.scrollY < 0 || !Number.isSafeInteger(Math.round(item.scrollY))) {
        throw badRequest('reader tab scroll position must be a non-negative number.');
      }
      tab.scrollY = Math.round(item.scrollY);
    }
    tabs.push(tab);
  }
  const requestedIndex = Number(value.activeTabIndex);
  const activeTabIndex = Number.isSafeInteger(requestedIndex)
    && requestedIndex >= 0
    && requestedIndex < tabs.length
    ? requestedIndex
    : (tabs.length > 0 ? 0 : -1);
  return { tabs, activeTabIndex };
}

export function normalizeCustomRadioStations(value) {
  if (!Array.isArray(value)) {
    throw badRequest('custom radio stations must be an array.');
  }
  const result = [];
  const seenUrls = new Set();
  for (const station of value) {
    const name = String(station?.name || '').trim();
    const streamUrl = String(station?.streamUrl || '').trim();
    if (!name || name.length > MAX_RADIO_STATION_NAME_LENGTH) {
      throw badRequest(`radio station names must be 1-${MAX_RADIO_STATION_NAME_LENGTH} characters.`);
    }
    if (!streamUrl || streamUrl.length > MAX_RADIO_STREAM_URL_LENGTH) {
      throw badRequest('radio stream URL is missing or too long.');
    }
    let parsed;
    try {
      parsed = new URL(streamUrl);
    } catch {
      throw badRequest('radio stream URL must be a valid http or https URL.');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw badRequest('radio stream URL must use http or https.');
    }
    // Fragments are never sent with an HTTP stream request, so they cannot
    // distinguish stations and must not bypass duplicate detection.
    parsed.hash = '';
    const normalizedUrl = parsed.href;
    const key = normalizedUrl.toLowerCase();
    if (seenUrls.has(key)) {
      throw badRequest('radio station stream URLs must be unique.');
    }
    seenUrls.add(key);
    const description = String(station?.description || 'Custom station').trim()
      || 'Custom station';
    if (description.length > MAX_RADIO_STATION_DESCRIPTION_LENGTH) {
      throw badRequest(
        `radio station descriptions must be no more than ${MAX_RADIO_STATION_DESCRIPTION_LENGTH} characters.`,
      );
    }
    result.push({
      name,
      description,
      streamUrl: normalizedUrl,
      siteUrl: '',
      custom: true,
    });
  }
  return result;
}

function normalizeHiddenRadioStationIds(value) {
  if (!Array.isArray(value)) {
    throw badRequest('hidden radio station IDs must be an array.');
  }
  if (value.length > MAX_HIDDEN_RADIO_STATIONS) {
    throw badRequest(`no more than ${MAX_HIDDEN_RADIO_STATIONS} radio stations may be hidden.`);
  }
  const result = [];
  const seen = new Set();
  for (const item of value) {
    const stationId = String(item || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(stationId)) {
      throw badRequest('hidden radio station IDs may contain lowercase letters, numbers, and hyphens.');
    }
    if (seen.has(stationId)) continue;
    seen.add(stationId);
    result.push(stationId);
  }
  return result;
}

export function normalizeRadioStationOrder(value) {
  if (!Array.isArray(value)) {
    throw badRequest('radio station order must be an array.');
  }
  const result = [];
  const seen = new Set();
  for (const item of value) {
    const stationKey = String(item || '').trim().toLowerCase();
    const builtInKey = /^builtin:[a-z0-9][a-z0-9-]{0,63}$/.test(stationKey);
    const customKey = /^custom:https?:\/\/\S{1,512}$/.test(stationKey);
    if (!builtInKey && !customKey) {
      throw badRequest('radio station order contains an invalid station key.');
    }
    if (seen.has(stationKey)) continue;
    seen.add(stationKey);
    result.push(stationKey);
  }
  return result;
}

export function normalizeKeybindings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest('keybindings must be an object.');
  }
  const result = {};
  const seen = new Map();
  for (const [name, fallback] of Object.entries(DEFAULT_KEYBINDINGS)) {
    const shortcut = String(value[name] ?? fallback).trim();
    const modified = /^(?:Ctrl|Alt|Shift|Meta|Super)(?:\+(?:Ctrl|Alt|Shift|Meta|Super))*\+(?:[A-Za-z0-9]+|[+=-])$/i.test(shortcut);
    const unmodified = /^(?:[A-Za-z0-9]+|[+=-])$/.test(shortcut);
    if (!modified && !unmodified) {
      throw badRequest(`keybinding ${name} must contain a supported key.`);
    }
    const key = shortcut.toLowerCase().replace(/\+shift\+=$/, '++').replace(/\+shift\+\+$/, '++');
    if (seen.has(key)) throw new ServiceError(`${shortcut} is already assigned to ${seen.get(key)} in Light.`, { code: 'KEYBINDING_CONFLICT', status: 409 });
    seen.set(key, name);
    result[name] = shortcut;
  }
  return result;
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw badRequest(`${name} must be a positive integer.`);
  }
  return parsed;
}

function publicError(error) {
  return {
    code: error instanceof ServiceError ? error.code : 'SYNC_FAILED',
    message: error.message,
  };
}

function badRequest(message) {
  return new ServiceError(message, { code: 'BAD_REQUEST', status: 400 });
}
