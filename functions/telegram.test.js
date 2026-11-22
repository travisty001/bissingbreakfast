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

const orderWithCopy = {
    orderId: 'updated-test', text: 'Updated Breakfast Order: Tea Rose Suite for 09:15 AM.', updated: true,
    order: {
        room_name: 'Tea Rose Suite', service_date: '2026-11-22', requested_time: '09:15 AM',
        guest_count: 2, dietary_notes: 'No peanuts', items: [
            { item_name: 'Crêpe with Banana - Sides: Bacon | Drinks: Coffee [Special Request: No butter]', quantity: 1 },
            { item_name: 'Egg Breakfast (Poached) - Sides: No sides | Drinks: Orange Juice', quantity: 1 }
        ]
    }
};
const twoChats = { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_IDS: '100,200' };

test('each chat receives one HTML kitchen card with its order alert as the caption', async () => {
    const requests = [];
    const result = await sendTelegramAlert(orderWithCopy, {
        env: twoChats, logger, fetchImpl: async (url, { body }) => {
            requests.push({ url, body });
            return Response.json({ ok: true });
        }
    });
    assert.deepEqual(result, { status: 'sent', sent: 2, expected: 2, copiesSent: 2 });
    assert.deepEqual(requests.map(({ body }) => body.get('chat_id')), ['100', '200']);
    for (const { url, body } of requests) {
        assert.ok(url.endsWith('/sendDocument'));
        assert.equal(body.get('caption'), orderWithCopy.text);
        const file = body.get('document');
        assert.equal(file.type, 'text/html');
        assert.equal(file.name, 'tea-rose-suite-2026-11-22-updated.html');
        const html = await file.text();
        assert.ok(html.startsWith('<!doctype html>'));
        assert.match(html, /Guest 1[\s\S]*Crêpe with Banana[\s\S]*Bacon[\s\S]*Coffee[\s\S]*No butter/);
        assert.match(html, /Guest 2[\s\S]*Egg Breakfast[\s\S]*Orange Juice/);
        assert.match(html, /Dietary notes[\s\S]*No peanuts/);
        assert.equal(body.get('disable_content_type_detection'), 'true');
    }
});

test('a rejected attachment falls back to a text notification for that chat only', async () => {
    const calls = [];
    const result = await sendTelegramAlert(orderWithCopy, {
        env: twoChats, logger, fetchImpl: async (url, { body }) => {
            const method = url.split('/').pop();
            const chat = body instanceof FormData ? body.get('chat_id') : JSON.parse(body).chat_id;
            calls.push([method, chat]);
            if (chat === '100' && method === 'sendDocument') {
                return Response.json({ ok: false, error_code: 403 }, { status: 403 });
            }
            return Response.json({ ok: true });
        }
    });
    assert.deepEqual(calls, [['sendDocument', '100'], ['sendMessage', '100'], ['sendDocument', '200']]);
    assert.deepEqual(result, { status: 'sent', sent: 2, expected: 2, copiesSent: 1 });
});

test('after an uncertain upload the next chat still receives its own copy', async () => {
    let attempts = 0;
    const result = await sendTelegramAlert(orderWithCopy, {
        env: twoChats, logger, fetchImpl: async () => {
            if (++attempts === 1) throw new Error('connection closed');
            return Response.json({ ok: true });
        }
    });
    assert.deepEqual(result, { status: 'partial', sent: 1, expected: 2, copiesSent: 1 });
    assert.equal(attempts, 2);
});

test('kitchen card prints free-form guest input as literal text', async () => {
    const { createOrderCopy } = require('./order-copy');
    const order = { ...orderWithCopy.order, room_name: '<img src=x>', dietary_notes: '<b>no nuts</b>',
        created_at: { toDate: () => new Date('2026-11-22T00:30:00Z') }, items: [
            { item_name: 'Crêpe - Sides: Toast | Drinks: Café [Special Request: <script>alert(1)</script>\nUse [A] | B & C]', quantity: 2 }
        ] };
    const { file } = createOrderCopy(order, true);
    const html = await file.text();
    assert.match(html, /&lt;img src=x&gt;/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;\nUse \[A\] \| B &amp; C/);
    assert.match(html, /&lt;b&gt;no nuts&lt;\/b&gt;/);
    assert.match(html, /Guest 1 · Qty 2/);
    assert.match(html, /Placed 6:30 PM/);
    assert.doesNotMatch(html, /<script/i);
});

test('continental card shows the room request and kitchen instructions', async () => {
    const { createOrderCopy } = require('./order-copy');
    const html = await createOrderCopy({ ...orderWithCopy.order, requested_time: 'Continental', items: [
        { item_name: 'Extra tea', quantity: 2 }
    ] }, false).file.text();
    assert.match(html, /Before 8 AM/);
    assert.match(html, /dining room fridge/);
    assert.match(html, /2 × Extra tea/);
    assert.doesNotMatch(html, /Guest 1/);
});
