#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// service/src/daemon.js
import { randomBytes as randomBytes4 } from "node:crypto";
import { writeFileSync as writeFileSync4, renameSync as renameSync3, chmodSync as chmodSync5, existsSync as existsSync4, readFileSync as readFileSync4 } from "node:fs";
import { join as join5 } from "node:path";

// service/src/oauth-registration.js
import { execFileSync } from "node:child_process";
import { chmodSync as chmodSync2, copyFileSync, existsSync, mkdirSync as mkdirSync2, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { join, resolve as resolve2 } from "node:path";
import { fileURLToPath } from "node:url";

// service/src/paths.js
import { chmodSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
function getConfigDir(env = process.env) {
  return resolve(
    env.LIGHT_CONFIG_DIR || `${env.XDG_CONFIG_HOME || `${homedir()}/.config`}/omarchy/light-public`
  );
}
function ensureSecureDirectory(directory) {
  mkdirSync(directory, { recursive: true, mode: 448 });
  chmodSync(directory, 448);
  return directory;
}

// service/src/oauth-registration.js
var desktop = "omarchy-light-public-oauth.desktop";
function registerOAuthCallback({
  env = process.env,
  node,
  // The service is bundled at service/dist/daemon.mjs. Copy a built-in-only
  // dispatcher outside the checkout so other apps' callbacks still work after
  // a standard plugin removal. Node is resolved through PATH across mise updates.
  callback = fileURLToPath(new URL("../dist/oauth-dispatch.mjs", import.meta.url)),
  daemon = fileURLToPath(new URL("../dist/daemon.mjs", import.meta.url)),
  run = (command, args) => execFileSync(command, args, { encoding: "utf8", env, timeout: 5e3 })
} = {}) {
  const dataHome = env.XDG_DATA_HOME || join(env.HOME || homedir2(), ".local/share");
  const stableNode = join(env.MISE_DATA_DIR || join(dataHome, "mise"), "shims/node");
  node ||= existsSync(stableNode) ? stableNode : "node";
  const applications = join(dataHome, "applications");
  const bridgeDirectory = join(dataHome, "omarchy/light-public");
  const bridge = join(bridgeDirectory, "oauth-dispatch.mjs");
  const target = join(applications, desktop);
  const directory = ensureSecureDirectory(getConfigDir(env));
  const quote = (value) => '"' + String(value).replace(/(["`$\\])/g, "\\$1").replaceAll("\\", "\\\\").replaceAll("%", "%%") + '"';
  const content = `[Desktop Entry]
Type=Application
Name=Light sign-in
NoDisplay=true
Exec=/usr/bin/env ${quote("LIGHT_CONFIG_DIR=" + directory)} ${quote(node)} ${quote(bridge)} %u
MimeType=x-scheme-handler/omarchy;
`;
  const previous = String(run("xdg-mime", ["query", "default", "x-scheme-handler/omarchy"])).trim();
  const fallback = join(directory, "oauth-fallback.json");
  if (previous !== desktop) {
    if (previous && !/^[a-zA-Z0-9._-]+\.desktop$/.test(previous))
      throw new Error("The current callback handler could not be preserved.");
    writeFileSync(fallback, JSON.stringify({ desktop: previous }), { mode: 384 });
    chmodSync2(fallback, 384);
  }
  ensureSecureDirectory(bridgeDirectory);
  const temporaryBridge = `${bridge}.${process.pid}.tmp`;
  copyFileSync(callback, temporaryBridge);
  chmodSync2(temporaryBridge, 384);
  renameSync(temporaryBridge, bridge);
  const runtime = join(directory, "oauth-runtime.json");
  writeFileSync(runtime, JSON.stringify({ daemon: resolve2(daemon) }), { mode: 384 });
  chmodSync2(runtime, 384);
  if (!existsSync(target) || readFileSync(target, "utf8") !== content) {
    mkdirSync2(applications, { recursive: true });
    const temporary = `${target}.${process.pid}.tmp`;
    writeFileSync(temporary, content, { mode: 420 });
    renameSync(temporary, target);
  }
  if (previous !== desktop) run("xdg-mime", ["default", desktop, "x-scheme-handler/omarchy"]);
  if (String(run("xdg-mime", ["query", "default", "x-scheme-handler/omarchy"])).trim() !== desktop)
    throw new Error("Light could not register its sign-in callback.");
}
function repairExistingOAuthCallback({
  env = process.env,
  run = (command, args) => execFileSync(command, args, { encoding: "utf8", env, timeout: 5e3 })
} = {}) {
  const dataHome = env.XDG_DATA_HOME || join(env.HOME || homedir2(), ".local/share");
  if (!existsSync(join(dataHome, "applications", desktop))) return;
  if (String(run("xdg-mime", ["query", "default", "x-scheme-handler/omarchy"])).trim() === desktop)
    registerOAuthCallback({ env, run });
}

// service/src/session-hotkeys.js
import { execFileSync as execFileSync2 } from "node:child_process";

// service/src/download-manager.js
import { createHash } from "node:crypto";

// service/node_modules/zod/v4/core/core.js
var NEVER = Object.freeze({
  status: "aborted"
});
// @__NO_SIDE_EFFECTS__
function $constructor(name, initializer2, params) {
  function init(inst, def) {
    var _a;
    Object.defineProperty(inst, "_zod", {
      value: inst._zod ?? {},
      enumerable: false
    });
    (_a = inst._zod).traits ?? (_a.traits = /* @__PURE__ */ new Set());
    inst._zod.traits.add(name);
    initializer2(inst, def);
    for (const k in _.prototype) {
      if (!(k in inst))
        Object.defineProperty(inst, k, { value: _.prototype[k].bind(inst) });
    }
    inst._zod.constr = _;
    inst._zod.def = def;
  }
  const Parent = params?.Parent ?? Object;
  class Definition extends Parent {
  }
  Object.defineProperty(Definition, "name", { value: name });
  function _(def) {
    var _a;
    const inst = params?.Parent ? new Definition() : this;
    init(inst, def);
    (_a = inst._zod).deferred ?? (_a.deferred = []);
    for (const fn of inst._zod.deferred) {
      fn();
    }
    return inst;
  }
  Object.defineProperty(_, "init", { value: init });
  Object.defineProperty(_, Symbol.hasInstance, {
    value: (inst) => {
      if (params?.Parent && inst instanceof params.Parent)
        return true;
      return inst?._zod?.traits?.has(name);
    }
  });
  Object.defineProperty(_, "name", { value: name });
  return _;
}
var $ZodAsyncError = class extends Error {
  constructor() {
    super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
  }
};
var $ZodEncodeError = class extends Error {
  constructor(name) {
    super(`Encountered unidirectional transform during encode: ${name}`);
    this.name = "ZodEncodeError";
  }
};
var globalConfig = {};
function config(newConfig) {
  if (newConfig)
    Object.assign(globalConfig, newConfig);
  return globalConfig;
}

// service/node_modules/zod/v4/core/util.js
var util_exports = {};
__export(util_exports, {
  BIGINT_FORMAT_RANGES: () => BIGINT_FORMAT_RANGES,
  Class: () => Class,
  NUMBER_FORMAT_RANGES: () => NUMBER_FORMAT_RANGES,
  aborted: () => aborted,
  allowsEval: () => allowsEval,
  assert: () => assert,
  assertEqual: () => assertEqual,
  assertIs: () => assertIs,
  assertNever: () => assertNever,
  assertNotEqual: () => assertNotEqual,
  assignProp: () => assignProp,
  base64ToUint8Array: () => base64ToUint8Array,
  base64urlToUint8Array: () => base64urlToUint8Array,
  cached: () => cached,
  captureStackTrace: () => captureStackTrace,
  cleanEnum: () => cleanEnum,
  cleanRegex: () => cleanRegex,
  clone: () => clone,
  cloneDef: () => cloneDef,
  createTransparentProxy: () => createTransparentProxy,
  defineLazy: () => defineLazy,
  esc: () => esc,
  escapeRegex: () => escapeRegex,
  extend: () => extend,
  finalizeIssue: () => finalizeIssue,
  floatSafeRemainder: () => floatSafeRemainder,
  getElementAtPath: () => getElementAtPath,
  getEnumValues: () => getEnumValues,
  getLengthableOrigin: () => getLengthableOrigin,
  getParsedType: () => getParsedType,
  getSizableOrigin: () => getSizableOrigin,
  hexToUint8Array: () => hexToUint8Array,
  isObject: () => isObject,
  isPlainObject: () => isPlainObject,
  issue: () => issue,
  joinValues: () => joinValues,
  jsonStringifyReplacer: () => jsonStringifyReplacer,
  merge: () => merge,
  mergeDefs: () => mergeDefs,
  normalizeParams: () => normalizeParams,
  nullish: () => nullish,
  numKeys: () => numKeys,
  objectClone: () => objectClone,
  omit: () => omit,
  optionalKeys: () => optionalKeys,
  partial: () => partial,
  pick: () => pick,
  prefixIssues: () => prefixIssues,
  primitiveTypes: () => primitiveTypes,
  promiseAllObject: () => promiseAllObject,
  propertyKeyTypes: () => propertyKeyTypes,
  randomString: () => randomString,
  required: () => required,
  safeExtend: () => safeExtend,
  shallowClone: () => shallowClone,
  stringifyPrimitive: () => stringifyPrimitive,
  uint8ArrayToBase64: () => uint8ArrayToBase64,
  uint8ArrayToBase64url: () => uint8ArrayToBase64url,
  uint8ArrayToHex: () => uint8ArrayToHex,
  unwrapMessage: () => unwrapMessage
});
function assertEqual(val) {
  return val;
}
function assertNotEqual(val) {
  return val;
}
function assertIs(_arg) {
}
function assertNever(_x) {
  throw new Error();
}
function assert(_) {
}
function getEnumValues(entries) {
  const numericValues = Object.values(entries).filter((v) => typeof v === "number");
  const values = Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
  return values;
}
function joinValues(array2, separator = "|") {
  return array2.map((val) => stringifyPrimitive(val)).join(separator);
}
function jsonStringifyReplacer(_, value) {
  if (typeof value === "bigint")
    return value.toString();
  return value;
}
function cached(getter) {
  const set = false;
  return {
    get value() {
      if (!set) {
        const value = getter();
        Object.defineProperty(this, "value", { value });
        return value;
      }
      throw new Error("cached value already set");
    }
  };
}
function nullish(input) {
  return input === null || input === void 0;
}
function cleanRegex(source) {
  const start = source.startsWith("^") ? 1 : 0;
  const end = source.endsWith("$") ? source.length - 1 : source.length;
  return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepString = step.toString();
  let stepDecCount = (stepString.split(".")[1] || "").length;
  if (stepDecCount === 0 && /\d?e-\d?/.test(stepString)) {
    const match = stepString.match(/\d?e-(\d?)/);
    if (match?.[1]) {
      stepDecCount = Number.parseInt(match[1]);
    }
  }
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var EVALUATING = /* @__PURE__ */ Symbol("evaluating");
function defineLazy(object2, key, getter) {
  let value = void 0;
  Object.defineProperty(object2, key, {
    get() {
      if (value === EVALUATING) {
        return void 0;
      }
      if (value === void 0) {
        value = EVALUATING;
        value = getter();
      }
      return value;
    },
    set(v) {
      Object.defineProperty(object2, key, {
        value: v
        // configurable: true,
      });
    },
    configurable: true
  });
}
function objectClone(obj) {
  return Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyDescriptors(obj));
}
function assignProp(target, prop, value) {
  Object.defineProperty(target, prop, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  });
}
function mergeDefs(...defs) {
  const mergedDescriptors = {};
  for (const def of defs) {
    const descriptors = Object.getOwnPropertyDescriptors(def);
    Object.assign(mergedDescriptors, descriptors);
  }
  return Object.defineProperties({}, mergedDescriptors);
}
function cloneDef(schema) {
  return mergeDefs(schema._zod.def);
}
function getElementAtPath(obj, path) {
  if (!path)
    return obj;
  return path.reduce((acc, key) => acc?.[key], obj);
}
function promiseAllObject(promisesObj) {
  const keys = Object.keys(promisesObj);
  const promises = keys.map((key) => promisesObj[key]);
  return Promise.all(promises).then((results) => {
    const resolvedObj = {};
    for (let i = 0; i < keys.length; i++) {
      resolvedObj[keys[i]] = results[i];
    }
    return resolvedObj;
  });
}
function randomString(length = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let str = "";
  for (let i = 0; i < length; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return str;
}
function esc(str) {
  return JSON.stringify(str);
}
var captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {
};
function isObject(data) {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}
var allowsEval = cached(() => {
  if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) {
    return false;
  }
  try {
    const F = Function;
    new F("");
    return true;
  } catch (_) {
    return false;
  }
});
function isPlainObject(o) {
  if (isObject(o) === false)
    return false;
  const ctor = o.constructor;
  if (ctor === void 0)
    return true;
  const prot = ctor.prototype;
  if (isObject(prot) === false)
    return false;
  if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
    return false;
  }
  return true;
}
function shallowClone(o) {
  if (isPlainObject(o))
    return { ...o };
  if (Array.isArray(o))
    return [...o];
  return o;
}
function numKeys(data) {
  let keyCount = 0;
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      keyCount++;
    }
  }
  return keyCount;
}
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return "undefined";
    case "string":
      return "string";
    case "number":
      return Number.isNaN(data) ? "nan" : "number";
    case "boolean":
      return "boolean";
    case "function":
      return "function";
    case "bigint":
      return "bigint";
    case "symbol":
      return "symbol";
    case "object":
      if (Array.isArray(data)) {
        return "array";
      }
      if (data === null) {
        return "null";
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return "promise";
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return "map";
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return "set";
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return "date";
      }
      if (typeof File !== "undefined" && data instanceof File) {
        return "file";
      }
      return "object";
    default:
      throw new Error(`Unknown data type: ${t}`);
  }
};
var propertyKeyTypes = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
var primitiveTypes = /* @__PURE__ */ new Set(["string", "number", "bigint", "boolean", "symbol", "undefined"]);
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
  const cl = new inst._zod.constr(def ?? inst._zod.def);
  if (!def || params?.parent)
    cl._zod.parent = inst;
  return cl;
}
function normalizeParams(_params) {
  const params = _params;
  if (!params)
    return {};
  if (typeof params === "string")
    return { error: () => params };
  if (params?.message !== void 0) {
    if (params?.error !== void 0)
      throw new Error("Cannot specify both `message` and `error` params");
    params.error = params.message;
  }
  delete params.message;
  if (typeof params.error === "string")
    return { ...params, error: () => params.error };
  return params;
}
function createTransparentProxy(getter) {
  let target;
  return new Proxy({}, {
    get(_, prop, receiver) {
      target ?? (target = getter());
      return Reflect.get(target, prop, receiver);
    },
    set(_, prop, value, receiver) {
      target ?? (target = getter());
      return Reflect.set(target, prop, value, receiver);
    },
    has(_, prop) {
      target ?? (target = getter());
      return Reflect.has(target, prop);
    },
    deleteProperty(_, prop) {
      target ?? (target = getter());
      return Reflect.deleteProperty(target, prop);
    },
    ownKeys(_) {
      target ?? (target = getter());
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(_, prop) {
      target ?? (target = getter());
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    defineProperty(_, prop, descriptor) {
      target ?? (target = getter());
      return Reflect.defineProperty(target, prop, descriptor);
    }
  });
}
function stringifyPrimitive(value) {
  if (typeof value === "bigint")
    return value.toString() + "n";
  if (typeof value === "string")
    return `"${value}"`;
  return `${value}`;
}
function optionalKeys(shape) {
  return Object.keys(shape).filter((k) => {
    return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
  });
}
var NUMBER_FORMAT_RANGES = {
  safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
  float32: [-34028234663852886e22, 34028234663852886e22],
  float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
};
var BIGINT_FORMAT_RANGES = {
  int64: [/* @__PURE__ */ BigInt("-9223372036854775808"), /* @__PURE__ */ BigInt("9223372036854775807")],
  uint64: [/* @__PURE__ */ BigInt(0), /* @__PURE__ */ BigInt("18446744073709551615")]
};
function pick(schema, mask) {
  const currDef = schema._zod.def;
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const newShape = {};
      for (const key in mask) {
        if (!(key in currDef.shape)) {
          throw new Error(`Unrecognized key: "${key}"`);
        }
        if (!mask[key])
          continue;
        newShape[key] = currDef.shape[key];
      }
      assignProp(this, "shape", newShape);
      return newShape;
    },
    checks: []
  });
  return clone(schema, def);
}
function omit(schema, mask) {
  const currDef = schema._zod.def;
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const newShape = { ...schema._zod.def.shape };
      for (const key in mask) {
        if (!(key in currDef.shape)) {
          throw new Error(`Unrecognized key: "${key}"`);
        }
        if (!mask[key])
          continue;
        delete newShape[key];
      }
      assignProp(this, "shape", newShape);
      return newShape;
    },
    checks: []
  });
  return clone(schema, def);
}
function extend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to extend: expected a plain object");
  }
  const checks = schema._zod.def.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error("Object schemas containing refinements cannot be extended. Use `.safeExtend()` instead.");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const _shape = { ...schema._zod.def.shape, ...shape };
      assignProp(this, "shape", _shape);
      return _shape;
    },
    checks: []
  });
  return clone(schema, def);
}
function safeExtend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to safeExtend: expected a plain object");
  }
  const def = {
    ...schema._zod.def,
    get shape() {
      const _shape = { ...schema._zod.def.shape, ...shape };
      assignProp(this, "shape", _shape);
      return _shape;
    },
    checks: schema._zod.def.checks
  };
  return clone(schema, def);
}
function merge(a, b) {
  const def = mergeDefs(a._zod.def, {
    get shape() {
      const _shape = { ...a._zod.def.shape, ...b._zod.def.shape };
      assignProp(this, "shape", _shape);
      return _shape;
    },
    get catchall() {
      return b._zod.def.catchall;
    },
    checks: []
    // delete existing checks
  });
  return clone(a, def);
}
function partial(Class2, schema, mask) {
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const oldShape = schema._zod.def.shape;
      const shape = { ...oldShape };
      if (mask) {
        for (const key in mask) {
          if (!(key in oldShape)) {
            throw new Error(`Unrecognized key: "${key}"`);
          }
          if (!mask[key])
            continue;
          shape[key] = Class2 ? new Class2({
            type: "optional",
            innerType: oldShape[key]
          }) : oldShape[key];
        }
      } else {
        for (const key in oldShape) {
          shape[key] = Class2 ? new Class2({
            type: "optional",
            innerType: oldShape[key]
          }) : oldShape[key];
        }
      }
      assignProp(this, "shape", shape);
      return shape;
    },
    checks: []
  });
  return clone(schema, def);
}
function required(Class2, schema, mask) {
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const oldShape = schema._zod.def.shape;
      const shape = { ...oldShape };
      if (mask) {
        for (const key in mask) {
          if (!(key in shape)) {
            throw new Error(`Unrecognized key: "${key}"`);
          }
          if (!mask[key])
            continue;
          shape[key] = new Class2({
            type: "nonoptional",
            innerType: oldShape[key]
          });
        }
      } else {
        for (const key in oldShape) {
          shape[key] = new Class2({
            type: "nonoptional",
            innerType: oldShape[key]
          });
        }
      }
      assignProp(this, "shape", shape);
      return shape;
    },
    checks: []
  });
  return clone(schema, def);
}
function aborted(x, startIndex = 0) {
  if (x.aborted === true)
    return true;
  for (let i = startIndex; i < x.issues.length; i++) {
    if (x.issues[i]?.continue !== true) {
      return true;
    }
  }
  return false;
}
function prefixIssues(path, issues) {
  return issues.map((iss) => {
    var _a;
    (_a = iss).path ?? (_a.path = []);
    iss.path.unshift(path);
    return iss;
  });
}
function unwrapMessage(message) {
  return typeof message === "string" ? message : message?.message;
}
function finalizeIssue(iss, ctx, config2) {
  const full = { ...iss, path: iss.path ?? [] };
  if (!iss.message) {
    const message = unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config2.customError?.(iss)) ?? unwrapMessage(config2.localeError?.(iss)) ?? "Invalid input";
    full.message = message;
  }
  delete full.inst;
  delete full.continue;
  if (!ctx?.reportInput) {
    delete full.input;
  }
  return full;
}
function getSizableOrigin(input) {
  if (input instanceof Set)
    return "set";
  if (input instanceof Map)
    return "map";
  if (input instanceof File)
    return "file";
  return "unknown";
}
function getLengthableOrigin(input) {
  if (Array.isArray(input))
    return "array";
  if (typeof input === "string")
    return "string";
  return "unknown";
}
function issue(...args) {
  const [iss, input, inst] = args;
  if (typeof iss === "string") {
    return {
      message: iss,
      code: "custom",
      input,
      inst
    };
  }
  return { ...iss };
}
function cleanEnum(obj) {
  return Object.entries(obj).filter(([k, _]) => {
    return Number.isNaN(Number.parseInt(k, 10));
  }).map((el) => el[1]);
}
function base64ToUint8Array(base642) {
  const binaryString = atob(base642);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
function uint8ArrayToBase64(bytes) {
  let binaryString = "";
  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  return btoa(binaryString);
}
function base64urlToUint8Array(base64url2) {
  const base642 = base64url2.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - base642.length % 4) % 4);
  return base64ToUint8Array(base642 + padding);
}
function uint8ArrayToBase64url(bytes) {
  return uint8ArrayToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function hexToUint8Array(hex) {
  const cleanHex = hex.replace(/^0x/, "");
  if (cleanHex.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}
function uint8ArrayToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
var Class = class {
  constructor(..._args) {
  }
};

// service/node_modules/zod/v4/core/errors.js
var initializer = (inst, def) => {
  inst.name = "$ZodError";
  Object.defineProperty(inst, "_zod", {
    value: inst._zod,
    enumerable: false
  });
  Object.defineProperty(inst, "issues", {
    value: def,
    enumerable: false
  });
  inst.message = JSON.stringify(def, jsonStringifyReplacer, 2);
  Object.defineProperty(inst, "toString", {
    value: () => inst.message,
    enumerable: false
  });
};
var $ZodError = $constructor("$ZodError", initializer);
var $ZodRealError = $constructor("$ZodError", initializer, { Parent: Error });

// service/node_modules/zod/v4/core/parse.js
var _parse = (_Err) => (schema, value, _ctx, _params) => {
  const ctx = _ctx ? Object.assign(_ctx, { async: false }) : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError();
  }
  if (result.issues.length) {
    const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
    captureStackTrace(e, _params?.callee);
    throw e;
  }
  return result.value;
};
var parse = /* @__PURE__ */ _parse($ZodRealError);
var _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
  const ctx = _ctx ? Object.assign(_ctx, { async: true }) : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  if (result.issues.length) {
    const e = new (params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
    captureStackTrace(e, params?.callee);
    throw e;
  }
  return result.value;
};
var parseAsync = /* @__PURE__ */ _parseAsync($ZodRealError);
var _safeParse = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError();
  }
  return result.issues.length ? {
    success: false,
    error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  } : { success: true, data: result.value };
};
var safeParse = /* @__PURE__ */ _safeParse($ZodRealError);
var _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? Object.assign(_ctx, { async: true }) : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  return result.issues.length ? {
    success: false,
    error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  } : { success: true, data: result.value };
};
var safeParseAsync = /* @__PURE__ */ _safeParseAsync($ZodRealError);

// service/node_modules/zod/v4/core/regexes.js
var hostname = /^(?=.{1,253}\.?$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[-0-9a-zA-Z]{0,61}[0-9a-zA-Z])?)*\.?$/;
var dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
var date = /* @__PURE__ */ new RegExp(`^${dateSource}$`);
var string = (params) => {
  const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
  return new RegExp(`^${regex}$`);
};
var integer = /^-?\d+$/;
var number = /^-?\d+(?:\.\d+)?/;
var boolean = /^(?:true|false)$/i;

