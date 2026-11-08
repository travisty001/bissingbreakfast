'use strict';
// Exercises the actual Express order endpoint without touching production Firebase,
// SMTP, or Telegram. Fake dependencies record each notification.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const http = require('node:http');

test('new and replacement orders alert both channels and isolate transport failures', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-08T04:59:59Z') });
    const originalLoad = Module._load;
    const messages = [];
    const smsMessages = [];
    let smsThrows = false;
    let telegramThrows = false;
    const docs = [];
    const fakeDb = {
        settings() {},
        collection(name) {
            assert.equal(name, 'orders');
            return {
                where() { return { get: async () => ({ docs: docs.map(d => ({
                    data: () => d.value,
                    ref: { id: d.id, update: async v => { d.value = { ...d.value, ...v }; } }
                })) }) }; },
                add: async value => {
                    const d = { id: 'isolated-order-1', value };
                    docs.push(d);
                    return { id: d.id };
                }
            };
        }
    };
    const fakeAdmin = {
        initializeApp() {},
        firestore: Object.assign(() => fakeDb, {
            FieldValue: { serverTimestamp: () => 'test-timestamp' }
        })
    };
    const fakeSqlite = { verbose: () => ({
        Database: class {
            all(sql, params, callback) { callback(null, []); }
        }
    }) };
    const fakeFunctions = { https: { onRequest: (options, app) => {
        assert.deepEqual(options.secrets, ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_IDS', 'SMS_GMAIL_APP_PASSWORD']);
        return app;
    } } };
    const fakeSms = { sendOrderAlert: async message => {
        smsMessages.push(message);
        if (smsThrows) throw new Error('SMTP unavailable');
        return { status: 'smtp_accepted' };
    } };
    const fakeTelegram = {
        sendTelegramAlert: async message => {
            messages.push(message);
            if (telegramThrows) throw new Error('Telegram unavailable');
            return { status: 'sent', sent: 1, expected: 1 };
        }
    };
    Module._load = function(request, parent, _isMain) {
        if (parent && parent.filename.endsWith('/functions/index.js')) {
            if (request === 'firebase-admin') return fakeAdmin;
            if (request === 'firebase-functions') return fakeFunctions;
            if (request === 'firebase-functions/params') return { defineSecret: name => name };
            if (request === 'sqlite3') return fakeSqlite;
            if (request === './telegram') return fakeTelegram;
            if (request === './sms') return fakeSms;
            if (request === 'nodemailer') return {};
        }
        return originalLoad.apply(this, arguments);
    };
    let app;
    try { app = require('./index').api; }
    finally { Module._load = originalLoad; }
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const endpoint = 'http://127.0.0.1:' + server.address().port + '/api/orders';
    try {
        async function submit(time) {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    room_id: 1, service_date: '2026-11-08',
                    requested_time: time, guest_count: 1, order_items: []
                })
            });
            assert.equal(response.status, 200);
            return response.json();
        }
        const first = await submit('8:30');
        assert.equal(first.updated, false);
        assert.equal(first.telegram.status, 'sent');
        assert.equal(first.sms.status, 'smtp_accepted');
        assert.equal(messages[0].text, 'New Breakfast Order: Bissing Suite for 8:30.');
        const second = await submit('9:15');
        assert.equal(second.updated, true);
        assert.equal(second.order_id, first.order_id);
        assert.equal(messages[1].text, 'Updated Breakfast Order: Bissing Suite for 9:15.');
        assert.deepEqual(smsMessages, messages);
        smsThrows = true;
        const third = await submit('9:30');
        assert.equal(third.success, true);
        assert.equal(third.sms.status, 'failed');
        assert.equal(third.telegram.status, 'sent');
        smsThrows = false; telegramThrows = true;
        const fourth = await submit('9:45');
        assert.equal(fourth.success, true);
        assert.equal(fourth.sms.status, 'smtp_accepted');
        assert.equal(fourth.telegram.status, 'failed');
        assert.equal(smsMessages.length, 4);
        assert.equal(messages.length, 4);
        assert.equal(docs.length, 1);
        assert.equal(docs[0].value.requested_time, '9:45');
        const snapshot = JSON.stringify(docs);
        for (const instant of ['2026-11-08T05:00:00Z', '2026-11-08T06:00:00Z', '2026-11-08T20:59:59Z']) {
            t.mock.timers.setTime(new Date(instant).getTime());
            const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({room_id: 1, service_date: '2026-11-08', requested_time: '10:00'}) });
            assert.equal(response.status, 403);
            assert.equal((await response.json()).code, 'ORDERING_CLOSED');
            const menu = await fetch(endpoint.replace('/orders', '/menu'));
            assert.equal(menu.status, 403);
        }
        assert.equal(JSON.stringify(docs), snapshot);
        assert.equal(messages.length, 4);
        assert.equal(smsMessages.length, 4);
        t.mock.timers.setTime(new Date('2026-11-08T21:00:00Z').getTime());
        const status = await fetch(endpoint.replace('/orders', '/ordering-window'));
        assert.equal(status.headers.get('cache-control'), 'no-store');
        assert.equal((await status.json()).open, true);
        assert.equal((await fetch(endpoint.replace('/orders', '/menu'))).status, 200);
        const stale = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({room_id: 1, service_date: '2026-11-08', requested_time: '10:00'}) });
        assert.equal(stale.status, 400);
        assert.equal(messages.length, 4);
    } finally { await new Promise(resolve => server.close(resolve)); }
});
