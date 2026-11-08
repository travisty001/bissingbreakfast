// Build and run npm run preview -- --port 5177 first.
// Run with Playwright available (NODE_PATH may point at a separate test install).
// All API requests are mocked: no guest orders or notifications are sent.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
    const {getOrderingWindow} = await import('../functions/ordering-window.mjs');
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
    try {
        async function scenario(instant, timezoneId = 'Pacific/Honolulu') {
            const context = await browser.newContext({ timezoneId, viewport: {width:390,height:844} });
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', e => errors.push(e.message));
            page.on('dialog', async d => { errors.push(d.message()); await d.dismiss(); });
            await page.clock.install({time: new Date(instant)});
            let reject = false;
            let statusFails = false;
            const orders = [];
            await page.route('https://api-peaufx4prq-uc.a.run.app/**', async route => {
                const url = route.request().url();
                let body;
                let status = 200;
                if (url.endsWith('/ordering-window')) {
                    body = getOrderingWindow(new Date(await page.evaluate(() => Date.now())));
                    if (statusFails) status = 503;
                } else if (url.endsWith('/orders')) {
                    orders.push(route.request().postDataJSON());
                    body = reject ? {success:false, code:'ORDERING_CLOSED', ordering:getOrderingWindow(new Date('2026-11-09T05:00:00Z'))} : {success:true,order_id:'test-order-12345'};
                    if (reject) status=403;
                } else body = {success:true,order:null};
                await route.fulfill({status,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS'},contentType:'application/json',body:JSON.stringify(body)});
            });
            await page.route('https://api.weatherapi.com/**', route => route.abort());
            await page.goto('http://127.0.0.1:5177/?room=Bissing');
            return {context,page,errors,orders,reject:()=>{reject=true;},fail:()=>{statusFails=true;}};
        }
        const closed = await scenario('2026-11-08T14:00:00Z');
        await closed.page.getByRole('heading',{name:'Breakfast Ordering Is Closed'}).waitFor();
        assert.match(await closed.page.locator('.bh-confirm-lead').innerText(), /until 11 PM only/);
        assert.equal(await closed.page.getByRole('button',{name:/Submit|Edit My/}).count(),0);
        assert.equal(await closed.page.locator('.bh-confirm-check').innerText(),'☾');
        assert.equal(await closed.page.locator('body').evaluate(e => e.scrollWidth > innerWidth),false);
        assert.deepEqual(closed.errors,[]);
        await closed.context.close();
        const open = await scenario('2026-11-09T04:59:58Z','Asia/Tokyo');
        await open.page.getByRole('heading',{name:'How many people are staying in your room?'}).waitFor();
        await open.page.clock.fastForward(3000);
        await open.page.getByRole('heading',{name:'Breakfast Ordering Is Closed'}).waitFor();
        assert.equal(open.orders.length,0);
        assert.deepEqual(open.errors,[]);
        await open.context.close();
        const reopen = await scenario('2026-11-08T20:59:58Z');
        await reopen.page.getByRole('heading',{name:'Breakfast Ordering Is Closed'}).waitFor();
        await reopen.page.clock.fastForward(3000);
        await reopen.page.getByRole('heading',{name:'How many people are staying in your room?'}).waitFor();
        await reopen.context.close();
        for (const rejection of [false,true]) {
            const current = await scenario('2026-11-09T02:00:00Z','Asia/Tokyo');
            await current.page.getByRole('button',{name:'1 person',exact:true}).click();
            await current.page.locator('select').first().selectOption('Continental');
            if (rejection) current.reject();
            await current.page.getByRole('button',{name:'Submit Continental Breakfast Request'}).click();
            await current.page.waitForTimeout(1000);
            await current.page.getByRole('heading',{name:rejection ? 'Breakfast Ordering Is Closed' : 'Breakfast Order Confirmed'}).waitFor();
            assert.equal(current.orders[0].service_date,'2026-11-09');
            assert.deepEqual(current.errors,[]);
            await current.context.close();
        }
        const offline = await scenario('2026-11-09T02:00:00Z');
        await offline.page.getByRole('heading',{name:'How many people are staying in your room?'}).waitFor();
        offline.fail();
        await offline.page.clock.fastForward(60001);
        await offline.page.getByRole('heading',{name:'Menu Temporarily Unavailable'}).waitFor();
        assert.equal(await offline.page.getByRole('button',{name:/Submit/}).count(),0);
        await offline.context.close();
        console.log('PASS: closed screen, mobile layout, cutoff, reopening, wrong device timezone, success, server rejection, and unavailable status');
    } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