// service/node_modules/zod/v4/core/checks.js
var $ZodCheck = /* @__PURE__ */ $constructor("$ZodCheck", (inst, def) => {
  var _a;
  inst._zod ?? (inst._zod = {});
  inst._zod.def = def;
  (_a = inst._zod).onattach ?? (_a.onattach = []);
});
var numericOriginMap = {
  number: "number",
  bigint: "bigint",
  object: "date"
};
var $ZodCheckLessThan = /* @__PURE__ */ $constructor("$ZodCheckLessThan", (inst, def) => {
  $ZodCheck.init(inst, def);
  const origin = numericOriginMap[typeof def.value];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
    if (def.value < curr) {
      if (def.inclusive)
        bag.maximum = def.value;
      else
        bag.exclusiveMaximum = def.value;
    }
  });
  inst._zod.check = (payload) => {
    if (def.inclusive ? payload.value <= def.value : payload.value < def.value) {
      return;
    }
    payload.issues.push({
      origin,
      code: "too_big",
      maximum: def.value,
      input: payload.value,
      inclusive: def.inclusive,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckGreaterThan = /* @__PURE__ */ $constructor("$ZodCheckGreaterThan", (inst, def) => {
  $ZodCheck.init(inst, def);
  const origin = numericOriginMap[typeof def.value];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
    if (def.value > curr) {
      if (def.inclusive)
        bag.minimum = def.value;
      else
        bag.exclusiveMinimum = def.value;
    }
  });
  inst._zod.check = (payload) => {
    if (def.inclusive ? payload.value >= def.value : payload.value > def.value) {
      return;
    }
    payload.issues.push({
      origin,
      code: "too_small",
      minimum: def.value,
      input: payload.value,
      inclusive: def.inclusive,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckNumberFormat = /* @__PURE__ */ $constructor("$ZodCheckNumberFormat", (inst, def) => {
  $ZodCheck.init(inst, def);
  def.format = def.format || "float64";
  const isInt = def.format?.includes("int");
  const origin = isInt ? "int" : "number";
  const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.format = def.format;
    bag.minimum = minimum;
    bag.maximum = maximum;
    if (isInt)
      bag.pattern = integer;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    if (isInt) {
      if (!Number.isInteger(input)) {
        payload.issues.push({
          expected: origin,
          format: def.format,
          code: "invalid_type",
          continue: false,
          input,
          inst
        });
        return;
      }
      if (!Number.isSafeInteger(input)) {
        if (input > 0) {
          payload.issues.push({
            input,
            code: "too_big",
            maximum: Number.MAX_SAFE_INTEGER,
            note: "Integers must be within the safe integer range.",
            inst,
            origin,
            continue: !def.abort
          });
        } else {
          payload.issues.push({
            input,
            code: "too_small",
            minimum: Number.MIN_SAFE_INTEGER,
            note: "Integers must be within the safe integer range.",
            inst,
            origin,
            continue: !def.abort
          });
        }
        return;
      }
    }
    if (input < minimum) {
      payload.issues.push({
        origin: "number",
        input,
        code: "too_small",
        minimum,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
    if (input > maximum) {
      payload.issues.push({
        origin: "number",
        input,
        code: "too_big",
        maximum,
        inst
      });
    }
  };
});
var $ZodCheckMaxLength = /* @__PURE__ */ $constructor("$ZodCheckMaxLength", (inst, def) => {
  var _a;
  $ZodCheck.init(inst, def);
  (_a = inst._zod.def).when ?? (_a.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.length !== void 0;
  });
  inst._zod.onattach.push((inst2) => {
    const curr = inst2._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
    if (def.maximum < curr)
      inst2._zod.bag.maximum = def.maximum;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const length = input.length;
    if (length <= def.maximum)
      return;
    const origin = getLengthableOrigin(input);
    payload.issues.push({
      origin,
      code: "too_big",
      maximum: def.maximum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckMinLength = /* @__PURE__ */ $constructor("$ZodCheckMinLength", (inst, def) => {
  var _a;
  $ZodCheck.init(inst, def);
  (_a = inst._zod.def).when ?? (_a.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.length !== void 0;
  });
  inst._zod.onattach.push((inst2) => {
    const curr = inst2._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
    if (def.minimum > curr)
      inst2._zod.bag.minimum = def.minimum;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const length = input.length;
    if (length >= def.minimum)
      return;
    const origin = getLengthableOrigin(input);
    payload.issues.push({
      origin,
      code: "too_small",
      minimum: def.minimum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckLengthEquals = /* @__PURE__ */ $constructor("$ZodCheckLengthEquals", (inst, def) => {
  var _a;
  $ZodCheck.init(inst, def);
  (_a = inst._zod.def).when ?? (_a.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.length !== void 0;
  });
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.minimum = def.length;
    bag.maximum = def.length;
    bag.length = def.length;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const length = input.length;
    if (length === def.length)
      return;
    const origin = getLengthableOrigin(input);
    const tooBig = length > def.length;
    payload.issues.push({
      origin,
      ...tooBig ? { code: "too_big", maximum: def.length } : { code: "too_small", minimum: def.length },
      inclusive: true,
      exact: true,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckStringFormat = /* @__PURE__ */ $constructor("$ZodCheckStringFormat", (inst, def) => {
  var _a, _b;
  $ZodCheck.init(inst, def);
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.format = def.format;
    if (def.pattern) {
      bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
      bag.patterns.add(def.pattern);
    }
  });
  if (def.pattern)
    (_a = inst._zod).check ?? (_a.check = (payload) => {
      def.pattern.lastIndex = 0;
      if (def.pattern.test(payload.value))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: def.format,
        input: payload.value,
        ...def.pattern ? { pattern: def.pattern.toString() } : {},
        inst,
        continue: !def.abort
      });
    });
  else
    (_b = inst._zod).check ?? (_b.check = () => {
    });
});
var $ZodCheckRegex = /* @__PURE__ */ $constructor("$ZodCheckRegex", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    def.pattern.lastIndex = 0;
    if (def.pattern.test(payload.value))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "regex",
      input: payload.value,
      pattern: def.pattern.toString(),
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckOverwrite = /* @__PURE__ */ $constructor("$ZodCheckOverwrite", (inst, def) => {
  $ZodCheck.init(inst, def);
  inst._zod.check = (payload) => {
    payload.value = def.tx(payload.value);
  };
});

// service/node_modules/zod/v4/core/versions.js
var version = {
  major: 4,
  minor: 1,
  patch: 12
};

// service/node_modules/zod/v4/core/schemas.js
var $ZodType = /* @__PURE__ */ $constructor("$ZodType", (inst, def) => {
  var _a;
  inst ?? (inst = {});
  inst._zod.def = def;
  inst._zod.bag = inst._zod.bag || {};
  inst._zod.version = version;
  const checks = [...inst._zod.def.checks ?? []];
  if (inst._zod.traits.has("$ZodCheck")) {
    checks.unshift(inst);
  }
  for (const ch of checks) {
    for (const fn of ch._zod.onattach) {
      fn(inst);
    }
  }
  if (checks.length === 0) {
    (_a = inst._zod).deferred ?? (_a.deferred = []);
    inst._zod.deferred?.push(() => {
      inst._zod.run = inst._zod.parse;
    });
  } else {
    const runChecks = (payload, checks2, ctx) => {
      let isAborted = aborted(payload);
      let asyncResult;
      for (const ch of checks2) {
        if (ch._zod.def.when) {
          const shouldRun = ch._zod.def.when(payload);
          if (!shouldRun)
            continue;
        } else if (isAborted) {
          continue;
        }
        const currLen = payload.issues.length;
        const _ = ch._zod.check(payload);
        if (_ instanceof Promise && ctx?.async === false) {
          throw new $ZodAsyncError();
        }
        if (asyncResult || _ instanceof Promise) {
          asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
            await _;
            const nextLen = payload.issues.length;
            if (nextLen === currLen)
              return;
            if (!isAborted)
              isAborted = aborted(payload, currLen);
          });
        } else {
          const nextLen = payload.issues.length;
          if (nextLen === currLen)
            continue;
          if (!isAborted)
            isAborted = aborted(payload, currLen);
        }
      }
      if (asyncResult) {
        return asyncResult.then(() => {
          return payload;
        });
      }
      return payload;
    };
    const handleCanaryResult = (canary, payload, ctx) => {
      if (aborted(canary)) {
        canary.aborted = true;
        return canary;
      }
      const checkResult = runChecks(payload, checks, ctx);
      if (checkResult instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError();
        return checkResult.then((checkResult2) => inst._zod.parse(checkResult2, ctx));
      }
      return inst._zod.parse(checkResult, ctx);
    };
    inst._zod.run = (payload, ctx) => {
      if (ctx.skipChecks) {
        return inst._zod.parse(payload, ctx);
      }
      if (ctx.direction === "backward") {
        const canary = inst._zod.parse({ value: payload.value, issues: [] }, { ...ctx, skipChecks: true });
        if (canary instanceof Promise) {
          return canary.then((canary2) => {
            return handleCanaryResult(canary2, payload, ctx);
          });
        }
        return handleCanaryResult(canary, payload, ctx);
      }
      const result = inst._zod.parse(payload, ctx);
      if (result instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError();
        return result.then((result2) => runChecks(result2, checks, ctx));
      }
      return runChecks(result, checks, ctx);
    };
  }
  inst["~standard"] = {
    validate: (value) => {
      try {
        const r = safeParse(inst, value);
        return r.success ? { value: r.data } : { issues: r.error?.issues };
      } catch (_) {
        return safeParseAsync(inst, value).then((r) => r.success ? { value: r.data } : { issues: r.error?.issues });
      }
    },
    vendor: "zod",
    version: 1
  };
});
var $ZodString = /* @__PURE__ */ $constructor("$ZodString", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = [...inst?._zod.bag?.patterns ?? []].pop() ?? string(inst._zod.bag);
  inst._zod.parse = (payload, _) => {
    if (def.coerce)
      try {
        payload.value = String(payload.value);
      } catch (_2) {
      }
    if (typeof payload.value === "string")
      return payload;
    payload.issues.push({
      expected: "string",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
var $ZodStringFormat = /* @__PURE__ */ $constructor("$ZodStringFormat", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  $ZodString.init(inst, def);
});
var $ZodURL = /* @__PURE__ */ $constructor("$ZodURL", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    try {
      const trimmed = payload.value.trim();
      const url2 = new URL(trimmed);
      if (def.hostname) {
        def.hostname.lastIndex = 0;
        if (!def.hostname.test(url2.hostname)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid hostname",
            pattern: hostname.source,
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
      }
      if (def.protocol) {
        def.protocol.lastIndex = 0;
        if (!def.protocol.test(url2.protocol.endsWith(":") ? url2.protocol.slice(0, -1) : url2.protocol)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid protocol",
            pattern: def.protocol.source,
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
      }
      if (def.normalize) {
        payload.value = url2.href;
      } else {
        payload.value = trimmed;
      }
      return;
    } catch (_) {
      payload.issues.push({
        code: "invalid_format",
        format: "url",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
var $ZodNumber = /* @__PURE__ */ $constructor("$ZodNumber", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = inst._zod.bag.pattern ?? number;
  inst._zod.parse = (payload, _ctx) => {
    if (def.coerce)
      try {
        payload.value = Number(payload.value);
      } catch (_) {
      }
    const input = payload.value;
    if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) {
      return payload;
    }
    const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? "Infinity" : void 0 : void 0;
    payload.issues.push({
      expected: "number",
      code: "invalid_type",
      input,
      inst,
      ...received ? { received } : {}
    });
    return payload;
  };
});
var $ZodNumberFormat = /* @__PURE__ */ $constructor("$ZodNumber", (inst, def) => {
  $ZodCheckNumberFormat.init(inst, def);
  $ZodNumber.init(inst, def);
});
var $ZodBoolean = /* @__PURE__ */ $constructor("$ZodBoolean", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = boolean;
  inst._zod.parse = (payload, _ctx) => {
    if (def.coerce)
      try {
        payload.value = Boolean(payload.value);
      } catch (_) {
      }
    const input = payload.value;
    if (typeof input === "boolean")
      return payload;
    payload.issues.push({
      expected: "boolean",
      code: "invalid_type",
      input,
      inst
    });
    return payload;
  };
});
function handleArrayResult(result, final, index) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(index, result.issues));
  }
  final.value[index] = result.value;
}
var $ZodArray = /* @__PURE__ */ $constructor("$ZodArray", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!Array.isArray(input)) {
      payload.issues.push({
        expected: "array",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    payload.value = Array(input.length);
    const proms = [];
    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      const result = def.element._zod.run({
        value: item,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        proms.push(result.then((result2) => handleArrayResult(result2, payload, i)));
      } else {
        handleArrayResult(result, payload, i);
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => payload);
    }
    return payload;
  };
});
function handlePropertyResult(result, final, key, input) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(key, result.issues));
  }
  if (result.value === void 0) {
    if (key in input) {
      final.value[key] = void 0;
    }
  } else {
    final.value[key] = result.value;
  }
}
function normalizeDef(def) {
  const keys = Object.keys(def.shape);
  for (const k of keys) {
    if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) {
      throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
    }
  }
  const okeys = optionalKeys(def.shape);
  return {
    ...def,
    keys,
    keySet: new Set(keys),
    numKeys: keys.length,
    optionalKeys: new Set(okeys)
  };
}
function handleCatchall(proms, input, payload, ctx, def, inst) {
  const unrecognized = [];
  const keySet = def.keySet;
  const _catchall = def.catchall._zod;
  const t = _catchall.def.type;
  for (const key of Object.keys(input)) {
    if (keySet.has(key))
      continue;
    if (t === "never") {
      unrecognized.push(key);
      continue;
    }
    const r = _catchall.run({ value: input[key], issues: [] }, ctx);
    if (r instanceof Promise) {
      proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input)));
    } else {
      handlePropertyResult(r, payload, key, input);
    }
  }
  if (unrecognized.length) {
    payload.issues.push({
      code: "unrecognized_keys",
      keys: unrecognized,
      input,
      inst
    });
  }
  if (!proms.length)
    return payload;
  return Promise.all(proms).then(() => {
    return payload;
  });
}
var $ZodObject = /* @__PURE__ */ $constructor("$ZodObject", (inst, def) => {
  $ZodType.init(inst, def);
  const desc = Object.getOwnPropertyDescriptor(def, "shape");
  if (!desc?.get) {
    const sh = def.shape;
    Object.defineProperty(def, "shape", {
      get: () => {
        const newSh = { ...sh };
        Object.defineProperty(def, "shape", {
          value: newSh
        });
        return newSh;
      }
    });
  }
  const _normalized = cached(() => normalizeDef(def));
  defineLazy(inst._zod, "propValues", () => {
    const shape = def.shape;
    const propValues = {};
    for (const key in shape) {
      const field = shape[key]._zod;
      if (field.values) {
        propValues[key] ?? (propValues[key] = /* @__PURE__ */ new Set());
        for (const v of field.values)
          propValues[key].add(v);
      }
    }
    return propValues;
  });
  const isObject2 = isObject;
  const catchall = def.catchall;
  let value;
  inst._zod.parse = (payload, ctx) => {
    value ?? (value = _normalized.value);
    const input = payload.value;
    if (!isObject2(input)) {
      payload.issues.push({
        expected: "object",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    payload.value = {};
    const proms = [];
    const shape = value.shape;
    for (const key of value.keys) {
      const el = shape[key];
      const r = el._zod.run({ value: input[key], issues: [] }, ctx);
      if (r instanceof Promise) {
        proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input)));
      } else {
        handlePropertyResult(r, payload, key, input);
      }
    }
    if (!catchall) {
      return proms.length ? Promise.all(proms).then(() => payload) : payload;
    }
    return handleCatchall(proms, input, payload, ctx, _normalized.value, inst);
  };
});
function handleUnionResults(results, final, inst, ctx) {
  for (const result of results) {
    if (result.issues.length === 0) {
      final.value = result.value;
      return final;
    }
  }
  const nonaborted = results.filter((r) => !aborted(r));
  if (nonaborted.length === 1) {
    final.value = nonaborted[0].value;
    return nonaborted[0];
  }
  final.issues.push({
    code: "invalid_union",
    input: final.value,
    inst,
    errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  });
  return final;
}
var $ZodUnion = /* @__PURE__ */ $constructor("$ZodUnion", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0);
  defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
  defineLazy(inst._zod, "values", () => {
    if (def.options.every((o) => o._zod.values)) {
      return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
    }
    return void 0;
  });
  defineLazy(inst._zod, "pattern", () => {
    if (def.options.every((o) => o._zod.pattern)) {
      const patterns = def.options.map((o) => o._zod.pattern);
      return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
    }
    return void 0;
  });
  const single = def.options.length === 1;
  const first = def.options[0]._zod.run;
  inst._zod.parse = (payload, ctx) => {
    if (single) {
      return first(payload, ctx);
    }
    let async = false;
    const results = [];
    for (const option of def.options) {
      const result = option._zod.run({
        value: payload.value,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        results.push(result);
        async = true;
      } else {
        if (result.issues.length === 0)
          return result;
        results.push(result);
      }
    }
    if (!async)
      return handleUnionResults(results, payload, inst, ctx);
    return Promise.all(results).then((results2) => {
      return handleUnionResults(results2, payload, inst, ctx);
    });
  };
});
var $ZodRecord = /* @__PURE__ */ $constructor("$ZodRecord", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!isPlainObject(input)) {
      payload.issues.push({
        expected: "record",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    const proms = [];
    if (def.keyType._zod.values) {
      const values = def.keyType._zod.values;
      payload.value = {};
      for (const key of values) {
        if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
          const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
          if (result instanceof Promise) {
            proms.push(result.then((result2) => {
              if (result2.issues.length) {
                payload.issues.push(...prefixIssues(key, result2.issues));
              }
              payload.value[key] = result2.value;
            }));
          } else {
            if (result.issues.length) {
              payload.issues.push(...prefixIssues(key, result.issues));
            }
            payload.value[key] = result.value;
          }
        }
      }
      let unrecognized;
      for (const key in input) {
        if (!values.has(key)) {
          unrecognized = unrecognized ?? [];
          unrecognized.push(key);
        }
      }
      if (unrecognized && unrecognized.length > 0) {
        payload.issues.push({
          code: "unrecognized_keys",
          input,
          inst,
          keys: unrecognized
        });
      }
    } else {
      payload.value = {};
      for (const key of Reflect.ownKeys(input)) {
        if (key === "__proto__")
          continue;
        const keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
        if (keyResult instanceof Promise) {
          throw new Error("Async schemas not supported in object keys currently");
        }
        if (keyResult.issues.length) {
          payload.issues.push({
            code: "invalid_key",
            origin: "record",
            issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
            input: key,
            path: [key],
            inst
          });
          payload.value[keyResult.value] = keyResult.value;
          continue;
        }
        const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
        if (result instanceof Promise) {
          proms.push(result.then((result2) => {
            if (result2.issues.length) {
              payload.issues.push(...prefixIssues(key, result2.issues));
            }
            payload.value[keyResult.value] = result2.value;
          }));
        } else {
          if (result.issues.length) {
            payload.issues.push(...prefixIssues(key, result.issues));
          }
          payload.value[keyResult.value] = result.value;
        }
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => payload);
    }
    return payload;
  };
});
var $ZodEnum = /* @__PURE__ */ $constructor("$ZodEnum", (inst, def) => {
  $ZodType.init(inst, def);
  const values = getEnumValues(def.entries);
  const valuesSet = new Set(values);
  inst._zod.values = valuesSet;
  inst._zod.pattern = new RegExp(`^(${values.filter((k) => propertyKeyTypes.has(typeof k)).map((o) => typeof o === "string" ? escapeRegex(o) : o.toString()).join("|")})$`);
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (valuesSet.has(input)) {
      return payload;
    }
    payload.issues.push({
      code: "invalid_value",
      values,
      input,
      inst
    });
    return payload;
  };
});
var $ZodLiteral = /* @__PURE__ */ $constructor("$ZodLiteral", (inst, def) => {
  $ZodType.init(inst, def);
  if (def.values.length === 0) {
    throw new Error("Cannot create literal schema with no valid values");
  }
  inst._zod.values = new Set(def.values);
  inst._zod.pattern = new RegExp(`^(${def.values.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$`);
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (inst._zod.values.has(input)) {
      return payload;
    }
    payload.issues.push({
      code: "invalid_value",
      values: def.values,
      input,
      inst
    });
    return payload;
  };
});
var $ZodTransform = /* @__PURE__ */ $constructor("$ZodTransform", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      throw new $ZodEncodeError(inst.constructor.name);
    }
    const _out = def.transform(payload.value, payload);
    if (ctx.async) {
      const output = _out instanceof Promise ? _out : Promise.resolve(_out);
      return output.then((output2) => {
        payload.value = output2;
        return payload;
      });
    }
    if (_out instanceof Promise) {
      throw new $ZodAsyncError();
    }
    payload.value = _out;
    return payload;
  };
});
function handleOptionalResult(result, input) {
  if (result.issues.length && input === void 0) {
    return { issues: [], value: void 0 };
  }
  return result;
}
var $ZodOptional = /* @__PURE__ */ $constructor("$ZodOptional", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  inst._zod.optout = "optional";
  defineLazy(inst._zod, "values", () => {
    return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, void 0]) : void 0;
  });
  defineLazy(inst._zod, "pattern", () => {
    const pattern = def.innerType._zod.pattern;
    return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    if (def.innerType._zod.optin === "optional") {
      const result = def.innerType._zod.run(payload, ctx);
      if (result instanceof Promise)
        return result.then((r) => handleOptionalResult(r, payload.value));
      return handleOptionalResult(result, payload.value);
    }
    if (payload.value === void 0) {
      return payload;
    }
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodNullable = /* @__PURE__ */ $constructor("$ZodNullable", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
  defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
  defineLazy(inst._zod, "pattern", () => {
    const pattern = def.innerType._zod.pattern;
    return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
  });
  defineLazy(inst._zod, "values", () => {
    return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, null]) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    if (payload.value === null)
      return payload;
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodCatch = /* @__PURE__ */ $constructor("$ZodCatch", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
  defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => {
        payload.value = result2.value;
        if (result2.issues.length) {
          payload.value = def.catchValue({
            ...payload,
            error: {
              issues: result2.issues.map((iss) => finalizeIssue(iss, ctx, config()))
            },
            input: payload.value
          });
          payload.issues = [];
        }
        return payload;
      });
    }
    payload.value = result.value;
    if (result.issues.length) {
      payload.value = def.catchValue({
        ...payload,
        error: {
          issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config()))
        },
        input: payload.value
      });
      payload.issues = [];
    }
    return payload;
  };
});
var $ZodPipe = /* @__PURE__ */ $constructor("$ZodPipe", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "values", () => def.in._zod.values);
  defineLazy(inst._zod, "optin", () => def.in._zod.optin);
  defineLazy(inst._zod, "optout", () => def.out._zod.optout);
  defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      const right = def.out._zod.run(payload, ctx);
      if (right instanceof Promise) {
        return right.then((right2) => handlePipeResult(right2, def.in, ctx));
      }
      return handlePipeResult(right, def.in, ctx);
    }
    const left = def.in._zod.run(payload, ctx);
    if (left instanceof Promise) {
      return left.then((left2) => handlePipeResult(left2, def.out, ctx));
    }
    return handlePipeResult(left, def.out, ctx);
  };
});
function handlePipeResult(left, next, ctx) {
  if (left.issues.length) {
    left.aborted = true;
    return left;
  }
  return next._zod.run({ value: left.value, issues: left.issues }, ctx);
}
var $ZodCustom = /* @__PURE__ */ $constructor("$ZodCustom", (inst, def) => {
  $ZodCheck.init(inst, def);
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _) => {
    return payload;
  };
  inst._zod.check = (payload) => {
    const input = payload.value;
    const r = def.fn(input);
    if (r instanceof Promise) {
      return r.then((r2) => handleRefineResult(r2, payload, input, inst));
    }
    handleRefineResult(r, payload, input, inst);
    return;
  };
});
function handleRefineResult(result, payload, input, inst) {
  if (!result) {
    const _iss = {
      code: "custom",
      input,
      inst,
      // incorporates params.error into issue reporting
      path: [...inst._zod.def.path ?? []],
      // incorporates params.error into issue reporting
      continue: !inst._zod.def.abort
      // params: inst._zod.def.params,
    };
    if (inst._zod.def.params)
      _iss.params = inst._zod.def.params;
    payload.issues.push(issue(_iss));
  }
}

