import React, { useState, useEffect } from 'react';

export default function KitchenReference() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Default to today's date formatted for the date picker YYYY-MM-DD
    const today = new Date();
    const defaultDate = today.toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(defaultDate);

    useEffect(() => {
        setLoading(true);
        fetch(`https://api-peaufx4prq-uc.a.run.app/api/admin/cheat-sheet?date=${selectedDate}`, {
            headers: {
                'x-kitchen-pin': '1879' // Required security PIN from your backend
            }
        })
            .then(res => {
                if (!res.ok) throw new Error("Failed to fetch orders from kitchen server.");
                return res.json();
            })
            .then(data => {
                const rawOrders = Array.isArray(data) ? data : (data.orders || data.data || []);
                setOrders(rawOrders);
                setLoading(false);
            })
            .catch(err => {
                console.error("Admin fetch error:", err);
                setError(err.message);
                setLoading(false);
            });
    }, [selectedDate]);

    // Resolve suite names from room IDs
    const getSuiteName = (roomVal) => {
        if (!roomVal) return 'Bissing Suite';
        const str = String(roomVal).toLowerCase();
        if (str === '1' || str.includes('bissing')) return 'Bissing Suite';
        if (str === '2' || str.includes('basgall')) return 'Basgall Suite';
        if (str === '3' || str.includes('tea')) return 'Tea Rose Suite';
        return String(roomVal);
    };

    // --- SMART PLATE PARSER FOR HIGH-SPEED KITCHEN SCANNABILITY ---
    const parsePlateData = (rawText = '') => {
        let text = String(rawText || '');
        
        // 1. Extract special request note if present
        let specialNote = null;
        if (text.includes('[Special Request:')) {
            const parts = text.split('[Special Request:');
            text = parts[0].trim();
            specialNote = parts[1].replace(']', '').trim();
        }

        // 2. Check if it's Continental or standard text without side/drink delimiters
        if (!text.includes(' - Sides:')) {
            return {
                main: text,
                sides: null,
                drinks: null,
                specialNote
            };
        }

        // 3. Split Main Course, Sides, and Drinks into distinct sections
        const mainParts = text.split(' - Sides:');
        const mainCourse = mainParts[0].trim();
        
        let sidesText = null;
        let drinksText = null;

        if (mainParts[1]) {
            const sideDrinkParts = mainParts[1].split(' | Drinks:');
            sidesText = sideDrinkParts[0].trim();
            if (sideDrinkParts[1]) {
                drinksText = sideDrinkParts[1].trim();
            }
        }

        return {
            main: mainCourse,
            sides: (sidesText === 'No sides' || !sidesText) ? null : sidesText,
            drinks: (drinksText === 'No beverages' || !drinksText) ? null : drinksText,
            specialNote
        };
    };

    // Group orders by Suite and Time so plates from the same room stay together
    const groupedOrders = Object.values(
        orders.reduce((acc, order) => {
            const suite = getSuiteName(order.room_id || order.room_name || order.suite);
            const time = order.requested_time || '08:30 AM';
            const groupKey = `${suite}_${time}`;

            if (!acc[groupKey]) {
                acc[groupKey] = {
                    suite: suite,
                    time: time,
                    generalNotes: order.dietary_notes || '',
                    plates: []
                };
            }

            if (order.order_items && Array.isArray(order.order_items)) {
                acc[groupKey].plates.push(...order.order_items);
            } else {
                acc[groupKey].plates.push(order);
            }
            return acc;
        }, {})
    );

    return (
        <div style={{ padding: '40px 20px', maxWidth: '850px', margin: '0 auto', fontFamily: "'Source Sans 3', sans-serif" }}>
            
            {/* --- TOP ADMIN HEADER --- */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #900C3F', paddingBottom: '16px', marginBottom: '32px' }}>
                <div>
                    <span style={{ textTransform: 'uppercase', letterSpacing: '2px', fontSize: '12px', fontWeight: '700', color: '#d4af37', display: 'block', marginBottom: '4px' }}>
                        Service Management
                    </span>
                    <h1 style={{ color: '#1a1512', margin: 0, fontFamily: "'Merriweather', serif", fontSize: '32px' }}>
                        Kitchen Reference
                    </h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'white', padding: '8px 14px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #dcd3c6' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#5c5249' }}>Service Date:</span>
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => setSelectedDate(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '15px', fontWeight: 'bold', color: '#1a1512', outline: 'none', cursor: 'pointer' }}
                    />
                </div>
            </div>

            {loading && <div style={{ textAlign: 'center', padding: '60px', color: '#666', fontSize: '18px' }}>⏳ Loading kitchen service tickets...</div>}
            {error && <div style={{ backgroundColor: '#fef5f5', border: '1px solid #fbd0d0', padding: '20px', borderRadius: '8px', color: '#900C3F', fontWeight: 'bold' }}>⚠️ Error loading orders: {error}</div>}

            {!loading && !error && groupedOrders.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #eaeaea', color: '#777', fontStyle: 'italic', fontSize: '16px' }}>
                    No breakfast orders found for {selectedDate}.
                </div>
            )}

            {/* --- SUITE TICKET CARDS --- */}
            {!loading && !error && groupedOrders.map((group, idx) => (
                <div key={idx} style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.07)',
                    marginBottom: '26px',
                    border: '1px solid #e2ded6',
                    overflow: 'hidden'
                }}>
                    
                    {/* CARD HEADER BAR (BURGUNDY & GOLD ACCENT) */}
                    <div style={{ 
                        backgroundColor: '#1a1512', 
                        color: '#ffffff', 
                        padding: '18px 24px', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        borderBottom: '4px solid #d4af37' 
                    }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '24px', fontFamily: "'Merriweather', serif", color: '#ffffff', letterSpacing: '0.5px' }}>
                                {group.suite}
                            </h2>
                            <span style={{ fontSize: '13px', color: '#d4af37', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                {group.plates.length} {group.plates.length === 1 ? 'Plate Order' : 'Plate Orders'}
                            </span>
                        </div>
                        <div style={{ 
                            backgroundColor: '#900C3F', 
                            color: '#ffffff', 
                            padding: '10px 18px', 
                            borderRadius: '6px', 
                            fontWeight: 'bold', 
                            fontSize: '18px', 
                            letterSpacing: '0.5px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.15)'
                        }}>
                            {group.time}
                        </div>
                    </div>

                    {/* GENERAL ROOM NOTE BANNER (IF ANY) */}
                    {group.generalNotes && group.generalNotes.trim() !== '' && (
                        <div style={{ backgroundColor: '#fff8e6', color: '#856404', padding: '14px 24px', borderBottom: '1px solid #ffeeba', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '18px' }}>ℹ️</span>
                            <div>
                                <strong style={{ textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px', display: 'block' }}>General Suite Note / Dietary Restriction:</strong>
                                <span style={{ fontWeight: '600' }}>{group.generalNotes}</span>
                            </div>
                        </div>
                    )}

                    {/* STRUCTURED PLATES LIST */}
                    <div style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                            {group.plates.map((plate, pIdx) => {
                                const rawText = plate.item_name || plate.customization_note || plate.name || 'Continental / Standard Breakfast';
                                const { main, sides, drinks, specialNote } = parsePlateData(rawText);

                                return (
                                    <div key={pIdx} style={{ 
                                        backgroundColor: '#fcfbf9', 
                                        border: '1px solid #eae6df', 
                                        borderRadius: '8px', 
                                        padding: '18px',
                                        borderLeft: '6px solid #1a1512'
                                    }}>
                                        {/* PLATE TITLE / MAIN COURSE */}
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: (sides || drinks || specialNote) ? '12px' : '0' }}>
                                            <span style={{ backgroundColor: '#d4af37', color: '#1a1512', fontWeight: 'bold', fontSize: '13px', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                                Plate {pIdx + 1}
                                            </span>
                                            <strong style={{ fontSize: '19px', color: '#1a1512', fontFamily: "'Merriweather', serif" }}>
                                                {main}
                                            </strong>
                                        </div>

                                        {/* INDENTED SIDES & DRINKS GRID */}
                                        {(sides || drinks) && (
                                            <div style={{ 
                                                display: 'grid', 
                                                gridTemplateColumns: sides && drinks ? '1fr 1fr' : '1fr', 
                                                gap: '12px', 
                                                backgroundColor: '#ffffff', 
                                                padding: '12px 16px', 
                                                borderRadius: '6px', 
                                                border: '1px solid #f0ece3',
                                                marginLeft: '4px',
                                                marginBottom: specialNote ? '12px' : '0'
                                            }}>
                                                {sides && (
                                                    <div>
                                                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#777', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '2px' }}>
                                                            Accompaniments / Sides
                                                        </span>
                                                        <span style={{ fontSize: '15px', color: '#333', fontWeight: '600' }}>
                                                            🍴 {sides}
                                                        </span>
                                                    </div>
                                                )}
                                                {drinks && (
                                                    <div>
                                                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#777', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '2px' }}>
                                                            Beverages
                                                        </span>
                                                        <span style={{ fontSize: '15px', color: '#333', fontWeight: '600' }}>
                                                            ☕ {drinks}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* HIGHLIGHTED SPECIAL REQUEST CALLOUT BOX */}
                                        {specialNote && (
                                            <div style={{ 
                                                backgroundColor: '#fef5f5', 
                                                color: '#900C3F', 
                                                padding: '10px 14px', 
                                                borderRadius: '6px', 
                                                fontSize: '14px', 
                                                marginTop: (sides || drinks) ? '0' : '10px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                border: '1px solid #fbd0d0',
                                                fontWeight: 'bold'
                                            }}>
                                                <span style={{ fontSize: '16px' }}>⚠️</span>
                                                <span>Special Request: {specialNote}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>
            ))}

        </div>
    );
}
