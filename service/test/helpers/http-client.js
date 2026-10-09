export function authenticatedFetch(url, options = {}) {
  return globalThis.fetch(url, {
    ...options,
    headers: { authorization: 'Bearer test-client', ...options.headers },
  });
}
