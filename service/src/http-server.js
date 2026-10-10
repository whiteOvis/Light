import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { StudyData } from './study-data.js';

function shortcutsUnavailable() {
  throw new ServiceError('Global shortcuts require Light to be enabled in an Omarchy session.', {
    code: 'KEYBINDINGS_UNAVAILABLE', status: 503,
  });
}
import { ServiceError } from './service.js';
import { normalizeKeybindings } from './user-data-manager.js';
import { activeSystemBindings, checkSystemKeybindingConflicts } from './keybinding-conflicts.js';

// Bound ordinary requests; radio collections and their ordering can grow freely.
export const MAX_BODY_BYTES = 1024 * 1024;

export function createHttpServer({
  service,
  cache,
  authentication,
  downloadManager,
  oauth,
  userData,
  applyGlobalHotkey = shortcutsUnavailable,
  applyVerseOfTheDayHotkey = shortcutsUnavailable,
  listSystemBindings = activeSystemBindings,
  requireAccount = true,
  clientToken = randomBytes(32).toString('hex'),
}) {
  const study = userData?.database ? new StudyData(userData) : null;
  return createServer(async (request, response) => {
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.setHeader('cache-control', 'no-store');

    try {
      // Loopback binding alone does not stop web pages or DNS rebinding from
      // reaching local mutation endpoints. Light's native client has no Origin.
      const host = new URL(`http://${request.headers.host || ''}`);
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(host.hostname)
          || host.username || host.password || host.pathname !== '/') {
        throw new ServiceError('Only loopback hosts are allowed.', { code: 'FORBIDDEN', status: 403 });
      }
      if (request.headers.origin !== undefined || request.headers['sec-fetch-site'] !== undefined) {
        throw new ServiceError('Browser requests are not allowed.', { code: 'FORBIDDEN', status: 403 });
      }
      const credential = Buffer.from(request.headers.authorization || '');
      const expected = Buffer.from(`Bearer ${clientToken}`);
      if (credential.length !== expected.length || !timingSafeEqual(credential, expected)) {
        throw new ServiceError('Local client authentication required.', {
          code: 'CLIENT_AUTHENTICATION_REQUIRED', status: 401,
        });
      }
      const url = new URL(request.url, 'http://localhost');
      const query = url.searchParams;
      const route = `${request.method} ${url.pathname}`;
      let result;
      let status = 200;

      if (requireAccount && !availableWithoutAccount(url.pathname)) {
        if (!authentication?.getAccessToken)
          throw new ServiceError('Sign in with YouVersion to use Light.', {
            code: 'AUTHENTICATION_REQUIRED', status: 401,
          });
        await authentication.getAccessToken();
      }

      switch (route) {
        case 'GET /health':
          result = {
            ok: true,
            onlineConfigured: service.onlineConfigured,
            authentication: authentication.status(),
            ...(authentication.status().authenticated ? {
              cache: cache.stats(),
              downloads: downloadManager.listPackages(),
            } : {}),
          };
          break;
        case 'GET /v1/versions':
          result = await service.versions(query.get('language') || '*', {
            mode: query.get('mode') || 'auto',
          });
          break;
        case 'GET /v1/languages':
          result = await service.languages(query.get('locale') || 'en-US', {
            mode: query.get('mode') || 'auto',
          });
          break;
        case 'GET /v1/books':
          result = await service.books(required(query, 'version'), {
            mode: query.get('mode') || 'auto',
          });
          break;
        case 'GET /v1/chapters':
          result = await service.chapters(
            required(query, 'version'),
            required(query, 'book'),
            { mode: query.get('mode') || 'auto' },
          );
          break;
        case 'GET /v1/search-previews': {
          let entries;
          try { entries = JSON.parse(query.get('verses') || '[]'); }
          catch { throw new ServiceError('Invalid preview list.', { code: 'BAD_REQUEST', status: 400 }); }
          result = await service.searchPreviews(entries);
          break;
        }
        case 'GET /v1/search':
          if (query.get('source') === 'download') {
            result = service.searchDownloaded(required(query, 'version'), query.get('query'), query.get('page_token') || '');
          } else {
            result = await service.search(required(query, 'version'), query.get('query'), query.get('page_token') || '');
          }
          break;
        case 'GET /v1/passage':
          result = await service.passage(
            required(query, 'version'),
            required(query, 'usfm'),
            {
              mode: query.get('mode') || 'auto',
              format: query.get('format') || 'text',
              includeHeadings: query.get('include_headings') || false,
              includeNotes: query.get('include_notes') || false,
            },
          );
          break;
        case 'GET /v1/recent-passage':
          result = service.recentPassage();
          break;
        case 'GET /v1/verse-of-the-day':
          result = await service.verseOfTheDay(required(query, 'version'), {
            mode: query.get('mode') || 'auto',
          });
          break;
        case 'GET /v1/auth/status':
          if (authentication.status().authenticated) {
            try { await authentication.getAccessToken(); } catch {}
          }
          result = { ...authentication.status(), ...oauth.status() };
          break;
        case 'POST /v1/auth/start': {
          const body = await readJsonBody(request);
          result = await oauth.start({
            scopes: body.scopes || ['profile', 'email'],
            permissions: body.permissions || ['highlights'],
            open: body.open !== false,
          });
          break;
        }
        case 'POST /v1/auth/refresh':
          await authentication.refresh();
          result = authentication.status();
          break;
        case 'POST /v1/auth/logout':
          result = authentication.signOut();
          break;
        case 'GET /v1/downloads':
          result = { packages: downloadManager.listPackages() };
          break;
        case 'POST /v1/downloads': {
          const body = await readJsonBody(request);
          result = downloadManager.queuePackage(body.version, {
            format: body.format || 'text',
            includeHeadings: body.includeHeadings || false,
            includeNotes: body.includeNotes || false,
            refresh: body.refresh || false,
          });
          status = 202;
          break;
        }
        case 'GET /v1/study/options': result = study.options(); break;
        case 'PUT /v1/study/options': result = study.setOptions(await readJsonBody(request, Infinity)); break;
        case 'GET /v1/study/library': result = await study.libraryWithPreviews(service); break;
        case 'POST /v1/study/history': result = study.visit(await readJsonBody(request)); break;
        case 'POST /v1/study/bookmarks': result = study.bookmark(await readJsonBody(request)); break;
        case 'POST /v1/study/radio-import': result = study.importRadio(await readJsonBody(request, Infinity)); break;
        case 'GET /v1/study/backup': result = study.exportBackup(); break;
        case 'POST /v1/study/restore': result = study.restoreBackup(await readJsonBody(request, Infinity)); break;
        case 'GET /v1/user-data':
          result = await userData.getContext(
            required(query, 'version'),
            required(query, 'passage'),
            { refresh: queryBoolean(query, 'refresh') },
          );
          break;
        case 'GET /v1/user-data/highlights':
          result = {
            highlights: await userData.getHighlights(
              required(query, 'version'),
              required(query, 'passage'),
              { refresh: queryBoolean(query, 'refresh') },
            ),
          };
          break;
        case 'POST /v1/user-data/highlights': {
          const body = await readJsonBody(request);
          result = await userData.createHighlight({
            versionId: body.version,
            passageId: body.passage,
            color: body.color,
            selectionRanges: body.selectionRanges,
          });
          status = result.queued ? 202 : 201;
          break;
        }
        case 'DELETE /v1/user-data/highlights':
          result = await userData.deleteHighlight({
            versionId: required(query, 'version'),
            passageId: required(query, 'passage'),
          });
          status = result.queued ? 202 : 200;
          break;
        case 'POST /v1/user-data/sync': {
          const body = await readJsonBody(request);
          result = await userData.syncHighlights(body.version, body.passage);
          break;
        }
        case 'GET /v1/user-data/notes':
          result = {
            notes: userData.getNotes(
              required(query, 'version'),
              required(query, 'passage'),
            ),
            remoteSyncSupported: false,
          };
          break;
        case 'POST /v1/user-data/notes': {
          const body = await readJsonBody(request);
          result = userData.createNote({
            versionId: body.version,
            passageId: body.passage,
            body: body.body,
          });
          status = 201;
          break;
        }
        case 'GET /v1/user-data/preferences/highlight-color':
          result = { defaultHighlightColor: userData.getDefaultHighlightColor() };
          break;
        case 'PUT /v1/user-data/preferences/highlight-color': {
          const body = await readJsonBody(request);
          result = userData.setDefaultHighlightColor(body.color);
          break;
        }
        case 'GET /v1/user-data/preferences/highlight-opacity':
          result = { defaultHighlightOpacity: userData.getDefaultHighlightOpacity() };
          break;
        case 'PUT /v1/user-data/preferences/highlight-opacity': {
          const body = await readJsonBody(request);
          result = userData.setDefaultHighlightOpacity(body.opacity);
          break;
        }
        case 'GET /v1/user-data/preferences/app-scale':
          result = { appScale: userData.getAppScale() };
          break;
        case 'PUT /v1/user-data/preferences/app-scale': {
          const body = await readJsonBody(request);
          result = userData.setAppScale(body.scale);
          break;
        }
        case 'GET /v1/user-data/preferences/reader-text-scale':
          result = { readerTextScale: userData.getReaderTextScale() };
          break;
        case 'PUT /v1/user-data/preferences/reader-text-scale': {
          const body = await readJsonBody(request);
          result = userData.setReaderTextScale(body.scale);
          break;
        }
        case 'GET /v1/user-data/preferences/reader-font-style':
          result = { readerFontStyle: userData.getReaderFontStyle() };
          break;
        case 'PUT /v1/user-data/preferences/reader-font-style': {
          const body = await readJsonBody(request);
          result = userData.setReaderFontStyle(body.style);
          break;
        }
        case 'GET /v1/user-data/preferences/red-letters':
          result = { redLetters: userData.getRedLetters() };
          break;
        case 'PUT /v1/user-data/preferences/red-letters': {
          const body = await readJsonBody(request);
          result = userData.setRedLetters(body.enabled);
          break;
        }
        case 'GET /v1/user-data/preferences/verse-of-the-day':
          result = { verseOfTheDayEnabled: userData.getVerseOfTheDayEnabled() };
          break;
        case 'PUT /v1/user-data/preferences/verse-of-the-day': {
          const body = await readJsonBody(request);
          result = userData.setVerseOfTheDayEnabled(body.enabled);
          break;
        }
        case 'GET /v1/user-data/preferences/music-player':
          result = { musicPlayerEnabled: userData.getMusicPlayerEnabled() };
          break;
        case 'PUT /v1/user-data/preferences/music-player': {
          const body = await readJsonBody(request);
          result = userData.setMusicPlayerEnabled(body.enabled);
          break;
        }
        case 'GET /v1/user-data/preferences/custom-radio-stations':
          result = { customRadioStations: userData.getCustomRadioStations() };
          break;
        case 'PUT /v1/user-data/preferences/custom-radio-stations': {
          const body = await readJsonBody(request, Infinity);
          result = userData.setCustomRadioStations(body.stations);
          break;
        }
        case 'GET /v1/user-data/preferences/hidden-radio-stations':
          result = { hiddenRadioStationIds: userData.getHiddenRadioStationIds() };
          break;
        case 'PUT /v1/user-data/preferences/hidden-radio-stations': {
          const body = await readJsonBody(request);
          result = userData.setHiddenRadioStationIds(body.stationIds);
          break;
        }
        case 'GET /v1/user-data/preferences/radio-station-order':
          result = { radioStationOrder: userData.getRadioStationOrder() };
          break;
        case 'PUT /v1/user-data/preferences/radio-station-order': {
          const body = await readJsonBody(request, Infinity);
          result = userData.setRadioStationOrder(body.stationKeys);
          break;
        }
        case 'GET /v1/user-data/preferences/settings-section-order':
          result = { settingsSectionOrder: userData.getSettingsSectionOrder() };
          break;
        case 'PUT /v1/user-data/preferences/settings-section-order': {
          const body = await readJsonBody(request);
          result = userData.setSettingsSectionOrder(body.sectionIds);
          break;
        }
        case 'GET /v1/user-data/preferences/app-language':
          result = { appLanguage: userData.getAppLanguage() };
          break;
        case 'PUT /v1/user-data/preferences/app-language': {
          const body = await readJsonBody(request);
          result = userData.setAppLanguage(body.language);
          break;
        }
        case 'GET /v1/user-data/preferences/secondary-bible-languages':
          result = { secondaryBibleLanguages: userData.getSecondaryBibleLanguages() };
          break;
        case 'PUT /v1/user-data/preferences/secondary-bible-languages': {
          const body = await readJsonBody(request);
          result = userData.setSecondaryBibleLanguages(body.languages);
          break;
        }
        case 'GET /v1/user-data/preferences/reader-tabs':
          result = userData.getReaderTabs();
          break;
        case 'PUT /v1/user-data/preferences/reader-tabs': {
          const body = await readJsonBody(request);
          result = userData.setReaderTabs(body);
          break;
        }
        case 'GET /v1/user-data/preferences/keybindings':
          result = { keybindings: userData.getKeybindings() };
          break;
        case 'PUT /v1/user-data/preferences/keybindings': {
          const body = await readJsonBody(request);
          const bindings = normalizeKeybindings(body.keybindings);
          const previous = userData.getKeybindings();
          checkSystemKeybindingConflicts(bindings, previous, listSystemBindings());
          const globalChanged = bindings.globalToggle !== previous.globalToggle;
          try {
            if (globalChanged) applyGlobalHotkey(bindings.globalToggle);
            if (bindings.verseOfTheDay !== previous.verseOfTheDay)
              applyVerseOfTheDayHotkey(bindings.verseOfTheDay);
          } catch (error) {
            if (globalChanged) {
              try { applyGlobalHotkey(previous.globalToggle); } catch {}
            }
            throw error;
          }
          // Do not persist a shortcut that the desktop rejected. Editing an
          // app-only shortcut must not rewrite/reload the desktop's bindings.
          result = userData.setKeybindings(bindings);
          break;
        }
        default:
          result = await dynamicRoute(
            request.method,
            url.pathname,
            downloadManager,
            userData,
          );
          if (result && (result.queued || result.status === 'queued')) status = 202;
      }

      response.statusCode = status;
      response.end(JSON.stringify(result));
    } catch (error) {
      const known = error instanceof ServiceError;
      response.statusCode = known ? error.status : 500;
      response.end(JSON.stringify({
        error: {
          code: known ? error.code : 'INTERNAL_ERROR',
          message: known ? error.message : 'Internal service error.',
        },
      }));
    }
  });
}

