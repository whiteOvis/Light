#!/usr/bin/env node

import { stdin, stdout } from 'node:process';

import { AuthenticationManager } from './auth.js';
import { SQLiteCache } from './cache.js';
import { DownloadManager } from './download-manager.js';
import { createHttpServer } from './http-server.js';
import { OAuthManager } from './oauth.js';
import { getConfigDir } from './paths.js';
import { createPlatformClients, ServiceError, LightService } from './service.js';
import { TokenStore } from './token-store.js';
import { UserDataManager } from './user-data-manager.js';

const HELP = `Usage:
  light-service serve
  light-service versions [--language '*'] [--mode auto|online|offline]
  light-service languages [--mode auto|online|offline]
  light-service books --version VERSION_ID [--mode auto|online|offline]
  light-service chapters --version VERSION_ID --book JHN [--mode ...]
  light-service passage --version VERSION_ID --usfm JHN.3.16 [--format text|html] [--mode ...]
  light-service oauth start [--scopes profile,email] [--permissions highlights]
  light-service oauth callback omarchy://oauth/callback?state=...
  light-service oauth status
  light-service oauth cancel
  light-service auth status|refresh|logout
  light-service download add --version VERSION_ID [--format text|html]
  light-service download resume --version VERSION_ID
  light-service download list
  light-service download status --version VERSION_ID
  light-service download remove --version VERSION_ID
  light-service token set       # reads a JSON object from stdin
  light-service token status
  light-service token clear
  light-service cache stats
  light-service cache clear

Environment:
  YVP_API_HOST          API host override (default api.youversion.com)
  YVP_REDIRECT_URI      OAuth callback (default omarchy://oauth/callback)
  LIGHT_YVP_REQUEST_INTERVAL_MS  Shared YouVersion pacing (default 1100)
  LIGHT_YVP_COOLDOWN_MS          Shared 429 cooldown (default 300000)
  LIGHT_CONFIG_DIR         State directory (default ~/.config/omarchy/light-public)
  LIGHT_CACHE_TTL_SECONDS  Fresh-cache lifetime (default 604800)
  LIGHT_DOWNLOAD_CONCURRENCY  Concurrent chapter requests (default 1)
  LIGHT_HOST / LIGHT_PORT     Local HTTP bind address (default 127.0.0.1:8788)
`;

