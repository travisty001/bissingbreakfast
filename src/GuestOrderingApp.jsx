import React, { useState, useEffect } from 'react';

const TIME_SLOTS = ['08:30 AM', '08:45 AM', '09:00 AM', '09:15 AM', '09:30 AM', '09:45 AM', '10:00 AM', '10:15 AM', '10:30 AM', 'Continental'];

const createEmptyPlate = (num) => ({
    plateNumber: num,
    plateType: '', // 'Egg' | 'Griddle'
    eggStyle: 'Scrambled',
    griddleType: 'Crepes',
    griddleFlavor: 'Plain',
    griddleToppings: [],
    sides: [],
    beverages: [],
    notes: ''
});

export default function GuestOrderingApp() {
    const [timeIndex, setTimeIndex] = useState(0);
    const [guestCount, setGuestCount] = useState(1);
    const [guestCountChosen, setGuestCountChosen] = useState(false);
    const [plates, setPlates] = useState([createEmptyPlate(1), createEmptyPlate(2)]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submittedOrder, setSubmittedOrder] = useState(null);

    // --- LIVE DAYTIME TRAVELER FORECAST STATE ---
    const [weather, setWeather] = useState({
        locationName: '',
        tempMax: null,
        desc: 'Connecting to live weather service...',
        icon: '⏳',
        rainChance: null,
        windMax: null,
        uvIndex: null,
        morningTemp: null,
        morningDesc: '',
        noonTemp: null,
        noonDesc: '',
        afternoonTemp: null,
        afternoonDesc: '',
        fetchTime: null,
        isError: false
    });

    const eggStyles = ['Scrambled', 'Over Easy', 'Over Medium', 'Over Hard', 'Poached', 'Hard Boiled'];
    const griddleTypes = ['Crepes', 'French Toast', 'Pancakes'];
    const griddleFlavors = ['Plain', 'Hazelnut Spread'];
    const griddleToppings = ['Strawberries', 'Banana'];
    const sideOptions = ['Bacon', 'Hashbrowns', 'Whole Wheat Toast', 'White Toast'];
    const bevOptions = ['Coffee', 'Orange Juice', 'Black Tea', 'Green Tea'];

    // --- SUITE ROUTING & BACKGROUNDS ---
    const searchParams = new URLSearchParams(window.location.search);
    const urlRoom = searchParams.get('room');
    const rawPath = window.location.pathname.split('/').pop();
    const lowerRoom = (urlRoom || rawPath || '').toLowerCase();

    const isRoomSpecified = lowerRoom.includes('tea') || lowerRoom.includes('basgall') || lowerRoom.includes('bissing');

    let roomName = 'Bissing';
    let displayRoomName = 'BISSING SUITE';
    let bgImage = '/room-backgrounds/bissing-official-highres.webp';

    if (lowerRoom.includes('tea')) {
        roomName = 'TeaRose';
        displayRoomName = 'TEA ROSE SUITE';
        bgImage = '/room-backgrounds/tea-rose-suite-2025.webp';
    } else if (lowerRoom.includes('basgall')) {
        roomName = 'Basgall';
        displayRoomName = 'BASGALL SUITE';
        bgImage = '/room-backgrounds/basgall-portrait-highres.webp';
    }

    const requestedTime = TIME_SLOTS[timeIndex];
    const isContinental = requestedTime === 'Continental';

    const [existingOrderId, setExistingOrderId] = useState(null);
    const [orderLookupDone, setOrderLookupDone] = useState(false);

    // Rehydrate the room's order for tomorrow so changes do not create duplicate cards.
    useEffect(() => {
        if (!isRoomSpecified) return;
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;
        const roomId = { Bissing: 1, Basgall: 2, TeaRose: 3 }[roomName];
        let alive = true;
        const storageKey = `bissing-order-${roomId}-${date}`;
        const savedId = window.localStorage.getItem(storageKey);
        if (!savedId) { setOrderLookupDone(true); return; }
        fetch(`https://api-peaufx4prq-uc.a.run.app/api/orders/current?room_id=${roomId}&service_date=${date}&order_id=${encodeURIComponent(savedId)}`)
            .then(r => { if (!r.ok) throw new Error('Lookup failed'); return r.json(); })
            .then(data => {
                if (!alive || !data.order) return;
                const order = data.order;
                setExistingOrderId(order.order_id);
                const idx = TIME_SLOTS.indexOf(order.requested_time);
                if (idx >= 0) setTimeIndex(idx);
                if (idx === TIME_SLOTS.indexOf('Continental')) return;
                const saved = (order.items || []).slice(0, 2).map((item, i) => {
                    const raw = item.item_name || '';
                    const main = raw.split(' - Sides: ')[0];
                    const eggMatch = main.match(/^Egg Breakfast \((.*?)\)/i);
                    const isGriddle = !eggMatch;
                    const griddleType = ['Crepes', 'French Toast', 'Pancakes'].find(t => main.includes(t)) || 'Crepes';
                    const sides = (raw.match(/Sides: (.*?) \| Drinks:/)?.[1] || '').split(', ').filter(x => x && x !== 'No sides');
                    const beverages = (raw.match(/Drinks: (.*?)(?: \[Special Request:|$)/)?.[1] || '').split(', ').filter(x => x && x !== 'No beverages');
                    return { ...createEmptyPlate(i + 1), plateType: isGriddle ? 'Griddle' : 'Egg',
                        eggStyle: eggMatch?.[1] || 'Scrambled', griddleType,
                        griddleFlavor: main.startsWith('Hazelnut Spread') ? 'Hazelnut Spread' : 'Plain',
                        griddleToppings: ['Strawberries', 'Banana'].filter(t => main.includes(` with `) && main.split(' with ')[1].split(' & ').includes(t)),
                        sides, beverages, notes: raw.match(/\[Special Request: (.*?)\]/)?.[1] || '' };
                });
                if (saved.length) {
                    setPlates([...saved, ...[1,2].slice(saved.length).map(i => createEmptyPlate(i+1))]);
                }
            })
            .catch(err => console.warn('Existing-order lookup unavailable:', err))
            .finally(() => { if (alive) setOrderLookupDone(true); });
        return () => { alive = false; };
    }, [roomName, isRoomSpecified]);

    // --- FETCH REAL NEXT-DAY FORECAST ---
    useEffect(() => {
        if (submittedOrder) {
            const API_KEY = 'e0ed10ab10774f0cb51224830261704';
            const WEATHER_URL = `https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=67601&days=2&aqi=no&alerts=no`;

            fetch(WEATHER_URL)
                .then(async res => {
                    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
                    return res.json();
                })
                .then(data => {
                    if (data.forecast?.forecastday?.[1]) {
                        const tomorrowDay = data.forecast.forecastday[1].day;
                        const hours = data.forecast.forecastday[1].hour || [];
                        const conditionText = tomorrowDay.condition.text.toLowerCase();

                        let weatherIcon = '🌤️';
                        if (conditionText.includes('sun') || conditionText.includes('clear')) weatherIcon = '☀️';
                        if (conditionText.includes('cloud') || conditionText.includes('overcast')) weatherIcon = '☁️';
                        if (conditionText.includes('rain') || conditionText.includes('drizzle')) weatherIcon = '🌧️';
                        if (conditionText.includes('snow') || conditionText.includes('ice')) weatherIcon = '❄️';
                        if (conditionText.includes('thunder')) weatherIcon = '⛈️';

                        const morning = hours[9] || hours[8];
                        const noon = hours[12];
                        const afternoon = hours[15] || hours[16];
                        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        setWeather({
                            locationName: data.location.name || 'Hays, KS',
                            tempMax: Math.round(tomorrowDay.maxtemp_f),
                            desc: tomorrowDay.condition.text,
                            icon: weatherIcon,
                            rainChance: tomorrowDay.daily_chance_of_rain || 0,
                            windMax: Math.round(tomorrowDay.maxwind_mph),
                            uvIndex: tomorrowDay.uv,
                            morningTemp: morning ? Math.round(morning.temp_f) : null,
                            morningDesc: morning ? morning.condition.text : '',
                            noonTemp: noon ? Math.round(noon.temp_f) : null,
                            noonDesc: noon ? noon.condition.text : '',
                            afternoonTemp: afternoon ? Math.round(afternoon.temp_f) : null,
                            afternoonDesc: afternoon ? afternoon.condition.text : '',
                            fetchTime: timestamp,
                            isError: false
                        });
                    }
                })
                .catch(err => {
                    setWeather(prev => ({
                        ...prev,
                        locationName: 'Hays, KS',
                        desc: `Live Forecast Unavailable (${err.message})`,
                        icon: '⚠️',
                        isError: true
                    }));
                });
        }
    }, [submittedOrder]);

    const updatePlate = (index, updater) => {
        setPlates(prev => prev.map((plate, i) => (i === index ? updater(plate) : plate)));
    };

    const togglePlateArrayItem = (index, field, item) => {
        updatePlate(index, plate => {
            const list = plate[field];
            let filtered = list;
            if (item === 'White Toast') filtered = list.filter(i => i !== 'Whole Wheat Toast');
            if (item === 'Whole Wheat Toast') filtered = list.filter(i => i !== 'White Toast');

            const next = filtered.includes(item)
                ? filtered.filter(i => i !== item)
                : [...filtered, item];
            return { ...plate, [field]: next };
        });
    };

    const activePlates = plates.slice(0, guestCount);
    const isOrderReady = isContinental || activePlates.every(p => p.plateType === 'Egg' || p.plateType === 'Griddle');

    const handleSubmitOrder = () => {
        if (!isContinental) {
            for (let i = 0; i < activePlates.length; i++) {
                if (!activePlates[i].plateType) {
                    alert(`Please select Eggs or Griddle Breakfast for Guest ${i + 1}.`);
                    return;
                }
            }
        }

        setIsSubmitting(true);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const serviceDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

        const roomMapping = { 'Bissing': 1, 'Basgall': 2, 'TeaRose': 3, 'Tearose': 3, 'tearose': 3 };

        const builtPlates = activePlates.map(p => {
            const itemName = p.plateType === 'Egg'
                ? `Egg Breakfast (${p.eggStyle})`
                : `${p.griddleFlavor} ${p.griddleType}${p.griddleToppings.length ? ` with ${p.griddleToppings.join(' & ')}` : ''}`;
            const sidesText = p.sides.length > 0 ? p.sides.join(', ') : 'No sides';
            const bevText = p.beverages.length > 0 ? p.beverages.join(', ') : 'No beverages';
            const details = `Sides: ${sidesText} | Drinks: ${bevText}`;
            const plateNote = p.notes.trim();

            return {
                name: itemName,
                details,
                plateNote,
                customization_note: plateNote
                    ? `${itemName} - ${details} [Special Request: ${plateNote}]`
                    : `${itemName} - ${details}`
            };
        });

        const finalItems = isContinental ? [{
            menu_item_id: 1,
            quantity: 1,
            customization_note: "Continental Setup - Guest notified to check dining room and fridge."
        }] : builtPlates.map(item => ({
            menu_item_id: 1,
            quantity: 1,
            customization_note: item.customization_note
        }));

        fetch('https://api-peaufx4prq-uc.a.run.app/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                room_id: roomMapping[roomName] || 1,
                service_date: serviceDate,
                requested_time: requestedTime,
                guest_count: isContinental ? 1 : guestCount, // Continental is one room-level request, not per guest
                dietary_notes: "",
                order_items: finalItems
            })
        })
        .then(async res => {
            if (!res.ok) throw new Error("Server rejected the request.");
            return res.json();
        })
        .then(data => {
            setIsSubmitting(false);
            if (data.success) {
                setExistingOrderId(data.order_id || existingOrderId);
                if (data.order_id) window.localStorage.setItem(`bissing-order-${roomMapping[roomName]}-${serviceDate}`, data.order_id);
                setSubmittedOrder({ time: requestedTime, items: isContinental ? [] : builtPlates });
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        })
        .catch(err => {
            setIsSubmitting(false);
            alert("Error sending order to the kitchen. Please try again.");
            console.error("Order error:", err);
        });
    };

    // --- SHARED VISUAL STYLES ---
    const pageWrapperStyle = (bg) => ({
        '--bh-room-photo': `url('${bg}')`,
        backgroundColor: '#32242d',
        minHeight: '100vh',
        width: '100vw',
        margin: 0,
        padding: '28px 16px 80px 16px',
        boxSizing: 'border-box',
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    });

    const columnStyle = {
        maxWidth: '760px',
        margin: '0 auto'
    };

    const frostedHeaderStyle = {
        backgroundColor: 'rgba(43, 24, 34, 0.80)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.16)',
        borderRadius: '24px',
        padding: '42px 28px 38px 28px',
        textAlign: 'center',
        marginBottom: '18px',
        boxShadow: '0 20px 45px rgba(0, 0, 0, 0.55)'
    };

    const darkNavyShellStyle = {
        backgroundColor: 'rgba(250, 244, 233, 0.65)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.09)',
        borderRadius: '22px',
        padding: '24px',
        boxShadow: '0 24px 55px rgba(0, 0, 0, 0.75)',
        color: '#30212a'
    };

    const innerNavyCardStyle = {
        backgroundColor: '#fffaf2',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '26px 24px',
        marginBottom: '16px'
    };

    const sectionLabelStyle = {
        color: '#6b441e',
        display: 'block',
        marginBottom: '12px',
        textTransform: 'uppercase',
        letterSpacing: '1.2px',
        fontSize: '11px',
        fontWeight: '700'
    };

    const mainCourseCardStyle = (isSelected) => ({
        textAlign: 'left',
        padding: '16px 18px',
        borderRadius: '8px',
        backgroundColor: isSelected ? '#edd3a0' : '#fbf4e9',
        border: isSelected ? '2px solid #805124' : '1px solid #c7ad8b',
        color: '#34202d',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        boxShadow: isSelected ? '0 0 18px rgba(212, 175, 55, 0.18)' : 'none'
    });

    const checkboxCardStyle = (isChecked) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '13px 16px',
        borderRadius: '8px',
        backgroundColor: isChecked ? '#edd3a0' : '#fbf4e9',
        border: isChecked ? '2px solid #805124' : '1px solid #c7ad8b',
        color: '#34202d',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s ease'
    });

    // No menu or room picker without a suite-specific QR URL.
    if (!isRoomSpecified) return null;

    // --- 2. CONFIRMATION, LOCAL GUIDE & WEATHER SCREEN ---
    if (submittedOrder) {
        const isContinentalConfirmation = submittedOrder.time === 'Continental';
        const localLinks = [
            { title: 'Dining in Hays', description: 'Find restaurants, cafes and places to eat.', url: 'https://www.visithays.com/BusinessDirectoryII.aspx?lngBusinessCategoryID=73' },
            { title: 'Downtown Businesses', description: 'Browse the shops, restaurants and services on The Bricks.', url: 'https://www.downtownhays.com/' },
            { title: 'What’s Happening', description: 'Live events calendar for downtown Hays.', url: 'https://bricks.downtownhays.com/calendar/' },
            { title: 'Hays Events', description: 'Festivals, performances and activities around town.', url: 'https://www.visithays.com/calendar.aspx' },
            { title: 'Things to Explore', description: 'Museums, local history and visitor attractions.', url: 'https://www.visithays.com/' },
        ];

        return (
            <div className="bh-guest bh-room-page bh-confirm-page" style={pageWrapperStyle('/dining.jpg')}>
                <div style={columnStyle}>
                    <header className="bh-logo-masthead" aria-label={`Bissing House — ${displayRoomName}`}>
                        <span className="bh-logo-coin-wrap" role="img" aria-label="Bissing House">
                            <span className="bh-logo-coin">
                                <img className="bh-logo-coin-face bh-logo-coin-front" src="/Bissing-Logo-Lg-300x300.png" alt="" />
                                <img className="bh-logo-coin-face bh-logo-coin-back" src="/Bissing-Logo-Lg-300x300.png" alt="" />
                            </span>
                        </span>
                    </header>
                    <main className="bh-order-shell bh-confirm-shell" style={darkNavyShellStyle}>
                        <section className="bh-confirm-card" aria-labelledby="bh-confirm-heading">
                            <div className="bh-confirm-check" aria-hidden="true">✓</div>
                            <h1 id="bh-confirm-heading">Breakfast Order Confirmed</h1>
                            <p className="bh-confirm-lead">
                                {isContinentalConfirmation
                                    ? 'Your continental breakfast request is confirmed. Help yourself in the dining room before 8 AM; chilled items are in the dining room fridge.'
                                    : <>We’ll have breakfast ready for you at <strong>{submittedOrder.time.replace(/^0/, '')}</strong> in the dining room.</>}
                            </p>
                            {!isContinentalConfirmation && submittedOrder.items?.length > 0 && (
                                <div className="bh-confirm-items">
                                    {submittedOrder.items.map((item, idx) => (
                                        <div className="bh-confirm-item" key={idx}>
                                            <strong>Guest {idx + 1}: {item.name}</strong>
                                            <span>{item.details}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        <button type="button" className="bh-confirm-edit" onClick={() => { setSubmittedOrder(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                            Edit My Breakfast Order
                        </button>

                        <section className="bh-confirm-card bh-weather-card" aria-labelledby="bh-weather-heading">
                            <h2 id="bh-weather-heading">Tomorrow’s Weather in Hays</h2>
                            <div className="bh-weather-overview" aria-live="polite">
                                <span className="bh-weather-icon" aria-hidden="true">{weather.icon}</span>
                                <div>
                                    <strong>{weather.isError ? 'Forecast unavailable' : weather.locationName || 'Hays, Kansas'}</strong>
                                    <p>{weather.tempMax !== null && !weather.isError ? `${weather.desc} · High ${weather.tempMax}°F` : weather.desc}</p>
                                </div>
                            </div>
                            {!weather.isError && weather.morningTemp !== null && (
                                <div className="bh-weather-hours" aria-label="Tomorrow’s hourly temperatures">
                                    {[
                                        { label: '9 AM', temp: weather.morningTemp },
                                        { label: 'Noon', temp: weather.noonTemp },
                                        { label: '3 PM', temp: weather.afternoonTemp }
                                    ].filter(period => period.temp !== null).map(period => (
                                        <div className="bh-weather-hour" key={period.label}>
                                            <span>{period.label}</span>
                                            <strong>{period.temp}°F</strong>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <p className="bh-weather-footnote">Forecasts can change. Check conditions before heading out.</p>
                        </section>

                        <section className="bh-confirm-card bh-local-guide" aria-labelledby="bh-local-heading">
                            <h2 id="bh-local-heading">Enjoy Your Stay in Hays</h2>
                            <p>Explore local businesses, places to visit and what’s happening while you’re here.</p>
                            <div className="bh-local-grid">
                                {localLinks.map(link => (
                                    <a className="bh-local-link" key={link.title} href={link.url} target="_blank" rel="noopener noreferrer">
                                        <strong>{link.title}<span aria-hidden="true"> ↗</span></strong>
                                        <span>{link.description}</span>
                                    </a>
                                ))}
                            </div>
                        </section>
                    </main>
                </div>
            </div>
        );
    }

    // --- 3. MAIN ORDERING VIEW ---
    return (
        <div className="bh-guest bh-room-page" style={pageWrapperStyle(bgImage)}>
            <div style={columnStyle}>
                {/* TOP FROSTED HEADER WITH CIRCULAR LOGO */}
                <header className="bh-logo-masthead" aria-label={`Bissing House — ${displayRoomName}`}>
                    <span className="bh-logo-coin-wrap" role="img" aria-label="Bissing House">
                      <span className="bh-logo-coin">
                        <img className="bh-logo-coin-face bh-logo-coin-front" src="/Bissing-Logo-Lg-300x300.png" alt="" />
                        <img className="bh-logo-coin-face bh-logo-coin-back" src="/Bissing-Logo-Lg-300x300.png" alt="" />
                      </span>
                    </span>
                </header>

                {/* Choose the number of people before showing any breakfast options. */}
                <div className="bh-order-shell" style={darkNavyShellStyle}>
                    {!guestCountChosen ? (
                      <section className="bh-guest-start" aria-labelledby="bh-guest-start-title">
                        <span className="bh-kicker">BISSING HOUSE · BREAKFAST</span>
                        <h1 id="bh-guest-start-title">How many people are staying in your room?</h1>
                        <p>Select the number of guests to begin your breakfast order.</p>
                        <div className="bh-guest-start-options" role="group" aria-label="Number of people staying">
                          {[1, 2].map(count => (
                            <button key={count} type="button" aria-label={`${count} ${count === 1 ? 'person' : 'people'}`} onClick={() => { setGuestCount(count); setGuestCountChosen(true); }}>
                              <strong>{count}</strong>
                            </button>
                          ))}
                        </div>
                      </section>
                    ) : (
                      <>
                        <section className="bh-stay-summary" aria-label="Guest count">
                          <span>Breakfast for <strong>{guestCount} {guestCount === 1 ? 'person' : 'people'}</strong></span>
                          <button type="button" onClick={() => setGuestCountChosen(false)}>Change</button>
                        </section>
                    <section className="bh-clock-section bh-breakfast-service" aria-label="Breakfast service">
                      <div className="bh-service-heading"><p>Choose a serving time or an early continental breakfast.</p></div>
                      <label className="bh-serving-time-field" htmlFor="breakfast-serving-time">
                        <span>Breakfast time</span>
                        <select id="breakfast-serving-time" className="bh-serving-time-select" value={requestedTime} onChange={event => setTimeIndex(TIME_SLOTS.indexOf(event.target.value))}>
                          {TIME_SLOTS.map(time => (
                            <option key={time} value={time}>{time === 'Continental' ? 'Continental — before 8 AM' : time.replace(/^0/, '')}</option>
                          ))}
                        </select>
                      </label>
                      <div className="bh-service-details" aria-live="polite">
                        {isContinental ? (
                          <p>For an early start, help yourself to continental breakfast in the dining room before 8 AM. Chilled items are in the dining room fridge.</p>
                        ) : (
                          <>
                            <p>Your breakfast will be served in the dining room at <strong>{requestedTime.replace(/^0/, '')}</strong>.</p>
                            <p className="bh-service-extra">You’re welcome to take it to the porch, weather permitting, or enjoy it in the parlor. TV trays are available in both areas.</p>
                          </>
                        )}
                      </div>
                    </section>
                    {isContinental ? null : (
                        activePlates.map((plate, idx) => (
                            <div key={plate.plateNumber} style={innerNavyCardStyle}>
                                <h2 style={{ fontFamily: "Georgia, 'Merriweather', serif", fontSize: '20px', color: '#38251d', margin: '0 0 4px 0', fontWeight: '700' }}>
                                    Guest {plate.plateNumber}
                                </h2>
                                <p style={{ color: '#5e4b41', fontSize: '12.5px', margin: '0 0 22px 0' }}>
                                    Customize a cooked-to-order breakfast for this guest.
                                </p>

                                <div style={{ marginBottom: '24px' }}>
                                    <span style={sectionLabelStyle}>1. SELECT MAIN COURSE</span>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <button
                                            type="button"
                                            onClick={() => updatePlate(idx, p => ({ ...p, plateType: 'Egg' }))}
                                            style={mainCourseCardStyle(plate.plateType === 'Egg')}
                                        >
                                            <div style={{ fontFamily: "Georgia, 'Merriweather', serif", fontSize: '15px', fontWeight: '700', marginBottom: '3px' }}>
                                                Eggs
                                            </div>
                                            <div style={{ fontSize: '12.5px', color: '#5e4b41' }}>
                                                Choose egg style
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => updatePlate(idx, p => ({ ...p, plateType: 'Griddle' }))}
                                            style={mainCourseCardStyle(plate.plateType === 'Griddle')}
                                        >
                                            <div style={{ fontFamily: "Georgia, 'Merriweather', serif", fontSize: '15px', fontWeight: '700', marginBottom: '3px' }}>
                                                Griddle Breakfast
                                            </div>
                                            <div style={{ fontSize: '12.5px', color: '#5e4b41' }}>
                                                Crepes, French Toast, or Pancakes
                                            </div>
                                        </button>
                                    </div>

                                    {plate.plateType === 'Egg' && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '12px' }}>
                                            {eggStyles.map(style => {
                                                const active = plate.eggStyle === style;
                                                return (
                                                    <button
                                                        key={style}
                                                        type="button"
                                                        onClick={() => updatePlate(idx, p => ({ ...p, eggStyle: style }))}
                                                        style={{
                                                            padding: '10px 8px',
                                                            borderRadius: '6px',
                                                            border: active ? '2px solid #805124' : '1px solid #c7ad8b',
                                                            backgroundColor: active ? '#edd3a0' : '#fbf4e9',
                                                            color: '#38251d',
                                                            fontSize: '13px',
                                                            fontWeight: active ? '800' : '600',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        {style}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {plate.plateType === 'Griddle' && (
                                        <div style={{ marginTop: '12px' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' }}>
                                                {griddleTypes.map(type => {
                                                    const active = plate.griddleType === type;
                                                    return (
                                                        <button
                                                            key={type}
                                                            type="button"
                                                            onClick={() => updatePlate(idx, p => ({ ...p, griddleType: type }))}
                                                            style={{
                                                                padding: '10px 8px',
                                                                borderRadius: '6px',
                                                                border: active ? '2px solid #805124' : '1px solid #c7ad8b',
                                                                backgroundColor: active ? '#edd3a0' : '#fbf4e9',
                                                                color: '#38251d',
                                                                fontSize: '13px',
                                                                fontWeight: active ? '800' : '600',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            {type}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                {griddleFlavors.map(flavor => {
                                                    const active = plate.griddleFlavor === flavor;
                                                    return (
                                                        <button
                                                            key={flavor}
                                                            type="button"
                                                            onClick={() => updatePlate(idx, p => ({ ...p, griddleFlavor: flavor }))}
                                                            style={{
                                                                padding: '10px 8px',
                                                                borderRadius: '6px',
                                                                border: active ? '2px solid #805124' : '1px solid #c7ad8b',
                                                                backgroundColor: active ? '#edd3a0' : '#fbf4e9',
                                                                color: '#38251d',
                                                                fontSize: '12.5px',
                                                                fontWeight: '700',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            {flavor}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <div className="bh-griddle-toppings" role="group" aria-label="Optional fruit toppings">
                                                <div className="bh-griddle-toppings-heading">Fruit toppings <span>(optional — choose either or both)</span></div>
                                                <div className="bh-griddle-toppings-options">
                                                    {griddleToppings.map(topping => {
                                                        const selected = plate.griddleToppings.includes(topping);
                                                        return (
                                                            <button key={topping} type="button" aria-pressed={selected}
                                                                onClick={() => togglePlateArrayItem(idx, 'griddleToppings', topping)}
                                                                style={checkboxCardStyle(selected)}>
                                                                <span aria-hidden="true" className="bh-topping-check">{selected ? '✓' : ''}</span>
                                                                {topping}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div style={{ marginBottom: '24px' }}>
                                    <span style={sectionLabelStyle}>2. ACCOMPANIMENTS</span>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        {sideOptions.map(side => {
                                            const checked = plate.sides.includes(side);
                                            return (
                                                <button
                                                    key={side}
                                                    type="button"
                                                    onClick={() => togglePlateArrayItem(idx, 'sides', side)}
                                                    style={checkboxCardStyle(checked)}
                                                >
                                                    <span style={{
                                                        width: '16px',
                                                        height: '16px',
                                                        borderRadius: '3px',
                                                        backgroundColor: checked ? '#805124' : '#ffffff',
                                                        color: '#ffffff',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '12px',
                                                        fontWeight: '900',
                                                        flexShrink: 0
                                                    }}>
                                                        {checked ? '✓' : ''}
                                                    </span>
                                                    <span>{side}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <span style={sectionLabelStyle}>3. BEVERAGES</span>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        {bevOptions.map(bev => {
                                            const checked = plate.beverages.includes(bev);
                                            return (
                                                <button
                                                    key={bev}
                                                    type="button"
                                                    onClick={() => togglePlateArrayItem(idx, 'beverages', bev)}
                                                    style={checkboxCardStyle(checked)}
                                                >
                                                    <span style={{
                                                        width: '16px',
                                                        height: '16px',
                                                        borderRadius: '3px',
                                                        backgroundColor: checked ? '#805124' : '#ffffff',
                                                        color: '#ffffff',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '12px',
                                                        fontWeight: '900',
                                                        flexShrink: 0
                                                    }}>
                                                        {checked ? '✓' : ''}
                                                    </span>
                                                    <span>{bev}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <span style={sectionLabelStyle}>4. SPECIAL REQUESTS / DIETARY NOTES</span>
                                    <input
                                        type="text"
                                        value={plate.notes}
                                        onChange={(e) => updatePlate(idx, p => ({ ...p, notes: e.target.value }))}
                                        placeholder="Allergies or dietary restrictions..."
                                        style={{
                                            width: '100%',
                                            padding: '12px 14px',
                                            borderRadius: '6px',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            backgroundColor: 'rgba(11, 17, 30, 0.85)',
                                            color: '#ffffff',
                                            fontSize: '13.5px',
                                            boxSizing: 'border-box',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>
                        ))
                    )}

                    <button
                        className="bh-submit-order"
                        type="button"
                        onClick={handleSubmitOrder}
                        disabled={isSubmitting}
                        style={{
                            width: '100%',
                            padding: '16px 24px',
                            borderRadius: '6px',
                            border: isOrderReady ? '1px solid #f3cf55' : '1px solid rgba(255,255,255,0.12)',
                            backgroundColor: isOrderReady ? '#d4af37' : 'rgba(255, 255, 255, 0.08)',
                            color: '#201321',
                            fontFamily: "Georgia, 'Merriweather', serif",
                            fontSize: '16px',
                            fontWeight: '700',
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: isOrderReady ? '0 8px 24px rgba(212, 175, 55, 0.3)' : 'none'
                        }}
                    >
                        {isSubmitting
                            ? 'Sending Order to Kitchen...'
                            : isContinental
                            ? 'Submit Continental Breakfast Request'
                            : 'Submit Breakfast Order'}
                    </button>

                    <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b', marginTop: '14px' }}>
                        * Consuming raw or undercooked meats, poultry, or eggs may increase your risk of foodborne illness.
                    </div>
                      </>
                    )}
                </div>
            </div>
        </div>
    );
}