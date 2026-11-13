'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sendOrderAlert, getAlertChannelsStatus } = require('./sms');

test('carrier email-to-text is disabled for new and updated breakfast orders', async () => {
    for (const orderId of ['new', 'updated']) {
        const result = await sendOrderAlert({ text: 'Breakfast order', orderId });
        assert.deepEqual(result, { status: 'disabled', reason: 'carrier_email_to_text_retired' });
    }
});

test('even configured legacy SMTP credentials cannot trigger a carrier message', async () => {
    const mailer = { createTransport() { throw Error('SMTP must never be called'); } };
    const result = await sendOrderAlert({ orderId: 'test' }, {
        env: { SMS_GMAIL_USER: 'fake@example.invalid', SMS_GMAIL_APP_PASSWORD: 'fake' },
        mailer
    });
    assert.equal(result.status, 'disabled');
});

test('channel statuses do not claim unverified T-Mobile delivery', () => {
    assert.deepEqual(getAlertChannelsStatus(), {
        verizon: 'discontinued',
        tmobile: 'unverified',
        replacement_sms: 'not_configured',
        carrier_email_to_text: 'disabled',
        telegram: 'independent'
    });
});