async function main() {
  const [command = 'serve', ...argumentsList] = process.argv.slice(2);
  if (['help', '--help', '-h'].includes(command)) {
    stdout.write(HELP);
    return;
  }

  const configDirectory = getConfigDir();
  const cache = new SQLiteCache({
    directory: configDirectory,
    ttlSeconds: nonNegativeNumber(process.env.LIGHT_CACHE_TTL_SECONDS || 604800),
  });
  const tokenStore = new TokenStore({ directory: configDirectory });
  const { bibleClient, highlightsClient } = createPlatformClients(
    process.env,
    { installationId: tokenStore.getLocalSessionId() },
  );
  const downloadManager = new DownloadManager({
    database: cache.database,
    recoverInterruptedDownloads: command === 'serve',
    bibleClient,
    concurrency: integerSetting(process.env.LIGHT_DOWNLOAD_CONCURRENCY || 1, 1, 8),
    maxRetries: integerSetting(process.env.LIGHT_DOWNLOAD_RETRIES || 3, 0, 10),
    requestIntervalMs: integerSetting(
      process.env.LIGHT_DOWNLOAD_INTERVAL_MS || 1250,
      0,
      60_000,
    ),
  });
  const service = new LightService({
    cache,
    bibleClient,
    downloadManager,
  });
  const authentication = new AuthenticationManager({ tokenStore });
  const userData = new UserDataManager({
    database: cache.database,
    highlightsClient,
    authentication,
  });
  const oauth = new OAuthManager({ tokenStore });

  try {
    if (command === 'serve') {
      await serve({
        service,
        cache,
        authentication,
        downloadManager,
        oauth,
        userData,
      });
      return;
    }

    if (['versions', 'languages', 'books', 'chapters', 'passage', 'download'].includes(command))
      await authentication.getAccessToken();

    let result;
    if (command === 'versions') {
      const options = parseOptions(argumentsList);
      result = await service.versions(options.language || '*', {
        mode: options.mode || 'auto',
      });
    } else if (command === 'languages') {
      const options = parseOptions(argumentsList);
      result = await service.languages(options.locale || 'en-US', {
        mode: options.mode || 'auto',
      });
    } else if (command === 'books') {
      const options = parseOptions(argumentsList);
      result = await service.books(options.version, { mode: options.mode || 'auto' });
    } else if (command === 'chapters') {
      const options = parseOptions(argumentsList);
      result = await service.chapters(options.version, options.book, {
        mode: options.mode || 'auto',
      });
    } else if (command === 'passage') {
      const options = parseOptions(argumentsList);
      result = await service.passage(options.version, options.usfm, {
        mode: options.mode || 'auto',
        format: options.format || 'text',
        includeHeadings: options['include-headings'] || false,
        includeNotes: options['include-notes'] || false,
      });
    } else if (command === 'oauth') {
      result = await oauthCommand(argumentsList[0], argumentsList.slice(1), oauth, tokenStore);
    } else if (command === 'auth') {
      result = await authCommand(argumentsList[0], authentication);
    } else if (command === 'download') {
      result = await downloadCommand(
        argumentsList[0],
        argumentsList.slice(1),
        downloadManager,
      );
    } else if (command === 'token') {
      result = await tokenCommand(argumentsList[0], tokenStore);
    } else if (command === 'cache') {
      result = cacheCommand(argumentsList[0], cache);
    } else {
      throw new ServiceError(`Unknown command: ${command}`, {
        code: 'BAD_COMMAND',
        status: 400,
      });
    }
    printJson(result);
  } finally {
    cache.close();
  }
}

async function authCommand(action, authentication) {
  if (action === 'status') return authentication.status();
  if (action === 'refresh') {
    await authentication.refresh();
    return authentication.status();
  }
  if (action === 'logout') return authentication.signOut();
  throw new ServiceError('auth requires status, refresh, or logout.', {
    code: 'BAD_COMMAND',
    status: 400,
  });
}

async function downloadCommand(action, argumentsList, downloads) {
  if (action === 'list') return { packages: downloads.listPackages() };
  const options = parseOptions(argumentsList);
  if (action === 'status') {
    const download = downloads.getPackage(options.version);
    if (!download) {
      throw new ServiceError('Translation package not found.', {
        code: 'DOWNLOAD_NOT_FOUND',
        status: 404,
      });
    }
    return download;
  }
  if (action === 'remove') return downloads.removePackage(options.version);
  if (action === 'resume') return downloads.resumePackage(options.version);
  if (action === 'add') {
    return downloads.downloadPackage(options.version, {
      format: options.format || 'text',
      includeHeadings: options['include-headings'] || false,
      includeNotes: options['include-notes'] || false,
    });
  }
  throw new ServiceError('download requires add, resume, list, status, or remove.', {
    code: 'BAD_COMMAND',
    status: 400,
  });
}

async function oauthCommand(action, argumentsList, oauth, tokenStore) {
  if (action === 'status') {
    return {
      token: tokenStore.status(),
      pending: Boolean(tokenStore.loadPendingAuth()),
    };
  }
  if (action === 'cancel') {
    return { cancelled: tokenStore.clearPendingAuth() };
  }
  if (action === 'start') {
    const options = parseOptions(argumentsList);
    return oauth.start({
      scopes: commaList(options.scopes, ['profile', 'email']),
      permissions: commaList(options.permissions, ['highlights']),
      open: !options['no-open'],
    });
  }
  if (action === 'callback') {
    const callbackUri = argumentsList.find((argument) => !argument.startsWith('--'));
    if (!callbackUri) {
      throw new ServiceError('oauth callback requires the callback URI.', {
        code: 'CALLBACK_REQUIRED',
        status: 400,
      });
    }
    return oauth.handleCallback(callbackUri, {
      open: !argumentsList.includes('--no-open'),
    });
  }
  throw new ServiceError('oauth requires start, callback, status, or cancel.', {
    code: 'BAD_COMMAND',
    status: 400,
  });
}