// service/node_modules/zod/v4/core/api.js
function _string(Class2, params) {
  return new Class2({
    type: "string",
    ...normalizeParams(params)
  });
}
function _url(Class2, params) {
  return new Class2({
    type: "string",
    format: "url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _number(Class2, params) {
  return new Class2({
    type: "number",
    checks: [],
    ...normalizeParams(params)
  });
}
function _int(Class2, params) {
  return new Class2({
    type: "number",
    check: "number_format",
    abort: false,
    format: "safeint",
    ...normalizeParams(params)
  });
}
function _boolean(Class2, params) {
  return new Class2({
    type: "boolean",
    ...normalizeParams(params)
  });
}
function _lte(value, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
function _gt(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
function _gte(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
function _positive(params) {
  return _gt(0, params);
}
function _nonnegative(params) {
  return _gte(0, params);
}
function _maxLength(maximum, params) {
  const ch = new $ZodCheckMaxLength({
    check: "max_length",
    ...normalizeParams(params),
    maximum
  });
  return ch;
}
function _minLength(minimum, params) {
  return new $ZodCheckMinLength({
    check: "min_length",
    ...normalizeParams(params),
    minimum
  });
}
function _length(length, params) {
  return new $ZodCheckLengthEquals({
    check: "length_equals",
    ...normalizeParams(params),
    length
  });
}
function _regex(pattern, params) {
  return new $ZodCheckRegex({
    check: "string_format",
    format: "regex",
    ...normalizeParams(params),
    pattern
  });
}
function _overwrite(tx) {
  return new $ZodCheckOverwrite({
    check: "overwrite",
    tx
  });
}
function _trim() {
  return _overwrite((input) => input.trim());
}
function _toUpperCase() {
  return _overwrite((input) => input.toUpperCase());
}
function _refine(Class2, fn, _params) {
  const schema = new Class2({
    type: "custom",
    check: "custom",
    fn,
    ...normalizeParams(_params)
  });
  return schema;
}

// service/node_modules/zod/v4/mini/schemas.js
var ZodMiniType = /* @__PURE__ */ $constructor("ZodMiniType", (inst, def) => {
  if (!inst._zod)
    throw new Error("Uninitialized schema in ZodMiniType.");
  $ZodType.init(inst, def);
  inst.def = def;
  inst.type = def.type;
  inst.parse = (data, params) => parse(inst, data, params, { callee: inst.parse });
  inst.safeParse = (data, params) => safeParse(inst, data, params);
  inst.parseAsync = async (data, params) => parseAsync(inst, data, params, { callee: inst.parseAsync });
  inst.safeParseAsync = async (data, params) => safeParseAsync(inst, data, params);
  inst.check = (...checks) => {
    return inst.clone(
      {
        ...def,
        checks: [
          ...def.checks ?? [],
          ...checks.map((ch) => typeof ch === "function" ? { _zod: { check: ch, def: { check: "custom" }, onattach: [] } } : ch)
        ]
      }
      // { parent: true }
    );
  };
  inst.clone = (_def, params) => clone(inst, _def, params);
  inst.brand = () => inst;
  inst.register = ((reg, meta) => {
    reg.add(inst, meta);
    return inst;
  });
});
var ZodMiniString = /* @__PURE__ */ $constructor("ZodMiniString", (inst, def) => {
  $ZodString.init(inst, def);
  ZodMiniType.init(inst, def);
});
function string2(params) {
  return _string(ZodMiniString, params);
}
var ZodMiniStringFormat = /* @__PURE__ */ $constructor("ZodMiniStringFormat", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  ZodMiniString.init(inst, def);
});
var ZodMiniURL = /* @__PURE__ */ $constructor("ZodMiniURL", (inst, def) => {
  $ZodURL.init(inst, def);
  ZodMiniStringFormat.init(inst, def);
});
function url(params) {
  return _url(ZodMiniURL, params);
}
var ZodMiniNumber = /* @__PURE__ */ $constructor("ZodMiniNumber", (inst, def) => {
  $ZodNumber.init(inst, def);
  ZodMiniType.init(inst, def);
});
function number2(params) {
  return _number(ZodMiniNumber, params);
}
var ZodMiniNumberFormat = /* @__PURE__ */ $constructor("ZodMiniNumberFormat", (inst, def) => {
  $ZodNumberFormat.init(inst, def);
  ZodMiniNumber.init(inst, def);
});
function int(params) {
  return _int(ZodMiniNumberFormat, params);
}
var ZodMiniBoolean = /* @__PURE__ */ $constructor("ZodMiniBoolean", (inst, def) => {
  $ZodBoolean.init(inst, def);
  ZodMiniType.init(inst, def);
});
function boolean2(params) {
  return _boolean(ZodMiniBoolean, params);
}
var ZodMiniArray = /* @__PURE__ */ $constructor("ZodMiniArray", (inst, def) => {
  $ZodArray.init(inst, def);
  ZodMiniType.init(inst, def);
});
function array(element, params) {
  return new ZodMiniArray({
    type: "array",
    element,
    ...util_exports.normalizeParams(params)
  });
}
function keyof(schema) {
  const shape = schema._zod.def.shape;
  return _enum(Object.keys(shape));
}
var ZodMiniObject = /* @__PURE__ */ $constructor("ZodMiniObject", (inst, def) => {
  $ZodObject.init(inst, def);
  ZodMiniType.init(inst, def);
  util_exports.defineLazy(inst, "shape", () => def.shape);
});
function object(shape, params) {
  const def = {
    type: "object",
    shape: shape ?? {},
    ...util_exports.normalizeParams(params)
  };
  return new ZodMiniObject(def);
}
var ZodMiniUnion = /* @__PURE__ */ $constructor("ZodMiniUnion", (inst, def) => {
  $ZodUnion.init(inst, def);
  ZodMiniType.init(inst, def);
});
function union(options, params) {
  return new ZodMiniUnion({
    type: "union",
    options,
    ...util_exports.normalizeParams(params)
  });
}
var ZodMiniRecord = /* @__PURE__ */ $constructor("ZodMiniRecord", (inst, def) => {
  $ZodRecord.init(inst, def);
  ZodMiniType.init(inst, def);
});
function record(keyType, valueType, params) {
  return new ZodMiniRecord({
    type: "record",
    keyType,
    valueType,
    ...util_exports.normalizeParams(params)
  });
}
var ZodMiniEnum = /* @__PURE__ */ $constructor("ZodMiniEnum", (inst, def) => {
  $ZodEnum.init(inst, def);
  ZodMiniType.init(inst, def);
  inst.options = Object.values(def.entries);
});
function _enum(values, params) {
  const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
  return new ZodMiniEnum({
    type: "enum",
    entries,
    ...util_exports.normalizeParams(params)
  });
}
var ZodMiniLiteral = /* @__PURE__ */ $constructor("ZodMiniLiteral", (inst, def) => {
  $ZodLiteral.init(inst, def);
  ZodMiniType.init(inst, def);
});
function literal(value, params) {
  return new ZodMiniLiteral({
    type: "literal",
    values: Array.isArray(value) ? value : [value],
    ...util_exports.normalizeParams(params)
  });
}
var ZodMiniTransform = /* @__PURE__ */ $constructor("ZodMiniTransform", (inst, def) => {
  $ZodTransform.init(inst, def);
  ZodMiniType.init(inst, def);
});
function transform(fn) {
  return new ZodMiniTransform({
    type: "transform",
    transform: fn
  });
}
var ZodMiniOptional = /* @__PURE__ */ $constructor("ZodMiniOptional", (inst, def) => {
  $ZodOptional.init(inst, def);
  ZodMiniType.init(inst, def);
});
function optional(innerType) {
  return new ZodMiniOptional({
    type: "optional",
    innerType
  });
}
var ZodMiniNullable = /* @__PURE__ */ $constructor("ZodMiniNullable", (inst, def) => {
  $ZodNullable.init(inst, def);
  ZodMiniType.init(inst, def);
});
function nullable(innerType) {
  return new ZodMiniNullable({
    type: "nullable",
    innerType
  });
}
var ZodMiniCatch = /* @__PURE__ */ $constructor("ZodMiniCatch", (inst, def) => {
  $ZodCatch.init(inst, def);
  ZodMiniType.init(inst, def);
});
function _catch(innerType, catchValue) {
  return new ZodMiniCatch({
    type: "catch",
    innerType,
    catchValue: typeof catchValue === "function" ? catchValue : () => catchValue
  });
}
var ZodMiniPipe = /* @__PURE__ */ $constructor("ZodMiniPipe", (inst, def) => {
  $ZodPipe.init(inst, def);
  ZodMiniType.init(inst, def);
});
function pipe(in_, out) {
  return new ZodMiniPipe({
    type: "pipe",
    in: in_,
    out
  });
}
var ZodMiniCustom = /* @__PURE__ */ $constructor("ZodMiniCustom", (inst, def) => {
  $ZodCustom.init(inst, def);
  ZodMiniType.init(inst, def);
});
function refine(fn, _params = {}) {
  return _refine(ZodMiniCustom, fn, _params);
}

// service/node_modules/@youversion/platform-core/dist/chunk-XYSSYODM.js
var BCP47_LANGUAGE_TAG_REGEX = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?$/;
var LanguageIdSchema = string2().check(_trim(), _minLength(1, "Language ID must be a non-empty string"), _regex(BCP47_LANGUAGE_TAG_REGEX, "Language ID must match BCP 47 format (language or language+script)"));
var LanguageSchema = object({ id: string2().check(_regex(BCP47_LANGUAGE_TAG_REGEX, "BCP 47 id limited to language or language+script")), language: string2().check(_regex(/^[a-z]{2,3}$/, "ISO 639 canonical language subtag")), script: optional(nullable(string2().check(_regex(/^[A-Z][a-z]{3}$/, 'Script must match ISO 15924 format (e.g., "Latn")')))), script_name: optional(nullable(string2())), aliases: optional(array(string2())), display_names: optional(record(string2(), string2())), scripts: optional(array(string2().check(_regex(/^[A-Z][a-z]{3}$/, "ISO 15924 script code")))), variants: optional(array(string2())), countries: optional(array(string2().check(_regex(/^[A-Z]{2}$/, "ISO 3166-1 alpha-2 country code")))), text_direction: optional(_enum(["ltr", "rtl"])), writing_population: optional(int()), speaking_population: optional(int()), default_bible_id: optional(nullable(int())) });
var countrySchema = string2().check(_trim(), _length(2, "Country code must be a 2-character ISO 3166-1 alpha-2 code"), _toUpperCase());
var GetLanguagesOptionsSchema = object({ page_size: optional(union([int().check(_positive()), literal("*")])), fields: optional(array(keyof(LanguageSchema))), page_token: optional(string2()), country: optional(countrySchema) }).check(refine((data) => {
  if (data?.page_size === "*") {
    return data.fields && data.fields.length >= 1 && data.fields.length <= 3;
  }
  return true;
}, { error: 'page_size="*" requires 1-3 fields to be specified', path: ["page_size", "fields"] }));

// service/node_modules/@youversion/platform-core/dist/chunk-UROC66S2.js
async function getLanguage(client, languageId) {
  LanguageIdSchema.parse(languageId);
  return client.get(`/v1/languages/${languageId}`);
}

// service/node_modules/@youversion/platform-core/dist/chunk-GMP35JBN.js
var versionFilterState = { permittedVersionIds: void 0, excludedVersionIds: void 0, permittedLanguageTags: void 0 };

// service/node_modules/@youversion/platform-core/dist/chunk-7UGP5N2Z.js
function isVersionFilterActive() {
  return versionFilterState.permittedVersionIds !== void 0 || versionFilterState.permittedLanguageTags !== void 0 || (versionFilterState.excludedVersionIds?.length ?? 0) > 0;
}
function isLanguageFilterActive() {
  return versionFilterState.permittedLanguageTags !== void 0;
}
function isVersionIdDecidablyUnusable(versionId) {
  const excluded = versionFilterState.excludedVersionIds;
  if (excluded?.includes(versionId)) return true;
  const permittedIds = versionFilterState.permittedVersionIds;
  return permittedIds !== void 0 && !permittedIds.includes(versionId);
}
function isUsableBibleVersion(candidate) {
  if (isVersionIdDecidablyUnusable(candidate.id)) return false;
  const permittedTags = versionFilterState.permittedLanguageTags;
  if (permittedTags === void 0) return true;
  if (candidate.languageTag === void 0) return false;
  return permittedTags.includes(candidate.languageTag);
}
function isUsableLanguageTag(languageTag) {
  const permittedTags = versionFilterState.permittedLanguageTags;
  return permittedTags === void 0 || permittedTags.includes(languageTag);
}
function throwUnusableBibleVersion() {
  throw Object.assign(new Error("This app is not allowed to access this Bible version."), { status: 403 });
}
function fieldsNeededForVersionFilter(fields) {
  if (!fields) return void 0;
  if (!isVersionFilterActive()) return [...fields];
  const next = new Set(fields);
  next.add("id");
  if (isLanguageFilterActive()) {
    next.add("language_tag");
  }
  return [...next];
}
function fieldsNeededForLanguageFilter(fields) {
  if (!fields) return void 0;
  if (!isLanguageFilterActive()) return [...fields];
  const next = new Set(fields);
  next.add("id");
  return [...next];
}
var FILTER_PAGE_CURSOR_PREFIX = "yv-vf1:";
var FilterPageCursorSchema = object({ t: nullable(string2()), s: int().check(_nonnegative()) });
function encodeFilterPageCursor(pageToken, skip) {
  return `${FILTER_PAGE_CURSOR_PREFIX}${JSON.stringify({ t: pageToken, s: skip })}`;
}
function decodeFilterPageCursor(token) {
  if (!token.startsWith(FILTER_PAGE_CURSOR_PREFIX)) return void 0;
  try {
    const parsed = FilterPageCursorSchema.safeParse(JSON.parse(token.slice(FILTER_PAGE_CURSOR_PREFIX.length)));
    return parsed.success ? parsed.data : void 0;
  } catch {
    return void 0;
  }
}
function resolveFilterPageStart(startToken) {
  if (!startToken) return { skip: 0 };
  const cursor = decodeFilterPageCursor(startToken);
  if (!cursor) return { pageToken: startToken, skip: 0 };
  return { pageToken: cursor.t ?? void 0, skip: cursor.s };
}
async function fetchFilteredCollection(params, options, deps) {
  const filterFields = deps.fieldsNeeded();
  const pageSize = options.page_size;
  if (filterFields) {
    params["fields[]"] = filterFields;
    if (deps.isFilterActive() && pageSize === "*" && filterFields.length > 3) {
      delete params.page_size;
    }
  }
  if (!deps.isFilterActive()) {
    return deps.fetchPage(options.page_token);
  }
  return collectFilteredPage(deps.fetchPage, deps.isUsable, pageSize, options.page_token);
}
async function collectFilteredPage(fetchPage, isUsable, pageSize, startToken) {
  const start = resolveFilterPageStart(startToken);
  if (pageSize === "*") {
    const first2 = await fetchPage(start.pageToken);
    const data = first2.data.filter(isUsable).slice(start.skip);
    let token = first2.next_page_token;
    while (token) {
      const next = await fetchPage(token);
      data.push(...next.data.filter(isUsable));
      token = next.next_page_token;
    }
    return { data, next_page_token: null, total_size: data.length };
  }
  let fetchToken = start.pageToken;
  let skip = start.skip;
  const first = await fetchPage(fetchToken);
  const target = pageSize ?? first.data.length;
  const collected = [];
  let page = first;
  while (true) {
    const usable = page.data.filter(isUsable).slice(skip);
    const take = usable.slice(0, target - collected.length);
    collected.push(...take);
    if (usable.length > take.length) {
      return { data: collected, next_page_token: encodeFilterPageCursor(fetchToken ?? null, skip + take.length), total_size: first.total_size };
    }
    skip = 0;
    if (collected.length >= target || !page.next_page_token) {
      return { data: collected, next_page_token: page.next_page_token ?? null, total_size: first.total_size };
    }
    fetchToken = page.next_page_token;
    page = await fetchPage(fetchToken);
  }
}

// service/node_modules/@youversion/platform-core/dist/chunk-626ZOGOS.js
var PAGE_SIZE_STAR_FIELDS_MESSAGE = 'page_size="*" requires 1-3 fields to be specified';
async function getLanguages(client, options = {}) {
  if (options.page_size === "*") {
    const fieldsCount = options.fields?.length ?? 0;
    if (fieldsCount < 1 || fieldsCount > 3) {
      throw new Error(PAGE_SIZE_STAR_FIELDS_MESSAGE);
    }
  }
  const parsed = GetLanguagesOptionsSchema.parse(options);
  const params = {};
  if (parsed.country !== void 0) {
    params.country = parsed.country;
  }
  if (parsed.fields !== void 0) {
    params["fields[]"] = parsed.fields;
  }
  if (parsed.page_size !== void 0) {
    params.page_size = parsed.page_size;
  }
  const filterFields = fieldsNeededForLanguageFilter(parsed.fields);
  return fetchFilteredCollection(params, options, { fieldsNeeded: () => filterFields, isFilterActive: isLanguageFilterActive, fetchPage: (pageToken) => {
    const pageParams = { ...params };
    if (pageToken) {
      pageParams.page_token = pageToken;
    }
    return client.get(`/v1/languages`, pageParams);
  }, isUsable: (language) => isUsableLanguageTag(language.id) });
}

// service/node_modules/@youversion/platform-core/dist/chunk-6OXEYG3D.js
var LanguagesClient = class {
  client;
  constructor(client) {
    this.client = client;
  }
  async getLanguages(options = {}) {
    return getLanguages(this.client, options);
  }
  async getLanguage(languageId) {
    return getLanguage(this.client, languageId);
  }
};

// service/node_modules/@youversion/platform-core/dist/chunk-K4H2KK3Q.js
var CANON_IDS = ["old_testament", "new_testament", "deuterocanon"];
var BOOK_IDS = ["GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL", "MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV", "TOB", "JDT", "ESG", "WIS", "SIR", "BAR", "LJE", "S3Y", "SUS", "BEL", "1MA", "2MA", "3MA", "4MA", "1ES", "2ES", "MAN", "PS2", "ODA", "PSS", "3ES", "EZA", "5EZ", "6EZ", "DAG", "PS3", "2BA", "LBA", "JUB", "ENO", "1MQ", "2MQ", "3MQ", "REP", "4BA", "LAO", "LKA"];
var BibleVerseSchema = object({ id: string2(), passage_id: string2(), title: string2() });
var BibleVerseNumberSchema = int({ error: "Verse must be an integer" }).check(_positive("Verse must be a positive integer"));
var BibleChapterSchema = object({ id: string2(), passage_id: string2(), title: string2(), verses: optional(array(BibleVerseSchema)) });
var BibleChapterNumberSchema = int({ error: "Chapter must be an integer" }).check(_positive("Chapter must be a positive integer"));
var CanonSchema = _enum(CANON_IDS);
var BibleBookIntroSchema = object({ id: string2(), passage_id: string2(), title: string2() });
var OpenBookUsfmSchema = string2().check(_length(3));
var BookUsfmSchema = union([...BOOK_IDS.map((id) => literal(id)), OpenBookUsfmSchema]);
var BibleBookSchema = object({ id: BookUsfmSchema, title: string2(), full_title: string2(), abbreviation: optional(string2()), canon: CanonSchema, intro: optional(BibleBookIntroSchema), chapters: optional(array(BibleChapterSchema)) });
var BibleBookIdSchema = string2().check(_trim(), _minLength(3, "Book ID must be exactly 3 characters"), _maxLength(3, "Book ID must be exactly 3 characters"));
var BibleVersionSchema = object({ id: int(), abbreviation: string2(), promotional_content: optional(nullable(string2())), copyright: optional(nullable(string2())), info: optional(nullable(string2())), publisher_url: optional(nullable(string2())), language_tag: string2(), localized_abbreviation: string2(), localized_title: string2(), organization_id: optional(nullable(string2())), title: string2(), books: array(BookUsfmSchema), youversion_deep_link: url() });
var BibleVersionIdSchema = int().check(_positive("Version ID must be a positive integer"));
var LanguageRangeSchema = string2().check(_trim(), _minLength(1, "Language ranges must be a non-empty string"));
var GetVersionsOptionsSchema = optional(object({ page_size: optional(union([int().check(_positive()), literal("*")])), page_token: optional(string2()), fields: optional(array(keyof(BibleVersionSchema))), all_available: optional(boolean2()) })).check(refine((data) => {
  if (data?.page_size === "*") {
    return data.fields && data.fields.length >= 1 && data.fields.length <= 3;
  }
  return true;
}, { error: 'page_size="*" requires 1-3 fields to be specified', path: ["page_size", "fields"] }));

// service/node_modules/@youversion/platform-core/dist/chunk-HJSPCNQW.js
var BIBLE_CSS_STYLESHEET_URL = "https://cdn.youversion.com/platform/1/bible.css";
var UNTITLED_SERIF_FONT_ID = 1;
function getBibleStylesheets(config2) {
  if (!config2.appKey.trim()) {
    throw new Error("A non-empty app key is required to build Bible stylesheet resources.");
  }
  const apiHost = config2.apiHost || "api.youversion.com";
  return [{ kind: "bible", rel: "stylesheet", href: BIBLE_CSS_STYLESHEET_URL }, { kind: "font", rel: "stylesheet", href: `https://${apiHost}/v1/fonts/${UNTITLED_SERIF_FONT_ID}/stylesheet?app_key=${encodeURIComponent(config2.appKey)}` }];
}

// service/node_modules/@youversion/platform-core/dist/chunk-NNVIHS3B.js
var NON_BREAKING_SPACE = " ";
var FOOTNOTE_KEY_ATTR = "data-footnote-key";
var TRANSFORMED_ATTR = "data-yv-transformed";
var NEEDS_SPACE_BEFORE = /^[^\s.,;:!?)}\]'"'»›]/;
var ALLOWED_TAGS = /* @__PURE__ */ new Set(["DIV", "P", "SPAN", "SUP", "SUB", "EM", "STRONG", "I", "B", "SMALL", "BR", "SECTION", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH"]);
var DROP_ENTIRELY_TAGS = /* @__PURE__ */ new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH", "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT", "TEMPLATE", "LINK", "META", "BASE", "NOSCRIPT"]);
var ALLOWED_ATTRS = /* @__PURE__ */ new Set(["class", "v", "colspan", "rowspan", "dir", "usfm"]);
function topLevelElements(doc) {
  return doc.body ? Array.from(doc.body.children) : [];
}
function sanitizeBibleHtmlDocument(doc) {
  const root = doc.body ?? doc.documentElement;
  for (const el of Array.from(root.querySelectorAll("*"))) {
    const tag = el.tagName;
    if (DROP_ENTIRELY_TAGS.has(tag)) {
      el.remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      el.replaceWith(...Array.from(el.childNodes));
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (!ALLOWED_ATTRS.has(name) && !name.startsWith("data-")) {
        el.removeAttribute(attr.name);
      }
    }
  }
}
function wrapVerseContent(doc) {
  function wrapParagraphContent(doc2, paragraph, verseNum) {
    const children = Array.from(paragraph.childNodes);
    if (children.length === 0) return;
    const wrapper = doc2.createElement("span");
    wrapper.className = "yv-v";
    wrapper.setAttribute("v", verseNum);
    const firstChild = children[0];
    if (firstChild) {
      paragraph.insertBefore(wrapper, firstChild);
    }
    children.forEach((child) => {
      wrapper.appendChild(child);
    });
  }
  function wrapParagraphsUntilBoundary(doc2, verseNum, startParagraph, endParagraph) {
    if (!startParagraph) return;
    let currentParagraph = startParagraph.nextElementSibling;
    while (currentParagraph && currentParagraph !== endParagraph) {
      const isHeading = currentParagraph.classList.contains("yv-h") || currentParagraph.matches(".s1, .s2, .s3, .s4, .ms, .ms1, .ms2, .ms3, .ms4, .mr, .sp, .sr, .qa, .r");
      if (isHeading) {
        currentParagraph = currentParagraph.nextElementSibling;
        continue;
      }
      if (currentParagraph.querySelector(".yv-v[v]")) break;
      if (currentParagraph.classList.contains("p") || currentParagraph.tagName === "P") {
        wrapParagraphContent(doc2, currentParagraph, verseNum);
      }
      currentParagraph = currentParagraph.nextElementSibling;
    }
  }
  function handleParagraphWrapping(doc2, currentParagraph, nextParagraph, verseNum) {
    if (!currentParagraph) return;
    if (!nextParagraph) {
      wrapParagraphsUntilBoundary(doc2, verseNum, currentParagraph);
      return;
    }
    if (currentParagraph !== nextParagraph) {
      wrapParagraphsUntilBoundary(doc2, verseNum, currentParagraph, nextParagraph);
    }
  }
  function processVerseMarker(marker, index, markers) {
    const verseNum = marker.getAttribute("v");
    if (!verseNum) return;
    const nextMarker = markers[index + 1];
    const nodesToWrap = collectNodesBetweenMarkers(marker, nextMarker);
    if (nodesToWrap.length === 0) return;
    const currentParagraph = marker.closest(".p, p, div.p");
    const nextParagraph = nextMarker?.closest(".p, p, div.p") || null;
    const doc2 = marker.ownerDocument;
    wrapNodesInVerse(marker, verseNum, nodesToWrap);
    handleParagraphWrapping(doc2, currentParagraph, nextParagraph, verseNum);
  }
  function wrapNodesInVerse(marker, verseNum, nodes) {
    const wrapper = marker.ownerDocument.createElement("span");
    wrapper.className = "yv-v";
    wrapper.setAttribute("v", verseNum);
    const firstNode = nodes[0];
    if (firstNode) {
      marker.parentNode?.insertBefore(wrapper, firstNode);
    }
    nodes.forEach((node) => {
      wrapper.appendChild(node);
    });
    marker.remove();
  }
  function asElement(node) {
    return node.nodeType === 1 ? node : null;
  }
  function shouldStopCollecting(node, endMarker) {
    if (node === endMarker) return true;
    const element = asElement(node);
    if (endMarker && element?.contains(endMarker)) return true;
    return false;
  }
  function shouldSkipNode(node) {
    return asElement(node)?.classList.contains("yv-h") === true;
  }
  function collectNodesBetweenMarkers(startMarker, endMarker) {
    const nodes = [];
    let current = startMarker.nextSibling;
    while (current && !shouldStopCollecting(current, endMarker)) {
      if (shouldSkipNode(current)) {
        current = current.nextSibling;
        continue;
      }
      nodes.push(current);
      current = current.nextSibling;
    }
    return nodes;
  }
  const verseMarkers = Array.from(doc.querySelectorAll(".yv-v[v]"));
  verseMarkers.forEach(processVerseMarker);
}
function assignFootnoteKeys(doc) {
  let introIdx = 0;
  doc.querySelectorAll(".yv-n.f").forEach((fn) => {
    const verseNum = fn.closest(".yv-v[v]")?.getAttribute("v");
    fn.setAttribute(FOOTNOTE_KEY_ATTR, verseNum ?? `intro-${introIdx++}`);
  });
}
function replaceFootnotesWithAnchors(doc, footnotes) {
  for (const fn of footnotes) {
    const key = fn.getAttribute(FOOTNOTE_KEY_ATTR);
    if (!key) continue;
    const prev = fn.previousSibling;
    const next = fn.nextSibling;
    const prevText = prev?.textContent ?? "";
    const nextText = next?.textContent ?? "";
    const prevNeedsSpace = prevText.length > 0 && !/\s$/.test(prevText);
    const nextNeedsSpace = nextText.length > 0 && NEEDS_SPACE_BEFORE.test(nextText);
    if (prevNeedsSpace && nextNeedsSpace && fn.parentNode) {
      fn.parentNode.insertBefore(doc.createTextNode(" "), fn);
    }
    const anchor = doc.createElement("span");
    anchor.setAttribute("data-verse-footnote", key);
    anchor.setAttribute("data-verse-footnote-content", fn.innerHTML);
    fn.replaceWith(anchor);
  }
}
function addNbspToVerseLabels(doc) {
  doc.querySelectorAll(".yv-vlbl").forEach((label) => {
    const text = label.textContent || "";
    if (!text.endsWith(NON_BREAKING_SPACE)) {
      label.textContent = text + NON_BREAKING_SPACE;
    }
  });
}
function fixIrregularTables(doc) {
  doc.querySelectorAll("table").forEach((table) => {
    const rows = table.querySelectorAll("tr");
    if (rows.length === 0) return;
    let maxColumns = 0;
    rows.forEach((row) => {
      let count = 0;
      row.querySelectorAll("td, th").forEach((cell) => {
        count += parseInt(cell.getAttribute("colspan") || "1", 10);
      });
      maxColumns = Math.max(maxColumns, count);
    });
    if (maxColumns > 1) {
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td, th");
        if (cells.length === 1) {
          const existing = parseInt(cells[0].getAttribute("colspan") || "1", 10);
          if (existing < maxColumns) {
            cells[0].setAttribute("colspan", maxColumns.toString());
          }
        }
      });
    }
  });
}
function transformBibleHtml(html, options) {
  const doc = options.parseHtml(html);
  sanitizeBibleHtmlDocument(doc);
  const roots = topLevelElements(doc);
  if (roots.length > 0 && roots.every((el) => el.hasAttribute(TRANSFORMED_ATTR))) {
    return { html: options.serializeHtml(doc) };
  }
  wrapVerseContent(doc);
  assignFootnoteKeys(doc);
  const footnotes = Array.from(doc.querySelectorAll(".yv-n.f"));
  replaceFootnotesWithAnchors(doc, footnotes);
  addNbspToVerseLabels(doc);
  fixIrregularTables(doc);
  for (const el of topLevelElements(doc)) {
    el.setAttribute(TRANSFORMED_ATTR, "");
  }
  const transformedHtml = options.serializeHtml(doc);
  return { html: transformedHtml };
}

// service/node_modules/@youversion/platform-core/dist/chunk-5P3J6RIZ.js
function parseBibleVersionId(id) {
  return BibleVersionIdSchema.parse(id);
}
function parseBibleBookId(book) {
  return BibleBookIdSchema.parse(book);
}
function parseBibleChapter(chapter) {
  return BibleChapterNumberSchema.parse(chapter);
}
async function getVersion(client, id) {
  parseBibleVersionId(id);
  if (isVersionIdDecidablyUnusable(id)) {
    throwUnusableBibleVersion();
  }
  const version2 = await client.get(`/v1/bibles/${id}`);
  if (!isUsableBibleVersion({ id: version2.id, languageTag: version2.language_tag })) {
    throwUnusableBibleVersion();
  }
  return version2;
}
async function assertUsableVersion(client, versionId) {
  if (isVersionIdDecidablyUnusable(versionId)) {
    throwUnusableBibleVersion();
  }
  if (isLanguageFilterActive()) {
    await getVersion(client, versionId);
  }
}
async function getChapter(client, versionId, book, chapter) {
  parseBibleVersionId(versionId);
  parseBibleBookId(book);
  parseBibleChapter(chapter);
  await assertUsableVersion(client, versionId);
  return client.get(`/v1/bibles/${versionId}/books/${book}/chapters/${chapter}`);
}

// service/node_modules/@youversion/platform-core/dist/chunk-FTY6DK7V.js
var BiblePassageSchema = object({ id: string2(), content: string2(), reference: string2() });
var booleanSchema = boolean2();
function buildPassageQuery(format, includeHeadings, includeNotes) {
  if (includeHeadings !== void 0) {
    booleanSchema.parse(includeHeadings);
  }
  if (includeNotes !== void 0) {
    booleanSchema.parse(includeNotes);
  }
  const params = { format };
  if (includeHeadings !== void 0) {
    params.include_headings = includeHeadings;
  }
  if (includeNotes !== void 0) {
    params.include_notes = includeNotes;
  }
  return params;
}
async function getHtmlAdapters() {
  if (globalThis.DOMParser) {
    return { parseHtml: (h) => new globalThis.DOMParser().parseFromString(h, "text/html"), serializeHtml: (doc) => doc.body.innerHTML };
  }
  let jsdom;
  try {
    jsdom = await import("jsdom");
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Server-side HTML transformation requires "jsdom". Install it as a dependency or pass transform: false to skip transformation. Original error: ${detail}`, { cause: err });
  }
  return { parseHtml: (h) => new jsdom.JSDOM(`<!DOCTYPE html><html><body>${h}</body></html>`).window.document, serializeHtml: (doc) => doc.body.innerHTML };
}
async function getPassage(client, versionId, usfm, format = "html", include_headings, include_notes, transform2) {
  parseBibleVersionId(versionId);
  const params = buildPassageQuery(format, include_headings, include_notes);
  await assertUsableVersion(client, versionId);
  const passage = await fetchPassage(client, versionId, usfm, params);
  return transformPassage(passage, params.format, transform2);
}
async function getPassageForValidatedVersion(client, versionId, usfm, format = "html", include_headings, include_notes, transform2) {
  parseBibleVersionId(versionId);
  const params = buildPassageQuery(format, include_headings, include_notes);
  const response2 = await fetchPassage(client, versionId, usfm, params);
  const passage = BiblePassageSchema.parse(response2);
  return transformPassage(passage, params.format, transform2);
}
async function fetchPassage(client, versionId, usfm, params) {
  return client.get(`/v1/bibles/${versionId}/passages/${usfm}`, params);
}
async function transformPassage(passage, format, transform2) {
  if (format === "html" && transform2 !== false) {
    const adapters = await getHtmlAdapters();
    const { html } = transformBibleHtml(passage.content, adapters);
    return { ...passage, content: html };
  }
  return passage;
}

// service/node_modules/@youversion/platform-core/dist/chunk-PYRVEZPL.js
var GetPassageDisplayOptionsSchema = object({ versionId: BibleVersionIdSchema, passageId: string2().check(_trim(), _minLength(1, "Passage ID must be a non-empty string")), includeHeadings: optional(boolean2()), includeNotes: optional(boolean2()) });
var PassageAttributionSchema = object({ text: string2().check(_minLength(1)), source: _enum(["copyright", "promotionalContent"]) });
var PassageStylesheetSchema = object({ kind: _enum(["bible", "font"]), rel: literal("stylesheet"), href: url() });
var BiblePassageContainerAttributesSchema = object({ "data-yv-sdk": literal(""), "data-slot": literal("yv-bible-renderer") });
var BiblePassageDisplaySchema = object({ version: BibleVersionSchema, html: string2(), attribution: PassageAttributionSchema, stylesheets: array(PassageStylesheetSchema), containerAttributes: BiblePassageContainerAttributesSchema });
var BIBLE_CONTAINER_ATTRIBUTES = Object.freeze({ "data-yv-sdk": "", "data-slot": "yv-bible-renderer" });
var MissingPassageAttributionError = class extends Error {
  code = "missing_passage_attribution";
  versionId;
  constructor(versionId) {
    super(`Bible version ${versionId} has no display attribution.`);
    this.name = "MissingPassageAttributionError";
    this.versionId = versionId;
  }
};
function getPassageAttribution(version2) {
  if (version2.copyright?.trim()) {
    return { text: version2.copyright, source: "copyright" };
  }
  if (version2.promotional_content?.trim()) {
    return { text: version2.promotional_content, source: "promotionalContent" };
  }
  throw new MissingPassageAttributionError(version2.id);
}
async function fetchDisplayResources(client, options) {
  const fetchPassage2 = () => getPassageForValidatedVersion(client, options.versionId, options.passageId, "html", options.includeHeadings, options.includeNotes, true);
  if (isLanguageFilterActive()) {
    const version22 = await getVersion(client, options.versionId);
    const passage2 = await fetchPassage2();
    return { passage: passage2, version: version22 };
  }
  if (isVersionIdDecidablyUnusable(options.versionId)) {
    throwUnusableBibleVersion();
  }
  const [passage, version2] = await Promise.all([fetchPassage2(), getVersion(client, options.versionId)]);
  return { passage, version: version2 };
}
async function getPassageDisplay(client, input) {
  const options = GetPassageDisplayOptionsSchema.parse(input);
  const stylesheets = getBibleStylesheets(client.config);
  const resources = await fetchDisplayResources(client, options);
  const version2 = BibleVersionSchema.parse(resources.version);
  return { version: version2, html: resources.passage.content, attribution: getPassageAttribution(version2), stylesheets, containerAttributes: BIBLE_CONTAINER_ATTRIBUTES };
}

// service/node_modules/@youversion/platform-core/dist/chunk-SPK5Q64Y.js
async function getBooks(client, versionId, canon) {
  parseBibleVersionId(versionId);
  await assertUsableVersion(client, versionId);
  return client.get(`/v1/bibles/${versionId}/books`, { ...canon && { canon } });
}
async function getBook(client, versionId, book) {
  parseBibleVersionId(versionId);
  parseBibleBookId(book);
  await assertUsableVersion(client, versionId);
  return client.get(`/v1/bibles/${versionId}/books/${book}`);
}
async function getChapters(client, versionId, book) {
  parseBibleVersionId(versionId);
  parseBibleBookId(book);
  await assertUsableVersion(client, versionId);
  return client.get(`/v1/bibles/${versionId}/books/${book}/chapters`);
}
async function getVerses(client, versionId, book, chapter) {
  parseBibleVersionId(versionId);
  parseBibleBookId(book);
  parseBibleChapter(chapter);
  await assertUsableVersion(client, versionId);
  return client.get(`/v1/bibles/${versionId}/books/${book}/chapters/${chapter}/verses`);
}
async function getVerse(client, versionId, book, chapter, verse) {
  parseBibleVersionId(versionId);
  parseBibleBookId(book);
  parseBibleChapter(chapter);
  BibleVerseNumberSchema.parse(verse);
  await assertUsableVersion(client, versionId);
  return client.get(`/v1/bibles/${versionId}/books/${book}/chapters/${chapter}/verses/${verse}`);
}
async function getAllVOTDs(client) {
  return client.get(`/v1/verse_of_the_days`);
}
async function getVOTD(client, day) {
  int().check(_gte(1), _lte(366)).parse(day);
  return client.get(`/v1/verse_of_the_days/${day}`);
}

// service/node_modules/@youversion/platform-core/dist/chunk-IAWXFW3P.js
async function getVersions(client, language_ranges, license_id, options) {
  const languageRangeArray = Array.isArray(language_ranges) ? language_ranges : [language_ranges];
  const parsedLanguageRanges = array(LanguageRangeSchema).check(_minLength(1, "At least one language range is required")).parse(languageRangeArray);
  const params = { "language_ranges[]": parsedLanguageRanges };
  if (license_id) {
    params.license_id = license_id;
  }
  if (options?.page_size === "*") {
    const fieldsCount = options.fields?.length ?? 0;
    if (fieldsCount < 1 || fieldsCount > 3) {
      throw new Error('page_size="*" requires 1-3 fields to be specified');
    }
  }
  GetVersionsOptionsSchema.parse(options);
  if (options?.page_size) {
    params.page_size = options.page_size;
  }
  if (options?.fields) {
    params["fields[]"] = options.fields;
  }
  if (options?.all_available) {
    params.all_available = "true";
  }
  const filterFields = fieldsNeededForVersionFilter(options?.fields);
  return fetchFilteredCollection(params, options ?? {}, { fieldsNeeded: () => filterFields, isFilterActive: isVersionFilterActive, fetchPage: (pageToken) => {
    const pageParams = { ...params };
    if (pageToken) {
      pageParams.page_token = pageToken;
    }
    return client.get(`/v1/bibles`, pageParams);
  }, isUsable: (version2) => isUsableBibleVersion({ id: version2.id, languageTag: version2.language_tag }) });
}

// service/node_modules/@youversion/platform-core/dist/chunk-RV37D26R.js
var BibleClient = class {
  client;
  constructor(client) {
    this.client = client;
  }
  async getVersions(language_ranges, license_id, options) {
    return getVersions(this.client, language_ranges, license_id, options);
  }
  async getVersion(id) {
    return getVersion(this.client, id);
  }
  async getBooks(versionId, canon) {
    return getBooks(this.client, versionId, canon);
  }
  async getBook(versionId, book) {
    return getBook(this.client, versionId, book);
  }
  async getChapters(versionId, book) {
    return getChapters(this.client, versionId, book);
  }
  async getChapter(versionId, book, chapter) {
    return getChapter(this.client, versionId, book, chapter);
  }
  async getVerses(versionId, book, chapter) {
    return getVerses(this.client, versionId, book, chapter);
  }
  async getVerse(versionId, book, chapter, verse) {
    return getVerse(this.client, versionId, book, chapter, verse);
  }
  async getPassage(versionId, usfm, format = "html", include_headings, include_notes, transform2) {
    return getPassage(this.client, versionId, usfm, format, include_headings, include_notes, transform2);
  }
  async getPassageDisplay(options) {
    return getPassageDisplay(this.client, options);
  }
  async getIndex(versionId) {
    parseBibleVersionId(versionId);
    await assertUsableVersion(this.client, versionId);
    return this.client.get(`/v1/bibles/${versionId}/index`);
  }
  async getAllVOTDs() {
    return getAllVOTDs(this.client);
  }
  async getVOTD(day) {
    return getVOTD(this.client, day);
  }
};

// service/node_modules/@youversion/platform-core/dist/chunk-BPKJVDGU.js
var HttpStatusCarrierSchema = object({ status: number2() });
var ErrorBodySchema = object({ message: optional(string2()), error: optional(string2()) });
function getHttpStatus(cause) {
  const parsed = HttpStatusCarrierSchema.safeParse(cause);
  return parsed.success ? parsed.data.status : void 0;
}

// service/node_modules/@youversion/platform-core/dist/chunk-VBEFPKES.js
var StatePermissionsStashSchema = object({ state: string2(), permissions: array(string2()) });
var StoredGrantsSchema = object({ userId: string2(), permissions: array(string2()) });
var IdTokenClaimsSchema = object({ sub: _catch(optional(string2()), void 0), name: _catch(optional(string2()), void 0), profile_picture: _catch(optional(string2()), void 0), email: _catch(optional(string2()), void 0) });
var TokenExpiresInSchema = pipe(union([number2(), pipe(string2().check(_regex(/^\d+$/)), transform(Number))]), int().check(_positive()));
var TokenExchangeResponseSchema = object({ access_token: string2(), expires_in: TokenExpiresInSchema, id_token: string2(), refresh_token: string2(), scope: string2(), token_type: string2() });
var TokenRefreshResponseSchema = object({ access_token: string2(), expires_in: TokenExpiresInSchema, refresh_token: string2(), scope: string2(), token_type: string2() });
var YouVersionUserInfoJSONSchema = object({ name: optional(string2()), id: optional(string2()), avatar_url: optional(string2()), email: optional(string2()) });
function resolveStorage(read) {
  try {
    const storage = read();
    if (storage?.getItem instanceof Function) {
      return storage;
    }
  } catch {
  }
  return null;
}
function getWebStorage(name) {
  return resolveStorage(() => globalThis.window ? globalThis.window[name] : null) ?? resolveStorage(() => globalThis[name]);
}
function getLocalStorage() {
  return getWebStorage("localStorage");
}
function setStorageItem(storage, key, value) {
  try {
    storage?.setItem(key, value);
    return storage !== null;
  } catch {
    return false;
  }
}
function removeStorageItem(storage, key) {
  try {
    storage?.removeItem(key);
  } catch {
  }
}
var YouVersionPlatformConfiguration = class {
  static _appKey = null;
  static _installationId = null;
  static _apiHost = "api.youversion.com";
  static _refreshTokenKey = null;
  static _expiryDateKey = null;
  static _signInPromptMessage = void 0;
  static _appName = void 0;
  static getOrSetInstallationId() {
    const storage = getLocalStorage();
    if (!storage) {
      return "";
    }
    const existingId = storage.getItem("x-yvp-installation-id");
    if (existingId) {
      return existingId;
    }
    const newId = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `yvp-${(/* @__PURE__ */ new Date()).toISOString()}-${Math.random().toString(36).slice(2, 10)}`;
    return setStorageItem(storage, "x-yvp-installation-id", newId) ? newId : "";
  }
  static saveAuthData(accessToken, refreshToken, expiryDate) {
    const storage = getLocalStorage();
    let persisted = true;
    if (accessToken !== null) {
      persisted = setStorageItem(storage, "accessToken", accessToken) && persisted;
    } else {
      removeStorageItem(storage, "accessToken");
    }
    if (refreshToken !== null) {
      persisted = setStorageItem(storage, "refreshToken", refreshToken) && persisted;
    } else {
      removeStorageItem(storage, "refreshToken");
    }
    if (expiryDate !== null) {
      persisted = setStorageItem(storage, "expiryDate", expiryDate.toISOString()) && persisted;
    } else {
      removeStorageItem(storage, "expiryDate");
    }
    return persisted;
  }
  static saveUserInfo(userInfo) {
    const storage = getLocalStorage();
    if (userInfo === null) {
      removeStorageItem(storage, "userInfo");
      return true;
    }
    return setStorageItem(storage, "userInfo", JSON.stringify(userInfo));
  }
  static clearAuthTokens() {
    this.saveAuthData(null, null, null);
    this.saveUserInfo(null);
    this.clearGrantedPermissions();
    this.clearDataExchangeInitiator();
  }
  static grantedPermissionsKey = "youversion-platform:granted-permissions";
  static get currentUserId() {
    return this.storedUserInfo?.id ?? null;
  }
  static readStoredGrants() {
    const raw = getLocalStorage()?.getItem(this.grantedPermissionsKey);
    if (!raw) return null;
    try {
      const parsed = StoredGrantsSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }
  static writeStoredGrants(userId, permissions) {
    setStorageItem(getLocalStorage(), this.grantedPermissionsKey, JSON.stringify({ userId, permissions }));
  }
  static get grantedPermissions() {
    const userId = this.currentUserId;
    if (!userId) return [];
    const stored = this.readStoredGrants();
    if (stored?.userId !== userId) return [];
    return stored.permissions;
  }
  static saveGrantedPermissions(permissions) {
    const userId = this.currentUserId;
    if (!userId) return;
    const merged = /* @__PURE__ */ new Set([...this.grantedPermissions, ...permissions]);
    this.writeStoredGrants(userId, [...merged]);
  }
  static removeGrantedPermission(permission) {
    const userId = this.currentUserId;
    if (!userId) return;
    const next = this.grantedPermissions.filter((entry) => entry !== permission);
    this.writeStoredGrants(userId, next);
  }
  static clearGrantedPermissions() {
    removeStorageItem(getLocalStorage(), this.grantedPermissionsKey);
  }
  static dataExchangeInitiatorKey = "youversion-platform:data-exchange-initiator";
  static saveDataExchangeInitiator() {
    const userId = this.currentUserId;
    if (!userId) return;
    setStorageItem(getLocalStorage(), this.dataExchangeInitiatorKey, userId);
  }
  static get dataExchangeInitiator() {
    return getLocalStorage()?.getItem(this.dataExchangeInitiatorKey) ?? null;
  }
  static clearDataExchangeInitiator() {
    removeStorageItem(getLocalStorage(), this.dataExchangeInitiatorKey);
  }
  static hasPermission(permission) {
    return this.grantedPermissions.includes(permission);
  }
  static get accessToken() {
    return getLocalStorage()?.getItem("accessToken") ?? null;
  }
  static get refreshToken() {
    return getLocalStorage()?.getItem("refreshToken") ?? null;
  }
  static get storedUserInfo() {
    const raw = getLocalStorage()?.getItem("userInfo");
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      const result = YouVersionUserInfoJSONSchema.safeParse(parsed);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }
  static get tokenExpiryDate() {
    const dateString = getLocalStorage()?.getItem("expiryDate");
    return dateString ? new Date(dateString) : null;
  }
  static get appKey() {
    return this._appKey;
  }
  static set appKey(value) {
    this._appKey = value;
  }
  static get installationId() {
    if (!this._installationId) {
      this._installationId = this.getOrSetInstallationId();
    }
    return this._installationId;
  }
  static set installationId(value) {
    this._installationId = value || this.getOrSetInstallationId();
  }
  static get apiHost() {
    return this._apiHost;
  }
  static set apiHost(value) {
    this._apiHost = value;
  }
  static get refreshTokenKey() {
    return this._refreshTokenKey;
  }
  static set refreshTokenKey(value) {
    this._refreshTokenKey = value;
  }
  static get expiryDateKey() {
    return this._expiryDateKey;
  }
  static set expiryDateKey(value) {
    this._expiryDateKey = value;
  }
  static get signInPromptMessage() {
    return this._signInPromptMessage;
  }
  static set signInPromptMessage(value) {
    this._signInPromptMessage = value;
  }
  static get appName() {
    return this._appName;
  }
  static set appName(value) {
    this._appName = value;
  }
  static get permittedVersionIds() {
    return versionFilterState.permittedVersionIds;
  }
  static set permittedVersionIds(value) {
    versionFilterState.permittedVersionIds = value;
  }
  static get excludedVersionIds() {
    return versionFilterState.excludedVersionIds;
  }
  static set excludedVersionIds(value) {
    versionFilterState.excludedVersionIds = value;
  }
  static get permittedLanguageTags() {
    return versionFilterState.permittedLanguageTags;
  }
  static set permittedLanguageTags(value) {
    versionFilterState.permittedLanguageTags = value;
  }
};

// service/node_modules/@youversion/platform-core/dist/chunk-JWVJEXQV.js
function resolveAuthToken(lat, action) {
  if (lat) {
    return lat;
  }
  const token = YouVersionPlatformConfiguration.accessToken;
  if (!token) {
    throw new Error(`Authentication required. Please provide a token or sign in before ${action}.`);
  }
  return token;
}

// service/node_modules/@youversion/platform-core/dist/chunk-UAJL23AO.js
var HEX_COLOR_REGEX = /^[0-9a-f]{6}$/i;
var HexColorSchema = string2().check(_regex(HEX_COLOR_REGEX));
var HighlightPassageIdSchema = string2().check(_trim(), _minLength(1, "Passage ID must be a non-empty string"));
var HighlightColorSchema = string2().check(_regex(HEX_COLOR_REGEX, "Color must be a 6-character hex string without #"));
var HighlightWireSchema = object({ bible_id: int().check(_positive()), passage_id: string2(), color: HexColorSchema });
var HighlightCollectionWireSchema = object({ data: array(HighlightWireSchema), next_page_token: optional(nullable(string2())) });
var _HighlightSchema = object({ version_id: int().check(_positive()), passage_id: string2(), color: HexColorSchema });
function toHighlight(wire) {
  return { version_id: wire.bible_id, passage_id: wire.passage_id, color: wire.color };
}
var _CreateHighlightSchema = object({ version_id: int().check(_positive()), passage_id: string2(), color: HexColorSchema });
var CreateHighlightEnvelopeSchema = object({ request_id: string2().check(_minLength(1)), highlight: HighlightWireSchema });
var HighlightsClient = class {
  client;
  constructor(client) {
    this.client = client;
  }
  getAuthToken(lat) {
    return resolveAuthToken(lat, "accessing highlights");
  }
  authHeaders(lat) {
    return { Authorization: `Bearer ${this.getAuthToken(lat)}` };
  }
  validateVersionId(value) {
    try {
      BibleVersionIdSchema.parse(value);
    } catch {
      throw new Error("Version ID must be a positive integer");
    }
  }
  validatePassageId(value) {
    try {
      HighlightPassageIdSchema.parse(value);
    } catch {
      throw new Error("Passage ID must be a non-empty string");
    }
  }
  async assertUsableVersion(versionId) {
    if (isVersionIdDecidablyUnusable(versionId)) {
      throwUnusableBibleVersion();
    }
    if (YouVersionPlatformConfiguration.permittedLanguageTags === void 0) {
      return;
    }
    const version2 = await this.client.get(`/v1/bibles/${versionId}`);
    if (!isUsableBibleVersion({ id: version2.id, languageTag: version2.language_tag })) {
      throwUnusableBibleVersion();
    }
  }
  validateColor(value) {
    try {
      HighlightColorSchema.parse(value);
    } catch {
      throw new Error("Color must be a 6-character hex string without #");
    }
  }
  generateRequestId() {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }
    return `yvp-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  }
  async getHighlights(options, lat) {
    this.validateVersionId(options.version_id);
    this.validatePassageId(options.passage_id);
    await this.assertUsableVersion(options.version_id);
    const response2 = await this.client.get(`/v1/highlights`, { bible_id: options.version_id, passage_id: options.passage_id }, this.authHeaders(lat));
    if (response2 === "" || response2 == null) {
      return { data: [], next_page_token: null };
    }
    const parsed = HighlightCollectionWireSchema.safeParse(response2);
    if (!parsed.success) {
      throw new Error(`Unexpected highlights API response: ${parsed.error.message}`);
    }
    return { data: parsed.data.data.map(toHighlight), next_page_token: parsed.data.next_page_token ?? null };
  }
  async createHighlight(data, lat) {
    this.validateVersionId(data.version_id);
    this.validatePassageId(data.passage_id);
    this.validateColor(data.color);
    await this.assertUsableVersion(data.version_id);
    const response2 = await this.client.post(`/v1/highlights`, { request_id: this.generateRequestId(), highlight: { bible_id: data.version_id, passage_id: data.passage_id, color: data.color.toLowerCase() } }, void 0, this.authHeaders(lat));
    const parsed = HighlightWireSchema.safeParse(response2);
    if (!parsed.success) {
      throw new Error(`Unexpected highlights API response: ${parsed.error.message}`);
    }
    return toHighlight(parsed.data);
  }
  async deleteHighlight(passageId, options, lat) {
    this.validatePassageId(passageId);
    this.validateVersionId(options.version_id);
    await this.assertUsableVersion(options.version_id);
    await this.client.delete(`/v1/highlights/${encodeURIComponent(passageId)}`, { bible_id: options.version_id }, this.authHeaders(lat));
  }
};

// service/src/download-manager.js
var DEFAULT_CONCURRENCY = 1;
var DEFAULT_MAX_RETRIES = 3;
var DEFAULT_REQUEST_INTERVAL_MS = 1250;
var DownloadManager = class {
  constructor({
    database,
    bibleClient = null,
    concurrency = DEFAULT_CONCURRENCY,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryBaseMs = 500,
    requestIntervalMs = DEFAULT_REQUEST_INTERVAL_MS,
    recoverInterruptedDownloads = true
  }) {
    if (!database) throw new Error("A SQLite database is required.");
    this.database = database;
    this.bibleClient = bibleClient;
    this.concurrency = boundedInteger(concurrency, "download concurrency", 1, 8);
    this.maxRetries = boundedInteger(maxRetries, "download retries", 0, 10);
    this.retryBaseMs = boundedInteger(retryBaseMs, "retry delay", 0, 6e4);
    this.requestIntervalMs = boundedInteger(
      requestIntervalMs,
      "download request interval",
      0,
      6e4
    );
    this.nextRequestAt = 0;
    this.activeDownloads = /* @__PURE__ */ new Map();
    this.searchIndex = null;
    this.database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS download_packages (
        version_id INTEGER PRIMARY KEY,
        status TEXT NOT NULL,
        format TEXT NOT NULL,
        include_headings INTEGER NOT NULL,
        include_notes INTEGER NOT NULL,
        metadata TEXT,
        manifest TEXT,
        total_items INTEGER NOT NULL DEFAULT 0,
        completed_items INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER,
        error TEXT
      );
      CREATE TABLE IF NOT EXISTS download_passages (
        version_id INTEGER NOT NULL,
        passage_id TEXT NOT NULL,
        book_id TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        payload TEXT NOT NULL,
        downloaded_at INTEGER NOT NULL,
        PRIMARY KEY (version_id, passage_id),
        FOREIGN KEY (version_id) REFERENCES download_packages(version_id)
          ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS download_passages_book_idx
        ON download_passages(version_id, book_id, chapter_id);
    `);
    if (recoverInterruptedDownloads) this.database.exec(`
      UPDATE download_packages
      SET status = 'paused', error = 'Download interrupted; run download add to resume.'
      WHERE status IN ('queued', 'downloading');
      UPDATE download_packages
      SET status = 'paused',
        error = 'Paused because YouVersion is rate-limiting requests. Resume after the cooldown.'
      WHERE status = 'failed'
        AND (error LIKE '%status: 429%' OR error LIKE '%rate limit%');
    `);
  }
  downloadPackage(versionId, {
    format = "text",
    includeHeadings = false,
    includeNotes = false,
    refresh = false,
    onProgress
  } = {}) {
    const version2 = positiveInteger(versionId, "version");
    if (this.activeDownloads.has(version2)) return this.activeDownloads.get(version2);
    if (!this.bibleClient) {
      throw new ServiceError("YouVersion downloads are unavailable.", {
        code: "APP_KEY_MISSING",
        status: 503
      });
    }
    if (!["text", "html"].includes(format)) {
      throw badRequest('format must be "text" or "html".');
    }
    const options = {
      format,
      includeHeadings: booleanValue(includeHeadings, "includeHeadings"),
      includeNotes: booleanValue(includeNotes, "includeNotes"),
      refresh: booleanValue(refresh, "refresh"),
      onProgress
    };
    this.#markQueued(version2, options);
    const operation = this.#performDownload(version2, options).finally(() => this.activeDownloads.delete(version2));
    this.activeDownloads.set(version2, operation);
    return operation;
  }
  queuePackage(versionId, options) {
    const version2 = positiveInteger(versionId, "version");
    const operation = this.downloadPackage(version2, options);
    operation.catch(() => {
    });
    return { version: version2, status: "queued" };
  }
  resumePackage(versionId) {
    const version2 = positiveInteger(versionId, "version");
    const existing = this.database.prepare(`
      SELECT status, format, include_headings, include_notes
      FROM download_packages
      WHERE version_id = ?
    `).get(version2);
    if (!existing) {
      throw new ServiceError("Translation package not found.", {
        code: "DOWNLOAD_NOT_FOUND",
        status: 404
      });
    }
    if (existing.status !== "paused") {
      throw new ServiceError("Only a paused translation download can be resumed.", {
        code: "DOWNLOAD_NOT_PAUSED",
        status: 409
      });
    }
    return this.downloadPackage(version2, {
      format: existing.format,
      includeHeadings: Boolean(existing.include_headings),
      includeNotes: Boolean(existing.include_notes),
      refresh: false
    });
  }
  queueResume(versionId) {
    const version2 = positiveInteger(versionId, "version");
    const operation = this.resumePackage(version2);
    operation.catch(() => {
    });
    return { version: version2, status: "queued", resumed: true };
  }
  listPackages() {
    return this.database.prepare(`
      SELECT version_id, status, format, include_headings, include_notes,
        metadata, total_items, completed_items, created_at, updated_at,
        completed_at, error
      FROM download_packages
      ORDER BY updated_at DESC
    `).all().map(packageSummary);
  }
  getPackage(versionId) {
    const version2 = positiveInteger(versionId, "version");
    const row = this.database.prepare(`
      SELECT version_id, status, format, include_headings, include_notes,
        metadata, total_items, completed_items, created_at, updated_at,
        completed_at, error
      FROM download_packages
      WHERE version_id = ?
    `).get(version2);
    return row ? packageSummary(row) : null;
  }
  async checkForUpdate(versionId) {
    const version2 = positiveInteger(versionId, "version");
    if (!this.bibleClient) {
      throw new ServiceError("YouVersion update checks are unavailable.", {
        code: "APP_KEY_MISSING",
        status: 503
      });
    }
    const local = this.database.prepare(`
      SELECT status, metadata, manifest
      FROM download_packages
      WHERE version_id = ?
    `).get(version2);
    if (!local) {
      throw new ServiceError("Translation package not found.", {
        code: "DOWNLOAD_NOT_FOUND",
        status: 404
      });
    }
    if (!local.metadata || !local.manifest) {
      throw new ServiceError("Finish the initial download before checking for updates.", {
        code: "DOWNLOAD_INCOMPLETE",
        status: 409
      });
    }
    try {
      const [metadata, manifest] = await Promise.all([
        this.bibleClient.getVersion(version2),
        this.bibleClient.getIndex(version2)
      ]);
      const metadataChanged = fingerprint(metadata) !== fingerprint(JSON.parse(local.metadata));
      const indexChanged = fingerprint(manifest) !== fingerprint(JSON.parse(local.manifest));
      return {
        version: version2,
        updateAvailable: metadataChanged || indexChanged,
        metadataChanged,
        indexChanged,
        checkedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (cause) {
      const status = getHttpStatus(cause);
      throw new ServiceError(
        status === 429 ? "YouVersion is rate-limiting update checks. Try again after five minutes." : `Unable to check for translation updates: ${cause.message}`,
        {
          code: status === 429 ? "UPSTREAM_RATE_LIMITED" : "UPDATE_CHECK_FAILED",
          status: status === 429 ? 429 : 502,
          cause
        }
      );
    }
  }
  removePackage(versionId) {
    const version2 = positiveInteger(versionId, "version");
    if (this.activeDownloads.has(version2)) {
      throw new ServiceError("Cannot remove a translation while it is downloading.", {
        code: "DOWNLOAD_ACTIVE",
        status: 409
      });
    }
    const changes = this.database.prepare(
      "DELETE FROM download_packages WHERE version_id = ?"
    ).run(version2).changes;
    if (changes) this.searchIndex = null;
    return { removed: changes > 0, version: version2 };
  }
  getBooks(versionId) {
    const bundle = this.#manifest(versionId);
    if (!bundle) return null;
    return offlineResult({ data: bundle.manifest.books }, bundle);
  }
  getChapters(versionId, bookId) {
    const bundle = this.#manifest(versionId);
    if (!bundle) return null;
    const book = bundle.manifest.books.find(
      (candidate) => candidate.id === String(bookId).toUpperCase()
    );
    if (!book) return null;
    return offlineResult({ data: book.chapters }, bundle);
  }
  getPassage(versionId, passageId, { format = "text", includeHeadings = false, includeNotes = false } = {}) {
    const version2 = positiveInteger(versionId, "version");
    const row = this.database.prepare(`
      SELECT p.payload, p.downloaded_at, d.status, d.format,
        d.include_headings, d.include_notes
      FROM download_passages p
      JOIN download_packages d ON d.version_id = p.version_id
      WHERE p.version_id = ? AND p.passage_id = ?
    `).get(version2, String(passageId).toUpperCase());
    if (!row) return null;
    if (row.format !== format || Boolean(row.include_headings) !== Boolean(includeHeadings) || Boolean(row.include_notes) !== Boolean(includeNotes)) return null;
    return {
      data: JSON.parse(row.payload),
      meta: {
        source: "download",
        stale: false,
        storedAt: new Date(row.downloaded_at).toISOString(),
        expiresAt: null,
        packageStatus: row.status
      }
    };
  }
  getVerseText(versionId, passageId) {
    const version2 = positiveInteger(versionId, "version");
    const reference2 = String(passageId || "").toUpperCase();
    const match = reference2.match(/^([A-Z0-9]{3}\.\d+)\.\d+$/);
    if (!match) return null;
    const row = this.database.prepare(`
      SELECT p.payload FROM download_passages p
      JOIN download_packages d ON d.version_id = p.version_id
      WHERE p.version_id = ? AND p.passage_id = ? AND p.kind = 'chapter'
        AND d.completed_items > 0
    `).get(version2, match[1]);
    if (!row) return null;
    const content = JSON.parse(row.payload).content || "";
    return searchableVerses(content, match[1]).find((verse) => verse.reference === reference2)?.text || null;
  }
  search(query, pageToken = "", preferredVersion = null) {
    const offset = Number(pageToken || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1e5)
      throw badRequest("Invalid local search page token.");
    if (!this.searchIndex) {
      this.searchIndex = [];
      const rows = this.database.prepare(`
        SELECT version_id, passage_id, payload FROM download_passages
        WHERE kind = 'chapter' ORDER BY version_id, rowid
      `).all();
      for (const row of rows) {
        const content = JSON.parse(row.payload).content || "";
        for (const verse of searchableVerses(content, row.passage_id))
          this.searchIndex.push({ ...verse, version: Number(row.version_id) });
      }
    }
    const needle = normalizeSearchText(query);
    if (!needle) return { verses: [], source: "download", next_page_token: null };
    const preferred = Number(preferredVersion);
    const matches2 = this.searchIndex.filter((verse) => verse.normalized.includes(needle));
    matches2.sort((a, b) => Number(b.version === preferred) - Number(a.version === preferred));
    return {
      verses: matches2.slice(offset, offset + 25).map(({ reference: reference2, text, version: version2 }) => ({ reference: reference2, text, version: version2 })),
      source: "download",
      next_page_token: offset + 25 < matches2.length ? String(offset + 25) : null
    };
  }
  async #performDownload(versionId, options) {
    try {
      const [metadata, manifest] = await Promise.all([
        this.#requestWithRetry(() => this.bibleClient.getVersion(versionId)),
        this.#requestWithRetry(() => this.bibleClient.getIndex(versionId))
      ]);
      const items = packageItems(manifest);
      this.#preparePackage(versionId, metadata, manifest, items.length, options);
      const existing = new Set(this.database.prepare(
        "SELECT passage_id FROM download_passages WHERE version_id = ?"
      ).all(versionId).map((row) => row.passage_id));
      const remaining = items.filter((item) => !existing.has(item.passageId));
      let cursor = 0;
      const worker = async () => {
        while (cursor < remaining.length) {
          const item = remaining[cursor];
          cursor += 1;
          const passage = await this.#fetchPassage(versionId, item.passageId, options);
          this.#storePassage(versionId, item, passage);
          if (options.onProgress) options.onProgress(this.getPackage(versionId));
        }
      };
      await Promise.all(
        Array.from(
          { length: Math.min(this.concurrency, Math.max(remaining.length, 1)) },
          worker
        )
      );
      const now = Date.now();
      this.database.prepare(`
        UPDATE download_packages
        SET status = 'complete', completed_items = total_items,
          updated_at = ?, completed_at = ?, error = NULL
        WHERE version_id = ?
      `).run(now, now, versionId);
      return this.getPackage(versionId);
    } catch (cause) {
      const status = getHttpStatus(cause);
      const rateLimited = status === 429;
      const message = rateLimited ? "Paused because YouVersion is rate-limiting requests. Resume after the cooldown." : String(cause?.message || cause).slice(0, 500);
      this.database.prepare(`
        UPDATE download_packages
        SET status = ?, updated_at = ?, error = ?
        WHERE version_id = ?
      `).run(rateLimited ? "paused" : "failed", Date.now(), message, versionId);
      if (cause instanceof ServiceError) throw cause;
      if (rateLimited) {
        throw new ServiceError(message, {
          code: "UPSTREAM_RATE_LIMITED",
          status: 429,
          cause
        });
      }
      throw new ServiceError(`Translation download failed: ${message}`, {
        code: "DOWNLOAD_FAILED",
        status: 502,
        cause
      });
    }
  }
  #preparePackage(versionId, metadata, manifest, totalItems, options) {
    const now = Date.now();
    const current = this.database.prepare(`
      SELECT format, include_headings, include_notes
      FROM download_packages WHERE version_id = ?
    `).get(versionId);
    const optionsChanged = current && (current.format !== options.format || Boolean(current.include_headings) !== options.includeHeadings || Boolean(current.include_notes) !== options.includeNotes);
    if (optionsChanged || options.refresh) {
      this.database.prepare(
        "DELETE FROM download_passages WHERE version_id = ?"
      ).run(versionId);
    }
    this.database.prepare(`
      INSERT INTO download_packages(
        version_id, status, format, include_headings, include_notes,
        metadata, manifest, total_items, completed_items,
        created_at, updated_at, completed_at, error
      ) VALUES (?, 'downloading', ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL, NULL)
      ON CONFLICT(version_id) DO UPDATE SET
        status = 'downloading', format = excluded.format,
        include_headings = excluded.include_headings,
        include_notes = excluded.include_notes,
        metadata = excluded.metadata, manifest = excluded.manifest,
        total_items = excluded.total_items,
        completed_items = (
          SELECT COUNT(*) FROM download_passages
          WHERE version_id = excluded.version_id
        ),
        updated_at = excluded.updated_at, completed_at = NULL, error = NULL
    `).run(
      versionId,
      options.format,
      Number(options.includeHeadings),
      Number(options.includeNotes),
      JSON.stringify(metadata),
      JSON.stringify(manifest),
      totalItems,
      now,
      now
    );
  }
  #markQueued(versionId, options) {
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO download_packages(
        version_id, status, format, include_headings, include_notes,
        metadata, manifest, total_items, completed_items,
        created_at, updated_at, completed_at, error
      ) VALUES (?, 'queued', ?, ?, ?, NULL, NULL, 0, 0, ?, ?, NULL, NULL)
      ON CONFLICT(version_id) DO UPDATE SET
        status = 'queued', updated_at = excluded.updated_at, error = NULL
    `).run(
      versionId,
      options.format,
      Number(options.includeHeadings),
      Number(options.includeNotes),
      now,
      now
    );
  }
  async #fetchPassage(versionId, passageId, options) {
    return this.#requestWithRetry(() => this.bibleClient.getPassage(
      versionId,
      passageId,
      options.format,
      options.includeHeadings,
      options.includeNotes,
      false
    ));
  }
  async #requestWithRetry(operation) {
    return this.#withRetry(async () => {
      const scheduledAt = Math.max(Date.now(), this.nextRequestAt);
      this.nextRequestAt = scheduledAt + this.requestIntervalMs;
      await delay(Math.max(0, scheduledAt - Date.now()));
      return operation();
    });
  }
  async #withRetry(operation) {
    let attempt = 0;
    while (true) {
      try {
        return await operation();
      } catch (error) {
        const status = getHttpStatus(error);
        if (status === 429) throw error;
        const retryable = status === void 0 || status === 408 || status >= 500;
        if (!retryable || attempt >= this.maxRetries) throw error;
        const retryDelay = Math.min(this.retryBaseMs * 2 ** attempt, 6e4);
        await delay(retryDelay);
        attempt += 1;
      }
    }
  }
  #storePassage(versionId, item, passage) {
    this.searchIndex = null;
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO download_passages(
        version_id, passage_id, book_id, chapter_id, kind,
        payload, downloaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(version_id, passage_id) DO UPDATE SET
        payload = excluded.payload, downloaded_at = excluded.downloaded_at
    `).run(
      versionId,
      item.passageId,
      item.bookId,
      item.chapterId,
      item.kind,
      JSON.stringify(passage),
      now
    );
    this.database.prepare(`
      UPDATE download_packages
      SET completed_items = (
        SELECT COUNT(*) FROM download_passages WHERE version_id = ?
      ), updated_at = ?
      WHERE version_id = ?
    `).run(versionId, now, versionId);
  }
  #manifest(versionId) {
    const version2 = positiveInteger(versionId, "version");
    const row = this.database.prepare(`
      SELECT manifest, status, updated_at
      FROM download_packages WHERE version_id = ?
    `).get(version2);
    if (!row?.manifest) return null;
    return {
      manifest: JSON.parse(row.manifest),
      status: row.status,
      updatedAt: row.updated_at
    };
  }
};
function packageItems(manifest) {
  const items = [];
  for (const book of manifest.books) {
    if (book.intro?.passage_id) {
      items.push({
        passageId: book.intro.passage_id,
        bookId: book.id,
        chapterId: "INTRO",
        kind: "intro"
      });
    }
    for (const chapter of book.chapters) {
      items.push({
        passageId: chapter.passage_id,
        bookId: book.id,
        chapterId: chapter.id,
        kind: "chapter"
      });
    }
  }
  return items;
}
function normalizeSearchText(value) {
  return String(value).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
function searchableVerses(content, chapterReference) {
  const source = String(content);
  const verses = [];
  const add = (number3, value) => {
    const text = String(value).replace(/<[^>]*>/g, " ").replace(/&(?:nbsp|#160);/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#(?:39|x27);/gi, "'").replace(/\s+/g, " ").trim().replace(/^\d+\s*/, "");
    if (text) verses.push({
      reference: `${chapterReference}.${number3}`,
      text,
      normalized: normalizeSearchText(text)
    });
  };
  if (/<[^>]+>/.test(source)) {
    const marker = /<span\b[^>]*class=["'][^"']*\byv-v\b[^"']*["'][^>]*\bv=["']?(\d+)["']?[^>]*><\/span>/gi;
    let previous = null;
    let match;
    while (match = marker.exec(source)) {
      if (previous) add(previous.number, source.slice(previous.end, match.index));
      previous = { number: match[1], end: marker.lastIndex };
    }
    if (previous) add(previous.number, source.slice(previous.end));
  } else {
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*(\d+)\s+(.+)/);
      if (match) add(match[1], match[2]);
    }
  }
  return verses;
}
function packageSummary(row) {
  const metadata = row.metadata ? JSON.parse(row.metadata) : null;
  return {
    version: Number(row.version_id),
    status: row.status,
    format: row.format,
    includeHeadings: Boolean(row.include_headings),
    includeNotes: Boolean(row.include_notes),
    title: metadata?.localized_title || metadata?.title || null,
    abbreviation: metadata?.localized_abbreviation || metadata?.abbreviation || null,
    languageTag: metadata?.language_tag || null,
    copyright: metadata?.copyright || null,
    totalItems: Number(row.total_items),
    completedItems: Number(row.completed_items),
    progress: row.total_items ? Number(row.completed_items) / Number(row.total_items) : 0,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    error: row.error
  };
}
function offlineResult(data, bundle) {
  return {
    data,
    meta: {
      source: "download",
      stale: false,
      storedAt: new Date(bundle.updatedAt).toISOString(),
      expiresAt: null,
      packageStatus: bundle.status
    }
  };
}
function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw badRequest(`${name} must be a positive integer.`);
  }
  return parsed;
}
function booleanValue(value, name) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0" || value === void 0) return false;
  throw badRequest(`${name} must be true or false.`);
}
function boundedInteger(value, name, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
}
function badRequest(message) {
  return new ServiceError(message, { code: "BAD_REQUEST", status: 400 });
}
function delay(milliseconds) {
  return new Promise((resolve3) => setTimeout(resolve3, milliseconds));
}
function fingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

// service/src/service-error.js
var ServiceError = class extends Error {
  constructor(message, { code = "SERVICE_ERROR", status = 500, cause } = {}) {
    super(message, { cause });
    this.name = "ServiceError";
    this.code = code;
    this.status = status;
  }
};

// service/src/search-acceleration.js
var SearchAcceleration = class {
  constructor(service) {
    this.service = service;
    this.results = /* @__PURE__ */ new Map();
    this.pending = /* @__PURE__ */ new Map();
  }
  async search(version2, query, page, fetchResults) {
    const key = JSON.stringify([version2, query.toLowerCase(), page]);
    let entry = this.results.get(key);
    if (!entry || entry.expires <= Date.now()) {
      let pending = this.pending.get(key);
      if (!pending) {
        pending = Promise.resolve().then(fetchResults).then((result) => {
          this.results.delete(key);
          this.results.set(key, { result, expires: Date.now() + 6e4 });
          if (this.results.size > 64) this.results.delete(this.results.keys().next().value);
          return result;
        }).finally(() => this.pending.delete(key));
        this.pending.set(key, pending);
      }
      entry = { result: await pending };
    }
    return { ...entry.result, verses: (entry.result.verses || []).map((hit) => {
      const text = hit.text || this.cachedVerse(version2, hit.reference);
      return text ? { ...hit, text } : hit;
    }) };
  }
  cachedVerse(version2, reference2) {
    if (!/^[A-Z0-9]{3}\.\d+\.\d+$/.test(reference2)) return "";
    const preview = this.service.cache?.get(`search-preview:${JSON.stringify({ version: version2, reference: reference2 })}`);
    if (preview && !preview.expired) return preview.data.text || "";
    const chapter = reference2.split(".").slice(0, 2).join(".");
    for (const usfm of [reference2, chapter]) {
      for (const format of ["text", "html"]) {
        for (const headings of [false, true]) for (const notes of [false, true]) {
          const params = { version: version2, usfm, format, headings, notes };
          const cached2 = this.service.cache?.get(`passage:${JSON.stringify(params)}`);
          const downloaded = this.service.downloadManager?.getPassage(version2, usfm, {
            format,
            includeHeadings: headings,
            includeNotes: notes
          });
          const data = downloaded?.data || (cached2 && !cached2.expired ? cached2.data : null);
          if (!data?.content) continue;
          if (usfm === reference2 && format === "text") return data.content;
          const match = searchableVerses(data.content, chapter).find((v) => v.reference === reference2);
          if (match) return match.text;
        }
      }
    }
    return "";
  }
  async previews(entries) {
    if (!Array.isArray(entries) || entries.length > 10 || entries.some((entry) => !Number.isSafeInteger(Number(entry?.version)) || Number(entry.version) < 1 || !/^[A-Z0-9]{3}\.\d+\.\d+$/.test(entry?.reference))) {
      throw new ServiceError("Provide at most ten valid verse previews.", { code: "BAD_REQUEST", status: 400 });
    }
    const previews = {}, failed = {}, groups = /* @__PURE__ */ new Map();
    let rateLimited = false;
    for (const entry of entries) {
      const version2 = Number(entry.version), reference2 = entry.reference;
      const key = `${version2}:${reference2}`;
      const cached2 = this.cachedVerse(version2, reference2);
      if (cached2) {
        previews[key] = cached2;
        continue;
      }
      const chapter = reference2.split(".").slice(0, 2).join(".");
      const groupKey = `${version2}:${chapter}`;
      if (!groups.has(groupKey)) groups.set(groupKey, { version: version2, chapter, entries: [] });
      if (!groups.get(groupKey).entries.some((v) => v.reference === reference2))
        groups.get(groupKey).entries.push({ reference: reference2, number: Number(reference2.split(".")[2]) });
    }
    const work = [...groups.values()];
    let cursor = 0;
    const worker = async () => {
      while (cursor < work.length) {
        const group = work[cursor++];
        try {
          if (rateLimited) throw new Error("Preview cooldown");
          const numbers = group.entries.map((v) => v.number);
          const first = Math.min(...numbers), last = Math.max(...numbers);
          const reference2 = `${group.chapter}.${first}${last === first ? "" : "-" + last}`;
          const result = await this.service.passage(group.version, reference2, {
            format: first === last ? "text" : "html",
            includeHeadings: false,
            includeNotes: false
          });
          const verses = first === last ? [{ reference: reference2, text: result.data?.content || "" }] : searchableVerses(result.data?.content, group.chapter);
          for (const entry of group.entries) {
            const text = verses.find((v) => v.reference === entry.reference)?.text;
            const key = `${group.version}:${entry.reference}`;
            if (!text) {
              failed[key] = true;
              continue;
            }
            previews[key] = text;
            this.service.cache?.set(`search-preview:${JSON.stringify({
              version: group.version,
              reference: entry.reference
            })}`, "search-preview", { text });
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
};

// service/src/platform-api-client.js
var DEFAULT_API_HOST = "api.youversion.com";
var DEFAULT_TIMEOUT_MS = 1e4;
var DEFAULT_RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1e3;
var PlatformApiClient = class {
  constructor({
    appKey,
    apiHost = DEFAULT_API_HOST,
    timeout = DEFAULT_TIMEOUT_MS,
    installationId,
    cooldownMs = DEFAULT_RATE_LIMIT_COOLDOWN_MS,
    fetchImplementation = globalThis.fetch,
    now = () => Date.now()
  } = {}) {
    if (!appKey) throw new Error("PlatformApiClient requires an app key.");
    if (!installationId) {
      throw new Error("PlatformApiClient requires a stable installation ID.");
    }
    if (typeof fetchImplementation !== "function") {
      throw new Error("PlatformApiClient requires fetch support.");
    }
    this.baseUrl = `https://${apiHost}`;
    this.timeout = positiveInteger2(timeout, "request timeout");
    this.cooldownMs = positiveInteger2(cooldownMs, "rate-limit cooldown");
    this.fetch = fetchImplementation;
    this.now = now;
    this.cooldownUntil = 0;
    this.defaultHeaders = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-YVP-App-Key": appKey,
      "X-YVP-Installation-Id": installationId
    };
  }
  get cooldownRemainingMs() {
    return Math.max(0, this.cooldownUntil - this.now());
  }
  get(path, params, headers) {
    return this.#request(path, { method: "GET", headers }, params);
  }
  post(path, data, params, headers) {
    return this.#request(path, {
      method: "POST",
      body: data === void 0 ? void 0 : JSON.stringify(data),
      headers
    }, params);
  }
  delete(path, params, headers) {
    return this.#request(path, { method: "DELETE", headers }, params);
  }
  async #request(path, options, params) {
    this.#throwIfCoolingDown();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response2 = await this.fetch(
        `${this.baseUrl}${path}${queryString(params)}`,
        {
          ...options,
          signal: controller.signal,
          headers: { ...this.defaultHeaders, ...options.headers || {} }
        }
      );
      if (!response2.ok) {
        const message = await responseMessage(response2);
        const error = Object.assign(
          new Error(message || `Request failed with status ${response2.status}`),
          { status: response2.status, statusText: response2.statusText }
        );
        if (response2.status === 429) {
          const retryAfterMs = parseRetryAfter(
            response2.headers?.get?.("retry-after"),
            this.now()
          ) || this.cooldownMs;
          this.cooldownUntil = Math.max(
            this.cooldownUntil,
            this.now() + retryAfterMs
          );
          error.retryAfterMs = this.cooldownRemainingMs;
        }
        throw error;
      }
      if (response2.status === 204) return void 0;
      const contentType = response2.headers?.get?.("content-type") || "";
      const text = await response2.text();
      if (!text) return void 0;
      return contentType.includes("application/json") ? JSON.parse(text) : text;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  #throwIfCoolingDown() {
    const remaining = this.cooldownRemainingMs;
    if (remaining <= 0) return;
    const seconds = Math.max(1, Math.ceil(remaining / 1e3));
    throw Object.assign(
      new Error(`YouVersion rate-limit cooldown is active. Retry in ${seconds} seconds.`),
      {
        status: 429,
        code: "YVP_RATE_LIMIT_COOLDOWN",
        retryAfterMs: remaining
      }
    );
  }
};
function queryString(params) {
  if (!params) return "";
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, String(item));
    } else if (value !== void 0 && value !== null) {
      query.append(key, String(value));
    }
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}
async function responseMessage(response2) {
  try {
    const text = await response2.text();
    if (!text) return "";
    try {
      const body = JSON.parse(text);
      return String(body.message || body.error || text);
    } catch {
      return text;
    }
  } catch {
    return "";
  }
}
function parseRetryAfter(value, now) {
  const header = String(value || "").trim();
  if (!header) return 0;
  if (/^\d+(?:\.\d+)?$/.test(header)) {
    return Math.max(1, Math.ceil(Number(header) * 1e3));
  }
  const retryAt = Date.parse(header);
  return Number.isFinite(retryAt) ? Math.max(1, retryAt - now) : 0;
}
function positiveInteger2(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

// service/src/platform-config.js
var YOUVERSION_APPLICATION_KEY = "TXAcDdJhtdLGnCBs9XHQvxmUWNNRoOAm42YCxsCBneIWz2Ns";
var YOUVERSION_REDIRECT_URI = "omarchy://oauth/callback";

// service/src/rate-limited-bible-client.js
var DEFAULT_REQUEST_INTERVAL_MS2 = 1100;
var DEFAULT_COOLDOWN_MS = 5 * 60 * 1e3;
var RateLimitedBibleClient = class {
  constructor({
    client,
    languagesClient = null,
    apiClient = null,
    requestIntervalMs = DEFAULT_REQUEST_INTERVAL_MS2,
    cooldownMs = DEFAULT_COOLDOWN_MS,
    now = () => Date.now(),
    sleep = delay2
  }) {
    if (!client) throw new Error("A Bible client is required.");
    this.client = client;
    this.languagesClient = languagesClient;
    this.apiClient = apiClient;
    this.requestIntervalMs = nonNegativeInteger(requestIntervalMs, "request interval");
    this.cooldownMs = positiveInteger3(cooldownMs, "rate-limit cooldown");
    this.now = now;
    this.sleep = sleep;
    this.nextRequestAt = 0;
    this.cooldownUntil = 0;
    this.inFlight = /* @__PURE__ */ new Map();
  }
  get cooldownRemainingMs() {
    return Math.max(0, this.cooldownUntil - this.now());
  }
  getVersions(...args) {
    return this.#request("getVersions", args);
  }
  getVersion(...args) {
    return this.#request("getVersion", args);
  }
  getBooks(...args) {
    return this.#request("getBooks", args);
  }
  getIndex(...args) {
    return this.#request("getIndex", args);
  }
  getChapters(...args) {
    return this.#request("getChapters", args);
  }
  getPassage(...args) {
    return this.#request("getPassage", args);
  }
  searchVerses(version2, query, pageToken = "") {
    return this.#requestOperation("searchVerses", [version2, query, pageToken], () => this.apiClient.get(
      "/v1/search-verses",
      { bible_id: version2, query, page_size: 25, page_token: pageToken || void 0 }
    ));
  }
  getVOTD(...args) {
    return this.#request("getVOTD", args);
  }
  getLanguages(options = {}) {
    if (this.apiClient && options.bibles_available === true) {
      return this.#requestOperation("getLanguages", [options], () => this.apiClient.get(
        "/v1/languages",
        {
          page_size: options.page_size,
          "fields[]": options.fields,
          bibles_available: "true"
        },
        { "Accept-Language": options.locale || "en-US" }
      ));
    }
    if (!this.languagesClient) throw new Error("A languages client is required.");
    return this.#request("getLanguages", [options], this.languagesClient);
  }
  #request(method, args, client = this.client) {
    return this.#requestOperation(
      method,
      args,
      () => client[method](...args)
    );
  }
  #requestOperation(method, args, operationCallback) {
    const key = `${method}:${JSON.stringify(args)}`;
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const operation = this.#execute(operationCallback).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, operation);
    return operation;
  }
  async #execute(operation) {
    this.#throwIfCoolingDown();
    const scheduledAt = Math.max(this.now(), this.nextRequestAt);
    this.nextRequestAt = scheduledAt + this.requestIntervalMs;
    const waitMs = Math.max(0, scheduledAt - this.now());
    if (waitMs > 0) await this.sleep(waitMs);
    this.#throwIfCoolingDown();
    try {
      const result = await operation();
      this.consecutiveRateLimits = 0;
      return result;
    } catch (error) {
      if (getHttpStatus(error) === 429) {
        this.consecutiveRateLimits = (this.consecutiveRateLimits || 0) + 1;
        const suppliedRetryAfter = Number(error?.retryAfterMs);
        const fallback = Math.min(
          this.cooldownMs * 2 ** (this.consecutiveRateLimits - 1),
          60 * 60 * 1e3
        );
        const retryAfterMs = Number.isFinite(suppliedRetryAfter) && suppliedRetryAfter > 0 ? suppliedRetryAfter : fallback;
        this.cooldownUntil = Math.max(
          this.cooldownUntil,
          this.now() + retryAfterMs
        );
        error.retryAfterMs = this.cooldownRemainingMs;
      }
      throw error;
    }
  }
  #throwIfCoolingDown() {
    const remaining = this.cooldownRemainingMs;
    if (remaining <= 0) return;
    const seconds = Math.max(1, Math.ceil(remaining / 1e3));
    throw Object.assign(
      new Error(`YouVersion rate-limit cooldown is active. Retry in ${seconds} seconds.`),
      {
        status: 429,
        code: "YVP_RATE_LIMIT_COOLDOWN",
        retryAfterMs: remaining
      }
    );
  }
};
function nonNegativeInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return parsed;
}
function positiveInteger3(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}
function delay2(milliseconds) {
  return new Promise((resolve3) => setTimeout(resolve3, milliseconds));
}

