(() => {
  let theme = 'dark';
  try { if (localStorage.getItem('halley.theme') === 'light') theme = 'light'; } catch { /* Storage can be disabled. */ }
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'light' ? '#f7f9fc' : '#0a0e17';
})();
