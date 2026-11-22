'use strict';

const { readFileSync } = require('node:fs');
const path = require('node:path');

const assets = path.join(__dirname, 'order-card');
const css = readFileSync(path.join(assets, 'card.css'), 'utf8');
function imageData(filename) {
    return 'data:image/webp;base64,' + readFileSync(path.join(assets, filename)).toString('base64');
}
const logo = imageData('logo.webp');
const roomImages = new Map([
    ['Bissing Suite', imageData('bissing.webp')],
    ['Basgall Suite', imageData('basgall.webp')],
    ['Tea Rose Suite', imageData('tearose.webp')]
]);
const serviceDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' });
const placedTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago'
});
const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => escapes[c]);
}
function noteBox(label, value) {
    return value ? `<aside class="note"><strong>${label}</strong><p>${escapeHtml(value)}</p></aside>` : '';
}
function splitOnce(text, separator) {
    const i = text.indexOf(separator);
    return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i + separator.length)];
}
function guestPlate(item, index) {
    const [plate, request] = splitOnce(String(item.item_name || 'Breakfast plate'), ' [Special Request: ');
    const [main, details] = splitOnce(plate, ' - Sides: ');
    const [sides, drinks] = splitOnce(details, ' | Drinks: ');
    const quantity = Number(item.quantity || 1) === 1 ? '' : ' · Qty ' + escapeHtml(item.quantity);
    return `<section class="plate">
        <p class="guest-label">Guest ${index + 1}${quantity}</p>
        <h3>${escapeHtml(main)}</h3>
        <dl><div><dt>Sides</dt><dd>${escapeHtml(sides || 'None')}</dd></div>
            <div><dt>Drinks</dt><dd>${escapeHtml(drinks || 'None')}</dd></div></dl>
        ${noteBox('Special request', request.replace(/\]$/, ''))}
    </section>`;
}
function continentalPlate(items) {
    const standard = 'Continental Setup - Guest notified to check dining room and fridge.';
    const otherRequests = items.filter(item => item.item_name !== standard || Number(item.quantity || 1) !== 1)
        .map(item => Number(item.quantity || 1) === 1 ? item.item_name : item.quantity + ' × ' + item.item_name);
    return `<section class="plate"><h3>Continental breakfast</h3>
        <p class="instructions">Self-service before 8 AM in the dining room. Chilled options are in the dining room fridge.</p>
        ${noteBox('Room request', otherRequests.join('\n'))}</section>`;
}
function createOrderCopy(order, updated) {
    const continental = order.requested_time === 'Continental';
    const room = escapeHtml(order.room_name);
    const status = updated ? 'Updated order' : 'Confirmed order';
    const time = continental ? 'Before 8 AM' : escapeHtml(String(order.requested_time).replace(/^0(?=\d:)/, ''));
    const guests = continental ? 'Continental breakfast' : escapeHtml(order.guest_count) + (Number(order.guest_count) === 1 ? ' guest' : ' guests');
    const placed = order.created_at?.toDate?.() ?? (typeof order.created_at === 'string' ? new Date(order.created_at) : null);
    const placement = placed && Number.isFinite(placed.getTime()) ? `<span>Placed ${placedTime.format(placed)}</span>` : '';
    const photo = roomImages.get(order.room_name);
    const background = photo ? ` style="background-image: linear-gradient(100deg, rgba(30,18,27,.95), rgba(30,18,27,.77)), url('${photo}')"` : '';
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${room} · ${status} · Bissing House</title><style>${css}</style></head><body>
<main><header><img alt="Bissing House" src="${logo}"><div><h1>Kitchen Dashboard</h1><p class="date">${serviceDate.format(new Date(order.service_date + 'T12:00:00Z'))}</p></div></header>
<article class="ticket"><div class="summary"${background}><p class="status">${status}</p>
<div class="room-row"><h2>${room}</h2><strong class="time">${time}</strong></div>
<div class="meta"><span>${guests}</span>${placement}</div></div>
<div class="plates">${continental ? continentalPlate(order.items) : order.items.map(guestPlate).join('\n')}
${noteBox('Dietary notes', order.dietary_notes)}</div></article></main></body></html>`;
    const slug = String(order.room_name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
    const filename = [slug, order.service_date, updated ? 'updated' : 'confirmed'].join('-') + '.html';
    return { file: new Blob([html], { type: 'text/html' }), filename };
}

module.exports = { createOrderCopy };
