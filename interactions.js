/** SupplyFlow progressive interaction layer. Business logic remains in app.js. */
(() => {
  'use strict';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const page = document.querySelector('#page');
  const shortcuts = ['new-bill', 'bill-history', 'rate-dashboard'];

  function enhancePage() {
    if (!page || reducedMotion.matches) return;
    page.classList.remove('page-enter');
    void page.offsetWidth;
    page.classList.add('page-enter');
    page.querySelectorAll(':scope > .card, :scope > .grid, :scope > .toolbar, .vendor-card').forEach((element, index) => {
      element.style.setProperty('--enter-index', Math.min(index, 10));
      element.classList.add('stagger-enter');
    });
  }

  function addRipple(event) {
    const button = event.target.closest('.btn, .nav-link, .insight-link, .icon-edit');
    if (!button || reducedMotion.matches) return;
    const bounds = button.getBoundingClientRect();
    const size = Math.max(bounds.width, bounds.height) * 1.6;
    const ripple = document.createElement('span');
    ripple.className = 'button-ripple';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - bounds.left - size / 2}px`;
    ripple.style.top = `${event.clientY - bounds.top - size / 2}px`;
    button.append(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  }

  function handleShortcut(event) {
    if (!event.altKey || event.ctrlKey || event.metaKey) return;
    const pageId = shortcuts[Number(event.key) - 1];
    if (!pageId || typeof window.go !== 'function') return;
    event.preventDefault();
    window.go(pageId);
  }

  document.addEventListener('pointerdown', addRipple);
  document.addEventListener('keydown', handleShortcut);
  if (page) {
    new MutationObserver(enhancePage).observe(page, { childList: true });
    enhancePage();
  }
})();
