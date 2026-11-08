'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sendTelegramAlert } = require('./telegram');
const token = '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi';
const logger = { log() {}, error() {} };
const order = { orderId: 'preview-test', text: 'New Breakfast Order: Bissing Suite for 8:30.' };

test('unconfigured Telegram never sends', async () => {
    assert.deepEqual(await sendTelegramAlert(order, { env: {}, fetchImpl: () => { throw Error('unexpected'); }, logger }), { status: 'not_configured' });
});
test('one recipient receives order text without exposing token in payload', async () => {
    const requests = [];
    const result = await sendTelegramAlert(order, {
        env: { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_IDS: '8095534849' },
        fetchImpl: async (url, options) => {
            requests.push({ url, options });
            return { ok: true, json: async () => ({ ok: true }) };
        }, logger
    });
    assert.equal(result.status, 'sent');
    assert.equal(result.sent, 1);
    assert.deepEqual(JSON.parse(requests[0].options.body), { chat_id: '8095534849', text: order.text });
});
test('failed Telegram response is reported, not thrown', async () => {
    const result = await sendTelegramAlert(order, {
        env: { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_IDS: '8095534849' },
        fetchImpl: async () => ({ ok: false, json: async () => ({ ok: false }) }), logger
    });
    assert.equal(result.status, 'failed');
});
test('multiple recipients support partial delivery', async () => {
    let n = 0;
    const result = await sendTelegramAlert(order, {
        env: { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_IDS: '8095534849,12345678' },
        fetchImpl: async () => ({ ok: ++n === 1, json: async () => ({ ok: n === 1 }) }), logger
    });
    assert.deepEqual(result, { status: 'partial', sent: 1, expected: 2 });
});
