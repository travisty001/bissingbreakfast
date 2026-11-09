import "./victorian-menu.css";
import React, { useState, useEffect, useRef } from "react";
import {
  getOrderingWindow,
  ORDERING_CLOSED_MESSAGE,
} from "../functions/ordering-window.mjs";

const TIME_SLOTS = [
  "08:30 AM",
  "08:45 AM",
  "09:00 AM",
  "09:15 AM",
  "09:30 AM",
  "09:45 AM",
  "10:00 AM",
  "10:15 AM",
  "10:30 AM",
  "Continental",
];

const createEmptyPlate = (num) => ({
  plateNumber: num,
  plateType: "", // 'Egg' | 'Griddle'
  eggStyle: "Scrambled",
  griddleType: "Crepes",
  griddleFlavor: "Plain",
  griddleToppings: [],
  sides: [],
  beverages: [],
  notes: "",
});

export default function GuestOrderingApp() {
  const [reviewing, setReviewing] = useState(false);
  const [formError, setFormError] = useState("");
  const [timeIndex, setTimeIndex] = useState(0);
  const [guestCount, setGuestCount] = useState(1);
  const [guestCountChosen, setGuestCountChosen] = useState(false);
  const [plates, setPlates] = useState([
    createEmptyPlate(1),
    createEmptyPlate(2),
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState(null);

  const activeServiceDate = useRef(null);
  const serverClock = useRef(null);
  const [ordering, setOrdering] = useState(null);
  const [orderingUnavailable, setOrderingUnavailable] = useState(false);
  // Start closed until server time is known; keep open tabs in sync across the cutoff.
  useEffect(() => {
    let alive = true;

    const tick = () => {
      const clock = serverClock.current;
      if (alive && clock)
        setOrdering(
          getOrderingWindow(
            new Date(clock.time + performance.now() - clock.at),
          ),
        );
    };
    const sync = async () => {
      try {
        const response = await fetch(
          "https://api-peaufx4prq-uc.a.run.app/api/ordering-window",
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("Ordering status unavailable");
        const status = await response.json();
        const time = Date.parse(status.serverNow);
        if (!Number.isFinite(time) || typeof status.open !== "boolean")
          throw new Error("Invalid ordering status");
        if (!alive) return;
        serverClock.current = { time, at: performance.now() };
        setOrderingUnavailable(false);
        tick();
      } catch {
        if (alive) {
          serverClock.current = null;
          setOrdering(null);
          setOrderingUnavailable(true);
        }
      }
    };
    sync();
    const ticker = setInterval(tick, 1000);
    const refresh = setInterval(sync, 60000);
    const onVisible = () => {
      if (!document.hidden) {
        tick();
        sync();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(ticker);
      clearInterval(refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // --- LIVE DAYTIME TRAVELER FORECAST STATE ---
  const [weather, setWeather] = useState({
    locationName: "",
    tempMax: null,
    desc: "Connecting to live weather service...",
    icon: "⏳",
    rainChance: null,
    windMax: null,
    uvIndex: null,
    morningTemp: null,
    morningDesc: "",
    noonTemp: null,
    noonDesc: "",
    afternoonTemp: null,
    afternoonDesc: "",
    fetchTime: null,
    isError: false,
  });

  const eggStyles = [
    "Scrambled",
    "Over Easy",
    "Over Medium",
    "Over Hard",
    "Poached",
    "Hard Boiled",
  ];
  const griddleTypes = ["Crepes", "French Toast", "Pancakes"];
  const griddleFlavors = ["Plain", "Hazelnut Spread"];
  const griddleToppings = ["Strawberries", "Banana"];
  const sideOptions = [
    "Bacon",
    "Hashbrowns",
    "Whole Wheat Toast",
    "White Toast",
  ];
  const bevOptions = ["Coffee", "Orange Juice", "Black Tea", "Green Tea"];

  // --- SUITE ROUTING & BACKGROUNDS ---
  const searchParams = new URLSearchParams(window.location.search);
  const urlRoom = searchParams.get("room");
  const rawPath = window.location.pathname.split("/").pop();
  const lowerRoom = (urlRoom || rawPath || "").toLowerCase();

  const isRoomSpecified =
    lowerRoom.includes("tea") ||
    lowerRoom.includes("basgall") ||
    lowerRoom.includes("bissing");

  let roomName = "Bissing";
  let displayRoomName = "BISSING SUITE";

  if (lowerRoom.includes("tea")) {
    roomName = "TeaRose";
    displayRoomName = "TEA ROSE SUITE";
  } else if (lowerRoom.includes("basgall")) {
    roomName = "Basgall";
    displayRoomName = "BASGALL SUITE";
  }

  const requestedTime = TIME_SLOTS[timeIndex];
  const isContinental = requestedTime === "Continental";

  const [existingOrderId, setExistingOrderId] = useState(null);
  const [orderLookupDone, setOrderLookupDone] = useState(false);

  useEffect(() => {
    if (!ordering?.open || activeServiceDate.current === ordering.serviceDate)
      return;
    activeServiceDate.current = ordering.serviceDate;
    setReviewing(false);
    setSubmittedOrder(null);
    setExistingOrderId(null);
    setGuestCountChosen(false);
    setGuestCount(1);
    setTimeIndex(0);
    setPlates([createEmptyPlate(1), createEmptyPlate(2)]);
  }, [ordering?.open, ordering?.serviceDate]);

  // Rehydrate the room's order for tomorrow so changes do not create duplicate cards.
  useEffect(() => {
    if (!isRoomSpecified || !ordering?.open) return;
    const date = ordering.serviceDate;
    const roomId = { Bissing: 1, Basgall: 2, TeaRose: 3 }[roomName];
    let alive = true;
    const storageKey = `bissing-order-${roomId}-${date}`;
    const savedId = window.localStorage.getItem(storageKey);
    if (!savedId) {
      setOrderLookupDone(true);
      return;
    }
    fetch(
      `https://api-peaufx4prq-uc.a.run.app/api/orders/current?room_id=${roomId}&service_date=${date}&order_id=${encodeURIComponent(savedId)}`,
    )
      .then((r) => {
        if (!r.ok) throw new Error("Lookup failed");
        return r.json();
      })
      .then((data) => {
        if (!alive || !data.order) return;
        const order = data.order;
        setExistingOrderId(order.order_id);
        const idx = TIME_SLOTS.indexOf(order.requested_time);
        if (idx >= 0) setTimeIndex(idx);
        if (idx === TIME_SLOTS.indexOf("Continental")) return;
        const saved = (order.items || []).slice(0, 2).map((item, i) => {
          const raw = item.item_name || "";
          const main = raw.split(" - Sides: ")[0];
          const eggMatch = main.match(/^Egg Breakfast \((.*?)\)/i);
          const isGriddle = !eggMatch;
          const griddleType =
            ["Crepes", "French Toast", "Pancakes"].find((t) =>
              main.includes(t),
            ) || "Crepes";
          const sides = (raw.match(/Sides: (.*?) \| Drinks:/)?.[1] || "")
            .split(", ")
            .filter((x) => x && x !== "No sides");
          const beverages = (
            raw.match(/Drinks: (.*?)(?: \[Special Request:|$)/)?.[1] || ""
          )
            .split(", ")
            .filter((x) => x && x !== "No beverages");
          return {
            ...createEmptyPlate(i + 1),
            plateType: isGriddle ? "Griddle" : "Egg",
            eggStyle: eggMatch?.[1] || "Scrambled",
            griddleType,
            griddleFlavor: main.startsWith("Hazelnut Spread")
              ? "Hazelnut Spread"
              : "Plain",
            griddleToppings: ["Strawberries", "Banana"].filter(
              (t) =>
                main.includes(` with `) &&
                main.split(" with ")[1].split(" & ").includes(t),
            ),
            sides,
            beverages,
            notes: raw.match(/\[Special Request: (.*?)\]/)?.[1] || "",
          };
        });
        if (saved.length) {
          setPlates([
            ...saved,
            ...[1, 2].slice(saved.length).map((i) => createEmptyPlate(i + 1)),
          ]);
        }
      })
      .catch((err) => console.warn("Existing-order lookup unavailable:", err))
      .finally(() => {
        if (alive) setOrderLookupDone(true);
      });
    return () => {
      alive = false;
    };
  }, [roomName, isRoomSpecified, ordering?.open, ordering?.serviceDate]);

  // --- FETCH REAL NEXT-DAY FORECAST ---
  useEffect(() => {
    if (submittedOrder) {
      const API_KEY = "e0ed10ab10774f0cb51224830261704";
      const WEATHER_URL = `https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=67601&days=2&aqi=no&alerts=no`;

      fetch(WEATHER_URL)
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (data.forecast?.forecastday?.[1]) {
            const tomorrowDay = data.forecast.forecastday[1].day;
            const hours = data.forecast.forecastday[1].hour || [];
            const conditionText = tomorrowDay.condition.text.toLowerCase();

            let weatherIcon = "🌤️";
            if (
              conditionText.includes("sun") ||
              conditionText.includes("clear")
            )
              weatherIcon = "☀️";
            if (
              conditionText.includes("cloud") ||
              conditionText.includes("overcast")
            )
              weatherIcon = "☁️";
            if (
              conditionText.includes("rain") ||
              conditionText.includes("drizzle")
            )
              weatherIcon = "🌧️";
            if (conditionText.includes("snow") || conditionText.includes("ice"))
              weatherIcon = "❄️";
            if (conditionText.includes("thunder")) weatherIcon = "⛈️";

            const morning = hours[9] || hours[8];
            const noon = hours[12];
            const afternoon = hours[15] || hours[16];
            const timestamp = new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            setWeather({
              locationName: data.location.name || "Hays, KS",
              tempMax: Math.round(tomorrowDay.maxtemp_f),
              desc: tomorrowDay.condition.text,
              icon: weatherIcon,
              rainChance: tomorrowDay.daily_chance_of_rain || 0,
              windMax: Math.round(tomorrowDay.maxwind_mph),
              uvIndex: tomorrowDay.uv,
              morningTemp: morning ? Math.round(morning.temp_f) : null,
              morningDesc: morning ? morning.condition.text : "",
              noonTemp: noon ? Math.round(noon.temp_f) : null,
              noonDesc: noon ? noon.condition.text : "",
              afternoonTemp: afternoon ? Math.round(afternoon.temp_f) : null,
              afternoonDesc: afternoon ? afternoon.condition.text : "",
              fetchTime: timestamp,
              isError: false,
            });
          }
        })
        .catch((err) => {
          setWeather((prev) => ({
            ...prev,
            locationName: "Hays, KS",
            desc: `Live Forecast Unavailable (${err.message})`,
            icon: "⚠️",
            isError: true,
          }));
        });
    }
  }, [submittedOrder]);

  const updatePlate = (index, updater) => {
    setPlates((prev) =>
      prev.map((plate, i) => (i === index ? updater(plate) : plate)),
    );
  };

  const togglePlateArrayItem = (index, field, item) => {
    updatePlate(index, (plate) => {
      const list = plate[field];
      let filtered = list;
      if (item === "White Toast")
        filtered = list.filter((i) => i !== "Whole Wheat Toast");
      if (item === "Whole Wheat Toast")
        filtered = list.filter((i) => i !== "White Toast");

      const next = filtered.includes(item)
        ? filtered.filter((i) => i !== item)
        : [...filtered, item];
      return { ...plate, [field]: next };
    });
  };

  const activePlates = plates.slice(0, guestCount);
  const isOrderReady =
    isContinental ||
    activePlates.every(
      (p) => p.plateType === "Egg" || p.plateType === "Griddle",
    );

  const handleSubmitOrder = () => {
    if (!ordering?.open || isSubmitting) return;
    if (!isContinental) {
      for (let i = 0; i < activePlates.length; i++) {
        if (!activePlates[i].plateType) {
          alert(`Please select Eggs or Griddle Breakfast for Guest ${i + 1}.`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    const serviceDate = ordering.serviceDate;

    const roomMapping = {
      Bissing: 1,
      Basgall: 2,
      TeaRose: 3,
      Tearose: 3,
      tearose: 3,
    };

    const builtPlates = activePlates.map((p) => {
      const itemName =
        p.plateType === "Egg"
          ? `Egg Breakfast (${p.eggStyle})`
          : `${p.griddleFlavor} ${p.griddleType}${p.griddleToppings.length ? ` with ${p.griddleToppings.join(" & ")}` : ""}`;
      const sidesText = p.sides.length > 0 ? p.sides.join(", ") : "No sides";
      const bevText =
        p.beverages.length > 0 ? p.beverages.join(", ") : "No beverages";
      const details = `Sides: ${sidesText} | Drinks: ${bevText}`;
      const plateNote = p.notes.trim();

      return {
        name: itemName,
        details,
        plateNote,
        customization_note: plateNote
          ? `${itemName} - ${details} [Special Request: ${plateNote}]`
          : `${itemName} - ${details}`,
      };
    });

    const finalItems = isContinental
      ? [
          {
            menu_item_id: 1,
            quantity: 1,
            customization_note:
              "Continental Setup - Guest notified to check dining room and fridge.",
          },
        ]
      : builtPlates.map((item) => ({
          menu_item_id: 1,
          quantity: 1,
          customization_note: item.customization_note,
        }));

    fetch("https://api-peaufx4prq-uc.a.run.app/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room_id: roomMapping[roomName] || 1,
        service_date: serviceDate,
        requested_time: requestedTime,
        guest_count: isContinental ? 1 : guestCount, // Continental is one room-level request, not per guest
        dietary_notes: "",
        order_items: finalItems,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (data.code === "ORDERING_CLOSED") {
          serverClock.current = {
            time: Date.parse(data.ordering.serverNow),
            at: performance.now(),
          };
          setOrdering(data.ordering);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return data;
        }
        if (!res.ok) throw new Error("Server rejected the request.");
        return data;
      })
      .then((data) => {
        setIsSubmitting(false);
        if (data.success) {
          setExistingOrderId(data.order_id || existingOrderId);
          if (data.order_id)
            window.localStorage.setItem(
              `bissing-order-${roomMapping[roomName]}-${serviceDate}`,
              data.order_id,
            );
          setSubmittedOrder({
            time: requestedTime,
            items: isContinental ? [] : builtPlates,
          });
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      })
      .catch((err) => {
        setIsSubmitting(false);
        alert("Error sending order to the kitchen. Please try again.");
        console.error("Order error:", err);
      });
  };

  const names = ["Guest one", "Guest two"];
  const ornament = (
    <div className="vm-ornament" aria-hidden="true">
      <svg
        viewBox="0 0 320 32"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      >
        <path d="M8 16H78C99 16 97 3 86 5C76 7 86 27 112 16C130 8 145 9 160 16C175 9 190 8 208 16C234 27 244 7 234 5C223 3 221 16 242 16H312M50 22H108C128 22 139 20 150 16M270 22H212C192 22 181 20 170 16" />
        <path d="M160 4L166 16L160 28L154 16Z" />
        <circle cx="25" cy="16" r="3" />
        <circle cx="295" cy="16" r="3" />
      </svg>
    </div>
  );
  const changeScreen = (review) => {
    setReviewing(review);
    setFormError("");
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const choices = (options, selected, change, multiple = false) => (
    <div className="vm-grid">
      {options.map((option) => (
        <button
          type="button"
          key={option}
          aria-pressed={
            multiple ? selected.includes(option) : selected === option
          }
          onClick={() => change(option)}
          className="vm-tile"
        >
          <span
            aria-hidden="true"
            className={multiple ? "vm-mark square" : "vm-mark"}
          >
            {(multiple ? selected.includes(option) : selected === option)
              ? "✓"
              : ""}
          </span>
          {option}
        </button>
      ))}
    </div>
  );
  const plateSummary = (p) => (
    <>
      <p>
        <strong>
          {p.plateType === "Egg"
            ? "Eggs · " + p.eggStyle
            : p.griddleType + " · " + p.griddleFlavor}
        </strong>
      </p>
      {p.plateType === "Griddle" && p.griddleToppings.length > 0 && (
        <p>{p.griddleToppings.join(", ")}</p>
      )}
      <p>Sides: {p.sides.join(", ") || "None"}</p>
      <p>Drinks: {p.beverages.join(", ") || "None"}</p>
      {p.notes && <p>Special request: {p.notes}</p>}
    </>
  );
  if (!isRoomSpecified) return null;
  return (
    <div className="vm-page">
      <div className="vm-shell">
        <header className="vm-paper vm-brand">
          <img src="/Bissing-Logo-Lg-300x300.png" alt="Bissing House" />
          <p className="vm-eyebrow">Bissing House · Hays, Kansas</p>
          <h1>Breakfast at the House</h1>
          <p>A lovely start to your morning.</p>
          {ornament}
          <p className="vm-hint">{displayRoomName}</p>
        </header>
        {submittedOrder || !ordering?.open ? (
          <main>
            <section className="vm-paper vm-center">
              <div className="vm-success bh-confirm-check" aria-hidden="true">
                {submittedOrder ? "✓" : "☾"}
              </div>
              <h2>
                {submittedOrder
                  ? "Breakfast Order Confirmed"
                  : ordering
                    ? "Breakfast Ordering Is Closed"
                    : orderingUnavailable
                      ? "Menu Temporarily Unavailable"
                      : "Welcome to Bissing House"}
              </h2>
              <p className="bh-confirm-lead">
                {!submittedOrder
                  ? ordering
                    ? ORDERING_CLOSED_MESSAGE
                    : orderingUnavailable
                      ? "We’re unable to check ordering availability right now. Please try again shortly."
                      : "Checking breakfast ordering availability…"
                  : submittedOrder.time === "Continental"
                    ? "Your continental breakfast request is confirmed. Help yourself in the dining room before 8 AM; chilled items are in the dining room fridge."
                    : "We’ll have breakfast ready for you at " +
                      submittedOrder.time.replace(/^0/, "") +
                      " in the dining room."}
              </p>
              {submittedOrder?.items.map((item, i) => (
                <div className="vm-review-row" key={i}>
                  <h3>{names[i]}</h3>
                  <p>{item.name}</p>
                  <p>{item.details}</p>
                  {item.plateNote && <p>{item.plateNote}</p>}
                </div>
              ))}
              {submittedOrder && ordering?.open && (
                <button
                  className="vm-action"
                  onClick={() => {
                    setSubmittedOrder(null);
                    changeScreen(false);
                  }}
                >
                  Edit My Breakfast Order
                </button>
              )}
            </section>
            {submittedOrder && (
              <section className="vm-paper">
                <h2>Tomorrow in Hays</h2>
                <p>
                  {weather.isError
                    ? "Weather is temporarily unavailable."
                    : weather.tempMax !== null
                      ? weather.desc + " · High " + weather.tempMax + "°F"
                      : "Checking the forecast…"}
                </p>
                <a
                  href="https://www.visithays.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Explore Hays
                </a>
              </section>
            )}
          </main>
        ) : (
          <main>
            <ol className="vm-steps" aria-label="Breakfast steps">
              {["Your table", "Your breakfast", "Review"].map((step, i) => (
                <li
                  key={step}
                  aria-current={
                    i === (!guestCountChosen ? 0 : reviewing ? 2 : 1)
                      ? "step"
                      : undefined
                  }
                >
                  {step}
                </li>
              ))}
            </ol>
            {!guestCountChosen ? (
              <section className="vm-paper">
                <p className="vm-eyebrow">Your table</p>
                <h2>How many people are staying in your room?</h2>
                <p className="vm-hint">
                  Choose the number of guests to see the menu.
                </p>
                <div className="vm-grid">
                  {[1, 2].map((count) => (
                    <button
                      className="vm-tile"
                      key={count}
                      aria-label={count + (count === 1 ? " person" : " people")}
                      onClick={() => {
                        setGuestCount(count);
                        setGuestCountChosen(true);
                        changeScreen(false);
                      }}
                    >
                      {count} {count === 1 ? "guest" : "guests"}
                    </button>
                  ))}
                </div>
              </section>
            ) : reviewing ? (
              <section className="vm-paper">
                <button className="vm-back" onClick={() => changeScreen(false)}>
                  ← Back to your choices
                </button>
                <p className="vm-eyebrow">Review your breakfast</p>
                <h2>Your morning, together</h2>
                <p>
                  <strong>{requestedTime.replace(/^0/, "")}</strong>
                </p>
                {isContinental ? (
                  <p>
                    Continental breakfast — one request for your room. Help
                    yourself before 8 AM; chilled items are in the dining room
                    fridge.
                  </p>
                ) : (
                  activePlates.map((p, i) => (
                    <div className="vm-review-row" key={p.plateNumber}>
                      <h3>{names[i]}</h3>
                      {plateSummary(p)}
                    </div>
                  ))
                )}
                <button
                  className="vm-action"
                  disabled={isSubmitting}
                  onClick={handleSubmitOrder}
                >
                  {isSubmitting
                    ? "Sending Order to Kitchen..."
                    : isContinental
                      ? "Submit Continental Breakfast Request"
                      : "Submit Breakfast Order"}
                </button>
                <p className="vm-hint">
                  {existingOrderId
                    ? "Submitting replaces your previous breakfast order."
                    : "Send your choices to the kitchen when everything looks right."}
                </p>
              </section>
            ) : (
              <>
                <button
                  className="vm-back"
                  onClick={() => setGuestCountChosen(false)}
                >
                  ← Change guest count
                </button>
                <h2>What sounds good?</h2>
                <p className="vm-hint">Choose a breakfast for each of you.</p>
                <section className="vm-paper">
                  <p className="vm-eyebrow">At your leisure</p>
                  <h2>
                    <label htmlFor="breakfast-serving-time">
                      When would you like breakfast?
                    </label>
                  </h2>
                  <select
                    id="breakfast-serving-time"
                    value={requestedTime}
                    onChange={(e) =>
                      setTimeIndex(TIME_SLOTS.indexOf(e.target.value))
                    }
                  >
                    {TIME_SLOTS.map((time) => (
                      <option key={time} value={time}>
                        {time === "Continental"
                          ? "Continental — before 8 AM"
                          : time.replace(/^0/, "")}
                      </option>
                    ))}
                  </select>
                  <p>
                    {isContinental
                      ? "Help yourself to continental breakfast in the dining room before 8 AM. Chilled items are in the dining room fridge."
                      : "Join us in the dining room. Weather permitting, enjoy the porch, or settle into the parlor. TV trays are available in both areas."}
                  </p>
                  <p className="vm-hint">Orders accepted until 11 p.m.</p>
                </section>
                {!isContinental && (
                  <>
                    {guestCount === 2 && (
                      <nav className="vm-grid" aria-label="Guest shortcuts">
                        {names.map((name, i) => (
                          <a
                            className="vm-tile"
                            href={"#guest-" + i}
                            key={name}
                          >
                            {name} ↓
                          </a>
                        ))}
                      </nav>
                    )}
                    {activePlates.map((plate, i) => (
                      <section
                        className="vm-paper"
                        id={"guest-" + i}
                        key={plate.plateNumber}
                      >
                        <div className="vm-guest-title">
                          <span className="vm-number" aria-hidden="true">
                            {i + 1}
                          </span>
                          <h2>{names[i]}</h2>
                        </div>
                        <fieldset>
                          <legend>Main course</legend>
                          {choices(
                            ["Eggs", "Griddle Breakfast"],
                            plate.plateType === "Egg"
                              ? "Eggs"
                              : plate.plateType === "Griddle"
                                ? "Griddle Breakfast"
                                : "",
                            (v) =>
                              updatePlate(i, (p) => ({
                                ...p,
                                plateType: v === "Eggs" ? "Egg" : "Griddle",
                              })),
                          )}
                        </fieldset>
                        {plate.plateType === "Egg" && (
                          <fieldset>
                            <legend>Egg preparation</legend>
                            {choices(eggStyles, plate.eggStyle, (v) =>
                              updatePlate(i, (p) => ({ ...p, eggStyle: v })),
                            )}
                          </fieldset>
                        )}
                        {plate.plateType === "Griddle" && (
                          <>
                            <fieldset>
                              <legend>From the griddle</legend>
                              {choices(griddleTypes, plate.griddleType, (v) =>
                                updatePlate(i, (p) => ({
                                  ...p,
                                  griddleType: v,
                                })),
                              )}
                            </fieldset>
                            <fieldset>
                              <legend>Flavor</legend>
                              {choices(
                                griddleFlavors,
                                plate.griddleFlavor,
                                (v) =>
                                  updatePlate(i, (p) => ({
                                    ...p,
                                    griddleFlavor: v,
                                  })),
                              )}
                            </fieldset>
                            <fieldset>
                              <legend>Fruit toppings · optional</legend>
                              {choices(
                                griddleToppings,
                                plate.griddleToppings,
                                (v) =>
                                  togglePlateArrayItem(i, "griddleToppings", v),
                                true,
                              )}
                            </fieldset>
                          </>
                        )}
                        <fieldset>
                          <legend>Sides · optional</legend>
                          {choices(
                            sideOptions,
                            plate.sides,
                            (v) => togglePlateArrayItem(i, "sides", v),
                            true,
                          )}
                        </fieldset>
                        <fieldset>
                          <legend>Drinks · optional</legend>
                          {choices(
                            bevOptions,
                            plate.beverages,
                            (v) => togglePlateArrayItem(i, "beverages", v),
                            true,
                          )}
                        </fieldset>
                        <label className="vm-notes">
                          Special requests / dietary notes
                          <input
                            value={plate.notes}
                            onChange={(e) =>
                              updatePlate(i, (p) => ({
                                ...p,
                                notes: e.target.value,
                              }))
                            }
                            placeholder="Allergies or dietary restrictions…"
                          />
                        </label>
                      </section>
                    ))}
                  </>
                )}
                {formError && (
                  <p role="alert" className="vm-error">
                    {formError}
                  </p>
                )}
                <button
                  className="vm-action"
                  disabled={!orderLookupDone}
                  onClick={() => {
                    if (!isOrderReady) {
                      setFormError(
                        "Please choose a main course for " +
                          activePlates
                            .map((p, i) => (!p.plateType ? names[i] : null))
                            .filter(Boolean)
                            .join(" and ") +
                          ".",
                      );
                      return;
                    }
                    changeScreen(true);
                  }}
                >
                  Review breakfast
                </button>
                <p className="vm-hint">
                  Consuming raw or undercooked meats, poultry, or eggs may
                  increase your risk of foodborne illness.
                </p>
              </>
            )}
          </main>
        )}
        <footer className="vm-center">
          {ornament}
        </footer>
      </div>
    </div>
  );
}
