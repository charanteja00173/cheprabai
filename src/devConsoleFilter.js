/**
 * Suppress noisy development-only console messages.
 * This file MUST be imported before React to catch messages
 * logged during React's module evaluation (e.g. DevTools promo).
 */
if (process.env.NODE_ENV === 'development') {
  const SUPPRESSED_PATTERNS = [
    'Download the React DevTools',
    'React Router Future Flag Warning',
    'v7_startTransition',
    'v7_relativeSplatPath',
  ];
  const shouldSuppress = (args) =>
    args.some(
      (arg) =>
        typeof arg === 'string' &&
        SUPPRESSED_PATTERNS.some((p) => arg.includes(p))
    );
  ['log', 'warn', 'info', 'error'].forEach((method) => {
    const original = console[method];
    console[method] = (...args) => {
      if (shouldSuppress(args)) return;
      original.apply(console, args);
    };
  });
}
