import React, { useState, useEffect } from 'react';

const TIME_SLOTS = ['08:00 AM', '08:15 AM', '08:30 AM', '08:45 AM', '09:00 AM', '09:15 AM', '09:30 AM', '09:45 AM', '10:00 AM', 'Continental'];

const createEmptyPlate = (num) => ({
    plateNumber: num,
    plateType: '', // 'Egg' | 'Griddle'
    eggStyle: 'Scrambled',
    griddleType: 'Crepes',
    griddleFlavor: 'Plain',
    sides: [],
    beverages: [],
    notes: ''
});

export default function GuestOrderingApp() {
    const [timeIndex, setTimeIndex] = useState(2);
    const [guestCount, setGuestCount] = useState(1);
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
    let bgImage = '/room-backgrounds/bissing-suite-2025.webp';

    if (lowerRoom.includes('tea')) {
        roomName = 'TeaRose';
        displayRoomName = 'TEA ROSE SUITE';
        bgImage = '/room-backgrounds/tea-rose-suite-2025.webp';
    } else if (lowerRoom.includes('basgall')) {
        roomName = 'Basgall';
        displayRoomName = 'BASGALL SUITE';
        bgImage = '/room-backgrounds/basgall-suite-2025.webp';
    }

    const requestedTime = TIME_SLOTS[timeIndex];
    const isContinental = requestedTime === 'Continental';

    const cycleTime = (dir) => {
        // Continental is a separate service, not a step on the clock face.
        const cookedSlotCount = TIME_SLOTS.length - 1;
        setTimeIndex((prev) => prev === cookedSlotCount
            ? (dir > 0 ? 0 : cookedSlotCount - 1)
            : (prev + dir + cookedSlotCount) % cookedSlotCount);
    };

    const clockHour = isContinental ? 8 : Number(requestedTime.slice(0, 2));
    const clockMinute = isContinental ? 0 : Number(requestedTime.slice(3, 5));
    const minuteAngle = clockMinute * 6;
    const hourAngle = (clockHour % 12) * 30 + clockMinute * 0.5;

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
                        sides, beverages, notes: raw.match(/\[Special Request: (.*?)\]/)?.[1] || '' };
                });
                if (saved.length) {
                    setGuestCount(saved.length);
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
                    alert(`Please select Eggs or Griddle Breakfast for ${guestCount === 1 ? 'your plate' : `Plate \${i + 1}`}.`);
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
                : `${p.griddleFlavor} ${p.griddleType}`;
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
                guest_count: isContinental ? 1 : activePlates.length,
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
                setSubmittedOrder({ time: requestedTime, items: builtPlates });
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
        backgroundImage: `linear-gradient(180deg, rgba(26, 15, 21, 0.27), rgba(26, 15, 21, 0.50)), url('${bg}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 37%',
        backgroundAttachment: 'fixed',
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

    // --- 1. WELCOME & QR LANDING PAGE ---
    if (!isRoomSpecified && !submittedOrder) {
        return (
            <div className="bh-guest" style={pageWrapperStyle('/house.jpg')}>
                <div style={columnStyle}>
                    <header className="bh-hero" style={frostedHeaderStyle}>
                        <img
                            className="bh-logo" src="/Bissing-Logo-Lg-300x300.png"
                            alt="Bissing House"
                            style={{ width: '88px', height: '88px', borderRadius: '50%', marginBottom: '14px', boxShadow: '0 4px 14px rgba(0,0,0,0.4)' }}
                        />
                        <p style={{ color: '#d4af37', fontSize: '11px', letterSpacing: '2.5px', textTransform: 'uppercase', margin: '0 0 8px 0', fontWeight: '700' }}>
                            HAYS, KANSAS &nbsp;•&nbsp; EST. 1908
                        </p>
                        <h1 style={{ fontFamily: "Georgia, 'Merriweather', serif", fontSize: '36px', color: '#ffffff', margin: '0 0 16px 0', fontWeight: '700' }}>
                            Bissing House
                        </h1>
                        <p style={{ color: '#e2e8f0', fontSize: '15px', lineHeight: '1.6', margin: 0 }}>
                            Please scan the QR code inside your suite to access your morning breakfast menu.
                        </p>
                    </header>
                </div>
            </div>
        );
    }

    // --- 2. CONFIRMATION & WEATHER SCREEN ---
    if (submittedOrder) {
        return (
            <div className="bh-guest" style={pageWrapperStyle('/dining.jpg')}>
                <div style={columnStyle}>
                    <header className="bh-hero bh-hero--room" aria-label={`Bissing House — ${displayRoomName}`}>
                    <img className="bh-logo bh-logo--room" src="/Bissing-Logo-Lg-300x300.png" alt="Bissing House" />
                </header>

                    <div className="bh-order-shell" style={darkNavyShellStyle}>
                        <div style={{ ...innerNavyCardStyle, textAlign: 'center', border: '1px solid rgba(212, 175, 55, 0.4)' }}>
                            <h2 style={{ color: '#d4af37', fontFamily: "Georgia, 'Merriweather', serif", marginTop: 0, marginBottom: '10px', fontSize: '26px' }}>
                                Order Confirmed
                            </h2>
                            <p style={{ color: '#cbd5e1', fontSize: '15px', margin: '0 0 18px 0' }}>
                                Your breakfast order is scheduled for <strong style={{ color: '#ffffff' }}>{submittedOrder.time}</strong>.
                            </p>

                            {submittedOrder.items && submittedOrder.items.length > 0 && (
                                <div style={{ textAlign: 'left', backgroundColor: 'rgba(8, 12, 22, 0.85)', padding: '16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    {submittedOrder.items.map((item, idx) => (
                                        <div key={idx} style={{ padding: '8px 0', borderBottom: idx < submittedOrder.items.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                                            <strong style={{ color: '#d4af37', display: 'block', fontSize: '14px' }}>
                                                Plate {idx + 1}: {item.name}
                                            </strong>
                                            <span style={{ color: '#cbd5e1', fontSize: '13px' }}>{item.details}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button type="button" onClick={() => { setSubmittedOrder(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            style={{ width: '100%', marginBottom: '16px', padding: '14px', background: '#d4af37', color: '#10131d', border: 0, borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
                            Edit My Breakfast Order
                        </button>
                        <div style={{ ...innerNavyCardStyle, marginBottom: 0 }}>
                            <h3 style={{ color: '#ffffff', fontFamily: "Georgia, 'Merriweather', serif", borderBottom: '1px solid rgba(212, 175, 55, 0.4)', paddingBottom: '10px', marginTop: 0, marginBottom: '18px', fontSize: '18px' }}>
                                Tomorrow's Hays Forecast
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                                <div style={{ fontSize: '40px' }}>{weather.icon}</div>
                                <div>
                                    <strong style={{ display: 'block', fontSize: '16px', color: '#ffffff' }}>
                                        {weather.isError ? 'Weather Notice' : `${weather.locationName} — Tomorrow`}
                                    </strong>
                                    <span style={{ color: '#cbd5e1', fontSize: '14px' }}>
                                        {weather.tempMax !== null ? `${weather.desc} — High: ${weather.tempMax}°F` : weather.desc}
                                    </span>
                                </div>
                            </div>

                            {!weather.isError && weather.morningTemp !== null && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', backgroundColor: 'rgba(8, 12, 22, 0.8)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', fontSize: '13px' }}>
                                    <div>
                                        <strong style={{ display: 'block', color: '#d4af37', fontSize: '11px' }}>9:00 AM</strong>
                                        <span style={{ fontSize: '15px', fontWeight: '700' }}>{weather.morningTemp}°F</span>
                                    </div>
                                    <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                                        <strong style={{ display: 'block', color: '#d4af37', fontSize: '11px' }}>12:00 PM</strong>
                                        <span style={{ fontSize: '15px', fontWeight: '700' }}>{weather.noonTemp}°F</span>
                                    </div>
                                    <div>
                                        <strong style={{ display: 'block', color: '#d4af37', fontSize: '11px' }}>3:00 PM</strong>
                                        <span style={{ fontSize: '15px', fontWeight: '700' }}>{weather.afternoonTemp}°F</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- 3. MAIN ORDERING VIEW ---
    return (
        <div className="bh-guest" style={pageWrapperStyle(bgImage)}>
            <div style={columnStyle}>
                {/* TOP FROSTED HEADER WITH CIRCULAR LOGO */}
                <header className="bh-hero bh-hero--room" aria-label={`Bissing House — ${displayRoomName}`}>
                    <img className="bh-logo bh-logo--room" src="/Bissing-Logo-Lg-300x300.png" alt="Bissing House" />
                </header>

                {/* DARK NAVY SLATE CONTAINER */}
                <div className="bh-order-shell" style={darkNavyShellStyle}>
                    {/* Edwardian mantel / baby grandfather clock: 1909-inspired, accessible controls */}
                    <section className="bh-clock-section" aria-label="Choose breakfast serving time">
                      <div className="bh-clock-heading"><h2>What time shall we serve you?</h2></div>
                      <div className="bh-clock-controls">
                        <div className="bh-clock-cabinet bh-heritage-clock">
                          <div className="bh-clock-finial bh-clock-finial--left" aria-hidden="true" />
                          <div className="bh-clock-finial bh-clock-finial--right" aria-hidden="true" />
                          <div className="bh-clock-pediment" aria-hidden="true">
                            <span className="bh-clock-scroll">❦</span>
                            <span className="bh-clock-pediment-name">BISSING · 1909</span>
                            <span className="bh-clock-scroll">❦</span>
                          </div>
                          <div className="bh-clock-inlay-frame">
                            <span className="bh-clock-pilaster bh-clock-pilaster--left" aria-hidden="true" />
                            <div className="bh-clock-center">
                              <div className="bh-clock-face-rim">
                                <svg viewBox="0 0 240 240" className="bh-clock-dial" role="group" aria-label={isContinental ? 'Continental breakfast selected' : `Breakfast clock set to ${requestedTime}. Click either glowing hand to adjust the time.`}>
                                  <defs>
                                    <radialGradient id="heritageIvory"><stop offset="0" stopColor="#fff9e8"/><stop offset=".81" stopColor="#f0e4c8"/><stop offset="1" stopColor="#d6bf90"/></radialGradient>
                                    <filter id="clockHandGlow" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="3.1" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                                  </defs>
                                  <circle cx="120" cy="120" r="113" fill="#a86b45" stroke="#603b29" strokeWidth="2.4" />
                                  <circle cx="120" cy="120" r="106" fill="url(#heritageIvory)" stroke="#e4c894" strokeWidth="3" />
                                  <circle cx="120" cy="120" r="97" fill="none" stroke="#956e40" strokeWidth=".85" />
                                  <circle cx="120" cy="120" r="90" fill="none" stroke="#bda176" strokeWidth=".7" strokeDasharray="2 3" />
                                  {Array.from({length:60}, (_,i) => <line key={i} x1="120" y1={i%5===0?19:15} x2="120" y2={i%5===0?29:21} transform={`rotate(${i*6} 120 120)`} stroke="#69503b" strokeWidth={i%5===0?1.8:.7}/>)}
                                  {['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'].map((n,i) => <text key={n} x={120+76*Math.sin(i*Math.PI/6)} y={125-76*Math.cos(i*Math.PI/6)} textAnchor="middle" fontFamily="'Palatino Linotype', 'Book Antiqua', Georgia, serif" fontWeight="bold" fontSize="18" fill="#583927">{n}</text>)}
                                  <path d="M91 91 Q120 80 149 91 M91 149 Q120 160 149 149" fill="none" stroke="#ad885f" strokeWidth=".8"/>
                                  <text x="120" y="85" textAnchor="middle" fontFamily="Georgia,serif" fontSize="8" letterSpacing="1.5" fill="#7d5137">BISSING HOUSE</text>
                                  <text x="120" y="164" textAnchor="middle" fontFamily="Georgia,serif" fontSize="8" letterSpacing="1.3" fill="#7d5137">HAYS · KANSAS</text>
                                  <g className="bh-hand bh-hand--hour" role="button" tabIndex={0} aria-label="Move breakfast time 15 minutes earlier" onClick={() => cycleTime(-1)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleTime(-1); } }} transform={`rotate(${hourAngle} 120 120)`}>
                                    <path d="M120 135 L120 57" stroke="transparent" strokeWidth="28" strokeLinecap="round" className="bh-hand-hit"/>
                                    <path d="M120 132 L114.5 116 L115 84 Q120 75 125 84 L125.5 116 Z" fill="#6f4036" stroke="#2f211d" strokeWidth="1.8"/>
                                    <path d="M120 111 L118 88 L120 79 L122 88 Z" fill="#e7af63" filter="url(#clockHandGlow)" className="bh-hand-glow"/>
                                    <circle cx="120" cy="103" r="2.6" fill="#fff0bd"/>
                                  </g>
                                  <g className="bh-hand bh-hand--minute" role="button" tabIndex={0} aria-label="Move breakfast time 15 minutes later" onClick={() => cycleTime(1)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleTime(1); } }} transform={`rotate(${minuteAngle} 120 120)`}>
                                    <path d="M120 139 L120 33" stroke="transparent" strokeWidth="22" strokeLinecap="round" className="bh-hand-hit"/>
                                    <path d="M120 139 L115 119 L116.3 65 L120 39 L123.7 65 L125 119 Z" fill="#58362d" stroke="#2f211d" strokeWidth="1.6"/>
                                    <path d="M120 106 L118.2 65 L120 46 L121.8 65 Z" fill="#f5cb83" filter="url(#clockHandGlow)" className="bh-hand-glow"/>
                                  </g>
                                  <circle cx="120" cy="120" r="6" fill="#b27d42" stroke="#4e301e" strokeWidth="1.5" pointerEvents="none"/>
                                  <circle cx="120" cy="120" r="2" fill="#fff0c8" pointerEvents="none"/>
                                </svg>
                              </div>
                              <div className="bh-clock-time-readout" aria-live="polite">{isContinental ? 'CONTINENTAL' : requestedTime}</div>
                              <div className="bh-clock-neck"><div className="bh-pendulum"><span /></div></div>
                            </div>
                            <span className="bh-clock-pilaster bh-clock-pilaster--right" aria-hidden="true" />
                          </div>
                          <div className="bh-clock-marquetry" aria-hidden="true"><span>◆</span><span>❧</span><span>◆</span></div>
                          <div className="bh-clock-base"><span>HANDCRAFTED · 1909</span></div>
                        </div>
                      </div>
                      <output className="bh-visually-hidden" aria-live="polite">{isContinental ? "Continental breakfast selected" : `Selected serving time ${requestedTime}`}</output>
                      <label className="bh-continental-line">
                        <input type="checkbox" checked={isContinental} onChange={(event) => setTimeIndex(event.target.checked ? TIME_SLOTS.length - 1 : 2)} />
                        <span>Select this option for a Continental breakfast available prior to 8:00 AM.</span>
                      </label>
                      <div className="bh-clock-guest-count">
                        {!isContinental && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                                <button
                                    type="button"
                                    onClick={() => setGuestCount(1)}
                                    style={{
                                        padding: '10px 12px',
                                        borderRadius: '6px',
                                        border: guestCount === 1 ? '2px solid #805124' : '1px solid #c7ad8b',
                                        backgroundColor: guestCount === 1 ? '#edd3a0' : '#fbf4e9',
                                        color: '#38251d',
                                        fontWeight: '700',
                                        fontSize: '13px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    1 Guest (1 Plate)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setGuestCount(2)}
                                    style={{
                                        padding: '10px 12px',
                                        borderRadius: '6px',
                                        border: guestCount === 2 ? '2px solid #805124' : '1px solid #c7ad8b',
                                        backgroundColor: guestCount === 2 ? '#edd3a0' : '#fbf4e9',
                                        color: '#38251d',
                                        fontWeight: '700',
                                        fontSize: '13px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    2 Guests (2 Plates)
                                </button>
                            </div>
                        )}
                      </div>
                    </section>

                    {isContinental ? (
                        <div style={innerNavyCardStyle}>
                            <h2 style={{ fontFamily: "Georgia, 'Merriweather', serif", fontSize: '20px', color: '#38251d', marginTop: 0, marginBottom: '8px' }}>
                                Continental Service
                            </h2>
                            <p style={{ color: '#5e4b41', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                                Continental breakfast is available in the dining room before 8:00 AM. Chilled items are in the refrigerator.
                            </p>
                        </div>
                    ) : (
                        activePlates.map((plate, idx) => (
                            <div key={plate.plateNumber} style={innerNavyCardStyle}>
                                <h2 style={{ fontFamily: "Georgia, 'Merriweather', serif", fontSize: '20px', color: '#38251d', margin: '0 0 4px 0', fontWeight: '700' }}>
                                    {guestCount === 1 ? 'Build A Breakfast Plate' : `Plate ${plate.plateNumber} of 2`}
                                </h2>
                                <p style={{ color: '#5e4b41', fontSize: '12.5px', margin: '0 0 22px 0' }}>
                                    Customize your hot breakfast plate cooked to order by the Bissing House kitchen.
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
                                        </div>
                                    )}
                                </div>

                                <div style={{ marginBottom: '24px' }}>
                                    <span style={sectionLabelStyle}>2. ACCOMPANIMENTS</span>

                                    {idx === 0 && (
                                        <div className="bh-fruit-notice" role="note">
                                            <strong>Fresh fruit is temporarily unavailable.</strong>
                                            <span>We have temporarily removed fresh fruit as a precaution against potential foodborne illness. Thank you for understanding.</span>
                                        </div>
                                    )}

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
                        type="button"
                        onClick={handleSubmitOrder}
                        disabled={isSubmitting}
                        style={{
                            width: '100%',
                            padding: '16px 24px',
                            borderRadius: '6px',
                            border: isOrderReady ? '1px solid #f3cf55' : '1px solid rgba(255,255,255,0.12)',
                            backgroundColor: isOrderReady ? '#d4af37' : 'rgba(255, 255, 255, 0.08)',
                            color: isOrderReady ? '#0b111e' : '#94a3b8',
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
                            : `Submit Breakfast Order (${guestCount} ${guestCount === 1 ? 'Plate' : 'Plates'})`}
                    </button>

                    <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b', marginTop: '14px' }}>
                        * Consuming raw or undercooked meats, poultry, or eggs may increase your risk of foodborne illness.
                    </div>
                </div>
            </div>
        </div>
    );
}