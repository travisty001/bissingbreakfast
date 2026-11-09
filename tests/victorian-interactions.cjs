// Run after npm run build, with jsdom installed. All network traffic is mocked.
const { JSDOM } = require("jsdom");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const pause = () => new Promise((r) => setTimeout(r, 30));
(async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://localhost/?room=Basgall",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window,
    orders = [];
  w.scrollTo = () => {};
  w.alert = (m) => {
    throw Error(m);
  };
  w.fetch = async (url, init = {}) => ({
    ok: true,
    json: async () => {
      if (String(url).includes("ordering-window"))
        return { open: true, serverNow: "2026-11-09T02:00:00Z" };
      if (init.method === "POST") {
        orders.push(JSON.parse(init.body));
        return { success: true, order_id: "test-123" };
      }
      return { order: null };
    },
  });
  const asset = fs.readdirSync("dist/assets").find((f) => f.endsWith(".js"));
  w.eval(fs.readFileSync("dist/assets/" + asset, "utf8"));
  await pause();
  await pause();
  const click = async (name, scope = w.document) => {
    const b = [...scope.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === name,
    );
    assert.ok(b, "Button: " + name);
    b.click();
    await pause();
  };
  await click("2 guests");
  await click("Review breakfast");
  assert.match(
    w.document.querySelector("[role=alert]").textContent,
    /Guest one and Guest two/,
  );
  assert.equal(orders.length, 0);
  const guests = w.document.querySelectorAll("[id^=guest-]");
  await click("Eggs", guests[0]);
  await click("Over Easy", guests[0]);
  await click("Bacon", guests[0]);
  await click("Griddle Breakfast", guests[1]);
  await click("Pancakes", guests[1]);
  await click("Banana", guests[1]);
  await click("Review breakfast");
  assert.match(w.document.body.textContent, /Eggs · Over Easy/);
  assert.match(w.document.body.textContent, /Pancakes · Plain/);
  assert.equal(orders.length, 0);
  await click("← Back to your choices");
  assert.equal(
    w.document.querySelector("#guest-0 button[aria-pressed=true]").textContent,
    "✓Eggs",
  );
  await click("Review breakfast");
  await click("Submit Breakfast Order");
  assert.equal(orders.length, 1);
  assert.equal(orders[0].room_id, 2);
  assert.equal(orders[0].guest_count, 2);
  assert.match(orders[0].order_items[1].customization_note, /Banana/);
  assert.match(w.document.body.textContent, /Breakfast Order Confirmed/);
  await click("Edit My Breakfast Order");
  const select = w.document.querySelector("select");
  select.value = "Continental";
  select.dispatchEvent(new w.Event("change", { bubbles: true }));
  await pause();
  await click("Review breakfast");
  await click("Submit Continental Breakfast Request");
  assert.equal(orders.length, 2);
  assert.equal(orders[1].guest_count, 1);
  assert.equal(orders[1].order_items.length, 1);
  assert.equal(w.document.querySelectorAll(".vm-page img").length, 1);
  dom.window.close();
  console.log(
    "PASS: required choices, two guests, review, edit retention, room payload, confirmation and Continental",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
