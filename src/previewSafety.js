// Preview mode is intentionally isolated from the production ordering API.
// Vite dev server only: never contact or modify real guest orders or SMS settings.
if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_LIVE_API !== 'true') {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = String(typeof input === 'string' ? input : input?.url || '');
    if (!url.startsWith('https://api-peaufx4prq-uc.a.run.app/')) return originalFetch(input, init);
    if (import.meta.env.VITE_LOCAL_TEST_API === 'true') {
      const target = new URL(url);
      return originalFetch(target.pathname + target.search, init);
    }
    const path = new URL(url).pathname;
    let payload = { success: true };
    if (path.endsWith('/cheat-sheet')) payload = { orders: [] };
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
  banner.textContent = import.meta.env.VITE_LOCAL_TEST_API === 'true'
    ? 'LOCAL TEST · SAVED TEST ORDERS · SMS DISABLED'
    : 'DESIGN PREVIEW · TEST DATA ONLY · NO REAL ORDERS OR SMS';
  document.addEventListener('DOMContentLoaded', () => document.body.prepend(banner), { once: true });
}

// A development preview can read the live backend but must never modify orders
// or send notifications. This remains true even when production alerts are automatic.
if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_LIVE_API === 'true') {
  const liveFetch = window.fetch.bind(window);
  const base = 'https://api-peaufx4prq-uc.a.run.app';
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init.method || 'GET').toUpperCase();
    if (url.startsWith(base) && method !== 'GET' && method !== 'HEAD') {
      return Promise.reject(new Error('Live backend writes are disabled in the local preview.'));
    }
    return liveFetch(input, init);
  };
  const banner = document.createElement('div');
  banner.className = 'bh-preview-banner';
  banner.textContent = 'LIVE BACKEND READ-ONLY · ORDER SUBMISSIONS DISABLED';
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',()=>document.body.prepend(banner),{once:true});
  else document.body.prepend(banner);
}
