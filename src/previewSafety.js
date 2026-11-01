// Preview mode is intentionally isolated from the production ordering API.
// Vite dev server only: never contact or modify real guest orders or SMS settings.
if (import.meta.env.VITE_ENABLE_LIVE_API !== 'true') {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = String(typeof input === 'string' ? input : input?.url || '');
    if (!url.startsWith('https://api-peaufx4prq-uc.a.run.app/')) return originalFetch(input, init);
    const path = new URL(url).pathname;
    let payload = { success: true };
    if (path.endsWith('/cheat-sheet')) payload = { orders: [] };
    else if (path.endsWith('/sms-status')) payload = { enabled: false };
    else if (path.endsWith('/current')) payload = { order: null };
    else if (path.endsWith('/orders') && (init.method || 'GET').toUpperCase() === 'POST') {
      payload = { success: true, order_id: 'PREVIEW-' + Date.now() };
    }
    return Promise.resolve(new Response(JSON.stringify(payload), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    }));
  };
  const banner = document.createElement('div');
  banner.className = 'bh-preview-banner';
  banner.textContent = 'DESIGN PREVIEW · TEST DATA ONLY · NO REAL ORDERS OR SMS';
  document.addEventListener('DOMContentLoaded', () => document.body.prepend(banner), { once: true });
}
