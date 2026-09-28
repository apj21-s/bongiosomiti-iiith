/**
 * Lets a plain node script import the app's TypeScript modules.
 *
 * Next resolves `./mail-transport` without an extension; node does not. This
 * hook retries such a specifier with `.ts` before giving up, which is enough
 * for scripts that reuse utils/ rather than reimplementing it.
 */
export async function resolve(specifier, context, next) {
  if (/^\.{1,2}\/[^.]*$/.test(specifier)) {
    try { return await next(specifier + '.ts', context) } catch { /* fall through */ }
  }
  return next(specifier, context)
}
