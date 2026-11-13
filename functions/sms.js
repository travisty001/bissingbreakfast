'use strict';

// Carrier email-to-text is retired. Verizon vtext.com has stopped working;
// T-Mobile tmomail.net is unverified. No email-to-SMS messages are sent.
// Leave this explicit fail-closed implementation in place until a supported
// SMS provider is selected, approved, and independently tested.
function getAlertChannelsStatus() {
    return {
        verizon: 'discontinued',
        tmobile: 'unverified',
        replacement_sms: 'not_configured',
        carrier_email_to_text: 'disabled',
        telegram: 'independent'
    };
}

async function sendOrderAlert() {
    // Intentionally no network requests, recipients, or credential lookup.
    return { status: 'disabled', reason: 'carrier_email_to_text_retired' };
}

module.exports = { sendOrderAlert, getAlertChannelsStatus };