function availableWithoutAccount(pathname) {
  return pathname === '/health'
    || pathname.startsWith('/v1/auth/')
    || pathname === '/v1/study/options'
    || pathname === '/v1/study/radio-import'
    || (pathname.startsWith('/v1/user-data/preferences/')
      && pathname !== '/v1/user-data/preferences/reader-tabs');
}

async function dynamicRoute(method, pathname, downloadManager, userData) {
  const resumeMatch = pathname.match(/^\/v1\/downloads\/(\d+)\/resume$/);
  if (resumeMatch && method === 'POST') {
    return downloadManager.queueResume(resumeMatch[1]);
  }
  const updateMatch = pathname.match(/^\/v1\/downloads\/(\d+)\/update$/);
  if (updateMatch && method === 'GET') {
    return downloadManager.checkForUpdate(updateMatch[1]);
  }
  const match = pathname.match(/^\/v1\/downloads\/(\d+)$/);
  if (match && method === 'GET') {
    const download = downloadManager.getPackage(match[1]);
    if (!download) {
      throw new ServiceError('Translation package not found.', {
        code: 'DOWNLOAD_NOT_FOUND',
        status: 404,
      });
    }
    return download;
  }
  if (match && method === 'DELETE') return downloadManager.removePackage(match[1]);
  const noteMatch = pathname.match(/^\/v1\/user-data\/notes\/([0-9a-f-]+)$/i);
  if (noteMatch && method === 'DELETE') return userData.deleteNote(noteMatch[1]);
  throw new ServiceError('Endpoint not found.', {
    code: 'NOT_FOUND',
    status: 404,
  });
}

function queryBoolean(query, name) {
  const value = query.get(name);
  if (value === null) return false;
  if (['true', '1'].includes(value)) return true;
  if (['false', '0'].includes(value)) return false;
  throw new ServiceError(`${name} must be true or false.`, {
    code: 'BAD_REQUEST',
    status: 400,
  });
}

async function readJsonBody(request, maxBytes = MAX_BODY_BYTES) {
  const declaredLength = Number(request.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ServiceError('Request body is too large.', {
      code: 'BODY_TOO_LARGE',
      status: 413,
    });
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      throw new ServiceError('Request body is too large.', {
        code: 'BODY_TOO_LARGE',
        status: 413,
      });
    }
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ServiceError('Request body must be valid JSON.', {
      code: 'BAD_REQUEST',
      status: 400,
    });
  }
}

function required(query, name) {
  const value = query.get(name);
  if (!value) {
    throw new ServiceError(`Missing query parameter: ${name}`, {
      code: 'BAD_REQUEST',
      status: 400,
    });
  }
  return value;
}
