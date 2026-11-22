'use strict';

async function postToTelegram(fetchImpl, token, method, body, headers) {
    const response = await fetchImpl('https://api.telegram.org/bot' + token + '/' + method, {
        method: 'POST', body, headers, signal: AbortSignal.timeout(10000)
    });
    const result = await response.json();
    return { ok: response.ok && result.ok, code: result.error_code || response.status };
}

// Telegram delivery is opt-in and disabled until explicitly configured.
// Credentials belong in Firebase secrets, never in the repository.
async function sendTelegramAlert({ text, orderId, order, updated }, { env = process.env, fetchImpl = globalThis.fetch, logger = console } = {}) {
    const token = (env.TELEGRAM_BOT_TOKEN || '').trim();
    const chatIds = (env.TELEGRAM_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!token || !chatIds.length) return { status: 'not_configured' };
    if (!/^\d{6,12}:[A-Za-z0-9_-]{25,}$/.test(token) || chatIds.some(id => !/^-?\d+$/.test(id))) {
        logger.error('Telegram configuration invalid', { orderId, tokenFormatValid: /^\d{6,12}:[A-Za-z0-9_-]{25,}$/.test(token), chatIdsValid: chatIds.every(id => /^-?\d+$/.test(id)), tokenLength: token.length, chatIdCount: chatIds.length });
        return { status: 'invalid_configuration' };
    }
    let copy;
    if (order) {
        try {
            const { createOrderCopy } = require('./order-copy');
            copy = await createOrderCopy(order, updated);
        } catch (error) {
            logger.error('Telegram order copy unavailable', { orderId, errorType: error.name });
        }
    }

    let sent = 0;
    let copiesSent = 0;
    for (const chatId of chatIds) {
        try {
            if (copy) {
                const body = new FormData();
                body.set('chat_id', chatId);
                body.set('caption', text.slice(0, 1024));
                body.set('document', copy.file, copy.filename);
                const result = await postToTelegram(fetchImpl, token, 'sendDocument', body);
                if (result.ok) {
                    copiesSent++;
                    sent++;
                    continue;
                }
                // An explicit document rejection can still allow plain text. Avoid
                // duplicating an alert after an ambiguous network or server failure.
                if (result.code !== 400 && result.code !== 403) continue;
            }
            const message = order ? text + '\nOrder copy unavailable. See the kitchen dashboard.' : text;
            const result = await postToTelegram(fetchImpl, token, 'sendMessage',
                JSON.stringify({ chat_id: chatId, text: message }), { 'content-type': 'application/json' });
            if (result.ok) sent++;
        } catch (error) {
            logger.error('Telegram alert failed', { orderId, errorType: error.name });
        }
    }
    const expected = chatIds.length;
    const status = sent === expected ? 'sent' : sent ? 'partial' : 'failed';
    const result = { status, sent, expected };
    if (order) result.copiesSent = copiesSent;
    logger.log('Telegram alert result', { orderId, ...result });
    return result;
}
module.exports = { sendTelegramAlert };
