'use strict';

// Telegram delivery is opt-in and disabled until explicitly configured.
// Credentials belong in Firebase secrets, never in the repository.
async function sendTelegramAlert({ text, orderId }, { env = process.env, fetchImpl = globalThis.fetch, logger = console } = {}) {
    const token = (env.TELEGRAM_BOT_TOKEN || '').trim();
    const chatIds = (env.TELEGRAM_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!token || !chatIds.length) return { status: 'not_configured' };
    if (!/^\d{6,12}:[A-Za-z0-9_-]{25,}$/.test(token) || chatIds.some(id => !/^-?\d+$/.test(id))) {
        logger.error('Telegram configuration invalid', { orderId, tokenFormatValid: /^\d{6,12}:[A-Za-z0-9_-]{25,}$/.test(token), chatIdsValid: chatIds.every(id => /^-?\d+$/.test(id)), tokenLength: token.length, chatIdCount: chatIds.length });
        return { status: 'invalid_configuration' };
    }
    const statuses = [];
    for (const chatId of chatIds) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            let response;
            try {
                response = await fetchImpl('https://api.telegram.org/bot' + token + '/sendMessage', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, text }),
                    signal: controller.signal
                });
            } finally { clearTimeout(timer); }
            const data = await response.json();
            statuses.push(response.ok && data.ok ? 'sent' : 'failed');
        } catch (error) {
            statuses.push('failed');
            logger.error('Telegram alert failed', { orderId, errorType: error.name });
        }
    }
    const sent = statuses.filter(s => s === 'sent').length;
    logger.log('Telegram alert result', { orderId, sent, expected: chatIds.length });
    return { status: sent === chatIds.length ? 'sent' : sent ? 'partial' : 'failed', sent, expected: chatIds.length };
}
module.exports = { sendTelegramAlert };
