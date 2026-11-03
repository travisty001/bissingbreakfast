'use strict';
// Three authorized breakfast-alert recipients. No dashboard on/off switch or test-only routing.
const ALERT_RECIPIENTS = [
    '7852593556@vtext.com',
    '2143358780@tmomail.net',
    '7852596900@vtext.com'
];

async function sendOrderAlert({ text, orderId }, { env = process.env, mailer, logger = console } = {}) {
    if (!env.SMS_GMAIL_USER || !env.SMS_GMAIL_APP_PASSWORD) {
        logger.error('SMS skipped: Gmail credentials missing', { orderId });
        return { status: 'missing_credentials' };
    }
    try {
        const transporter = mailer.createTransport({
            service: 'gmail',
            auth: { user: env.SMS_GMAIL_USER, pass: env.SMS_GMAIL_APP_PASSWORD },
            connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
        });
        const info = await transporter.sendMail({
            from: env.SMS_GMAIL_USER,
            to: ALERT_RECIPIENTS,
            subject: '',
            text
        });
        const accepted = (info.accepted || []).length;
        const rejected = (info.rejected || []).length;
        const status = rejected ? 'smtp_rejected' : accepted === ALERT_RECIPIENTS.length ? 'smtp_accepted' : 'smtp_unconfirmed';
        // SMTP acceptance does not guarantee phone delivery.
        logger.log('SMS transport result', { orderId, status, accepted, rejected, expected: ALERT_RECIPIENTS.length });
        return { status };
    } catch (err) {
        logger.error('SMS transport failed', { orderId, code: err.code || 'UNKNOWN', responseCode: err.responseCode || null });
        return { status: 'failed', code: err.code || 'UNKNOWN' };
    }
}
module.exports = { sendOrderAlert };