// service/src/service.js
function createPlatformClients(env = process.env, {
  appKey = YOUVERSION_APPLICATION_KEY,
  installationId = env.LIGHT_INSTALLATION_ID,
  fetchImplementation = globalThis.fetch
} = {}) {
  if (!appKey) {
    return { apiClient: null, bibleClient: null, highlightsClient: null };
  }
  const config2 = { appKey, installationId, fetchImplementation };
  if (env.YVP_API_HOST) config2.apiHost = env.YVP_API_HOST;
  if (env.YVP_TIMEOUT_MS) {
    config2.timeout = positiveInteger4(env.YVP_TIMEOUT_MS, "YVP_TIMEOUT_MS");
  }
  if (env.LIGHT_YVP_COOLDOWN_MS) {
    config2.cooldownMs = positiveInteger4(
      env.LIGHT_YVP_COOLDOWN_MS,
      "LIGHT_YVP_COOLDOWN_MS"
    );
  }
  const apiClient = new PlatformApiClient(config2);
  const bibleClient = new RateLimitedBibleClient({
    client: new BibleClient(apiClient),
    languagesClient: new LanguagesClient(apiClient),
    apiClient,
    requestIntervalMs: env.LIGHT_YVP_REQUEST_INTERVAL_MS ? nonNegativeInteger2(env.LIGHT_YVP_REQUEST_INTERVAL_MS, "LIGHT_YVP_REQUEST_INTERVAL_MS") : void 0,
    cooldownMs: env.LIGHT_YVP_COOLDOWN_MS ? positiveInteger4(env.LIGHT_YVP_COOLDOWN_MS, "LIGHT_YVP_COOLDOWN_MS") : void 0
  });
  return {
    apiClient,
    bibleClient,
    highlightsClient: new HighlightsClient(apiClient)
  };
}
var LightService = class {
  constructor({ cache, bibleClient = null, downloadManager = null }) {
    this.cache = cache;
    this.searchAcceleration = new SearchAcceleration(this);
    this.bibleClient = bibleClient;
    this.downloadManager = downloadManager;
  }
  async search(version2, query, pageToken = "") {
    const versionId = positiveInteger4(version2, "version");
    const text = String(query || "").trim().replace(/^text:\s*/i, "");
    if (!text || text.length > 100 || String(pageToken).length > 2048)
      throw badRequest2("Search requires 1–100 characters and a valid page token.");
    if (!this.bibleClient) throw new ServiceError("Online search is unavailable. Download a translation for offline search.", {
      code: "SEARCH_UNAVAILABLE",
      status: 503
    });
    try {
      const result = await this.searchAcceleration.search(
        versionId,
        text,
        pageToken,
        () => this.bibleClient.searchVerses(versionId, text, pageToken)
      );
      return { ...result, version: versionId, source: "youversion" };
    } catch (cause) {
      throw new ServiceError(`Search unavailable for this version: ${cause.message}. Downloaded translations support offline search.`, {
        code: "SEARCH_UNAVAILABLE",
        status: getHttpStatus(cause) === 429 ? 429 : 502,
        cause
      });
    }
  }
  searchPreviews(entries) {
    return this.searchAcceleration.previews(entries);
  }
  searchDownloaded(version2, query, pageToken = "") {
    const versionId = positiveInteger4(version2, "version");
    const text = String(query || "").trim().replace(/^text:\s*/i, "");
    if (!text || text.length > 100 || String(pageToken).length > 2048)
      throw badRequest2("Search requires 1–100 characters and a valid page token.");
    return this.downloadManager?.search(text, pageToken, versionId) || { verses: [], source: "download", next_page_token: null };
  }
  get onlineConfigured() {
    return this.bibleClient !== null;
  }
  async versions(language = "*", { mode = "auto" } = {}) {
    const languageRange = String(language || "").trim();
    if (languageRange !== "*" && !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(languageRange)) {
      throw badRequest2("language must be * or a BCP-47 language code such as en or en-US.");
    }
    const result = await this.#resolve(
      "versions",
      { language: languageRange, access: "licensed" },
      mode,
      () => fetchAllVersions(
        this.bibleClient,
        languageRange
      ),
      // Local versions supplement the catalog; they must not short-circuit
      // its online fetch as downloaded passage content does.
      void 0,
      () => this.#localVersions()
    );
    return this.#mergeLocalVersions(result);
  }
  languages(locale = "en-US", { mode = "auto" } = {}) {
    const acceptedLocale = String(locale || "").trim();
    if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(acceptedLocale)) {
      throw badRequest2("locale must be a BCP-47 language code such as en-US.");
    }
    return this.#resolve(
      "available-languages",
      { locale: acceptedLocale },
      mode,
      () => this.bibleClient.getLanguages({
        page_size: "*",
        fields: ["id", "localized_name", "default_bible_id"],
        bibles_available: true,
        locale: acceptedLocale
      }),
      () => null
    );
  }
  books(versionId, { mode = "auto" } = {}) {
    const version2 = positiveInteger4(versionId, "version");
    return this.#resolve(
      "books",
      { version: version2 },
      mode,
      () => this.bibleClient.getBooks(version2),
      () => this.downloadManager?.getBooks(version2)
    );
  }
  chapters(versionId, book, { mode = "auto" } = {}) {
    const version2 = positiveInteger4(versionId, "version");
    const bookCode = usfmBook(book);
    return this.#resolve(
      "chapters",
      { version: version2, book: bookCode },
      mode,
      () => this.bibleClient.getChapters(version2, bookCode),
      () => this.downloadManager?.getChapters(version2, bookCode),
      () => this.#chaptersFromCachedBooks(version2, bookCode)
    );
  }
  recentPassage() {
    const cached2 = this.cache.latest("passage");
    if (!cached2) {
      throw new ServiceError("No recently viewed passage is cached.", {
        code: "RECENT_PASSAGE_NOT_FOUND",
        status: 404
      });
    }
    const prefix = "passage:";
    if (!cached2.key.startsWith(prefix)) {
      throw new ServiceError("The recent passage cache entry is invalid.", {
        code: "CACHE_ENTRY_INVALID",
        status: 500
      });
    }
    let selection;
    try {
      selection = JSON.parse(cached2.key.slice(prefix.length));
    } catch {
      throw new ServiceError("The recent passage cache entry is invalid.", {
        code: "CACHE_ENTRY_INVALID",
        status: 500
      });
    }
    return {
      selection,
      data: cached2.data,
      meta: {
        source: "cache",
        stale: cached2.expired,
        storedAt: cached2.storedAt,
        expiresAt: cached2.expiresAt
      }
    };
  }
  passage(versionId, usfm, {
    mode = "auto",
    format = "text",
    includeHeadings = false,
    includeNotes = false
  } = {}) {
    const version2 = positiveInteger4(versionId, "version");
    const reference2 = usfmReference(usfm);
    if (!["text", "html"].includes(format)) {
      throw badRequest2('format must be "text" or "html".');
    }
    const headings = booleanValue2(includeHeadings, "includeHeadings");
    const notes = booleanValue2(includeNotes, "includeNotes");
    return this.#resolve(
      "passage",
      { version: version2, usfm: reference2, format, headings, notes },
      mode,
      () => this.bibleClient.getPassage(
        version2,
        reference2,
        format,
        headings,
        notes,
        false
      ),
      () => this.downloadManager?.getPassage(version2, reference2, {
        format,
        includeHeadings: headings,
        includeNotes: notes
      })
    );
  }
  async verseOfTheDay(versionId, { mode = "auto", day = currentDayOfYear() } = {}) {
    const version2 = positiveInteger4(versionId, "version");
    const calendarDay = positiveInteger4(day, "day");
    if (calendarDay > 366) throw badRequest2("day must be between 1 and 366.");
    const daily = await this.#resolve(
      "verse-of-the-day",
      { day: calendarDay, year: (/* @__PURE__ */ new Date()).getFullYear() },
      mode,
      () => this.bibleClient.getVOTD(calendarDay)
    );
    const passageId = String(daily.data?.passage_id || "").toUpperCase();
    if (!/^[A-Z0-9]{3}\.\d+(?:\.\d+(?:-\d+)?)?$/.test(passageId)) {
      throw new ServiceError("YouVersion returned an invalid Verse of the Day reference.", {
        code: "UPSTREAM_INVALID_RESPONSE",
        status: 502
      });
    }
    const passage = await this.passage(version2, passageId, {
      mode,
      format: "html",
      includeHeadings: false,
      includeNotes: true
    });
    return {
      data: { day: calendarDay, passageId, passage: passage.data },
      meta: { source: passage.meta.source, stale: passage.meta.stale, votd: daily.meta }
    };
  }
  async #resolve(resource, parameters, requestedMode, fetchOnline, readDownloaded, readFallback) {
    const mode = cacheMode(requestedMode);
    const key = `${resource}:${JSON.stringify(parameters)}`;
    const cached2 = this.cache.get(key);
    if (mode === "offline") {
      const downloaded = readDownloaded?.();
      if (downloaded) return downloaded;
      if (cached2) return response(cached2.data, "cache", cached2);
      const fallback = readFallback?.();
      if (fallback) return fallback;
      throw new ServiceError("No cached response is available for this request.", {
        code: "OFFLINE_CACHE_MISS",
        status: 404
      });
    }
    if (mode === "auto" && cached2 && !cached2.expired) {
      return response(cached2.data, "cache", cached2);
    }
    if (mode === "auto") {
      const downloaded = readDownloaded?.();
      if (downloaded) return downloaded;
    }
    if (!this.bibleClient) {
      if (mode === "auto") {
        if (cached2) return response(cached2.data, "stale-cache", cached2);
        const downloaded = readDownloaded?.();
        if (downloaded) return downloaded;
        const fallback = readFallback?.();
        if (fallback) return fallback;
      }
      throw new ServiceError("YouVersion online access is unavailable.", {
        code: "APP_KEY_MISSING",
        status: 503
      });
    }
    try {
      const data = await fetchOnline();
      const timestamps = this.cache.set(key, resource, data);
      return response(data, "online", { ...timestamps, expired: false });
    } catch (cause) {
      if (mode === "auto" && cached2) {
        return response(cached2.data, "stale-cache", cached2, cause.message);
      }
      if (mode === "auto") {
        const downloaded = readDownloaded?.();
        if (downloaded) return downloaded;
        const fallback = readFallback?.();
        if (fallback) return fallback;
      }
      const upstreamStatus = getHttpStatus(cause);
      if (upstreamStatus === 429) {
        const retryAfterMs = Number(cause?.retryAfterMs) || 5 * 60 * 1e3;
        const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1e3));
        throw new ServiceError(
          `YouVersion is rate-limiting Light, and this selection has no cached or downloaded copy. Retry in about ${retryAfterSeconds} seconds.`,
          {
            code: "UPSTREAM_RATE_LIMITED",
            status: 429,
            cause
          }
        );
      }
      throw new ServiceError(`Light upstream request failed: ${cause.message}`, {
        code: "UPSTREAM_ERROR",
        status: 502,
        cause
      });
    }
  }
  #chaptersFromCachedBooks(version2, bookCode) {
    const cached2 = this.cache.get(`books:${JSON.stringify({ version: version2 })}`);
    if (!cached2) return null;
    const books = collectionItems(cached2.data);
    const book = books.find((candidate) => candidate?.id === bookCode);
    if (!book || !Array.isArray(book.chapters)) return null;
    return response({ data: book.chapters }, "cache", cached2);
  }
  #localVersions() {
    const downloaded = (this.downloadManager?.listPackages() || []).filter((item) => item.completedItems > 0).map((item) => ({
      id: item.version,
      title: item.title,
      localized_title: item.title,
      abbreviation: item.abbreviation,
      localized_abbreviation: item.abbreviation,
      language_tag: item.languageTag,
      copyright: item.copyright
    }));
    const data = downloaded;
    if (data.length === 0) return null;
    return {
      data: { data },
      meta: {
        source: "download",
        stale: false,
        storedAt: null,
        expiresAt: null
      }
    };
  }
  #mergeLocalVersions(result) {
    const payload = result?.data;
    const existing = collectionItems(payload);
    const local = collectionItems(this.#localVersions());
    if (local.length === 0) return result;
    const ids = new Set(existing.map((item) => String(item?.id)));
    const merged = local.filter((item) => !ids.has(String(item.id))).concat(existing);
    if (Array.isArray(payload)) return { ...result, data: merged };
    return { ...result, data: { ...payload || {}, data: merged } };
  }
};
function collectionItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
}
function currentDayOfYear(now = /* @__PURE__ */ new Date()) {
  return (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(now.getFullYear(), 0, 0)) / 864e5;
}
async function fetchAllVersions(client, languageRange) {
  return client.getVersions(languageRange, void 0, {
    page_size: "*",
    fields: ["id", "localized_abbreviation", "localized_title"],
    // The all_available catalog also contains metadata for unlicensed Bibles.
    // Reader choices must come from the app-scoped collection (API Usage).
    all_available: false
  });
}
function response(data, source, cache, warning) {
  return {
    data,
    meta: {
      source,
      stale: source === "stale-cache" || Boolean(cache.expired),
      storedAt: cache.storedAt,
      expiresAt: cache.expiresAt,
      ...warning ? { warning } : {}
    }
  };
}
function positiveInteger4(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw badRequest2(`${name} must be a positive integer.`);
  }
  return parsed;
}
function nonNegativeInteger2(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw badRequest2(`${name} must be a non-negative integer.`);
  }
  return parsed;
}
function usfmBook(value) {
  const normalized = String(value || "").toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(normalized)) {
    throw badRequest2("book must be a three-character USFM code, such as JHN.");
  }
  return normalized;
}
function usfmReference(value) {
  const normalized = String(value || "").toUpperCase();
  if (!/^[A-Z0-9]{3}\.(?:INTRO|\d+)(?:\.\d+(?:-\d+)?)?$/.test(normalized)) {
    throw badRequest2("usfm must look like JHN.3.16, GEN.1.1-5, or MAT.1.");
  }
  return normalized;
}
function booleanValue2(value, name) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0" || value === void 0) return false;
  throw badRequest2(`${name} must be true or false.`);
}
function cacheMode(value) {
  if (!["auto", "online", "offline"].includes(value)) {
    throw badRequest2("mode must be auto, online, or offline.");
  }
  return value;
}
function badRequest2(message) {
  return new ServiceError(message, { code: "BAD_REQUEST", status: 400 });
}

