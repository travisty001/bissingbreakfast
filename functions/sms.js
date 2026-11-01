'use strict';
// Fail closed to Travis-only until testing is explicitly ended by the operator.
const TRAVIS = '7852596900@vtext.com';
const NORMAL_RECIPIENTS = ['7852593556@vtext.com', '2143358780@tmomail.net', TRAVIS];
function testOnly(env = process.env) { return env.SMS_TEST_ONLY !== 'false'; }

async function sendOrderAlert({ enabled, text, orderId }, { env = process.env, mailer, logger = console } = {}) {
    const mode = testOnly(env) ? 'travis_only' : 'normal';
    if (!enabled) return { status: 'disabled', mode };
    if (!env.SMS_GMAIL_USER || !env.SMS_GMAIL_APP_PASSWORD) {
        logger.error('SMS skipped: Gmail credentials missing', { orderId, mode });
        return { status: 'missing_credentials', mode };
    }
    try {
        const transporter = mailer.createTransport({
            service: 'gmail',
            auth: { user: env.SMS_GMAIL_USER, pass: env.SMS_GMAIL_APP_PASSWORD },
            connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
        });
        const info = await transporter.sendMail({
            from: env.SMS_GMAIL_USER,
            to: mode === 'travis_only' ? [TRAVIS] : NORMAL_RECIPIENTS,
            subject: '',
            text
        });
        const accepted = (info.accepted || []).length;
        const rejected = (info.rejected || []).length;
        const status = rejected ? 'smtp_rejected' : accepted ? 'smtp_accepted' : 'smtp_unconfirmed';
        // SMTP acceptance is not confirmation of delivery to a phone.
        logger.log('SMS transport result', { orderId, mode, status, accepted, rejected });
        return { status, mode };
    } catch (err) {
        // Do not log credentials or full provider error objects.
        logger.error('SMS transport failed', { orderId, mode, code: err.code || 'UNKNOWN', responseCode: err.responseCode || null });
        return { status: 'failed', mode, code: err.code || 'UNKNOWN' };
    }
}
module.exports = { sendOrderAlert, testOnly };
