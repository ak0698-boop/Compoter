// Shared bottom tab bar for the packaged app (Home / My Bookings / Account).
// Drop `<script src="app-tabs.js"></script>` before </body> on app-facing pages.
// Each tab is a normal page navigation — simplest reliable approach for a
// static-HTML site, still matches the bottom-tab look/feel of the app.
(function () {
  const TABS = [
    { href: 'app-home.html', icon: '🏠', label: 'Home' },
    { href: 'customer-login.html', icon: '📋', label: 'My Bookings' },
    { href: 'account.html', icon: '👤', label: 'Account' },
  ];

  const path = window.location.pathname.split('/').pop() || 'app-home.html';

  const style = document.createElement('style');
  style.textContent = `
    #cptr-app-tabs{
      position:fixed; left:0; right:0; bottom:0; z-index:9998; display:flex;
      background:var(--paper-raised,#fff); border-top:1px solid var(--line,#E2E6E4);
      box-shadow:0 -4px 16px rgba(0,0,0,0.06); padding-bottom:env(safe-area-inset-bottom, 0);
    }
    #cptr-app-tabs a{
      flex:1; display:flex; flex-direction:column; align-items:center; gap:2px;
      padding:9px 0 8px; font-family:var(--body,'Inter',sans-serif); font-size:11px; font-weight:600;
      color:var(--steel-light,#8A96A3); text-decoration:none;
    }
    #cptr-app-tabs a.active{ color:var(--indigo,#3730A3); }
    #cptr-app-tabs .cptr-tab-icon{ font-size:20px; }
    body{ padding-bottom:64px; }
  `;
  document.head.appendChild(style);

  const bar = document.createElement('div');
  bar.id = 'cptr-app-tabs';
  bar.innerHTML = TABS.map(t => `
    <a href="${t.href}" class="${t.href === path ? 'active' : ''}">
      <span class="cptr-tab-icon">${t.icon}</span>
      <span>${t.label}</span>
    </a>
  `).join('');
  document.body.appendChild(bar);
})();