// service/src/global-hotkey.js
function hyprlandChord(value) {
  const match = String(value || "").trim().match(/^(.*)\+(.+)$/);
  const parts = match ? match[1].split("+") : [];
  const key = match ? match[2] : "";
  const modifierMap = { ctrl: "CTRL", alt: "ALT", shift: "SHIFT", super: "SUPER", meta: "SUPER" };
  const modifiers = parts.map((part) => modifierMap[part.toLowerCase()]);
  const keyMap = { comma: "COMMA", period: "PERIOD", space: "SPACE", tab: "TAB", escape: "ESCAPE", enter: "RETURN", minus: "MINUS", "-": "MINUS", plus: "PLUS", "+": "PLUS", equal: "EQUAL", "=": "EQUAL" };
  const normalizedKey = keyMap[String(key || "").toLowerCase()] || String(key || "").toUpperCase();
  if (!key || modifiers.length === 0 || modifiers.some((modifier) => !modifier) || !/^[A-Z0-9]+$/.test(normalizedKey)) {
    throw new ServiceError("Use a modifier and key, such as Super+B.", {
      code: "KEYBINDING_INVALID",
      status: 400
    });
  }
  return [...new Set(modifiers), normalizedKey].join(" + ");
}

// service/src/session-hotkeys.js
var commands = {
  globalToggle: "omarchy-shell shell toggle light.bible-reader '{}'",
  verseOfTheDay: "omarchy-shell -q light.bible-reader verseOfTheDay"
};
var masks = { SUPER: 64, CTRL: 4, ALT: 8, SHIFT: 1 };
var aliases = { return: "enter", kp_enter: "enter", plus: "+", minus: "-", comma: ",", period: "." };
function identity(shortcut) {
  const parts = hyprlandChord(shortcut).split(" + ");
  const key = parts.pop();
  return { key, modifiers: parts.join(" "), mask: parts.reduce((sum, part) => sum | masks[part], 0) };
}
function matches(binding, chord2) {
  const key = String(binding.key).toLowerCase();
  return !binding.mouse && (!binding.submap || binding.submap === "reset") && (aliases[key] || key) === (aliases[chord2.key.toLowerCase()] || chord2.key.toLowerCase()) && Number(binding.modmask) === chord2.mask;
}
var SessionHotkeys = class {
  constructor({ run = (command, args) => execFileSync2(command, args, { encoding: "utf8", timeout: 3e3 }) } = {}) {
    this.run = run;
    this.owned = /* @__PURE__ */ new Map();
  }
  list() {
    return JSON.parse(this.run("hyprctl", ["binds", "-j"]));
  }
  remove(name) {
    const record2 = this.owned.get(name);
    if (!record2) return;
    const bindings = this.list().filter((binding) => matches(binding, record2.chord));
    if (bindings.length === 1 && bindings[0].dispatcher === "exec" && bindings[0].arg === commands[name] && bindings[0].description === record2.description)
      this.run("hyprctl", ["keyword", "unbind", `${record2.chord.modifiers},${record2.chord.key}`]);
    this.owned.delete(name);
  }
  set(name, shortcut) {
    if (!Object.hasOwn(commands, name)) throw new Error("Unknown Light global shortcut.");
    const chord2 = identity(shortcut);
    const bindings = this.list().filter((binding) => matches(binding, chord2));
    if (bindings.length) {
      if (bindings.every((binding) => binding.dispatcher === "exec" && binding.arg === commands[name])) {
        const old2 = this.owned.get(name);
        if (old2 && (old2.chord.key !== chord2.key || old2.chord.mask !== chord2.mask)) this.remove(name);
        if (bindings.length === 1 && new RegExp(`^Light session [0-9]+ ${name}$`).test(bindings[0].description))
          this.owned.set(name, { chord: chord2, description: bindings[0].description });
        return { [name]: shortcut };
      }
      throw new ServiceError(`${shortcut} is already used by another desktop action.`, {
        code: "KEYBINDING_CONFLICT",
        status: 409
      });
    }
    const description = `Light session ${process.pid} ${name}`;
    const result = String(this.run("hyprctl", [
      "keyword",
      "bindd",
      `${chord2.modifiers},${chord2.key},${description},exec,${commands[name]}`
    ])).trim();
    if (result !== "ok") throw new ServiceError("Hyprland rejected that global shortcut.", {
      code: "KEYBINDING_INVALID",
      status: 400
    });
    const old = this.owned.get(name);
    if (old && (old.chord.key !== chord2.key || old.chord.mask !== chord2.mask)) this.remove(name);
    this.owned.set(name, { chord: chord2, description });
    return { [name]: shortcut };
  }
  reconcile(bindings) {
    for (const name of Object.keys(commands)) {
      try {
        this.set(name, bindings[name]);
      } catch {
      }
    }
  }
  close() {
    for (const name of this.owned.keys()) {
      try {
        this.remove(name);
      } catch {
      }
    }
  }
};

// service/src/native-audio.js
import { existsSync as existsSync2, readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { join as join2 } from "node:path";
import { fileURLToPath as fileURLToPath2, pathToFileURL } from "node:url";
function prepareNativeAudio() {
  try {
    const components = fileURLToPath2(new URL("../../components/", import.meta.url));
    const library = join2(components, "LightAudio");
    if (!existsSync2(join2(library, "liblightaudio.so"))) return { nativeAudioAvailable: false, nativeAudioUrl: "" };
    const directory = ensureSecureDirectory(join2(getConfigDir(), "native-audio"));
    const module = ensureSecureDirectory(join2(directory, "LightAudio"));
    writeChanged(join2(module, "qmldir"), `module LightAudio
plugin lightaudio ${library}
`);
    const loader = join2(directory, "Features.qml");
    writeChanged(loader, readFileSync2(join2(components, "NativeAudioFeatures.qml"), "utf8"));
    return { nativeAudioAvailable: true, nativeAudioUrl: pathToFileURL(loader).href };
  } catch {
    return { nativeAudioAvailable: false, nativeAudioUrl: "" };
  }
}
function writeChanged(path, content) {
  if (!existsSync2(path) || readFileSync2(path, "utf8") !== content)
    writeFileSync2(path, content, { mode: 384 });
}

// service/src/daemon.js
import { stdin, stdout } from "node:process";

// service/src/auth.js
import { randomUUID } from "node:crypto";
var DEFAULT_REFRESH_SKEW_MS = 6e4;
var AuthenticationManager = class {
  constructor({
    tokenStore,
    appKey = YOUVERSION_APPLICATION_KEY,
    env = process.env,
    fetchImplementation = globalThis.fetch,
    refreshSkewMs = DEFAULT_REFRESH_SKEW_MS
  }) {
    this.tokenStore = tokenStore;
    this.appKey = appKey;
    this.env = env;
    this.fetch = fetchImplementation;
    this.refreshSkewMs = refreshSkewMs;
    this.refreshPromise = null;
  }
  status() {
    const stored = this.tokenStore.status();
    return {
      ...stored,
      authenticated: stored.configured && (stored.expired !== true || stored.hasRefreshToken)
    };
  }
  async getAccessToken({ forceRefresh = false } = {}) {
    const tokens = this.tokenStore.load();
    if (!tokens) throw authRequired("No Light user session is stored.");
    const expiresSoon = tokens.expiresAt && Date.parse(tokens.expiresAt) <= Date.now() + this.refreshSkewMs;
    if (forceRefresh || expiresSoon) return this.refresh();
    return tokens.accessToken;
  }
  async getAuthorizationHeader(options) {
    return `Bearer ${await this.getAccessToken(options)}`;
  }
  getSessionId() {
    if (typeof this.tokenStore.getLocalSessionId === "function") {
      return this.tokenStore.getLocalSessionId();
    }
    const tokens = this.tokenStore.load();
    if (!tokens) throw authRequired("No Light user session is stored.");
    if (tokens.sessionId) return tokens.sessionId;
    const sessionId = randomUUID();
    this.tokenStore.save({ ...tokens, sessionId });
    return sessionId;
  }
  async refresh() {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.#performRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }
  signOut() {
    return {
      cleared: this.tokenStore.clear(),
      pendingAuthorizationCleared: this.tokenStore.clearPendingAuth()
    };
  }
  async #performRefresh() {
    const current = this.tokenStore.load();
    if (!current?.refreshToken) {
      throw authRequired("The Light session has no refresh token. Sign in again.");
    }
    const appKey = this.appKey;
    if (!appKey) {
      throw new ServiceError("YouVersion sign-in is unavailable.", {
        code: "APP_KEY_MISSING",
        status: 503
      });
    }
    const apiHost = this.env.YVP_API_HOST || current.apiHost || "api.youversion.com";
    const response2 = await this.fetch(`https://${apiHost}/auth/token`, {
      method: "POST",
      signal: AbortSignal.timeout(1e4),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: current.refreshToken,
        client_id: appKey
      })
    });
    if (!response2.ok) {
      if ([400, 401, 403].includes(response2.status)) this.tokenStore.clear();
      throw new ServiceError(
        `Light token refresh failed with HTTP ${response2.status}.`,
        {
          code: [400, 401, 403].includes(response2.status) ? "SESSION_EXPIRED" : "TOKEN_REFRESH_FAILED",
          status: [400, 401, 403].includes(response2.status) ? 401 : 502
        }
      );
    }
    const refreshed = await response2.json();
    if (typeof refreshed.access_token !== "string" || !refreshed.access_token) {
      throw new ServiceError("The identity provider returned an invalid refresh response.", {
        code: "TOKEN_RESPONSE_INVALID",
        status: 502
      });
    }
    const expiresIn = Number(refreshed.expires_in);
    const expiresAt = Number.isFinite(expiresIn) ? new Date(Date.now() + expiresIn * 1e3).toISOString() : null;
    this.tokenStore.save({
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || current.refreshToken,
      expiresAt,
      appKey,
      apiHost,
      tokenType: refreshed.token_type || current.tokenType || "Bearer",
      scope: refreshed.scope || current.scope || null,
      sessionId: current.sessionId || randomUUID(),
      profile: current.profile || null
    });
    return refreshed.access_token;
  }
};
function authRequired(message) {
  return new ServiceError(message, { code: "AUTHENTICATION_REQUIRED", status: 401 });
}

