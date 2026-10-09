import { searchableVerses } from './download-manager.js';
import { ServiceError } from './service-error.js';

// Search references are short-lived; licensed text stays in the passage cache.
export class SearchAcceleration {
  constructor(service) {
    this.service = service;
    this.results = new Map();
    this.pending = new Map();
  }

  async search(version, query, page, fetchResults) {
    const key = JSON.stringify([version, query.toLowerCase(), page]);
    let entry = this.results.get(key);
    if (!entry || entry.expires <= Date.now()) {
      let pending = this.pending.get(key);
      if (!pending) {
        pending = Promise.resolve().then(fetchResults).then(result => {
          this.results.delete(key);
          this.results.set(key, { result, expires: Date.now() + 60_000 });
          if (this.results.size > 64) this.results.delete(this.results.keys().next().value);
          return result;
        }).finally(() => this.pending.delete(key));
        this.pending.set(key, pending);
      }
      entry = { result: await pending };
    }
    return { ...entry.result, verses: (entry.result.verses || []).map(hit => {
      const text = hit.text || this.cachedVerse(version, hit.reference);
      return text ? { ...hit, text } : hit;
    }) };
  }

  cachedVerse(version, reference) {
    if (!/^[A-Z0-9]{3}\.\d+\.\d+$/.test(reference)) return '';
    const preview = this.service.cache?.get(`search-preview:${JSON.stringify({ version, reference })}`);
    if (preview && !preview.expired) return preview.data.text || '';
    const chapter = reference.split('.').slice(0, 2).join('.');
    for (const usfm of [reference, chapter]) {
      for (const format of ['text', 'html']) {
        for (const headings of [false, true]) for (const notes of [false, true]) {
          const params = { version, usfm, format, headings, notes };
          const cached = this.service.cache?.get(`passage:${JSON.stringify(params)}`);
          const downloaded = this.service.downloadManager?.getPassage(version, usfm, {
            format, includeHeadings: headings, includeNotes: notes,
          });
          const data = downloaded?.data || (cached && !cached.expired ? cached.data : null);
          if (!data?.content) continue;
          if (usfm === reference && format === 'text') return data.content;
          const match = searchableVerses(data.content, chapter).find(v => v.reference === reference);
          if (match) return match.text;
        }
      }
    }
    return '';
  }

  async previews(entries) {
    if (!Array.isArray(entries) || entries.length > 10 || entries.some(entry =>
      !Number.isSafeInteger(Number(entry?.version)) || Number(entry.version) < 1
      || !/^[A-Z0-9]{3}\.\d+\.\d+$/.test(entry?.reference))) {
      throw new ServiceError('Provide at most ten valid verse previews.', { code: 'BAD_REQUEST', status: 400 });
    }
    const previews = {}, failed = {}, groups = new Map();
    let rateLimited = false;
    for (const entry of entries) {
      const version = Number(entry.version), reference = entry.reference;
      const key = `${version}:${reference}`;
      const cached = this.cachedVerse(version, reference);
      if (cached) { previews[key] = cached; continue; }
      const chapter = reference.split('.').slice(0, 2).join('.');
      const groupKey = `${version}:${chapter}`;
      if (!groups.has(groupKey)) groups.set(groupKey, { version, chapter, entries: [] });
      if (!groups.get(groupKey).entries.some(v => v.reference === reference))
        groups.get(groupKey).entries.push({ reference, number: Number(reference.split('.')[2]) });
    }
    // The shared YouVersion gate still controls request spacing and cooldown.
    const work = [...groups.values()];
    let cursor = 0;
    const worker = async () => {
      while (cursor < work.length) {
        const group = work[cursor++];
        try {
          if (rateLimited) throw new Error('Preview cooldown');
          const numbers = group.entries.map(v => v.number);
          const first = Math.min(...numbers), last = Math.max(...numbers);
          const reference = `${group.chapter}.${first}${last === first ? '' : '-' + last}`;
          const result = await this.service.passage(group.version, reference, {
            format: first === last ? 'text' : 'html', includeHeadings: false, includeNotes: false,
          });
          const verses = first === last
            ? [{ reference, text: result.data?.content || '' }]
            : searchableVerses(result.data?.content, group.chapter);
          for (const entry of group.entries) {
            const text = verses.find(v => v.reference === entry.reference)?.text;
            const key = `${group.version}:${entry.reference}`;
            if (!text) { failed[key] = true; continue; }
            previews[key] = text;
            this.service.cache?.set(`search-preview:${JSON.stringify({ version: group.version,
              reference: entry.reference })}`, 'search-preview', { text });
          }
        } catch (error) {
          if (error.status === 429) rateLimited = true;
          for (const entry of group.entries) failed[`${group.version}:${entry.reference}`] = true;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, work.length) }, worker));
    return { previews, failed, rateLimited };
  }
}
