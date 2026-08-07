// Back navigation for the Capacitor-wrapped app:
// 1. Makes Android's hardware/gesture back button behave like browser back.
// 2. Adds an always-visible on-screen back arrow (top-left) as a reliable
//    fallback, since hardware back support can vary by device/gesture nav.
// Both only activate inside the packaged app (window.Capacitor exists) — a
// no-op on the regular website, so this is safe to include on every page.
(function () {
  function attachHardwareBack() {
    if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.App) return;
    window.Capacitor.Plugins.App.addListener('backButton', function () {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.Capacitor.Plugins.App.exitApp();
      }
    });
  }

  function injectBackButton() {
    if (!window.Capacitor) return;
    if (window.history.length <= 1) return;
    if (document.getElementById('cptr-back-btn')) return;

    const style = document.createElement('style');
    style.textContent = `
      #cptr-back-btn{
        position:fixed; top:14px; left:14px; z-index:99999;
        width:36px; height:36px; border-radius:50%; border:none;
        background:rgba(0,0,0,0.4); color:#fff; font-size:18px; font-weight:700; line-height:1;
        display:flex; align-items:center; justify-content:center; cursor:pointer;
      }
    `;
    document.head.appendChild(style);

    const btn = document.createElement('button');
    btn.id = 'cptr-back-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Back');
    btn.textContent = '←';
    btn.addEventListener('click', () => {
      if (window.history.length > 1) window.history.back();
    });
    document.body.appendChild(btn);
  }

  function attach() {
    attachHardwareBack();
    injectBackButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
})();
