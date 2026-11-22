'use strict';

const pdfmake = require('pdfmake');
const fonts = require('pdfmake/fonts/Roboto');

pdfmake.addFonts(fonts);
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy(path => Object.values(fonts.Roboto).includes(path));

const serviceDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
});

function plateDetails(item) {
    // The guest menu stores each plate as one string, including the guest's free-form note.
    return String(item.item_name)
        .replace(' - Sides: ', '\nSides: ')
        .replace(' | Drinks: ', '\nDrinks: ')
        .replace(/ \[Special Request: ([\s\S]*)\]$/, '\nSpecial request: $1');
}

async function createOrderCopy(order, updated) {
    const continental = order.requested_time === 'Continental';
    const title = updated ? 'Breakfast order updated' : 'Breakfast order confirmed';
    const content = [
        { text: 'BISSING HOUSE', bold: true, color: '#795928', characterSpacing: 1.4, fontSize: 10 },
        { text: title, fontSize: 23, bold: true, margin: [0, 5, 0, 14] },
        { text: String(order.room_name), bold: true, fontSize: 17 },
        { text: serviceDate.format(new Date(order.service_date + 'T12:00:00Z')), margin: [0, 2, 0, 3] },
        { text: continental ? 'Continental breakfast · Before 8 AM' :
            String(order.requested_time) + ' · ' + order.guest_count + (Number(order.guest_count) === 1 ? ' guest' : ' guests') }
    ];
    order.items.forEach((item, index) => {
        const label = continental ? 'Room request' : 'Guest ' + (index + 1);
        const quantity = Number(item.quantity) === 1 ? '' : ' · Quantity ' + item.quantity;
        content.push(
            { text: label + quantity, bold: true, color: '#714361', margin: [0, 16, 0, 3] },
            { text: plateDetails(item) }
        );
    });
    if (order.dietary_notes) {
        content.push({ text: 'Dietary notes', bold: true, color: '#714361', margin: [0, 16, 0, 3] },
            { text: String(order.dietary_notes) });
    }

    const bytes = await pdfmake.createPdf({
        info: { title, author: 'Bissing House' },
        pageSize: { width: 338, height: 520 },
        pageMargins: [24, 24, 24, 24],
        defaultStyle: { fontSize: 12, lineHeight: 1.2, color: '#34262e' },
        content
    }).getBuffer();
    const room = String(order.room_name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
    const filename = [room, order.service_date, updated ? 'updated' : 'confirmed'].join('-') + '.pdf';
    return { file: new Blob([bytes], { type: 'application/pdf' }), filename };
}

module.exports = { createOrderCopy };
