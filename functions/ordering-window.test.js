const {test} = require('node:test');
const assert = require('node:assert/strict');
test('Hays ordering window boundaries, midnight, daylight saving and year rollover', async () => {
    const {getOrderingWindow} = await import('./ordering-window.mjs');
    for (const [instant, open, serviceDate] of [
        ['2026-11-08T20:59:59.999Z', false, '2026-11-09'],
        ['2026-11-08T21:00:00.000Z', true, '2026-11-09'],
        ['2026-11-09T04:59:59.999Z', true, '2026-11-09'],
        ['2026-11-09T05:00:00.000Z', false, '2026-11-09'],
        ['2026-11-09T06:00:00.000Z', false, '2026-11-10'],
        ['2026-07-01T19:59:59.999Z', false, '2026-07-02'],
        ['2026-07-01T20:00:00.000Z', true, '2026-07-02'],
        ['2026-07-02T03:59:59.999Z', true, '2026-07-02'],
        ['2026-07-02T04:00:00.000Z', false, '2026-07-02'],
        ['2026-03-08T07:59:59Z', false, '2026-03-09'],
        ['2026-03-08T08:00:00Z', false, '2026-03-09'],
        ['2026-11-01T06:59:59Z', false, '2026-11-02'],
        ['2026-11-01T07:00:00Z', false, '2026-11-02'],
        ['2027-01-01T04:00:00Z', true, '2027-01-01']
    ]) {
        const result = getOrderingWindow(new Date(instant));
        assert.equal(result.open, open, instant);
        assert.equal(result.serviceDate, serviceDate, instant);
    }
});

test('override opens closed hours, expires exactly, preserves service date', async () => {
 const {getOrderingWindow}=await import('./ordering-window.mjs');
 const now=new Date('2026-11-27T14:00:00Z');
 assert.equal(getOrderingWindow(now).open,false);
 assert.equal(getOrderingWindow(now,'2026-11-27T15:00:00Z').open,true);
 assert.equal(getOrderingWindow(now,'2026-11-27T15:00:00Z').serviceDate,'2026-11-28');
 assert.equal(getOrderingWindow(now,now.toISOString()).open,false);
 assert.equal(getOrderingWindow(now,'invalid').overrideUntil,null);
});