// service/src/cache.js
import { chmodSync as chmodSync3 } from "node:fs";
import { join as join3 } from "node:path";
import { DatabaseSync } from "node:sqlite";
var SQLiteCache = class {
  constructor({ directory, ttlSeconds = 7 * 24 * 60 * 60 } = {}) {
    if (!directory) throw new Error("A cache directory is required.");
    if (!Number.isFinite(ttlSeconds) || ttlSeconds < 0) {
      throw new Error("Cache TTL must be a non-negative number of seconds.");
    }
    ensureSecureDirectory(directory);
    this.path = join3(directory, "cache.sqlite");
    this.ttlMs = ttlSeconds * 1e3;
    this.database = new DatabaseSync(this.path);
    chmodSync3(this.path, 384);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS cache_entries (
        cache_key TEXT PRIMARY KEY,
        resource TEXT NOT NULL,
        payload TEXT NOT NULL,
        stored_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS cache_entries_resource_idx
        ON cache_entries(resource);
    `);
    this.selectStatement = this.database.prepare(`
      SELECT payload, stored_at, expires_at
      FROM cache_entries
      WHERE cache_key = ?
    `);
    this.upsertStatement = this.database.prepare(`
      INSERT INTO cache_entries(cache_key, resource, payload, stored_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET
        resource = excluded.resource,
        payload = excluded.payload,
        stored_at = excluded.stored_at,
        expires_at = excluded.expires_at
    `);
    this.deleteStatement = this.database.prepare(
      "DELETE FROM cache_entries WHERE cache_key = ?"
    );
    this.latestStatement = this.database.prepare(`
      SELECT cache_key, payload, stored_at, expires_at
      FROM cache_entries
      WHERE resource = ?
      ORDER BY stored_at DESC
      LIMIT 1
    `);
  }
  get(key) {
    const row = this.selectStatement.get(key);
    if (!row) return null;
    try {
      return {
        data: JSON.parse(row.payload),
        storedAt: new Date(row.stored_at).toISOString(),
        expiresAt: new Date(row.expires_at).toISOString(),
        expired: row.expires_at <= Date.now()
      };
    } catch {
      this.deleteStatement.run(key);
      return null;
    }
  }
  set(key, resource, data) {
    const storedAt = Date.now();
    const expiresAt = storedAt + this.ttlMs;
    this.upsertStatement.run(
      key,
      resource,
      JSON.stringify(data),
      storedAt,
      expiresAt
    );
    return {
      storedAt: new Date(storedAt).toISOString(),
      expiresAt: new Date(expiresAt).toISOString()
    };
  }
  latest(resource) {
    const row = this.latestStatement.get(String(resource));
    if (!row) return null;
    try {
      return {
        key: row.cache_key,
        data: JSON.parse(row.payload),
        storedAt: new Date(row.stored_at).toISOString(),
        expiresAt: new Date(row.expires_at).toISOString(),
        expired: row.expires_at <= Date.now()
      };
    } catch {
      this.deleteStatement.run(row.cache_key);
      return null;
    }
  }
  clear() {
    return this.database.prepare("DELETE FROM cache_entries").run().changes;
  }
  stats() {
    const row = this.database.prepare(`
      SELECT
        COUNT(*) AS entries,
        COALESCE(SUM(LENGTH(payload)), 0) AS payload_bytes,
        SUM(CASE WHEN expires_at <= ? THEN 1 ELSE 0 END) AS expired_entries
      FROM cache_entries
    `).get(Date.now());
    return {
      path: this.path,
      entries: Number(row.entries),
      expiredEntries: Number(row.expired_entries || 0),
      payloadBytes: Number(row.payload_bytes)
    };
  }
  close() {
    this.database.close();
  }
};

// service/src/http-server.js
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";

// service/src/user-data-manager.js
import { randomUUID as randomUUID2 } from "node:crypto";
var DEFAULT_HIGHLIGHT_COLOR = "fffe00";
var DEFAULT_HIGHLIGHT_OPACITY = 0.45;
var MIN_HIGHLIGHT_OPACITY = 0.2;
var MAX_HIGHLIGHT_OPACITY = 0.75;
var DEFAULT_APP_SCALE = 1.2;
var MIN_APP_SCALE = 0.8;
var MAX_APP_SCALE = 1.6;
var DEFAULT_READER_TEXT_SCALE = 1;
var MIN_READER_TEXT_SCALE = 0.7;
var MAX_READER_TEXT_SCALE = 1.8;
var DEFAULT_READER_FONT_STYLE = "youversion";
var READER_FONT_STYLES = /* @__PURE__ */ new Set(["system", "youversion"]);
var DEFAULT_RED_LETTERS = false;
var DEFAULT_VERSE_OF_THE_DAY_ENABLED = false;
var DEFAULT_MUSIC_PLAYER_ENABLED = false;
var MAX_RADIO_STATION_NAME_LENGTH = 80;
var MAX_RADIO_STREAM_URL_LENGTH = 512;
var MAX_RADIO_STATION_DESCRIPTION_LENGTH = 160;
var MAX_HIDDEN_RADIO_STATIONS = 256;
var DEFAULT_APP_LANGUAGE = "system";
var APP_LANGUAGES = /* @__PURE__ */ new Set(["system", "en-US", "es-419"]);
var MAX_SECONDARY_BIBLE_LANGUAGES = 12;
var MAX_READER_TABS = 7;
var SETTINGS_SECTION_IDS = Object.freeze([
  "reading",
  "appearance",
  "radio",
  "languages",
  "account",
  "shortcuts",
  "backup"
]);
var DEFAULT_KEYBINDINGS = Object.freeze({
  globalToggle: "Super+B",
  verseOfTheDay: "Super+Alt+V",
  openSettings: "Ctrl+S",
  settingsReading: "Ctrl+Shift+1",
  settingsAccount: "Ctrl+Shift+2",
  settingsBackup: "Ctrl+Shift+3",
  settingsAppearance: "Ctrl+Shift+4",
  settingsRadio: "Ctrl+Shift+5",
  settingsShortcuts: "Ctrl+Shift+6",
  settingsLanguages: "Ctrl+Shift+7",
  cycleRadioSkin: "Ctrl+Shift+M",
  openRadio: "Ctrl+M",
  openLibrary: "Ctrl+L",
  openHistory: "Ctrl+H",
  radioPrevious: "Left",
  radioNext: "Right",
  radioPlayPause: "Space",
  closeCurrentPage: "Escape",
  navigateUp: "Up",
  navigateDown: "Down",
  freshInput: "Ctrl+Backspace",
  radioVolumeDown: "Shift+Left",
  radioVolumeUp: "Shift+Right",
  textIncrease: "Ctrl++",
  textDecrease: "Ctrl+-",
  textIncreaseUp: "Ctrl+Up",
  textIncreaseRight: "Ctrl+Right",
  textDecreaseDown: "Ctrl+Down",
  textDecreaseLeft: "Ctrl+Left",
  brightnessIncrease: "Ctrl+Alt++",
  brightnessDecrease: "Ctrl+Alt+-",
  brightnessIncreaseUp: "Ctrl+Alt+Up",
  brightnessIncreaseRight: "Ctrl+Alt+Right",
  brightnessDecreaseDown: "Ctrl+Alt+Down",
  brightnessDecreaseLeft: "Ctrl+Alt+Left",
  toggleReaderFontStyle: "Ctrl+F",
  toggleNightMode: "Ctrl+D",
  appIncrease: "Alt++",
  appDecrease: "Alt+-",
  appIncreaseUp: "Alt+Up",
  appIncreaseRight: "Alt+Right",
  appDecreaseDown: "Alt+Down",
  appDecreaseLeft: "Alt+Left",
  newTab: "Ctrl+T",
  closeTab: "Ctrl+W",
  nextTab: "Ctrl+Tab",
  previousTab: "Ctrl+Shift+Tab",
  tab1: "Ctrl+1",
  tab2: "Ctrl+2",
  tab3: "Ctrl+3",
  tab4: "Ctrl+4",
  tab5: "Ctrl+5",
  tab6: "Ctrl+6",
  tab7: "Ctrl+7"
});
var MAX_NOTE_LENGTH = 1e4;
var MAX_HIGHLIGHT_SELECTION_RANGES = 100;
var MAX_HIGHLIGHT_TEXT_OFFSET = 1e5;
var UserDataManager = class {
  constructor({ database, highlightsClient = null, authentication }) {
    if (!database) throw new Error("A SQLite database is required.");
    if (!authentication) throw new Error("An authentication manager is required.");
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
      "PRAGMA table_info(user_highlights)"
    ).all();
    if (!highlightColumns.some((column) => column.name === "selection_json")) {
      this.database.exec(
        "ALTER TABLE user_highlights ADD COLUMN selection_json TEXT"
      );
    }
  }
  async getContext(versionId, passageId, { refresh = false } = {}) {
    const version2 = positiveInteger5(versionId, "version");
    const passage = contextPassage(passageId);
    const highlights = await this.getHighlights(version2, passage, { refresh });
    return {
      version: version2,
      passage,
      highlights,
      notes: this.getNotes(version2, passage),
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
        keybindings: this.getKeybindings()
      },
      capabilities: { remoteHighlights: true, remoteNotes: false }
    };
  }
  async getHighlights(versionId, passageId, { refresh = false } = {}) {
    const version2 = positiveInteger5(versionId, "version");
    const passage = contextPassage(passageId);
    if (refresh) await this.syncHighlights(version2, passage);
    const sessionId = this.authentication.getSessionId();
    return this.#highlightRows(sessionId, version2, passage).filter((row) => row.sync_state !== "pending_delete").map(highlightRecord);
  }
  async syncHighlights(versionId, passageId) {
    this.#requireRemoteHighlights();
    const version2 = positiveInteger5(versionId, "version");
    const passage = contextPassage(passageId);
    const sessionId = this.authentication.getSessionId();
    const flush = await this.flushPending();
    const remote = await this.#withAuthentication((token) => this.highlightsClient.getHighlights(
      { version_id: version2, passage_id: passage },
      token
    ));
    const now = Date.now();
    const pattern = `${passage}.%`;
    this.#transaction(() => {
      const savedSelections = new Map(this.database.prepare(`
        SELECT passage_id, selection_json FROM user_highlights
        WHERE session_id = ? AND version_id = ?
          AND sync_state = 'synced'
          AND (passage_id = ? OR passage_id LIKE ?)
      `).all(sessionId, version2, passage, pattern).map((row) => [row.passage_id, parseSelectionRanges(row.selection_json)]));
      this.database.prepare(`
        DELETE FROM user_highlights
        WHERE session_id = ? AND version_id = ?
          AND sync_state = 'synced'
          AND (passage_id = ? OR passage_id LIKE ?)
      `).run(sessionId, version2, passage, pattern);
      for (const highlight of remote.data || []) {
        const existing = this.database.prepare(`
          SELECT sync_state FROM user_highlights
          WHERE session_id = ? AND version_id = ? AND passage_id = ?
        `).get(sessionId, version2, highlight.passage_id);
        if (existing && existing.sync_state !== "synced") continue;
        this.#upsertHighlight({
          sessionId,
          version: version2,
          passage: highlight.passage_id,
          color: highlight.color,
          syncState: "synced",
          now,
          syncedAt: now,
          error: null,
          selectionRanges: savedSelections.get(highlight.passage_id) || []
        });
      }
    });
    return {
      highlights: this.#highlightRows(sessionId, version2, passage).filter((row) => row.sync_state !== "pending_delete").map(highlightRecord),
      flush,
      syncedAt: new Date(now).toISOString()
    };
  }
  async createHighlight({ versionId, passageId, color, selectionRanges } = {}) {
    const sessionId = this.authentication.getSessionId();
    const version2 = positiveInteger5(versionId, "version");
    const passage = highlightPassage(passageId);
    const selectedColor = normalizeColor(color || this.getDefaultHighlightColor());
    const selectedRanges = normalizeSelectionRanges(selectionRanges, passage);
    const now = Date.now();
    this.#upsertHighlight({
      sessionId,
      version: version2,
      passage,
      color: selectedColor,
      syncState: "pending_create",
      now,
      syncedAt: null,
      error: null,
      selectionRanges: selectedRanges
    });
    try {
      this.#requireRemoteHighlights();
      const remote = await this.#withAuthentication((token) => this.highlightsClient.createHighlight({
        version_id: version2,
        passage_id: passage,
        color: selectedColor
      }, token));
      this.database.prepare(`
        DELETE FROM user_highlights
        WHERE session_id = ? AND version_id = ? AND passage_id = ?
      `).run(sessionId, version2, passage);
      this.#upsertHighlight({
        sessionId,
        version: version2,
        passage: remote.passage_id,
        color: remote.color,
        syncState: "synced",
        now: Date.now(),
        syncedAt: Date.now(),
        error: null,
        selectionRanges: selectedRanges
      });
      return { highlight: highlightRecord(this.#getHighlight(sessionId, version2, remote.passage_id)), queued: false };
    } catch (error) {
      this.#recordHighlightError(sessionId, version2, passage, error);
      return {
        highlight: highlightRecord(this.#getHighlight(sessionId, version2, passage)),
        queued: true,
        error: publicError(error)
      };
    }
  }
  async deleteHighlight({ versionId, passageId } = {}) {
    const sessionId = this.authentication.getSessionId();
    const version2 = positiveInteger5(versionId, "version");
    const passage = highlightPassage(passageId);
    const versePassages = highlightVersePassages(passage);
    const existing = this.#getHighlight(sessionId, version2, passage);
    const now = Date.now();
    this.#transaction(() => {
      this.database.prepare(`
        DELETE FROM user_highlights
        WHERE session_id = ? AND version_id = ? AND passage_id = ?
      `).run(sessionId, version2, passage);
      for (const versePassage of versePassages) {
        this.#upsertHighlight({
          sessionId,
          version: version2,
          passage: versePassage,
          color: existing?.color || this.getDefaultHighlightColor(),
          syncState: "pending_delete",
          now,
          syncedAt: existing?.synced_at || null,
          error: null
        });
      }
    });
    try {
      this.#requireRemoteHighlights();
      for (const versePassage of versePassages) {
        await this.#withAuthentication((token) => this.highlightsClient.deleteHighlight(
          versePassage,
          { version_id: version2 },
          token
        ));
        this.database.prepare(`
          DELETE FROM user_highlights
          WHERE session_id = ? AND version_id = ? AND passage_id = ?
        `).run(sessionId, version2, versePassage);
      }
      return { deleted: true, queued: false, version: version2, passage };
    } catch (error) {
      for (const versePassage of versePassages) {
        if (this.#getHighlight(sessionId, version2, versePassage)?.sync_state === "pending_delete") {
          this.#recordHighlightError(sessionId, version2, versePassage, error);
        }
      }
      return { deleted: true, queued: true, version: version2, passage, error: publicError(error) };
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
        if (item.sync_state === "pending_delete") {
          await this.#withAuthentication((token) => this.highlightsClient.deleteHighlight(
            item.passage_id,
            { version_id: item.version_id },
            token
          ));
          this.database.prepare(`
            DELETE FROM user_highlights
            WHERE session_id = ? AND version_id = ? AND passage_id = ?
          `).run(sessionId, item.version_id, item.passage_id);
        } else {
          const remote = await this.#withAuthentication((token) => this.highlightsClient.createHighlight({
            version_id: item.version_id,
            passage_id: item.passage_id,
            color: item.color
          }, token));
          this.database.prepare(`
            DELETE FROM user_highlights
            WHERE session_id = ? AND version_id = ? AND passage_id = ?
          `).run(sessionId, item.version_id, item.passage_id);
          this.#upsertHighlight({
            sessionId,
            version: remote.version_id,
            passage: remote.passage_id,
            color: remote.color,
            syncState: "synced",
            now: Date.now(),
            syncedAt: Date.now(),
            error: null,
            selectionRanges: parseSelectionRanges(item.selection_json)
          });
        }
        result.synced += 1;
      } catch (error) {
        this.#recordHighlightError(
          sessionId,
          item.version_id,
          item.passage_id,
          error
        );
        result.failed += 1;
      }
    }
    return result;
  }
  getNotes(versionId, passageId) {
    const version2 = positiveInteger5(versionId, "version");
    const passage = contextPassage(passageId);
    return this.database.prepare(`
      SELECT id, version_id, passage_id, body, created_at, updated_at
      FROM user_notes
      WHERE version_id = ? AND (passage_id = ? OR passage_id LIKE ?)
      ORDER BY updated_at DESC
    `).all(version2, passage, `${passage}.%`).map(noteRecord);
  }
  createNote({ versionId, passageId, body } = {}) {
    const version2 = positiveInteger5(versionId, "version");
    const passage = highlightPassage(passageId);
    const noteBody = String(body || "").trim();
    if (!noteBody || noteBody.length > MAX_NOTE_LENGTH) {
      throw badRequest3(`note body must contain 1-${MAX_NOTE_LENGTH} characters.`);
    }
    const id = randomUUID2();
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO user_notes(id, version_id, passage_id, body, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, version2, passage, noteBody, now, now);
    return noteRecord(this.database.prepare(
      "SELECT * FROM user_notes WHERE id = ?"
    ).get(id));
  }
  deleteNote(id) {
    const changes = this.database.prepare(
      "DELETE FROM user_notes WHERE id = ?"
    ).run(String(id || "")).changes;
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
    return READER_FONT_STYLES.has(row?.preference_value) ? row.preference_value : DEFAULT_READER_FONT_STYLE;
  }
  setReaderFontStyle(style) {
    const normalized = String(style || "").trim().toLowerCase();
    if (!READER_FONT_STYLES.has(normalized)) {
      throw badRequest3("reader font style must be system or youversion.");
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
    return row.preference_value === "true";
  }
  setRedLetters(enabled) {
    if (typeof enabled !== "boolean") {
      throw badRequest3("red letters must be true or false.");
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
    return row ? row.preference_value === "true" : DEFAULT_VERSE_OF_THE_DAY_ENABLED;
  }
  setVerseOfTheDayEnabled(enabled) {
    if (typeof enabled !== "boolean") {
      throw badRequest3("verse of the day must be true or false.");
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
    return row ? row.preference_value === "true" : DEFAULT_MUSIC_PLAYER_ENABLED;
  }
  setMusicPlayerEnabled(enabled) {
    if (typeof enabled !== "boolean") {
      throw badRequest3("Christian radio must be true or false.");
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
    return APP_LANGUAGES.has(row?.preference_value) ? row.preference_value : DEFAULT_APP_LANGUAGE;
  }
  setAppLanguage(language) {
    const normalized = String(language || "").trim();
    if (!APP_LANGUAGES.has(normalized)) {
      throw badRequest3("app language must be system, en-US, or es-419.");
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
      updatedAt: new Date(now).toISOString()
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
      updatedAt: new Date(now).toISOString()
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
  #highlightRows(sessionId, version2, passage) {
    return this.database.prepare(`
      SELECT version_id, passage_id, color, sync_state, updated_at, synced_at,
        error, selection_json
      FROM user_highlights
      WHERE session_id = ? AND version_id = ?
        AND (passage_id = ? OR passage_id LIKE ?)
      ORDER BY passage_id ASC
    `).all(sessionId, version2, passage, `${passage}.%`);
  }
  #getHighlight(sessionId, version2, passage) {
    return this.database.prepare(`
      SELECT version_id, passage_id, color, sync_state, updated_at, synced_at,
        error, selection_json
      FROM user_highlights
      WHERE session_id = ? AND version_id = ? AND passage_id = ?
    `).get(sessionId, version2, passage);
  }
  #upsertHighlight({
    sessionId,
    version: version2,
    passage,
    color,
    syncState,
    now,
    syncedAt,
    error,
    selectionRanges = []
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
      version2,
      String(passage).toUpperCase(),
      normalizeColor(color),
      syncState,
      now,
      syncedAt,
      error,
      selectionRanges.length > 0 ? JSON.stringify(selectionRanges) : null
    );
  }
  #recordHighlightError(sessionId, version2, passage, error) {
    this.database.prepare(`
      UPDATE user_highlights SET error = ?, updated_at = ?
      WHERE session_id = ? AND version_id = ? AND passage_id = ?
    `).run(String(error?.message || error).slice(0, 500), Date.now(), sessionId, version2, passage);
  }
  #requireRemoteHighlights() {
    if (!this.highlightsClient) {
      throw new ServiceError("YouVersion highlight sync is unavailable.", {
        code: "APP_KEY_MISSING",
        status: 503
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
            "Light requires highlights permission. Sign in with the highlights permission.",
            { code: "HIGHLIGHTS_PERMISSION_REQUIRED", status: 403, cause: error }
          );
        }
        throw new ServiceError(`Light highlight request failed: ${error.message}`, {
          code: "HIGHLIGHTS_UPSTREAM_ERROR",
          status: 502,
          cause: error
        });
      }
    }
  }
  #transaction(callback) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      callback();
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
};
function highlightRecord(row) {
  return {
    version: Number(row.version_id),
    passage: row.passage_id,
    color: row.color,
    syncState: row.sync_state,
    updatedAt: new Date(row.updated_at).toISOString(),
    syncedAt: row.synced_at ? new Date(row.synced_at).toISOString() : null,
    error: row.error,
    selectionRanges: parseSelectionRanges(row.selection_json)
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
    syncState: "local_only"
  };
}
function contextPassage(value) {
  const passage = String(value || "").toUpperCase();
  if (!/^[A-Z0-9]{3}\.(?:INTRO|\d+)(?:\.\d+)?$/.test(passage)) {
    throw badRequest3("passage must be a chapter or single verse USFM reference.");
  }
  return passage;
}
function highlightPassage(value) {
  const passage = String(value || "").toUpperCase();
  if (!/^[A-Z0-9]{3}\.\d+\.\d+(?:-\d+)?$/.test(passage)) {
    throw badRequest3("highlight passage must be a verse or same-chapter verse range.");
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
  const color = String(value || "").replace(/^#/, "").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(color)) {
    throw badRequest3("highlight color must be a six-digit hex value.");
  }
  return color;
}
function normalizeHighlightOpacity(value) {
  const opacity = Number(value);
  if (!Number.isFinite(opacity) || opacity < MIN_HIGHLIGHT_OPACITY || opacity > MAX_HIGHLIGHT_OPACITY) {
    throw badRequest3(
      `highlight opacity must be from ${MIN_HIGHLIGHT_OPACITY} to ${MAX_HIGHLIGHT_OPACITY}.`
    );
  }
  return Math.round(opacity * 100) / 100;
}
function normalizeSelectionRanges(value, passageId) {
  if (value === void 0 || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_HIGHLIGHT_SELECTION_RANGES) {
    throw badRequest3(
      `selectionRanges must be an array with at most ${MAX_HIGHLIGHT_SELECTION_RANGES} items.`
    );
  }
  const passage = highlightPassage(passageId);
  const passageMatch = passage.match(/^([A-Z0-9]{3}\.\d+)\.(\d+)(?:-(\d+))?$/);
  const base = passageMatch[1];
  const firstVerse = Number(passageMatch[2]);
  const lastVerse = passageMatch[3] ? Number(passageMatch[3]) : firstVerse;
  const result = [];
  for (const item of value) {
    const rangePassage = String(item?.passage || "").toUpperCase();
    const rangeMatch = rangePassage.match(/^([A-Z0-9]{3}\.\d+)\.(\d+)$/);
    const start = Number(item?.start);
    const end = Number(item?.end);
    if (!rangeMatch || rangeMatch[1] !== base || Number(rangeMatch[2]) < firstVerse || Number(rangeMatch[2]) > lastVerse || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end > MAX_HIGHLIGHT_TEXT_OFFSET) {
      throw badRequest3("selectionRanges must contain valid offsets within the highlighted verses.");
    }
    result.push({ passage: rangePassage, start, end });
  }
  return result.sort((left, right) => left.passage.localeCompare(right.passage) || left.start - right.start);
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
    throw badRequest3(`app scale must be from ${MIN_APP_SCALE} to ${MAX_APP_SCALE}.`);
  }
  return Math.round(scale * 100) / 100;
}
function normalizeReaderTextScale(value) {
  const scale = Number(value);
  if (!Number.isFinite(scale) || scale < MIN_READER_TEXT_SCALE || scale > MAX_READER_TEXT_SCALE) {
    throw badRequest3(
      `reader text scale must be from ${MIN_READER_TEXT_SCALE} to ${MAX_READER_TEXT_SCALE}.`
    );
  }
  return Math.round(scale * 100) / 100;
}
function normalizeSecondaryBibleLanguages(value) {
  if (!Array.isArray(value)) {
    throw badRequest3("secondary Bible languages must be an array.");
  }
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of value) {
    const language = String(item || "").trim();
    if (!/^[a-z]{2,3}(?:-[A-Z][a-z]{3})?$/.test(language)) {
      throw badRequest3("secondary Bible languages must use BCP-47 language codes.");
    }
    if (seen.has(language)) continue;
    seen.add(language);
    result.push(language);
  }
  if (result.length > MAX_SECONDARY_BIBLE_LANGUAGES) {
    throw badRequest3(
      `no more than ${MAX_SECONDARY_BIBLE_LANGUAGES} secondary Bible languages may be selected.`
    );
  }
  return result;
}
function normalizeSettingsSectionOrder(value) {
  if (!Array.isArray(value)) {
    throw badRequest3("settings section order must be an array.");
  }
  const allowed = new Set(SETTINGS_SECTION_IDS);
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const raw of value) {
    const section = String(raw || "").trim();
    if (!allowed.has(section)) {
      throw badRequest3("settings section order contains an unknown section.");
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
  if (!value || typeof value !== "object" || !Array.isArray(value.tabs)) {
    throw badRequest3("reader tabs must include a tabs array.");
  }
  if (value.tabs.length > MAX_READER_TABS) {
    throw badRequest3(`no more than ${MAX_READER_TABS} reader tabs may be saved.`);
  }
  const tabs = [];
  for (const item of value.tabs) {
    if (item?.passage === "") {
      const version3 = item?.version === "" ? "" : positiveInteger5(item?.version, "reader tab version");
      tabs.push({ version: version3, passage: "" });
      continue;
    }
    const version2 = positiveInteger5(item?.version, "reader tab version");
    const passage = contextPassage(item?.passage);
    if (!/^[A-Z0-9]{3}\.\d+$/.test(passage)) {
      throw badRequest3("reader tabs must reference Bible chapters.");
    }
    const verse = String(item?.verse || "").trim();
    if (verse && !/^\d+(?:-\d+)?$/.test(verse)) {
      throw badRequest3("reader tab verses must be a verse number or range.");
    }
    const tab = verse ? { version: version2, passage, verse } : { version: version2, passage };
    if (item?.scrollY !== void 0) {
      if (typeof item.scrollY !== "number" || !Number.isFinite(item.scrollY) || item.scrollY < 0 || !Number.isSafeInteger(Math.round(item.scrollY))) {
        throw badRequest3("reader tab scroll position must be a non-negative number.");
      }
      tab.scrollY = Math.round(item.scrollY);
    }
    tabs.push(tab);
  }
  const requestedIndex = Number(value.activeTabIndex);
  const activeTabIndex = Number.isSafeInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < tabs.length ? requestedIndex : tabs.length > 0 ? 0 : -1;
  return { tabs, activeTabIndex };
}
function normalizeCustomRadioStations(value) {
  if (!Array.isArray(value)) {
    throw badRequest3("custom radio stations must be an array.");
  }
  const result = [];
  const seenUrls = /* @__PURE__ */ new Set();
  for (const station of value) {
    const name = String(station?.name || "").trim();
    const streamUrl = String(station?.streamUrl || "").trim();
    if (!name || name.length > MAX_RADIO_STATION_NAME_LENGTH) {
      throw badRequest3(`radio station names must be 1-${MAX_RADIO_STATION_NAME_LENGTH} characters.`);
    }
    if (!streamUrl || streamUrl.length > MAX_RADIO_STREAM_URL_LENGTH) {
      throw badRequest3("radio stream URL is missing or too long.");
    }
    let parsed;
    try {
      parsed = new URL(streamUrl);
    } catch {
      throw badRequest3("radio stream URL must be a valid http or https URL.");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw badRequest3("radio stream URL must use http or https.");
    }
    parsed.hash = "";
    const normalizedUrl = parsed.href;
    const key = normalizedUrl.toLowerCase();
    if (seenUrls.has(key)) {
      throw badRequest3("radio station stream URLs must be unique.");
    }
    seenUrls.add(key);
    const description = String(station?.description || "Custom station").trim() || "Custom station";
    if (description.length > MAX_RADIO_STATION_DESCRIPTION_LENGTH) {
      throw badRequest3(
        `radio station descriptions must be no more than ${MAX_RADIO_STATION_DESCRIPTION_LENGTH} characters.`
      );
    }
    result.push({
      name,
      description,
      streamUrl: normalizedUrl,
      siteUrl: "",
      custom: true
    });
  }
  return result;
}
function normalizeHiddenRadioStationIds(value) {
  if (!Array.isArray(value)) {
    throw badRequest3("hidden radio station IDs must be an array.");
  }
  if (value.length > MAX_HIDDEN_RADIO_STATIONS) {
    throw badRequest3(`no more than ${MAX_HIDDEN_RADIO_STATIONS} radio stations may be hidden.`);
  }
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of value) {
    const stationId = String(item || "").trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(stationId)) {
      throw badRequest3("hidden radio station IDs may contain lowercase letters, numbers, and hyphens.");
    }
    if (seen.has(stationId)) continue;
    seen.add(stationId);
    result.push(stationId);
  }
  return result;
}
function normalizeRadioStationOrder(value) {
  if (!Array.isArray(value)) {
    throw badRequest3("radio station order must be an array.");
  }
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of value) {
    const stationKey = String(item || "").trim().toLowerCase();
    const builtInKey = /^builtin:[a-z0-9][a-z0-9-]{0,63}$/.test(stationKey);
    const customKey = /^custom:https?:\/\/\S{1,512}$/.test(stationKey);
    if (!builtInKey && !customKey) {
      throw badRequest3("radio station order contains an invalid station key.");
    }
    if (seen.has(stationKey)) continue;
    seen.add(stationKey);
    result.push(stationKey);
  }
  return result;
}
function shortcutIdentity(value) {
  const pieces = value.toLowerCase().split("+");
  let key = pieces.pop();
  if (key === "") {
    key = "+";
    pieces.pop();
  }
  const modifiers = new Set(pieces.map((part) => part === "super" ? "meta" : part));
  key = { enter: "return", comma: ",", period: ".", plus: "+", minus: "-", equal: "=" }[key] || key;
  if (key === "+" || key === "=" && modifiers.has("shift")) {
    key = "+";
    modifiers.delete("shift");
  }
  return [...modifiers].sort().join("+") + ":" + key;
}
function normalizeKeybindings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest3("keybindings must be an object.");
  }
  const result = {};
  const seen = /* @__PURE__ */ new Map();
  for (const [name, fallback] of Object.entries(DEFAULT_KEYBINDINGS)) {
    const shortcut = String(value[name] ?? fallback).trim();
    const modified = /^(?:Ctrl|Alt|Shift|Meta|Super)(?:\+(?:Ctrl|Alt|Shift|Meta|Super))*\+(?:[A-Za-z0-9]+|[+=-])$/i.test(shortcut);
    const unmodified = /^(?:[A-Za-z0-9]+|[+=-])$/.test(shortcut);
    if (!modified && !unmodified) {
      throw badRequest3(`keybinding ${name} must contain a supported key.`);
    }
    const key = shortcutIdentity(shortcut);
    if (seen.has(key)) throw new ServiceError(`${shortcut} is already assigned to ${seen.get(key)} in Light.`, { code: "KEYBINDING_CONFLICT", status: 409 });
    seen.set(key, name);
    result[name] = shortcut;
  }
  return result;
}
function positiveInteger5(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw badRequest3(`${name} must be a positive integer.`);
  }
  return parsed;
}
function publicError(error) {
  return {
    code: error instanceof ServiceError ? error.code : "SYNC_FAILED",
    message: error.message
  };
}
function badRequest3(message) {
  return new ServiceError(message, { code: "BAD_REQUEST", status: 400 });
}

// service/src/study-data.js
var fail = (message) => {
  throw new ServiceError(message, { code: "BAD_REQUEST", status: 400 });
};
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
  const version2 = Number(value?.version);
  const passage = String(value?.passage || "").toUpperCase();
  if (!Number.isSafeInteger(version2) || version2 < 1 || !/^[A-Z0-9]{3}\.\d+(?:\.\d+(?:-\d+)?)?$/.test(passage)) fail("Invalid passage reference.");
  return {
    version: version2,
    passage,
    label: String(value.label || passage).slice(0, 200),
    preview: String(value.preview || "").slice(0, 500)
  };
}
var StudyData = class {
  constructor(userData) {
    this.userData = userData;
    this.db = userData.database;
    this.db.exec(`CREATE TABLE IF NOT EXISTS light_study_state (
      key TEXT PRIMARY KEY, value TEXT NOT NULL
    )`);
  }
  read(key, fallback) {
    const row = this.db.prepare("SELECT value FROM light_study_state WHERE key = ?").get(key);
    return row ? JSON.parse(row.value) : fallback;
  }
  write(key, value) {
    this.db.prepare("INSERT INTO light_study_state VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, JSON.stringify(value));
    return value;
  }
  importRadio(data) {
    if (data?.format !== "light-radio" || data.version !== 1) fail("Not a supported radio collection.");
    const incoming = normalizeCustomRadioStations(data.stations);
    const stations = this.userData.getCustomRadioStations();
    const seen = new Set(stations.map((station) => station.streamUrl.toLowerCase()));
    for (const station of incoming) {
      const key = station.streamUrl.toLowerCase();
      if (!seen.has(key)) {
        stations.push(station);
        seen.add(key);
      }
    }
    return this.userData.setCustomRadioStations(stations);
  }
  options() {
    const stored = this.read("options", {});
    return {
      resumeReading: stored.resumeReading !== false,
      autoOpenReferences: stored.autoOpenReferences === true,
      nightMode: stored.nightMode === true,
      textBrightness: Number.isFinite(stored.textBrightness) ? Math.max(0.2, Math.min(1, stored.textBrightness)) : 1,
      favoriteStations: Array.isArray(stored.favoriteStations) ? stored.favoriteStations : [],
      radioSkin: Number.isSafeInteger(stored.radioSkin) && stored.radioSkin >= 1 && stored.radioSkin <= 7 ? stored.radioSkin : 1,
      radioSkinOrder: normalizeRadioSkinOrder(stored.radioSkinOrder)
    };
  }
  setOptions(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) fail("Invalid reading options.");
    const next = { ...this.options() };
    if ("textBrightness" in value) {
      if (typeof value.textBrightness !== "number" || !Number.isFinite(value.textBrightness) || value.textBrightness < 0.2 || value.textBrightness > 1)
        fail("Text brightness must be between 20% and 100%.");
      next.textBrightness = Math.round(value.textBrightness * 100) / 100;
    }
    if ("nightMode" in value) {
      if (typeof value.nightMode !== "boolean") fail("Night mode must be a boolean.");
      next.nightMode = value.nightMode;
    }
    if ("autoOpenReferences" in value) {
      if (typeof value.autoOpenReferences !== "boolean") fail("Automatic reference opening must be a boolean.");
      next.autoOpenReferences = value.autoOpenReferences;
    }
    if ("resumeReading" in value) {
      if (typeof value.resumeReading !== "boolean") fail("Compacted search must be a boolean.");
      next.resumeReading = value.resumeReading;
    }
    if ("favoriteStations" in value) {
      if (!Array.isArray(value.favoriteStations) || value.favoriteStations.some(
        (key) => typeof key !== "string" || !/^(?:builtin:[a-z0-9-]+|custom:https?:\/\/\S{1,512})$/.test(key)
      )) fail("Invalid favorite stations.");
      next.favoriteStations = [...new Set(value.favoriteStations)];
    }
    if ("radioSkin" in value) {
      if (!Number.isSafeInteger(value.radioSkin) || value.radioSkin < 1 || value.radioSkin > 7)
        fail("Radio skin must be an integer from 1 through 7.");
      next.radioSkin = value.radioSkin;
    }
    if ("radioSkinOrder" in value) {
      if (!Array.isArray(value.radioSkinOrder) || value.radioSkinOrder.length !== 7 || new Set(value.radioSkinOrder).size !== 7 || value.radioSkinOrder.some((skin) => !Number.isSafeInteger(skin) || skin < 1 || skin > 7))
        fail("Radio skin order must contain each skin once.");
      next.radioSkinOrder = normalizeRadioSkinOrder(value.radioSkinOrder);
    }
    return this.write("options", next);
  }
  visit(value) {
    const item = reference(value);
    return this.write("history", [item, ...this.read("history", []).filter(
      (old) => old.version !== item.version || old.passage !== item.passage
    )].slice(0, 50));
  }
  bookmark(value) {
    const item = reference(value);
    const items = this.read("bookmarks", []);
    const rest = items.filter((old) => old.version !== item.version || old.passage !== item.passage);
    if (value.remove !== true) rest.unshift(item);
    return this.write("bookmarks", rest);
  }
  library() {
    const session = this.userData.authentication.getSessionId();
    return { history: this.read("history", []), entries: [
      ...this.read("bookmarks", []).map((item) => ({ ...item, kind: "bookmark" })),
      ...this.db.prepare("SELECT * FROM user_notes ORDER BY updated_at DESC").all().map((row) => ({
        kind: "note",
        id: row.id,
        version: row.version_id,
        passage: row.passage_id,
        label: row.passage_id,
        preview: row.body,
        updatedAt: row.updated_at
      })),
      ...this.db.prepare("SELECT * FROM user_highlights WHERE session_id = ? AND sync_state != 'pending_delete' ORDER BY updated_at DESC").all(session).map((row) => ({
        kind: "highlight",
        version: row.version_id,
        passage: row.passage_id,
        label: row.passage_id,
        preview: "",
        color: row.color,
        updatedAt: row.updated_at
      }))
    ] };
  }
  async libraryWithPreviews(service) {
    const library = this.library();
    if (!service?.passage) return library;
    const previews = /* @__PURE__ */ new Map();
    const expandedHighlightKeys = new Set(library.entries.filter((item) => item.kind === "highlight").slice(0, 7).map((item) => item.version + ":" + item.passage));
    for (const item of [...library.entries, ...library.history]) {
      if (item.preview) continue;
      const key = item.version + ":" + item.passage;
      if (item.kind === "highlight" && !expandedHighlightKeys.has(key)) continue;
      if (!previews.has(key)) {
        try {
          const fullHighlight = expandedHighlightKeys.has(key);
          const result = await service.passage(item.version, item.passage, {
            mode: fullHighlight ? "auto" : "offline",
            format: fullHighlight ? "html" : "text"
          });
          const text = String(result?.data?.content || "");
          previews.set(key, {
            // The Library shows the seven newest highlights in full, so do
            // not discard the saved passage text before the interface sees it.
            preview: fullHighlight ? text : text.slice(0, 500),
            previewFormat: fullHighlight ? "html" : "text",
            fullPreview: fullHighlight,
            label: String(result?.data?.reference || item.label)
          });
        } catch {
          previews.set(key, null);
        }
      }
      Object.assign(item, previews.get(key) || {});
    }
    return library;
  }
  exportBackup() {
    return {
      format: "light-backup",
      version: 2,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      bookmarks: this.read("bookmarks", []),
      history: this.read("history", []),
      notes: this.db.prepare("SELECT id, version_id AS version, passage_id AS passage, body FROM user_notes").all()
    };
  }
  restoreBackup(data) {
    const allowed = /* @__PURE__ */ new Set(["format", "version", "createdAt", "bookmarks", "history", "notes"]);
    if (data?.format !== "light-backup" || data.version !== 2 || !Array.isArray(data.notes) || !Array.isArray(data.bookmarks) || !Array.isArray(data.history) || Object.keys(data).some((key) => !allowed.has(key)))
      fail("Not a supported Light backup.");
    this.db.exec("BEGIN");
    try {
      for (const item of data.bookmarks) this.bookmark(item);
      for (const item of [...data.history].reverse()) this.visit(item);
      for (const note of data.notes) {
        const item = reference(note);
        if (typeof note.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(note.id) || typeof note.body !== "string" || !note.body.trim() || note.body.length > 1e4)
          fail("Invalid note in backup.");
        const old = this.db.prepare("SELECT body, version_id, passage_id FROM user_notes WHERE id = ?").get(note.id);
        if (old && (old.body !== note.body || old.version_id !== item.version || old.passage_id !== item.passage)) fail("A local note conflicts with this backup. No changes were restored.");
        const now = Date.now();
        this.db.prepare("INSERT OR IGNORE INTO user_notes VALUES (?, ?, ?, ?, ?, ?)").run(note.id, item.version, item.passage, note.body, now, now);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return { restored: true };
  }
};

// service/src/keybinding-conflicts.js
import { execFileSync as execFileSync3 } from "node:child_process";
function activeSystemBindings() {
  try {
    return JSON.parse(execFileSync3("hyprctl", ["binds", "-j"], { encoding: "utf8" }));
  } catch (error) {
    throw new ServiceError("Could not check Omarchy shortcuts. Try again when the desktop is available.", {
      code: "KEYBINDING_CHECK_FAILED",
      status: 503,
      cause: error
    });
  }
}
function chord(value) {
  const pieces = String(value).split("+").filter(Boolean);
  const key = String(value).endsWith("++") ? "+" : pieces.pop();
  const modifiers = new Set(pieces.map((piece) => piece.toLowerCase()));
  const mask = (modifiers.has("shift") ? 1 : 0) | (modifiers.has("ctrl") ? 4 : 0) | (modifiers.has("alt") ? 8 : 0) | (modifiers.has("super") || modifiers.has("meta") ? 64 : 0);
  return { key: String(key).toLowerCase(), mask };
}
function systemKey(key) {
  const aliases2 = {
    escape: "escape",
    esc: "escape",
    return: "enter",
    kp_enter: "enter",
    space: "space",
    plus: "+",
    minus: "-",
    equal: "=",
    backspace: "backspace"
  };
  const lower = String(key).toLowerCase();
  return aliases2[lower] || lower;
}
function checkSystemKeybindingConflicts(bindings, previous, systemBindings) {
  for (const [name, shortcut] of Object.entries(bindings)) {
    if (shortcut === previous[name]) continue;
    const candidate = chord(shortcut);
    const conflict = systemBindings.find((binding) => {
      if (binding.mouse || binding.submap && binding.submap !== "reset") return false;
      const key = systemKey(binding.key);
      const systemMask = Number(binding.modmask);
      const matchingKey = key === candidate.key || candidate.key === "+" && key === "=" && Boolean(systemMask & 1);
      const matchingModifiers = systemMask === candidate.mask || candidate.key === "+" && (systemMask ^ candidate.mask) === 1;
      return matchingKey && matchingModifiers;
    });
    if (conflict) {
      throw new ServiceError(`${shortcut} is already used by Omarchy${conflict.description ? `: ${conflict.description}` : "."}`, {
        code: "KEYBINDING_CONFLICT",
        status: 409
      });
    }
  }
}

// service/src/http-server.js
function shortcutsUnavailable() {
  throw new ServiceError("Global shortcuts require Light to be enabled in an Omarchy session.", {
    code: "KEYBINDINGS_UNAVAILABLE",
    status: 503
  });
}
var MAX_BODY_BYTES = 1024 * 1024;
function createHttpServer({
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
  clientToken = randomBytes(32).toString("hex")
}) {
  const study = userData?.database ? new StudyData(userData) : null;
  return createServer(async (request, response2) => {
    response2.setHeader("content-type", "application/json; charset=utf-8");
    response2.setHeader("cache-control", "no-store");
    try {
      const host = new URL(`http://${request.headers.host || ""}`);
      if (!["127.0.0.1", "localhost", "[::1]"].includes(host.hostname) || host.username || host.password || host.pathname !== "/") {
        throw new ServiceError("Only loopback hosts are allowed.", { code: "FORBIDDEN", status: 403 });
      }
      if (request.headers.origin !== void 0 || request.headers["sec-fetch-site"] !== void 0) {
        throw new ServiceError("Browser requests are not allowed.", { code: "FORBIDDEN", status: 403 });
      }
      const credential = Buffer.from(request.headers.authorization || "");
      const expected = Buffer.from(`Bearer ${clientToken}`);
      if (credential.length !== expected.length || !timingSafeEqual(credential, expected)) {
        throw new ServiceError("Local client authentication required.", {
          code: "CLIENT_AUTHENTICATION_REQUIRED",
          status: 401
        });
      }
      const url2 = new URL(request.url, "http://localhost");
      const query = url2.searchParams;
      const route = `${request.method} ${url2.pathname}`;
      let result;
      let status = 200;
      if (requireAccount && !availableWithoutAccount(url2.pathname)) {
        if (!authentication?.getAccessToken)
          throw new ServiceError("Sign in with YouVersion to use Light.", {
            code: "AUTHENTICATION_REQUIRED",
            status: 401
          });
        await authentication.getAccessToken();
      }
      switch (route) {
        case "GET /health":
          result = {
            ok: true,
            onlineConfigured: service.onlineConfigured,
            authentication: authentication.status(),
            ...authentication.status().authenticated ? {
              cache: cache.stats(),
              downloads: downloadManager.listPackages()
            } : {}
          };
          break;
        case "GET /v1/versions":
          result = await service.versions(query.get("language") || "*", {
            mode: query.get("mode") || "auto"
          });
          break;
        case "GET /v1/languages":
          result = await service.languages(query.get("locale") || "en-US", {
            mode: query.get("mode") || "auto"
          });
          break;
        case "GET /v1/books":
          result = await service.books(required2(query, "version"), {
            mode: query.get("mode") || "auto"
          });
          break;
        case "GET /v1/chapters":
          result = await service.chapters(
            required2(query, "version"),
            required2(query, "book"),
            { mode: query.get("mode") || "auto" }
          );
          break;
        case "GET /v1/search-previews": {
          let entries;
          try {
            entries = JSON.parse(query.get("verses") || "[]");
          } catch {
            throw new ServiceError("Invalid preview list.", { code: "BAD_REQUEST", status: 400 });
          }
          result = await service.searchPreviews(entries);
          break;
        }
        case "GET /v1/search":
          if (query.get("source") === "download") {
            result = service.searchDownloaded(required2(query, "version"), query.get("query"), query.get("page_token") || "");
          } else {
            result = await service.search(required2(query, "version"), query.get("query"), query.get("page_token") || "");
          }
          break;
        case "GET /v1/passage":
          result = await service.passage(
            required2(query, "version"),
            required2(query, "usfm"),
            {
              mode: query.get("mode") || "auto",
              format: query.get("format") || "text",
              includeHeadings: query.get("include_headings") || false,
              includeNotes: query.get("include_notes") || false
            }
          );
          break;
        case "GET /v1/recent-passage":
          result = service.recentPassage();
          break;
        case "GET /v1/verse-of-the-day":
          result = await service.verseOfTheDay(required2(query, "version"), {
            mode: query.get("mode") || "auto"
          });
          break;
        case "GET /v1/auth/status":
          if (authentication.status().authenticated) {
            try {
              await authentication.getAccessToken();
            } catch {
            }
          }
          result = { ...authentication.status(), ...oauth.status() };
          break;
        case "POST /v1/auth/start": {
          const body = await readJsonBody(request);
          result = await oauth.start({
            scopes: body.scopes || ["profile", "email"],
            permissions: body.permissions || ["highlights"],
            open: body.open !== false
          });
          break;
        }
        case "POST /v1/auth/refresh":
          await authentication.refresh();
          result = authentication.status();
          break;
        case "POST /v1/auth/logout":
          result = authentication.signOut();
          break;
        case "GET /v1/downloads":
          result = { packages: downloadManager.listPackages() };
          break;
        case "POST /v1/downloads": {
          const body = await readJsonBody(request);
          result = downloadManager.queuePackage(body.version, {
            format: body.format || "text",
            includeHeadings: body.includeHeadings || false,
            includeNotes: body.includeNotes || false,
            refresh: body.refresh || false
          });
          status = 202;
          break;
        }
        case "GET /v1/study/options":
          result = study.options();
          break;
        case "PUT /v1/study/options":
          result = study.setOptions(await readJsonBody(request, Infinity));
          break;
        case "GET /v1/study/library":
          result = await study.libraryWithPreviews(service);
          break;
        case "POST /v1/study/history":
          result = study.visit(await readJsonBody(request));
          break;
        case "POST /v1/study/bookmarks":
          result = study.bookmark(await readJsonBody(request));
          break;
        case "POST /v1/study/radio-import":
          result = study.importRadio(await readJsonBody(request, Infinity));
          break;
        case "GET /v1/study/backup":
          result = study.exportBackup();
          break;
        case "POST /v1/study/restore":
          result = study.restoreBackup(await readJsonBody(request, Infinity));
          break;
        case "GET /v1/user-data":
          result = await userData.getContext(
            required2(query, "version"),
            required2(query, "passage"),
            { refresh: queryBoolean(query, "refresh") }
          );
          break;
        case "GET /v1/user-data/highlights":
          result = {
            highlights: await userData.getHighlights(
              required2(query, "version"),
              required2(query, "passage"),
              { refresh: queryBoolean(query, "refresh") }
            )
          };
          break;
        case "POST /v1/user-data/highlights": {
          const body = await readJsonBody(request);
          result = await userData.createHighlight({
            versionId: body.version,
            passageId: body.passage,
            color: body.color,
            selectionRanges: body.selectionRanges
          });
          status = result.queued ? 202 : 201;
          break;
        }
        case "DELETE /v1/user-data/highlights":
          result = await userData.deleteHighlight({
            versionId: required2(query, "version"),
            passageId: required2(query, "passage")
          });
          status = result.queued ? 202 : 200;
          break;
        case "POST /v1/user-data/sync": {
          const body = await readJsonBody(request);
          result = await userData.syncHighlights(body.version, body.passage);
          break;
        }
        case "GET /v1/user-data/notes":
          result = {
            notes: userData.getNotes(
              required2(query, "version"),
              required2(query, "passage")
            ),
            remoteSyncSupported: false
          };
          break;
        case "POST /v1/user-data/notes": {
          const body = await readJsonBody(request);
          result = userData.createNote({
            versionId: body.version,
            passageId: body.passage,
            body: body.body
          });
          status = 201;
          break;
        }
        case "GET /v1/user-data/preferences/highlight-color":
          result = { defaultHighlightColor: userData.getDefaultHighlightColor() };
          break;
        case "PUT /v1/user-data/preferences/highlight-color": {
          const body = await readJsonBody(request);
          result = userData.setDefaultHighlightColor(body.color);
          break;
        }
        case "GET /v1/user-data/preferences/highlight-opacity":
          result = { defaultHighlightOpacity: userData.getDefaultHighlightOpacity() };
          break;
        case "PUT /v1/user-data/preferences/highlight-opacity": {
          const body = await readJsonBody(request);
          result = userData.setDefaultHighlightOpacity(body.opacity);
          break;
        }
        case "GET /v1/user-data/preferences/app-scale":
          result = { appScale: userData.getAppScale() };
          break;
        case "PUT /v1/user-data/preferences/app-scale": {
          const body = await readJsonBody(request);
          result = userData.setAppScale(body.scale);
          break;
        }
        case "GET /v1/user-data/preferences/reader-text-scale":
          result = { readerTextScale: userData.getReaderTextScale() };
          break;
        case "PUT /v1/user-data/preferences/reader-text-scale": {
          const body = await readJsonBody(request);
          result = userData.setReaderTextScale(body.scale);
          break;
        }
        case "GET /v1/user-data/preferences/reader-font-style":
          result = { readerFontStyle: userData.getReaderFontStyle() };
          break;
        case "PUT /v1/user-data/preferences/reader-font-style": {
          const body = await readJsonBody(request);
          result = userData.setReaderFontStyle(body.style);
          break;
        }
        case "GET /v1/user-data/preferences/red-letters":
          result = { redLetters: userData.getRedLetters() };
          break;
        case "PUT /v1/user-data/preferences/red-letters": {
          const body = await readJsonBody(request);
          result = userData.setRedLetters(body.enabled);
          break;
        }
        case "GET /v1/user-data/preferences/verse-of-the-day":
          result = { verseOfTheDayEnabled: userData.getVerseOfTheDayEnabled() };
          break;
        case "PUT /v1/user-data/preferences/verse-of-the-day": {
          const body = await readJsonBody(request);
          result = userData.setVerseOfTheDayEnabled(body.enabled);
          break;
        }
        case "GET /v1/user-data/preferences/music-player":
          result = { musicPlayerEnabled: userData.getMusicPlayerEnabled() };
          break;
        case "PUT /v1/user-data/preferences/music-player": {
          const body = await readJsonBody(request);
          result = userData.setMusicPlayerEnabled(body.enabled);
          break;
        }
        case "GET /v1/user-data/preferences/custom-radio-stations":
          result = { customRadioStations: userData.getCustomRadioStations() };
          break;
        case "PUT /v1/user-data/preferences/custom-radio-stations": {
          const body = await readJsonBody(request, Infinity);
          result = userData.setCustomRadioStations(body.stations);
          break;
        }
        case "GET /v1/user-data/preferences/hidden-radio-stations":
          result = { hiddenRadioStationIds: userData.getHiddenRadioStationIds() };
          break;
        case "PUT /v1/user-data/preferences/hidden-radio-stations": {
          const body = await readJsonBody(request);
          result = userData.setHiddenRadioStationIds(body.stationIds);
          break;
        }
        case "GET /v1/user-data/preferences/radio-station-order":
          result = { radioStationOrder: userData.getRadioStationOrder() };
          break;
        case "PUT /v1/user-data/preferences/radio-station-order": {
          const body = await readJsonBody(request, Infinity);
          result = userData.setRadioStationOrder(body.stationKeys);
          break;
        }
        case "GET /v1/user-data/preferences/settings-section-order":
          result = { settingsSectionOrder: userData.getSettingsSectionOrder() };
          break;
        case "PUT /v1/user-data/preferences/settings-section-order": {
          const body = await readJsonBody(request);
          result = userData.setSettingsSectionOrder(body.sectionIds);
          break;
        }
        case "GET /v1/user-data/preferences/app-language":
          result = { appLanguage: userData.getAppLanguage() };
          break;
        case "PUT /v1/user-data/preferences/app-language": {
          const body = await readJsonBody(request);
          result = userData.setAppLanguage(body.language);
          break;
        }
        case "GET /v1/user-data/preferences/secondary-bible-languages":
          result = { secondaryBibleLanguages: userData.getSecondaryBibleLanguages() };
          break;
        case "PUT /v1/user-data/preferences/secondary-bible-languages": {
          const body = await readJsonBody(request);
          result = userData.setSecondaryBibleLanguages(body.languages);
          break;
        }
        case "GET /v1/user-data/preferences/reader-tabs":
          result = userData.getReaderTabs();
          break;
        case "PUT /v1/user-data/preferences/reader-tabs": {
          const body = await readJsonBody(request);
          result = userData.setReaderTabs(body);
          break;
        }
        case "GET /v1/user-data/preferences/keybindings":
          result = { keybindings: userData.getKeybindings() };
          break;
        case "PUT /v1/user-data/preferences/keybindings": {
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
              try {
                applyGlobalHotkey(previous.globalToggle);
              } catch {
              }
            }
            throw error;
          }
          result = userData.setKeybindings(bindings);
          break;
        }
        default:
          result = await dynamicRoute(
            request.method,
            url2.pathname,
            downloadManager,
            userData
          );
          if (result && (result.queued || result.status === "queued")) status = 202;
      }
      response2.statusCode = status;
      response2.end(JSON.stringify(result));
    } catch (error) {
      const known = error instanceof ServiceError;
      response2.statusCode = known ? error.status : 500;
      response2.end(JSON.stringify({
        error: {
          code: known ? error.code : "INTERNAL_ERROR",
          message: known ? error.message : "Internal service error."
        }
      }));
    }
  });
}
function availableWithoutAccount(pathname) {
  return pathname === "/health" || pathname.startsWith("/v1/auth/") || pathname === "/v1/study/options" || pathname === "/v1/study/radio-import" || pathname.startsWith("/v1/user-data/preferences/") && pathname !== "/v1/user-data/preferences/reader-tabs";
}
async function dynamicRoute(method, pathname, downloadManager, userData) {
  const resumeMatch = pathname.match(/^\/v1\/downloads\/(\d+)\/resume$/);
  if (resumeMatch && method === "POST") {
    return downloadManager.queueResume(resumeMatch[1]);
  }
  const updateMatch = pathname.match(/^\/v1\/downloads\/(\d+)\/update$/);
  if (updateMatch && method === "GET") {
    return downloadManager.checkForUpdate(updateMatch[1]);
  }
  const match = pathname.match(/^\/v1\/downloads\/(\d+)$/);
  if (match && method === "GET") {
    const download = downloadManager.getPackage(match[1]);
    if (!download) {
      throw new ServiceError("Translation package not found.", {
        code: "DOWNLOAD_NOT_FOUND",
        status: 404
      });
    }
    return download;
  }
  if (match && method === "DELETE") return downloadManager.removePackage(match[1]);
  const noteMatch = pathname.match(/^\/v1\/user-data\/notes\/([0-9a-f-]+)$/i);
  if (noteMatch && method === "DELETE") return userData.deleteNote(noteMatch[1]);
  throw new ServiceError("Endpoint not found.", {
    code: "NOT_FOUND",
    status: 404
  });
}
function queryBoolean(query, name) {
  const value = query.get(name);
  if (value === null) return false;
  if (["true", "1"].includes(value)) return true;
  if (["false", "0"].includes(value)) return false;
  throw new ServiceError(`${name} must be true or false.`, {
    code: "BAD_REQUEST",
    status: 400
  });
}
async function readJsonBody(request, maxBytes = MAX_BODY_BYTES) {
  const declaredLength = Number(request.headers["content-length"]);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ServiceError("Request body is too large.", {
      code: "BODY_TOO_LARGE",
      status: 413
    });
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      throw new ServiceError("Request body is too large.", {
        code: "BODY_TOO_LARGE",
        status: 413
      });
    }
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ServiceError("Request body must be valid JSON.", {
      code: "BAD_REQUEST",
      status: 400
    });
  }
}
function required2(query, name) {
  const value = query.get(name);
  if (!value) {
    throw new ServiceError(`Missing query parameter: ${name}`, {
      code: "BAD_REQUEST",
      status: 400
    });
  }
  return value;
}

