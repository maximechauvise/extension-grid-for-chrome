(function () {
  const stored = localStorage.getItem('gt-theme');
  const theme = stored || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', theme);
})();

function initThemeToggle(buttonId) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  function update() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.textContent = isDark ? '☀' : '☾';
    btn.title = isDark ? 'Mode clair' : 'Mode sombre';
  }

  btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('gt-theme', next);
    update();
  });

  update();
}
