import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ensureSecureDirectory, getConfigDir } from './paths.js';

// Quickshell virtualizes QML URLs, but Qt's native plugin loader needs a real
// filesystem library path. Generate only the optional module's loader metadata
// in Light's private state directory; no build occurs during startup.
export function prepareNativeAudio() {
  try {
    const components = fileURLToPath(new URL('../../components/', import.meta.url));
    const library = join(components, 'LightAudio');
    if (!existsSync(join(library, 'liblightaudio.so'))) return { nativeAudioAvailable: false, nativeAudioUrl: '' };
    const directory = ensureSecureDirectory(join(getConfigDir(), 'native-audio'));
    const module = ensureSecureDirectory(join(directory, 'LightAudio'));
    writeChanged(join(module, 'qmldir'), `module LightAudio\nplugin lightaudio ${library}\n`);
    const loader = join(directory, 'Features.qml');
    writeChanged(loader, readFileSync(join(components, 'NativeAudioFeatures.qml'), 'utf8'));
    return { nativeAudioAvailable: true, nativeAudioUrl: pathToFileURL(loader).href };
  } catch {
    // A broken optional enhancement must not prevent reading or basic radio.
    return { nativeAudioAvailable: false, nativeAudioUrl: '' };
  }
}
function writeChanged(path, content) {
  // Quickshell watches QML files. Rewriting unchanged loader metadata at every
  // startup would create a native-loader/shell-reload loop.
  if (!existsSync(path) || readFileSync(path, 'utf8') !== content)
    writeFileSync(path, content, { mode: 0o600 });
}