async function serve({
  service,
  cache,
  authentication,
  downloadManager,
  oauth,
  userData,
}) {
  const host = process.env.LIGHT_HOST || '127.0.0.1';
  if (!['127.0.0.1', '::1', 'localhost'].includes(host)) {
    throw new ServiceError('LIGHT_HOST must be a loopback address.', {
      code: 'NON_LOCAL_BIND_REJECTED',
      status: 400,
    });
  }
  const port = portNumber(process.env.LIGHT_PORT || 8788);
  const server = createHttpServer({
    service,
    cache,
    authentication,
    downloadManager,
    oauth,
    userData,
  });
  server.listen(port, host, () => {
    stdout.write(`Light service listening on http://${host}:${port}\n`);
  });

  const shutdown = () => {
    server.close(() => {
      cache.close();
      process.exit(0);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  await new Promise((resolve, reject) => {
    server.once('close', resolve);
    server.once('error', reject);
  });
}

async function tokenCommand(action, tokenStore) {
  if (action === 'status') return tokenStore.status();
  if (action === 'clear') return { cleared: tokenStore.clear() };
  if (action !== 'set') {
    throw new ServiceError('token requires set, status, or clear.', {
      code: 'BAD_COMMAND',
      status: 400,
    });
  }
  if (stdin.isTTY) {
    throw new ServiceError('Pipe token JSON on stdin so secrets do not appear in process arguments.', {
      code: 'TOKEN_INPUT_REQUIRED',
      status: 400,
    });
  }
  const chunks = [];
  for await (const chunk of stdin) chunks.push(chunk);
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  tokenStore.save(input);
  return tokenStore.status();
}

function cacheCommand(action, cache) {
  if (action === 'stats') return cache.stats();
  if (action === 'clear') return { clearedEntries: cache.clear() };
  throw new ServiceError('cache requires stats or clear.', {
    code: 'BAD_COMMAND',
    status: 400,
  });
}

function parseOptions(argumentsList) {
  const options = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (!argument.startsWith('--')) {
      throw new ServiceError(`Unexpected argument: ${argument}`, {
        code: 'BAD_ARGUMENT',
        status: 400,
      });
    }
    const [rawName, inlineValue] = argument.slice(2).split('=', 2);
    if (rawName === 'offline') {
      options.mode = 'offline';
      continue;
    }
    if (rawName === 'online') {
      options.mode = 'online';
      continue;
    }
    const value = inlineValue ?? argumentsList[index + 1];
    if (value === undefined || value.startsWith('--')) {
      options[rawName] = true;
    } else {
      options[rawName] = value;
      if (inlineValue === undefined) index += 1;
    }
  }
  return options;
}

function printJson(value) {
  stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function commaList(value, fallback) {
  if (value === undefined) return fallback;
  if (value === true) return [];
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function nonNegativeNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new ServiceError('LIGHT_CACHE_TTL_SECONDS must be a non-negative number.', {
      code: 'BAD_CONFIGURATION',
      status: 400,
    });
  }
  return number;
}

function portNumber(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > 65535) {
    throw new ServiceError('LIGHT_PORT must be an integer from 1 to 65535.', {
      code: 'BAD_CONFIGURATION',
      status: 400,
    });
  }
  return number;
}

function integerSetting(value, minimum, maximum) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    throw new ServiceError(
      `Configuration value must be an integer from ${minimum} to ${maximum}.`,
      { code: 'BAD_CONFIGURATION', status: 400 },
    );
  }
  return number;
}

main().catch((error) => {
  const known = error instanceof ServiceError;
  process.stderr.write(`${known ? error.code : 'ERROR'}: ${error.message}\n`);
  process.exitCode = 1;
});
