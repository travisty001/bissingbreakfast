import React, { useState, useEffect } from 'react';

export default function GuestOrderingApp() {
    const [cart, setCart] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [requestedTime, setRequestedTime] = useState('');
    const [dietaryNotes, setDietaryNotes] = useState('');
    const [submittedOrder, setSubmittedOrder] = useState(null);
    const [isCartOpen, setIsCartOpen] = useState(false);
    
    // --- LIVE DAYTIME TRAVELER FORECAST STATE (NO HARDCODED FALLBACKS) ---
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

    // --- PLATE BUILDER STATE ---
    const [plateType, setPlateType] = useState('');
    const [eggStyle, setEggStyle] = useState('Scrambled'); // STRICTLY LOCKED TO SCRAMBLED
    const [griddleType, setGriddleType] = useState('Crepes');
    const [griddleFlavor, setGriddleFlavor] = useState('Plain');
    const [sides, setSides] = useState([]);
    const [beverages, setBeverages] = useState([]);

    // Menu Data (Fresh Fruit removed due to nationwide outbreak)
    const eggStyles = ['Scrambled', 'Over Easy', 'Over Medium', 'Over Hard', 'Poached', 'Hard Boiled'];
    const griddleTypes = ['Crepes', 'French Toast', 'Pancakes'];
    const griddleFlavors = ['Plain', 'Hazelnut Spread'];
    const sideOptions = ['Bacon', 'Hashbrowns', 'Whole Wheat Toast', 'White Toast'];
    const bevOptions = ['Orange Juice', 'Green Tea', 'Black Tea', 'Coffee'];

    // --- ROBUST CASE-INSENSITIVE ROUTING & DYNAMIC SUITE BACKGROUNDS ---
    const searchParams = new URLSearchParams(window.location.search);
    const urlRoom = searchParams.get('room');
    const rawPath = window.location.pathname.split('/').pop();
    const potentialRoom = urlRoom || rawPath || ''; 
    const lowerRoom = potentialRoom.toLowerCase();
    
    // Check if a specific suite was actually requested in the URL
    const isRoomSpecified = lowerRoom.includes('tea') || lowerRoom.includes('basgall') || lowerRoom.includes('bissing');

    let roomName = 'Bissing';
    let displayRoomName = 'Bissing';
    let bgImage = '/bissing.jpg';
    
    if (lowerRoom.includes('tea')) {
        roomName = 'TeaRose';
        displayRoomName = 'Tea Rose';
        bgImage = '/tearose.jpg';
    } else if (lowerRoom.includes('basgall')) {
        roomName = 'Basgall';
        displayRoomName = 'Basgall';
        bgImage = '/basgall.jpg';
    } else {
        roomName = 'Bissing';
        displayRoomName = 'Bissing';
        bgImage = '/bissing.jpg';
    }
    
    const isContinental = requestedTime === 'Continental';

    // --- FETCH REAL NEXT-DAY FORECAST FOR DAYTIME VISITORS ---
    useEffect(() => {
        if (submittedOrder) {
            const API_KEY = 'e0ed10ab10774f0cb51224830261704'; 
            const WEATHER_URL = `https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=67601&days=2&aqi=no&alerts=no`; 
            
            fetch(WEATHER_URL)
                .then(async res => {
                    if (!res.ok) {
                        const errData = await res.json().catch(() => ({}));
                        throw new Error(errData.error?.message || `HTTP Error ${res.status}`);
                    }
                    return res.json();
                })
                .then(data => {
                    if (data.forecast && data.forecast.forecastday && data.forecast.forecastday[1]) {
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

                        const now = new Date();
                        const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
                    } else {
                        throw new Error("API returned success, but tomorrow's forecast layer was missing.");
                    }
                })
                .catch(err => {
                    console.error("Weather forecast fetch failed:", err);
                    setWeather({ 
                        locationName: 'Hays, KS',
                        tempMax: null, 
                        desc: `Live Forecast Unavailable (${err.message})`, 
                        icon: '⚠️', 
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
                        isError: true 
                    });
                });
        }
    }, [submittedOrder]);

    const toggleArrayItem = (array, setArray, item) => {
        if (array.includes(item)) {
            setArray(array.filter(i => i !== item));
        } else {
            setArray([...array, item]);
        }
    };

    const handleAddPlate = () => {
        if (!plateType) {
            alert("Please select a Main Course (Egg or Griddle Breakfast).");
            return;
        }

        let itemName = '';
        if (plateType === 'Egg') {
            itemName = `Egg Breakfast (${eggStyle})`;
        } else {
            itemName = `${griddleFlavor} ${griddleType}`;
        }

        const sidesText = sides.length > 0 ? sides.join(', ') : 'No sides';
        const bevText = beverages.length > 0 ? beverages.join(', ') : 'No beverages';
        const details = `Sides: ${sidesText} | Drinks: ${bevText}`;

        setCart([...cart, { 
            id: Date.now(), 
            name: itemName, 
            details: details,
            plateNote: dietaryNotes.trim()
        }]);
        
        // --- FULL STATE RESET FOR NEXT PLATE BUILD ---
        setPlateType('');
        setEggStyle('Scrambled');
        setGriddleType('Crepes');
        setGriddleFlavor('Plain');
        setSides([]);
        setBeverages([]);
        setDietaryNotes(''); 
        alert(`${itemName} added to order! Another plate can now be built, or the order can be submitted.`);
    };

    const removeFromCart = (indexToRemove) => {
        const newCart = cart.filter((_, index) => index !== indexToRemove);
        setCart(newCart);
        if (newCart.length === 0) setIsCartOpen(false); 
    };

    const handleSubmitOrder = () => {
        if (!requestedTime) { alert("Please select a delivery time before sending the order."); return; }
        if (!isContinental && cart.length === 0) { alert("Please add at least one plate to the order."); return; }
        
        setIsSubmitting(true);
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        const serviceDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

        const roomMapping = { 'Bissing': 1, 'Basgall': 2, 'TeaRose': 3, 'Tearose': 3, 'tearose': 3 };

        const finalItems = isContinental ? [{
            menu_item_id: 1, 
            quantity: 1,
            customization_note: "Continental Setup - Guest notified to check dining room and fridge."
        }] : cart.map(item => ({
            menu_item_id: 1, 
            quantity: 1,
            customization_note: item.plateNote ? 
                `${item.name} - ${item.details} [Special Request: ${item.plateNote}]` : 
                `${item.name} - ${item.details}`
        }));

        fetch('https://api-peaufx4prq-uc.a.run.app/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                room_id: roomMapping[roomName] || 1, 
                service_date: serviceDate,
                requested_time: requestedTime, 
                guest_count: isContinental ? 1 : cart.length,
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
                setSubmittedOrder({ time: requestedTime, items: [...cart] });
                setCart([]);
                setDietaryNotes('');
                setIsCartOpen(false);
            }
        })
        .catch(err => {
            setIsSubmitting(false);
            alert("Error sending order to the kitchen. Please check the Express terminal.");
            console.error("Order error:", err);
        });
    };

    // --- 1. WELCOME & QR INSTRUCTION LANDING PAGE ---
    if (!isRoomSpecified && !submittedOrder) {
        return (
            <div style={{ backgroundImage: "url('/house.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', minHeight: '100vh', width: '100vw', margin: 0, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="app-container" style={{ width: '100%', maxWidth: '520px', padding: '20px' }}>
                    <header className="site-header" style={{ backgroundColor: 'rgba(26, 21, 18, 0.88)', backdropFilter: 'blur(8px)', padding: '40px 30px', borderRadius: '12px', border: '1px solid #d4af37', boxShadow: '0 12px 30px rgba(0,0,0,0.35)', margin: 0 }}>
                        <p className="eyebrow">Hays, Kansas</p>
                        <h1 style={{ margin: '0 0 8px 0', color: '#ffffff' }}>Bissing House</h1>
                        <p className="sub" style={{ margin: '0 0 20px 0' }}>Morning Breakfast Service</p>
                        
                        <div className="gold-rule" style={{ marginBottom: '25px' }}></div>
                        
                        <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.07)', padding: '28px 20px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', textAlign: 'center' }}>
                            <p style={{ fontSize: '15px', lineHeight: '1.6', color: '#ffffff', margin: '0 0 14px 0', fontWeight: '300' }}>
                                To access your morning menu and ensure your dining preferences are routed to the correct suite, please <strong>scan the QR code</strong> located inside your room.
                            </p>
                            <p style={{ fontSize: '14px', color: '#d4af37', margin: 0, fontStyle: 'italic', fontWeight: '600', letterSpacing: '0.5px' }}>
                                We look forward to serving you breakfast!
                            </p>
                        </div>
                    </header>
                </div>
            </div>
        );
    }
    
    // --- 2. LIVE CONFIRMATION SCREEN ---
    if (submittedOrder) {
        return (
            <div style={{ backgroundImage: "url('/dining.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', minHeight: '100vh', width: '100vw', margin: 0, padding: 0, overflowY: 'auto' }}>
                <div className="app-container" style={{ padding: '40px 20px', maxWidth: '600px', margin: '0 auto' }}>
                    
                    <div className="section-card" style={{ textAlign: 'center', padding: '40px', backgroundColor: 'rgba(26, 21, 18, 0.85)', backdropFilter: 'blur(8px)', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid rgba(204, 163, 82, 0.3)' }}>
                        <h2 style={{ color: '#d4af37', fontFamily: "'Merriweather', serif", marginBottom: '15px' }}>Order Confirmed!</h2>
                        <p style={{ color: '#e5e5e5', fontSize: '16px', margin: 0 }}>The kitchen has received the breakfast order for {submittedOrder.time}.</p>
                    </div>

                    <div className="section-card" style={{ backgroundColor: 'rgba(26, 21, 18, 0.85)', backdropFilter: 'blur(8px)', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid rgba(204, 163, 82, 0.3)' }}>
                        <h3 style={{ color: '#ffffff', fontFamily: "'Merriweather', serif", borderBottom: '2px solid #d4af37', paddingBottom: '10px', marginBottom: '20px', marginTop: 0 }}>Tomorrow's Daytime Itinerary Forecast</h3>
                        
                        <div style={{ marginBottom: '25px', backgroundColor: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: (weather.isError || weather.tempMax === null) ? '0' : '15px' }}>
                                <div style={{ fontSize: '46px' }}>{weather.icon}</div>
                                <div style={{ textAlign: 'left' }}>
                                    <strong style={{ display: 'block', fontSize: '18px', color: '#ffffff' }}>
                                        {weather.isError ? "Weather Notice" : `${weather.locationName} — Tomorrow's Conditions`}
                                    </strong>
                                    <span style={{ color: weather.isError ? '#fca5a5' : '#dcd3c6', fontSize: '15px', fontWeight: weather.isError ? 'bold' : 'normal', display: 'block' }}>
                                        {weather.tempMax !== null ? `${weather.desc} — Expected Daytime High: ${weather.tempMax}°F` : weather.desc}
                                    </span>
                                    {weather.fetchTime && (
                                        <span style={{ color: '#999', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                                            Live data retrieved at {weather.fetchTime}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {!weather.isError && weather.tempMax !== null && (
                                <>
                                    {weather.morningTemp !== null && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '15px', textAlign: 'center', fontSize: '13px', color: '#e5e5e5' }}>
                                            <div>
                                                <strong style={{ display: 'block', color: '#d4af37', fontSize: '11px', textTransform: 'uppercase' }}>9:00 AM (Morning)</strong>
                                                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{weather.morningTemp}°F</span>
                                                <span style={{ display: 'block', fontSize: '11px', color: '#a8a29e' }}>{weather.morningDesc}</span>
                                            </div>
                                            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                                                <strong style={{ display: 'block', color: '#d4af37', fontSize: '11px', textTransform: 'uppercase' }}>12:00 PM (Noon)</strong>
                                                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{weather.noonTemp}°F</span>
                                                <span style={{ display: 'block', fontSize: '11px', color: '#a8a29e' }}>{weather.noonDesc}</span>
                                            </div>
                                            <div>
                                                <strong style={{ display: 'block', color: '#d4af37', fontSize: '11px', textTransform: 'uppercase' }}>3:00 PM (Afternoon)</strong>
                                                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{weather.afternoonTemp}°F</span>
                                                <span style={{ display: 'block', fontSize: '11px', color: '#a8a29e' }}>{weather.afternoonDesc}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px', fontSize: '13px', color: '#dcd3c6' }}>
                                        <div style={{ textAlign: 'left' }}>
                                            <strong>🌧️ Rain Chance:</strong> <span style={{ color: weather.rainChance > 30 ? '#93c5fd' : 'inherit', fontWeight: weather.rainChance > 30 ? 'bold' : 'normal' }}>{weather.rainChance}%</span>
                                        </div>
                                        <div style={{ textAlign: 'left' }}>
                                            <strong>💨 Peak Wind:</strong> {weather.windMax} mph
                                        </div>
                                        <div style={{ textAlign: 'left' }}>
                                            <strong>☀️ UV Index:</strong> {weather.uvIndex}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <strong style={{ color: '#ffffff', display: 'block', marginBottom: '12px', textAlign: 'left', fontSize: '16px' }}>Recommended Area Attractions:</strong>
                        <ul style={{ color: '#dcd3c6', lineHeight: '1.8', margin: 0, paddingLeft: '20px', textAlign: 'left', fontSize: '14px' }}>
                            <li style={{ marginBottom: '10px' }}>
                                <a href="https://sternberg.fhsu.edu/" target="_blank" rel="noopener noreferrer" style={{ color: '#d4af37', fontWeight: 'bold', textDecoration: 'none' }}>Sternberg Museum of Natural History:</a> Famous for its world-class Cretaceous fossils, including the iconic "Fish Within a Fish" specimen and interactive prehistoric exhibits.
                            </li>
                            <li style={{ marginBottom: '10px' }}>
                                <a href="https://www.kshs.org/p/fort-hays/15865" target="_blank" rel="noopener noreferrer" style={{ color: '#d4af37', fontWeight: 'bold', textDecoration: 'none' }}>Historic Fort Hays & Frontier Park:</a> Walk the preserved 1860s military outpost grounds, explore the guardhouse and officer quarters, and visit the resident bison herd.
                            </li>
                            <li>
                                <a href="https://www.downtownhays.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#d4af37', fontWeight: 'bold', textDecoration: 'none' }}>Chestnut Street District:</a> Stroll the historic limestone and brick downtown corridor filled with local coffee shops, artisan boutiques, galleries, and craft dining.
                            </li>
                        </ul>
                    </div>

                </div>
            </div>
        );
    }

    // --- 3. MAIN ORDERING SCREEN ---
    return (
        <div style={{ backgroundImage: `url('${bgImage}')`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', minHeight: '100vh', width: '100vw', margin: 0, padding: 0 }}>
            <div className="app-container">
                <header className="site-header" style={{ backgroundColor: 'rgba(26, 21, 18, 0.65)', backdropFilter: 'blur(4px)' }}>
                    <p className="eyebrow">Hays, Kansas</p>
                    <h1>Bissing House</h1>
                    <p className="sub">Morning Breakfast Order &nbsp;·&nbsp; The {displayRoomName} Suite</p>
                    <div className="gold-rule"></div>
                </header>

                <div className="section-wrapper">
                    
                    {/* --- DARK GLASS: TIME PICKER --- */}
                    <div className="section-card" style={{ backgroundColor: 'rgba(26, 21, 18, 0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(204, 163, 82, 0.3)', borderRadius: '12px', padding: '24px', marginBottom: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                        <div className="time-picker-container">
                            <select 
                                value={requestedTime} 
                                onChange={(e) => setRequestedTime(e.target.value)} 
                                style={{ 
                                    backgroundColor: 'rgba(26, 21, 18, 0.8)', 
                                    color: '#e5e5e5', 
                                    borderColor: requestedTime === '' ? '#d4af37' : 'rgba(204, 163, 82, 0.3)', 
                                    width: '100%', 
                                    padding: '12px', 
                                    borderRadius: '8px',
                                    outline: 'none',
                                    fontSize: '16px'
                                }}
                            >
                                <option value="" disabled>Select a time...</option>
                                <option value="Continental">Continental (Prior to 8:30 AM)</option>
                                <option value="08:30 AM">08:30 AM</option>
                                <option value="09:00 AM">09:00 AM</option>
                                <option value="09:30 AM">09:30 AM</option>
                                <option value="10:00 AM">10:00 AM</option>
                                <option value="10:30 AM">10:30 AM</option>
                            </select>
                        </div>
                    </div>

                    {/* --- DYNAMIC SECTION: CONTINENTAL OR PLATE BUILDER --- */}
                    {isContinental ? (
                        <div className="section-card" style={{ backgroundColor: 'rgba(26, 21, 18, 0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(204, 163, 82, 0.3)', borderLeft: '6px solid #d4af37', borderRadius: '12px', padding: '24px', marginBottom: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                            <h2 className="section-title" style={{ marginBottom: '10px', color: '#ffffff' }}>Continental Service</h2>
                            <p style={{ color: '#e5e5e5', fontSize: '15px', lineHeight: '1.6', marginBottom: '15px' }}>
                                All fresh continental items will be set out in the main dining room. Please be sure to check the dining room fridge as well for additional chilled options!
                            </p>
                        </div>
                    ) : (
                        <div className="section-card" style={{ backgroundColor: 'rgba(26, 21, 18, 0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(204, 163, 82, 0.3)', borderRadius: '12px', padding: '24px', marginBottom: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', color: '#e5e5e5' }}>
                            <h2 className="section-title" style={{ color: '#ffffff', borderBottom: '1px solid rgba(204, 163, 82, 0.3)', paddingBottom: '12px', marginBottom: '20px' }}>Build A Plate</h2>
                            <div className="plate-builder">
                                
                                <div className="options-group" style={{ marginBottom: '20px' }}>
                                    <strong style={{ color: '#d4af37', display: 'block', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '12px' }}>1. Main Course</strong>
                                    <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                            <input 
                                                type="radio" 
                                                name="main" 
                                                checked={plateType === 'Egg'} 
                                                onChange={() => {
                                                    setPlateType('Egg');
                                                    setEggStyle('Scrambled');
                                                }} 
                                            /> Egg Breakfast
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                            <input 
                                                type="radio" 
                                                name="main" 
                                                checked={plateType === 'Griddle'} 
                                                onChange={() => {
                                                    setPlateType('Griddle');
                                                    setGriddleType('Crepes');
                                                    setGriddleFlavor('Plain');
                                                }} 
                                            /> Griddle Breakfast
                                        </label>
                                    </div>
                                </div>

                                {plateType === 'Egg' && (
                                    <div className="options-group" style={{ marginBottom: '20px' }}>
                                        <select value={eggStyle} onChange={(e) => setEggStyle(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(204, 163, 82, 0.3)', backgroundColor: 'rgba(26, 21, 18, 0.8)', color: '#e5e5e5', outline: 'none' }}>
                                            {eggStyles.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                )}

                                {plateType === 'Griddle' && (
                                    <div className="options-group" style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                                        <select value={griddleType} onChange={(e) => setGriddleType(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid rgba(204, 163, 82, 0.3)', backgroundColor: 'rgba(26, 21, 18, 0.8)', color: '#e5e5e5', outline: 'none' }}>
                                            {griddleTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                        <select value={griddleFlavor} onChange={(e) => setGriddleFlavor(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid rgba(204, 163, 82, 0.3)', backgroundColor: 'rgba(26, 21, 18, 0.8)', color: '#e5e5e5', outline: 'none' }}>
                                            {griddleFlavors.map(f => <option key={f} value={f}>{f}</option>)}
                                        </select>
                                    </div>
                                )}

                                <div className="options-group" style={{ marginBottom: '20px' }}>
                                    <strong style={{ color: '#d4af37', display: 'block', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '12px' }}>Accompaniments</strong>
                                    
                                    <div style={{ backgroundColor: 'rgba(144, 12, 63, 0.2)', borderLeft: '4px solid #900C3F', padding: '12px 15px', borderRadius: '6px', marginBottom: '15px', fontSize: '13px', color: '#fca5a5', lineHeight: '1.5' }}>
                                        <strong style={{ color: '#ff8f8f', display: 'block', marginBottom: '4px' }}>⚠️ Menu Advisory: Fresh Fruit Temporarily Unavailable</strong>
                                        Due to a widespread multi-state foodborne illness outbreak affecting fresh produce across the country (including the surge of <em>Cyclospora</em> and ongoing viral investigations like <em>Hepatitis A</em> in berry crops), we have temporarily removed Fresh Fruit from our breakfast menu out of an abundance of caution for our guests' health and safety.
                                    </div>

                                    {sideOptions.map(side => (
                                        <label key={side} style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={sides.includes(side)} onChange={() => toggleArrayItem(sides, setSides, side)} style={{ marginRight: '8px' }} /> {side}
                                        </label>
                                    ))}
                                </div>

                                <div className="options-group" style={{ marginBottom: '20px' }}>
                                    <strong style={{ color: '#d4af37', display: 'block', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '12px' }}>Beverages</strong>
                                    {bevOptions.map(bev => (
                                        <label key={bev} style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={beverages.includes(bev)} onChange={() => toggleArrayItem(beverages, setBeverages, bev)} style={{ marginRight: '8px' }} /> {bev}
                                        </label>
                                    ))}
                                </div>

                                <div className="options-group" style={{ marginTop: '25px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '20px' }}>
                                    <strong style={{ color: '#d4af37', display: 'block', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '12px' }}>Special Requests</strong>
                                    <textarea 
                                        value={dietaryNotes}
                                        onChange={(e) => setDietaryNotes(e.target.value)}
                                        placeholder="Allergies, dietary restrictions, etc..."
                                        style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid rgba(204, 163, 82, 0.3)', backgroundColor: 'rgba(26, 21, 18, 0.8)', color: '#e5e5e5', minHeight: '80px', boxSizing: 'border-box', outline: 'none' }}
                                    />
                                </div>

                                <button className="add-btn" onClick={handleAddPlate} disabled={!plateType} style={{ width: '100%', backgroundColor: (!plateType) ? 'rgba(255,255,255,0.1)' : '#d4af37', color: (!plateType) ? '#666' : '#1a1512', border: 'none', borderRadius: '8px', padding: '16px', fontSize: '16px', marginTop: '20px', cursor: (!plateType) ? 'not-allowed' : 'pointer', fontWeight: 'bold', transition: 'background-color 0.2s' }}>
                                    Add Plate to Order
                                </button>
                            </div>
                        </div>
                    )}

                    {/* --- LEGAL HEALTH ADVISORY DISCLAIMER FOOTER --- */}
                    <div style={{ 
                        backgroundColor: 'rgba(26, 21, 18, 0.85)', 
                        color: '#dcd3c6', 
                        textAlign: 'center', 
                        padding: '14px 20px', 
                        fontSize: '12px', 
                        lineHeight: '1.5', 
                        borderRadius: '8px', 
                        margin: '10px auto 80px auto', 
                        maxWidth: '600px',
                        border: '1px solid #900C3F',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        boxSizing: 'border-box'
                    }}>
                        * Consuming raw or undercooked meats, poultry, seafood, shellfish, or eggs may increase your risk of foodborne illness.
                    </div>
                </div>

                {/* --- VIEW ORDER MODAL --- */}
                {isCartOpen && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                        <div style={{ backgroundColor: '#1a1512', border: '1px solid #d4af37', borderRadius: '8px', padding: '20px', width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', marginBottom: '15px' }}>
                                <h2 style={{ color: '#ffffff', margin: 0, fontFamily: "'Merriweather', serif" }}>Your Order ({cart.length} Plates)</h2>
                                <button onClick={() => setIsCartOpen(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#d4af37' }}>&times;</button>
                            </div>
                            
                            {cart.length === 0 ? (
                                <p style={{ textAlign: 'center', color: '#999' }}>No plates added yet.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    {cart.map((item, index) => (
                                        <div key={item.id} style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #d4af37' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <strong style={{ fontSize: '16px', color: '#ffffff' }}>Plate {index + 1}: {item.name}</strong>
                                                <button onClick={() => removeFromCart(index)} style={{ background: 'none', border: 'none', color: '#ff8f8f', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px' }}>Remove</button>
                                            </div>
                                            <p style={{ fontSize: '14px', color: '#dcd3c6', margin: '5px 0' }}>{item.details}</p>
                                            {item.plateNote && (
                                                <p style={{ fontSize: '13px', color: '#fca5a5', margin: '5px 0', backgroundColor: 'rgba(144, 12, 63, 0.2)', padding: '8px', borderRadius: '4px' }}>
                                                    <strong>Notes:</strong> {item.plateNote}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            <button onClick={() => setIsCartOpen(false)} style={{ width: '100%', padding: '14px', marginTop: '20px', backgroundColor: '#d4af37', color: '#1a1512', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                                Continue Building
                            </button>
                        </div>
                    </div>
                )}

                {(cart.length > 0 || isContinental) && (
                    <div className="cart-bar" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#1a1512', color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1001, boxShadow: '0 -4px 12px rgba(0,0,0,0.5)', borderTop: '1px solid rgba(204,163,82,0.3)' }}>
                        {isContinental ? (
                            <span style={{ fontSize: '15px', color: '#dcd3c6', fontWeight: 'bold' }}>Continental Service</span>
                        ) : (
                            <span style={{ cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold', fontSize: '15px', color: '#d4af37' }} onClick={() => setIsCartOpen(true)}>
                                {`View Order (${cart.length} Plates)`}
                            </span>
                        )}
                        <button onClick={handleSubmitOrder} disabled={isSubmitting} style={{ backgroundColor: '#d4af37', color: '#1a1512', border: 'none', borderRadius: '6px', padding: '10px 20px', fontWeight: 'bold', fontSize: '15px', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
                            {isSubmitting ? "Sending..." : "Submit Order"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
