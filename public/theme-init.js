// Applies the saved theme before the first paint, so a light-theme user does not
// see the dark default flash while the app bundle loads. It is a file rather
// than an inline <script> because the CSP (script-src 'self') blocks inline
// code. Keep the logic identical to readStoredTheme in ThemeProvider.tsx.
(function () {
  var theme = 'dark';
  try {
    var stored = window.localStorage.getItem('sdi:theme');
    if (stored === 'dark' || stored === 'light') theme = stored;
    else if (window.matchMedia('(prefers-color-scheme: light)').matches) theme = 'light';
  } catch (error) {
    // Storage blocked - fall back to the OS preference, or dark.
    try {
      if (window.matchMedia('(prefers-color-scheme: light)').matches) theme = 'light';
    } catch (ignored) {
      // Keep dark.
    }
  }
  var root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
})();
