// Makes Android's hardware/gesture back button behave like a browser back
// button inside the Capacitor-wrapped app. No-ops silently on the regular
// website (window.Capacitor doesn't exist there), so this is safe to include
// on every page.
(function () {
  function attach() {
    if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.App) return;
    window.Capacitor.Plugins.App.addListener('backButton', function () {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.Capacitor.Plugins.App.exitApp();
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
})();