// service/src/oauth.js
import { createHash as createHash2, createPublicKey, randomBytes as randomBytes2, randomUUID as randomUUID3, timingSafeEqual as timingSafeEqual2, verify } from "node:crypto";
import { spawn } from "node:child_process";
var PENDING_AUTH_LIFETIME_MS = 10 * 60 * 1e3;
var ALLOWED_SCOPES = /* @__PURE__ */ new Set(["profile", "email"]);
var ALLOWED_PERMISSIONS = /* @__PURE__ */ new Set(["highlights"]);
var OAuthManager = class {
  constructor({
    tokenStore,
    appKey = YOUVERSION_APPLICATION_KEY,
    env = process.env,
    fetchImplementation = globalThis.fetch,
    openUrl = openExternalUrl,
    prepareCallback = () => {
    }
  }) {
    this.tokenStore = tokenStore;
    this.appKey = appKey;
    this.env = env;
    this.fetch = fetchImplementation;
    this.openUrl = openUrl;
    this.prepareCallback = prepareCallback;
  }
  async start({ scopes = ["profile", "email"], permissions = [], open = true } = {}) {
    const appKey = this.appKey;
    if (!appKey) {
      throw oauthError("YouVersion sign-in is unavailable.", "APP_KEY_MISSING");
    }
    const redirectUri = normalizeRedirectUri(
      this.env.YVP_REDIRECT_URI || YOUVERSION_REDIRECT_URI
    );
    const apiHost = validateApiHost(this.env.YVP_API_HOST || "api.youversion.com");
    const selectedScopes = validateList(scopes, ALLOWED_SCOPES, "scope");
    const selectedPermissions = validateList(
      permissions,
      ALLOWED_PERMISSIONS,
      "permission"
    );
    const existing = this.tokenStore.loadPendingAuth();
    if (existing && !existing.error && Date.parse(existing.expiresAt) > Date.now() && existing.authorizationUrl && existing.appKey === appKey && existing.apiHost === apiHost && existing.redirectUri === redirectUri && JSON.stringify(existing.requestedScopes) === JSON.stringify(selectedScopes) && JSON.stringify(existing.requestedPermissions) === JSON.stringify(selectedPermissions)) {
      await this.prepareCallback();
      if (open) await this.openPendingAuthorization(existing);
      return {
        stage: "authorization-started",
        redirectUri,
        authorizationUrl: existing.continuationUrl || existing.authorizationUrl,
        openedBrowser: open,
        expiresAt: existing.expiresAt
      };
    }
    await this.prepareCallback();
    const state = randomUrlSafe(24);
    const nonce = randomUrlSafe(24);
    const codeVerifier = randomUrlSafe(48);
    const codeChallenge = createHash2("sha256").update(codeVerifier).digest("base64url");
    const expiresAt = new Date(Date.now() + PENDING_AUTH_LIFETIME_MS).toISOString();
    const pending = {
      version: 1,
      appKey,
      apiHost,
      redirectUri,
      state,
      nonce,
      codeVerifier,
      requestedScopes: selectedScopes,
      requestedPermissions: selectedPermissions,
      grantedPermissions: [],
      sessionId: typeof this.tokenStore.getLocalSessionId === "function" ? this.tokenStore.getLocalSessionId() : randomUUID3(),
      expiresAt
    };
    const authorizationUrl = new URL(`https://${apiHost}/auth/authorize`);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("require_user_interaction", "true");
    authorizationUrl.searchParams.set("client_id", appKey);
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set(
      "scope",
      ["openid", ...selectedScopes].sort().join(" ")
    );
    authorizationUrl.searchParams.set("nonce", nonce);
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("code_challenge", codeChallenge);
    authorizationUrl.searchParams.set("code_challenge_method", "S256");
    for (const permission of selectedPermissions.sort()) {
      authorizationUrl.searchParams.append("requested_permissions[]", permission);
    }
    pending.authorizationUrl = authorizationUrl.toString();
    this.tokenStore.savePendingAuth(pending);
    if (open) await this.openPendingAuthorization(pending);
    return {
      stage: "authorization-started",
      redirectUri,
      authorizationUrl: authorizationUrl.toString(),
      openedBrowser: open,
      expiresAt
    };
  }
  async openPendingAuthorization(pending) {
    try {
      await this.openUrl(pending.continuationUrl || pending.authorizationUrl);
    } catch {
      const current = this.tokenStore.loadPendingAuth();
      if (current && safeEqual(current.state, pending.state)) {
        this.tokenStore.savePendingAuth({ ...current, error: {
          code: "BROWSER_OPEN_FAILED",
          message: "Unable to open the browser. Try sign-in again."
        } });
      }
      throw oauthError("Unable to open the browser. Try sign-in again.", "BROWSER_OPEN_FAILED", 502);
    }
  }
  async handleCallback(callbackUri, { open = true } = {}) {
    try {
      return await this.completeCallback(callbackUri, { open });
    } catch (error) {
      const pending = this.tokenStore.loadPendingAuth();
      let callback;
      try {
        callback = new URL(callbackUri);
      } catch {
      }
      if (pending && !pending.error && callback && safeEqual(callback.searchParams.get("state"), pending.state) && callbackOrigin(callback) === callbackOrigin(new URL(pending.redirectUri))) {
        this.tokenStore.savePendingAuth({ ...pending, error: {
          code: error instanceof ServiceError ? error.code : "OAUTH_NETWORK_FAILED",
          ...error.details ? { details: error.details } : {},
          message: error instanceof ServiceError ? error.message : "Unable to complete YouVersion sign-in. Check your connection and try again."
        } });
      }
      throw error;
    }
  }
  async completeCallback(callbackUri, { open = true } = {}) {
    const pending = this.tokenStore.loadPendingAuth();
    if (!pending) {
      throw oauthError(
        "No pending OAuth request was found. Start sign-in again.",
        "OAUTH_NOT_PENDING"
      );
    }
    if (Date.parse(pending.expiresAt) <= Date.now()) {
      throw oauthError("The OAuth request expired. Start sign-in again.", "OAUTH_EXPIRED");
    }
    const callback = parseCallbackUri(callbackUri);
    if (callbackOrigin(callback) !== callbackOrigin(new URL(pending.redirectUri))) {
      throw oauthError("The callback URI does not match the pending redirect URI.", "CALLBACK_MISMATCH");
    }
    const returnedState = callback.searchParams.get("state");
    if (!safeEqual(returnedState, pending.state)) {
      throw oauthError("OAuth state validation failed.", "OAUTH_STATE_MISMATCH");
    }
    const providerError = callback.searchParams.get("error");
    if (providerError) {
      const description = callback.searchParams.get("error_description");
      throw oauthError(
        `Light authorization failed: ${providerError}${description ? ` (${description})` : ""}`,
        "OAUTH_DENIED"
      );
    }
    const returnedGrants = parseGrantedPermissions(callback.searchParams);
    const code = callback.searchParams.get("code");
    if (!code && !pending.tokenResponse) {
      if (pending.error) throw oauthError(pending.error.message, pending.error.code, 502);
      const continuationUrl = new URL(`https://${pending.apiHost}/auth/callback`);
      continuationUrl.searchParams.set("state", pending.state);
      const alreadyContinued = Boolean(pending.continuationUrl);
      pending.continuationUrl = continuationUrl.toString();
      pending.grantedPermissions = returnedGrants.length ? returnedGrants : pending.grantedPermissions;
      this.tokenStore.savePendingAuth(pending);
      if (open && !alreadyContinued) await this.openPendingAuthorization(pending);
      return {
        stage: "awaiting-code",
        authorizationUrl: pending.continuationUrl,
        openedBrowser: open && !alreadyContinued,
        expiresAt: pending.expiresAt
      };
    }
    let tokens = pending.tokenResponse;
    if (!tokens) {
      const response2 = await this.fetch(`https://${pending.apiHost}/auth/token`, {
        method: "POST",
        signal: AbortSignal.timeout(1e4),
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: pending.redirectUri,
          client_id: pending.appKey,
          code_verifier: pending.codeVerifier
        })
      });
      if (!response2.ok) {
        throw oauthError(
          `Light token exchange failed with HTTP ${response2.status}.`,
          "TOKEN_EXCHANGE_FAILED",
          502
        );
      }
      tokens = await response2.json();
      if (typeof tokens.access_token !== "string" || !tokens.access_token) {
        throw oauthError(
          "The identity provider returned an invalid token response.",
          "TOKEN_RESPONSE_INVALID",
          502
        );
      }
      const current2 = this.tokenStore.loadPendingAuth();
      if (!current2 || !safeEqual(current2.state, pending.state))
        throw oauthError("This sign-in attempt was replaced or cancelled.", "OAUTH_NOT_PENDING");
      this.tokenStore.savePendingAuth({ ...current2, tokenResponse: tokens });
    }
    const expiresIn = Number(tokens.expires_in);
    const tokenExpiresAt = Number.isFinite(expiresIn) ? new Date(Date.now() + expiresIn * 1e3).toISOString() : null;
    const profile = typeof tokens.id_token === "string" && tokens.id_token ? await verifyProfileToken({
      idToken: tokens.id_token,
      apiHost: pending.apiHost,
      appKey: pending.appKey,
      nonce: pending.nonce,
      fetchImplementation: this.fetch
    }) : null;
    const current = this.tokenStore.loadPendingAuth();
    if (!current || !safeEqual(current.state, pending.state))
      throw oauthError("This sign-in attempt was replaced or cancelled.", "OAUTH_NOT_PENDING");
    this.tokenStore.save({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt: tokenExpiresAt,
      appKey: pending.appKey,
      apiHost: pending.apiHost,
      tokenType: tokens.token_type || "Bearer",
      scope: tokens.scope || null,
      sessionId: pending.sessionId,
      profile
    });
    this.tokenStore.clearPendingAuth();
    return {
      stage: "complete",
      token: this.tokenStore.status(),
      grantedPermissions: returnedGrants.length ? returnedGrants : pending.grantedPermissions
    };
  }
  status() {
    const pending = this.tokenStore.loadPendingAuth();
    return {
      pending: Boolean(pending && !pending.error && Date.parse(pending.expiresAt) > Date.now()),
      error: pending?.error || (pending && Date.parse(pending.expiresAt) <= Date.now() ? { code: "OAUTH_EXPIRED", message: "Sign-in expired. Please try again." } : null)
    };
  }
};
async function verifyProfileToken({ idToken, apiHost, appKey, nonce, fetchImplementation }) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw oauthError("The identity provider returned an invalid ID token.", "ID_TOKEN_INVALID", 502);
  const header = decodeJwtPart(parts[0], "header");
  const claims = decodeJwtPart(parts[1], "claims");
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw oauthError("The identity provider returned an unsupported ID token.", "ID_TOKEN_INVALID", 502);
  }
  const response2 = await fetchImplementation(`https://${apiHost}/.well-known/jwks.json`, {
    signal: AbortSignal.timeout(1e4)
  });
  if (!response2.ok) throw oauthError("Unable to verify the identity token.", "ID_TOKEN_VERIFICATION_FAILED", 502);
  const document = await response2.json();
  const key = Array.isArray(document?.keys) ? document.keys.find((candidate) => candidate?.kid === header.kid) : null;
  if (!key || key.kty !== "RSA") throw oauthError("The identity token signing key is unavailable.", "ID_TOKEN_VERIFICATION_FAILED", 502);
  let publicKey;
  try {
    publicKey = createPublicKey({ key, format: "jwk" });
  } catch {
    throw oauthError("The identity token signing key is invalid.", "ID_TOKEN_VERIFICATION_FAILED", 502);
  }
  const signature = Buffer.from(parts[2], "base64url");
  if (!verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, signature)) {
    throw oauthError("The identity token signature is invalid.", "ID_TOKEN_VERIFICATION_FAILED", 502);
  }
  const invalidClaims = [];
  const issuers = [`https://${apiHost}`, `https://${apiHost}/auth/token`];
  if (!issuers.includes(claims.iss)) invalidClaims.push("issuer");
  if (!audienceIncludes(claims.aud, appKey)) invalidClaims.push("audience");
  if (claims.nonce !== nonce) invalidClaims.push("nonce");
  if (!Number.isFinite(claims.exp) || claims.exp * 1e3 <= Date.now()) invalidClaims.push("expiry");
  if (invalidClaims.length) {
    throw Object.assign(
      oauthError(`The signed identity token failed validation: ${invalidClaims.join(", ")}.`, "ID_TOKEN_VERIFICATION_FAILED", 502),
      { details: { issuer: typeof claims.iss === "string" ? claims.iss.slice(0, 200) : null } }
    );
  }
  const id = safeClaim(claims.yvp_id || claims.sub, 160);
  if (!id) throw oauthError("The identity token did not include a user identifier.", "ID_TOKEN_VERIFICATION_FAILED", 502);
  return {
    id,
    name: safeClaim(claims.name, 240),
    email: safeClaim(claims.email, 320),
    avatarUrl: safeHttpsUrl(claims.profile_picture)
  };
}
function decodeJwtPart(value, label) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw oauthError(`The identity token ${label} is invalid.`, "ID_TOKEN_INVALID", 502);
  }
}
function audienceIncludes(audience, appKey) {
  return audience === appKey || Array.isArray(audience) && audience.includes(appKey);
}
function safeClaim(value, maximum) {
  return typeof value === "string" && value.length > 0 && value.length <= maximum ? value : null;
}
function safeHttpsUrl(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}
function openExternalUrl(url2) {
  return new Promise((resolve3, reject) => {
    const child = spawn("xdg-open", [url2], {
      detached: true,
      stdio: "ignore"
    });
    child.once("error", reject);
    const timeout = setTimeout(() => {
      child.kill();
      reject(oauthError("Opening the browser timed out.", "BROWSER_OPEN_FAILED", 502));
    }, 1e4);
    child.once("error", () => clearTimeout(timeout));
    child.once("exit", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve3();
      else reject(oauthError("Unable to open the browser.", "BROWSER_OPEN_FAILED", 502));
    });
  });
}
function randomUrlSafe(byteCount) {
  return randomBytes2(byteCount).toString("base64url");
}
function normalizeRedirectUri(value) {
  const redirect = parseCallbackUri(value);
  if (redirect.protocol !== "omarchy:" || callbackOrigin(redirect) !== YOUVERSION_REDIRECT_URI) {
    throw oauthError(
      `The YouVersion callback must be ${YOUVERSION_REDIRECT_URI}.`,
      "REDIRECT_URI_INVALID"
    );
  }
  if (redirect.search || redirect.hash) {
    throw oauthError("YVP_REDIRECT_URI cannot contain a query or fragment.", "REDIRECT_URI_INVALID");
  }
  return YOUVERSION_REDIRECT_URI;
}
function parseCallbackUri(value) {
  try {
    return new URL(value);
  } catch {
    throw oauthError("Invalid OAuth callback URI.", "CALLBACK_INVALID");
  }
}
function callbackOrigin(url2) {
  return `${url2.protocol}//${url2.host}${url2.pathname}`.replace(/\/$/, "");
}
function validateApiHost(value) {
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(value)) {
    throw oauthError("YVP_API_HOST must be a host name without a URL scheme.", "API_HOST_INVALID");
  }
  return value;
}
function validateList(values, allowed, label) {
  const normalized = Array.isArray(values) ? values : String(values || "").split(",");
  const unique = [...new Set(normalized.map((value) => value.trim()).filter(Boolean))];
  const invalid = unique.find((value) => !allowed.has(value));
  if (invalid) throw oauthError(`Unsupported OAuth ${label}: ${invalid}`, "OAUTH_OPTION_INVALID");
  return unique;
}
function parseGrantedPermissions(parameters) {
  const permissions = /* @__PURE__ */ new Set();
  for (const [key, value] of parameters) {
    if (!/^granted_permissions(?:\[\d*\])?$/.test(key)) continue;
    for (const permission of value.split(/[\s,]+/)) {
      if (permission) permissions.add(permission);
    }
  }
  return [...permissions];
}
function safeEqual(actual, expected) {
  if (!actual || typeof expected !== "string") return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual2(actualBuffer, expectedBuffer);
}
function oauthError(message, code, status = 400) {
  return new ServiceError(message, { code, status });
}

