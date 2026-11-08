// All breakfast ordering uses Hays time, independent of device/server timezone.
export const ORDERING_CLOSED_MESSAGE = 'Thank you for staying with us! Breakfast orders are accepted until 11 PM only. Ordering is now closed and will reopen at 3 PM for the following morning.';
const localTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23'
});
export function getOrderingWindow(now = new Date()) {
    const parts = Object.fromEntries(localTime.formatToParts(now).map(p => [p.type, p.value]));
    const hour = Number(parts.hour);
    const tomorrow = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1));
    return { open: hour >= 15 && hour < 23, serviceDate: tomorrow.toISOString().slice(0, 10),
        serverNow: now.toISOString(), timeZone: 'America/Chicago' };
}
