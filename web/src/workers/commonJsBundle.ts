function safeModuleObject(modules: Record<string, string>) {
  return `JSON.parse(${JSON.stringify(JSON.stringify(modules)).replace(/</g, '\\u003c')})`
}

export function bundleCommonJsModules(modules: Record<string, string>, entryModule: string) {
  return `
const __hafa_modules__ = ${safeModuleObject(modules)};
const __hafa_cache__ = Object.create(null);

function __hafa_normalize__(path) {
  const normalized = [];
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') normalized.pop();
    else normalized.push(segment);
  }
  return normalized.join('/');
}

function __hafa_resolve__(fromPath, specifier) {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    throw new Error('Packages are unavailable in Hafa Code TypeScript: ' + specifier);
  }
  const base = specifier.startsWith('/') ? '' : fromPath.split('/').slice(0, -1).join('/');
  const normalized = __hafa_normalize__((base ? base + '/' : '') + specifier.replace(/^\\/+/, ''));
  const candidates = [normalized, normalized + '.js', normalized + '/index.js'];
  const resolved = candidates.find((candidate) => Object.prototype.hasOwnProperty.call(__hafa_modules__, candidate));
  if (!resolved) throw new Error('Cannot find module ' + specifier + ' from ' + fromPath);
  return resolved;
}

function __hafa_require__(path) {
  if (__hafa_cache__[path]) return __hafa_cache__[path].exports;
  const code = __hafa_modules__[path];
  if (code === undefined) throw new Error('Cannot find module ' + path);
  const module = { exports: {} };
  __hafa_cache__[path] = module;
  const localRequire = (specifier) => __hafa_require__(__hafa_resolve__(path, specifier));
  const fn = new Function('require', 'exports', 'module', code);
  fn(localRequire, module.exports, module);
  return module.exports;
}

__hafa_require__(${JSON.stringify(entryModule)});
`
}