// service/src/token-store.js
import {
  chmodSync as chmodSync4,
  closeSync,
  constants,
  existsSync as existsSync3,
  openSync,
  readFileSync as readFileSync3,
  renameSync as renameSync2,
  unlinkSync,
  writeFileSync as writeFileSync3,
  writeSync
} from "node:fs";
import { join as join4 } from "node:path";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes as randomBytes3,
  randomUUID as randomUUID4
} from "node:crypto";
var ALGORITHM = "aes-256-gcm";
var TokenStore = class {
  constructor({ directory } = {}) {
    if (!directory) throw new Error("A token directory is required.");
    this.directory = ensureSecureDirectory(directory);
    this.keyPath = join4(directory, "token.key");
    this.tokenPath = join4(directory, "tokens.enc");
    this.pendingAuthPath = join4(directory, "oauth-pending.enc");
    this.localSessionPath = join4(directory, "local-session");
  }
  save({
    accessToken,
    refreshToken = null,
    expiresAt = null,
    appKey = null,
    apiHost = null,
    tokenType = "Bearer",
    scope = null,
    sessionId = null,
    profile = null
  }) {
    if (typeof accessToken !== "string" || accessToken.length === 0) {
      throw new Error("accessToken must be a non-empty string.");
    }
    if (refreshToken !== null && typeof refreshToken !== "string") {
      throw new Error("refreshToken must be a string or null.");
    }
    if (expiresAt !== null && Number.isNaN(Date.parse(expiresAt))) {
      throw new Error("expiresAt must be an ISO-8601 date or null.");
    }
    for (const [name, value] of Object.entries({
      appKey,
      apiHost,
      tokenType,
      scope,
      sessionId
    })) {
      if (value !== null && typeof value !== "string") {
        throw new Error(`${name} must be a string or null.`);
      }
    }
    const normalizedProfile = normalizeProfile(profile);
    this.#saveEncrypted(this.tokenPath, {
      accessToken,
      refreshToken,
      expiresAt,
      appKey,
      apiHost,
      tokenType,
      scope,
      sessionId,
      profile: normalizedProfile
    });
  }
  load() {
    return this.#loadEncrypted(this.tokenPath);
  }
  status() {
    const tokens = this.load();
    if (!tokens) return { configured: false };
    return {
      configured: true,
      hasRefreshToken: Boolean(tokens.refreshToken),
      expiresAt: tokens.expiresAt,
      expired: tokens.expiresAt ? Date.parse(tokens.expiresAt) <= Date.now() : null,
      profile: tokens.profile || null
    };
  }
  getLocalSessionId() {
    if (existsSync3(this.localSessionPath)) {
      const stored = readFileSync3(this.localSessionPath, "utf8").trim();
      if (stored) {
        chmodSync4(this.localSessionPath, 384);
        return stored;
      }
    }
    const sessionId = this.load()?.sessionId || randomUUID4();
    writeFileSync3(this.localSessionPath, `${sessionId}
`, { mode: 384 });
    chmodSync4(this.localSessionPath, 384);
    return sessionId;
  }
  clear() {
    if (!existsSync3(this.tokenPath)) return false;
    unlinkSync(this.tokenPath);
    return true;
  }
  savePendingAuth(pendingAuth) {
    this.#saveEncrypted(this.pendingAuthPath, pendingAuth);
  }
  loadPendingAuth() {
    return this.#loadEncrypted(this.pendingAuthPath);
  }
  clearPendingAuth() {
    if (!existsSync3(this.pendingAuthPath)) return false;
    unlinkSync(this.pendingAuthPath);
    return true;
  }
  #loadKey() {
    const key = readFileSync3(this.keyPath);
    if (key.length !== 32) throw new Error("The token encryption key is invalid.");
    chmodSync4(this.keyPath, 384);
    return key;
  }
  #loadOrCreateKey() {
    if (existsSync3(this.keyPath)) return this.#loadKey();
    const key = randomBytes3(32);
    let descriptor;
    try {
      descriptor = openSync(
        this.keyPath,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
        384
      );
      writeSync(descriptor, key);
    } catch (error) {
      if (error.code === "EEXIST") return this.#loadKey();
      throw error;
    } finally {
      if (descriptor !== void 0) closeSync(descriptor);
    }
    return key;
  }
  #saveEncrypted(path, value) {
    const key = this.#loadOrCreateKey();
    const iv = randomBytes3(12);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const plaintext = JSON.stringify(value);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final()
    ]);
    const document = JSON.stringify({
      version: 1,
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64")
    });
    this.#atomicPrivateWrite(path, document);
  }
  #loadEncrypted(path) {
    if (!existsSync3(path)) return null;
    const key = this.#loadKey();
    const document = JSON.parse(readFileSync3(path, "utf8"));
    if (document.version !== 1) {
      throw new Error(`Unsupported encrypted file version: ${document.version}`);
    }
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(document.iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(document.tag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(document.ciphertext, "base64")),
      decipher.final()
    ]).toString("utf8");
    return JSON.parse(plaintext);
  }
  #atomicPrivateWrite(path, contents) {
    const temporaryPath = `${path}.${randomUUID4()}.tmp`;
    try {
      writeFileSync3(temporaryPath, contents, { mode: 384, flag: "wx" });
      renameSync2(temporaryPath, path);
      chmodSync4(path, 384);
    } finally {
      if (existsSync3(temporaryPath)) unlinkSync(temporaryPath);
    }
  }
};
function normalizeProfile(profile) {
  if (profile === null) return null;
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new Error("profile must be an object or null.");
  }
  const id = stringField(profile.id, "profile.id", 160, true);
  const name = stringField(profile.name, "profile.name", 240);
  const email2 = stringField(profile.email, "profile.email", 320);
  const avatarUrl = stringField(profile.avatarUrl, "profile.avatarUrl", 2048);
  if (avatarUrl !== null) {
    let url2;
    try {
      url2 = new URL(avatarUrl);
    } catch {
      throw new Error("profile.avatarUrl must be a valid HTTPS URL.");
    }
    if (url2.protocol !== "https:") throw new Error("profile.avatarUrl must be a valid HTTPS URL.");
  }
  return { id, name, email: email2, avatarUrl };
}
function stringField(value, name, maximum, required3 = false) {
  if (value === void 0 || value === null || value === "") {
    if (required3) throw new Error(`${name} must be a non-empty string.`);
    return null;
  }
  if (typeof value !== "string" || value.length > maximum) {
    throw new Error(`${name} must be a string no longer than ${maximum} characters.`);
  }
  return value;
}

// service/src/daemon.js
var HELP = `Usage:
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
  const [command = "serve", ...argumentsList] = process.argv.slice(2);
  if (["help", "--help", "-h"].includes(command)) {
    stdout.write(HELP);
    return;
  }
  const managed = command === "serve" && argumentsList.includes("--managed");
  if (managed) {
    try {
      repairExistingOAuthCallback();
    } catch {
      process.stderr.write("Light could not refresh its existing sign-in handler; try Sign in again.\n");
    }
  }
  const nativeAudio = prepareNativeAudio();
  if (managed && await existingServiceAvailable()) {
    stdout.write(`LIGHT_READY ${JSON.stringify({ ...nativeAudio, existingService: true })}
`);
    if (!await followExistingService()) return;
    stdout.write("LIGHT_RESTARTING\n");
  }
  const configDirectory = getConfigDir();
  const cache = new SQLiteCache({
    directory: configDirectory,
    ttlSeconds: nonNegativeNumber(process.env.LIGHT_CACHE_TTL_SECONDS || 604800)
  });
  const tokenStore = new TokenStore({ directory: configDirectory });
  const { bibleClient, highlightsClient } = createPlatformClients(
    process.env,
    { installationId: tokenStore.getLocalSessionId() }
  );
  const downloadManager = new DownloadManager({
    database: cache.database,
    recoverInterruptedDownloads: command === "serve",
    bibleClient,
    concurrency: integerSetting(process.env.LIGHT_DOWNLOAD_CONCURRENCY || 1, 1, 8),
    maxRetries: integerSetting(process.env.LIGHT_DOWNLOAD_RETRIES || 3, 0, 10),
    requestIntervalMs: integerSetting(
      process.env.LIGHT_DOWNLOAD_INTERVAL_MS || 1250,
      0,
      6e4
    )
  });
  const service = new LightService({
    cache,
    bibleClient,
    downloadManager
  });
  const authentication = new AuthenticationManager({ tokenStore });
  const userData = new UserDataManager({
    database: cache.database,
    highlightsClient,
    authentication
  });
  const oauth = new OAuthManager({ tokenStore, prepareCallback: registerOAuthCallback });
  try {
    if (command === "serve") {
      await serve({
        service,
        cache,
        authentication,
        downloadManager,
        oauth,
        userData,
        managed,
        nativeAudio
      });
      return;
    }
    if (["versions", "languages", "books", "chapters", "passage", "download"].includes(command))
      await authentication.getAccessToken();
    let result;
    if (command === "versions") {
      const options = parseOptions(argumentsList);
      result = await service.versions(options.language || "*", {
        mode: options.mode || "auto"
      });
    } else if (command === "languages") {
      const options = parseOptions(argumentsList);
      result = await service.languages(options.locale || "en-US", {
        mode: options.mode || "auto"
      });
    } else if (command === "books") {
      const options = parseOptions(argumentsList);
      result = await service.books(options.version, { mode: options.mode || "auto" });
    } else if (command === "chapters") {
      const options = parseOptions(argumentsList);
      result = await service.chapters(options.version, options.book, {
        mode: options.mode || "auto"
      });
    } else if (command === "passage") {
      const options = parseOptions(argumentsList);
      result = await service.passage(options.version, options.usfm, {
        mode: options.mode || "auto",
        format: options.format || "text",
        includeHeadings: options["include-headings"] || false,
        includeNotes: options["include-notes"] || false
      });
    } else if (command === "oauth") {
      result = await oauthCommand(argumentsList[0], argumentsList.slice(1), oauth, tokenStore);
    } else if (command === "auth") {
      result = await authCommand(argumentsList[0], authentication);
    } else if (command === "download") {
      result = await downloadCommand(
        argumentsList[0],
        argumentsList.slice(1),
        downloadManager
      );
    } else if (command === "token") {
      result = await tokenCommand(argumentsList[0], tokenStore);
    } else if (command === "cache") {
      result = cacheCommand(argumentsList[0], cache);
    } else {
      throw new ServiceError(`Unknown command: ${command}`, {
        code: "BAD_COMMAND",
        status: 400
      });
    }
    printJson(result);
  } finally {
    cache.close();
  }
}
async function authCommand(action, authentication) {
  if (action === "status") return authentication.status();
  if (action === "refresh") {
    await authentication.refresh();
    return authentication.status();
  }
  if (action === "logout") return authentication.signOut();
  throw new ServiceError("auth requires status, refresh, or logout.", {
    code: "BAD_COMMAND",
    status: 400
  });
}
async function downloadCommand(action, argumentsList, downloads) {
  if (action === "list") return { packages: downloads.listPackages() };
  const options = parseOptions(argumentsList);
  if (action === "status") {
    const download = downloads.getPackage(options.version);
    if (!download) {
      throw new ServiceError("Translation package not found.", {
        code: "DOWNLOAD_NOT_FOUND",
        status: 404
      });
    }
    return download;
  }
  if (action === "remove") return downloads.removePackage(options.version);
  if (action === "resume") return downloads.resumePackage(options.version);
  if (action === "add") {
    return downloads.downloadPackage(options.version, {
      format: options.format || "text",
      includeHeadings: options["include-headings"] || false,
      includeNotes: options["include-notes"] || false
    });
  }
  throw new ServiceError("download requires add, resume, list, status, or remove.", {
    code: "BAD_COMMAND",
    status: 400
  });
}
async function oauthCommand(action, argumentsList, oauth, tokenStore) {
  if (action === "status") {
    return {
      token: tokenStore.status(),
      pending: Boolean(tokenStore.loadPendingAuth())
    };
  }
  if (action === "cancel") {
    return { cancelled: tokenStore.clearPendingAuth() };
  }
  if (action === "start") {
    const options = parseOptions(argumentsList);
    return oauth.start({
      scopes: commaList(options.scopes, ["profile", "email"]),
      permissions: commaList(options.permissions, ["highlights"]),
      open: !options["no-open"]
    });
  }
  if (action === "callback") {
    const callbackUri = argumentsList.find((argument) => !argument.startsWith("--"));
    if (!callbackUri) {
      throw new ServiceError("oauth callback requires the callback URI.", {
        code: "CALLBACK_REQUIRED",
        status: 400
      });
    }
    return oauth.handleCallback(callbackUri, {
      open: !argumentsList.includes("--no-open")
    });
  }
  throw new ServiceError("oauth requires start, callback, status, or cancel.", {
    code: "BAD_COMMAND",
    status: 400
  });
}
async function serve({
  service,
  cache,
  authentication,
  downloadManager,
  oauth,
  userData,
  managed = false,
  nativeAudio = {}
}) {
  const host = process.env.LIGHT_HOST || "127.0.0.1";
  if (!["127.0.0.1", "::1", "localhost"].includes(host)) {
    throw new ServiceError("LIGHT_HOST must be a loopback address.", {
      code: "NON_LOCAL_BIND_REJECTED",
      status: 400
    });
  }
  const port = portNumber(process.env.LIGHT_PORT || 8788);
  const clientToken = randomBytes4(32).toString("hex");
  const headerPath = join5(getConfigDir(), "client-auth-header");
  const temporaryPath = `${headerPath}.${process.pid}.tmp`;
  const hotkeys = managed && process.env.HYPRLAND_INSTANCE_SIGNATURE ? new SessionHotkeys() : null;
  const server = createHttpServer({
    clientToken,
    ...hotkeys ? {
      applyGlobalHotkey: (shortcut) => hotkeys.set("globalToggle", shortcut),
      applyVerseOfTheDayHotkey: (shortcut) => hotkeys.set("verseOfTheDay", shortcut)
    } : {},
    service,
    cache,
    authentication,
    downloadManager,
    oauth,
    userData
  });
  await new Promise((resolve3, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve3);
  });
  try {
    writeFileSync4(temporaryPath, `Authorization: Bearer ${clientToken}
`, { mode: 384, flag: "wx" });
    renameSync3(temporaryPath, headerPath);
    chmodSync5(headerPath, 384);
  } catch (error) {
    server.close();
    throw error;
  }
  let shortcutTimer;
  if (hotkeys) {
    hotkeys.reconcile(userData.getKeybindings());
    shortcutTimer = setInterval(() => hotkeys.reconcile(userData.getKeybindings()), 5e3);
  }
  stdout.write(`Light service listening on http://${host}:${port}
`);
  if (managed) stdout.write(`LIGHT_READY ${JSON.stringify(nativeAudio)}
`);
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    clearInterval(shortcutTimer);
    hotkeys?.close();
    server.close();
    server.closeAllConnections();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  if (managed) {
    stdin.resume();
    stdin.once("end", shutdown);
    if (stdin.readableEnded) shutdown();
  }
  await new Promise((resolve3) => server.once("close", resolve3));
  process.removeListener("SIGINT", shutdown);
  process.removeListener("SIGTERM", shutdown);
  if (managed) {
    stdin.removeListener("end", shutdown);
    stdin.pause();
  }
}
async function followExistingService() {
  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  stdin.resume();
  stdin.once("end", stop);
  process.once("SIGTERM", stop);
  try {
    while (!stopped && !stdin.readableEnded) {
      await new Promise((resolve3) => setTimeout(resolve3, 750));
      if (stopped || stdin.readableEnded) return false;
      if (!await existingServiceAvailable()) return !stopped;
    }
    return false;
  } finally {
    stdin.removeListener("end", stop);
    process.removeListener("SIGTERM", stop);
  }
}
async function existingServiceAvailable() {
  const host = process.env.LIGHT_HOST || "127.0.0.1";
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) return false;
  const port = portNumber(process.env.LIGHT_PORT || 8788);
  try {
    const header = readFileSync4(join5(getConfigDir(), "client-auth-header"), "utf8").trim();
    if (!/^Authorization: Bearer [a-f0-9]{64}$/.test(header)) return false;
    const response2 = await fetch(`http://${host === "::1" ? "[::1]" : host}:${port}/health`, {
      headers: { authorization: header.slice(15) },
      signal: AbortSignal.timeout(2e3)
    });
    const data = await response2.json();
    return response2.ok && data.ok === true && typeof data.authentication?.authenticated === "boolean";
  } catch {
    return false;
  }
}
async function tokenCommand(action, tokenStore) {
  if (action === "status") return tokenStore.status();
  if (action === "clear") return { cleared: tokenStore.clear() };
  if (action !== "set") {
    throw new ServiceError("token requires set, status, or clear.", {
      code: "BAD_COMMAND",
      status: 400
    });
  }
  if (stdin.isTTY) {
    throw new ServiceError("Pipe token JSON on stdin so secrets do not appear in process arguments.", {
      code: "TOKEN_INPUT_REQUIRED",
      status: 400
    });
  }
  const chunks = [];
  for await (const chunk of stdin) chunks.push(chunk);
  const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  tokenStore.save(input);
  return tokenStore.status();
}
function cacheCommand(action, cache) {
  if (action === "stats") return cache.stats();
  if (action === "clear") return { clearedEntries: cache.clear() };
  throw new ServiceError("cache requires stats or clear.", {
    code: "BAD_COMMAND",
    status: 400
  });
}
function parseOptions(argumentsList) {
  const options = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (!argument.startsWith("--")) {
      throw new ServiceError(`Unexpected argument: ${argument}`, {
        code: "BAD_ARGUMENT",
        status: 400
      });
    }
    const [rawName, inlineValue] = argument.slice(2).split("=", 2);
    if (rawName === "offline") {
      options.mode = "offline";
      continue;
    }
    if (rawName === "online") {
      options.mode = "online";
      continue;
    }
    const value = inlineValue ?? argumentsList[index + 1];
    if (value === void 0 || value.startsWith("--")) {
      options[rawName] = true;
    } else {
      options[rawName] = value;
      if (inlineValue === void 0) index += 1;
    }
  }
  return options;
}
function printJson(value) {
  stdout.write(`${JSON.stringify(value, null, 2)}
`);
}
function commaList(value, fallback) {
  if (value === void 0) return fallback;
  if (value === true) return [];
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}
function nonNegativeNumber(value) {
  const number3 = Number(value);
  if (!Number.isFinite(number3) || number3 < 0) {
    throw new ServiceError("LIGHT_CACHE_TTL_SECONDS must be a non-negative number.", {
      code: "BAD_CONFIGURATION",
      status: 400
    });
  }
  return number3;
}
function portNumber(value) {
  const number3 = Number(value);
  if (!Number.isSafeInteger(number3) || number3 < 1 || number3 > 65535) {
    throw new ServiceError("LIGHT_PORT must be an integer from 1 to 65535.", {
      code: "BAD_CONFIGURATION",
      status: 400
    });
  }
  return number3;
}
function integerSetting(value, minimum, maximum) {
  const number3 = Number(value);
  if (!Number.isSafeInteger(number3) || number3 < minimum || number3 > maximum) {
    throw new ServiceError(
      `Configuration value must be an integer from ${minimum} to ${maximum}.`,
      { code: "BAD_CONFIGURATION", status: 400 }
    );
  }
  return number3;
}
main().then(() => {
  if (process.argv.includes("--managed")) process.exit(0);
}).catch((error) => {
  const known = error instanceof ServiceError;
  process.stderr.write(`${known ? error.code : "ERROR"}: ${error.message}
`);
  process.exitCode = 1;
});
