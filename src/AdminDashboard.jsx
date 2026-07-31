import React, { useState, useEffect } from 'react';

const API_BASE = "https://api-peaufx4prq-uc.a.run.app/api/admin";
const KITCHEN_PIN = "1879";

export default function AdminDashboard() {
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [togglingSms, setTogglingSms] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchSmsStatus();
    fetchCheatSheet();
  }, [selectedDate]);

  // =====================================================================
  // SMS SCRIPTS
  // =====================================================================
  const fetchSmsStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/sms-status`, {
        headers: { "x-kitchen-pin": KITCHEN_PIN }
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data && typeof data.enabled !== 'undefined') {
        setSmsEnabled(data.enabled);
      }
    } catch (err) {
      console.warn("Could not load SMS status:", err.message);
    }
  };

  const handleToggleTestMode = async (e) => {
    const targetSmsState = !e.target.checked; 
    setTogglingSms(true);
    try {
      const res = await fetch(`${API_BASE}/sms-toggle`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-kitchen-pin": KITCHEN_PIN
        },
        body: JSON.stringify({ enabled: targetSmsState })
      });
      const data = await res.json();
      if (data && data.success) {
        setSmsEnabled(targetSmsState);
      }
    } catch (err) {
      alert("Network error while updating SMS toggle.");
    } finally {
      setTogglingSms(false);
    }
  };

  // =====================================================================
  // DATA FETCHING & PARSING
  // =====================================================================
  const fetchCheatSheet = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/cheat-sheet?date=${selectedDate}`, {
        headers: { "x-kitchen-pin": KITCHEN_PIN }
      });
      if (!res.ok) throw new Error("Server returned status " + res.status);
      const data = await res.json();
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      setErrorMsg("Could not connect to server.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // String Parser: Slices up "Item - Sides: X | Drinks: Y [Special Request: Z]"
  const parseOrderDetails = (rawStr) => {
    let mainCourse = rawStr || "Breakfast Plate";
    let sides = "";
    let drinks = "";
    let special = "";

    // Extract Special Request
    const specialMatch = rawStr.match(/\[Special Request:\s*(.*?)\]/i);
    if (specialMatch) {
      special = specialMatch[1];
      mainCourse = mainCourse.replace(specialMatch[0], '');
    }

    // Split by Pipe for Drinks
    const parts = mainCourse.split('|');
    let mainPart = parts[0] || '';
    let drinksPart = parts[1] || '';

    // Split Main Part for Sides
    if (mainPart.includes(' - Sides: ')) {
      const splitMain = mainPart.split(' - Sides: ');
      mainCourse = splitMain[0].trim();
      sides = splitMain[1].trim();
    } else {
      mainCourse = mainPart.trim();
    }

    if (drinksPart.includes('Drinks: ')) {
      drinks = drinksPart.replace('Drinks:', '').trim();
    }

    return { mainCourse, sides, drinks, special };
  };

  const safeOrders = Array.isArray(orders) ? orders : [];
  const groupedMap = safeOrders.reduce((acc, item) => {
    if (!item) return acc;
    const roomName = item?.room_name || `Suite ${item?.room_id || 1}`;
    let time = item?.requested_time || '08:30 AM';
    if (!time.toUpperCase().includes('M')) time = `${time} AM`;
    const groupKey = `${roomName}___${time}`;
    if (!acc[groupKey]) acc[groupKey] = { roomName, time, items: [] };
    acc[groupKey].items.push(item);
    return acc;
  }, {});

  const sortedGroups = Object.values(groupedMap).sort((a, b) => {
    const parse = (t) => {
      let [h, m] = t.trim().split(' ')[0].split(':').map(Number);
      if (h === 12) h = 0;
      if (t.toUpperCase().includes('PM')) h += 12;
      return h * 60 + (m || 0);
    };
    return parse(a.time) - parse(b.time);
  });

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-stone-900 font-sans pb-12 w-full">
      
      {/* HEADER SECTION */}
      <div className="max-w-4xl mx-auto px-6 pt-10">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          {/* TITLE & SIGN */}
          <div className="flex items-center gap-6">
            <div>
              <div className="text-xs font-bold text-amber-600 tracking-widest uppercase mb-1">Service Management</div>
              <h1 className="text-4xl md:text-5xl font-serif font-black text-stone-900">Kitchen Reference</h1>
            </div>

            {/* OHIO STATE RED "NO SMS" SIGN */}
            {!smsEnabled && (
              <div className="flex flex-col items-center justify-start h-[75px] w-12 shrink-0 -mt-2 drop-shadow-xl animate-bounce">
                <div className="bg-stone-50 border-[3px] border-[#BB0000] rounded-[2px] w-full h-12 flex flex-col items-center justify-center shadow-md z-10 relative overflow-hidden">
                  <div className="absolute top-0.5 w-1 h-1 bg-stone-400 rounded-full shadow-inner border border-stone-500"></div>
                  <div className="absolute bottom-0.5 w-1 h-1 bg-stone-400 rounded-full shadow-inner border border-stone-500"></div>
                  <div className="text-[#BB0000] font-black text-center leading-none flex flex-col items-center z-10 select-none" style={{ fontVariant: 'small-caps' }}>
                     <span className="text-[10px] tracking-widest block -mb-0.5">No</span>
                     <span className="text-[14px] tracking-tighter block">SMS</span>
                  </div>
                </div>
                <div className="w-2 h-10 bg-gradient-to-r from-zinc-500 via-zinc-300 to-zinc-600 border-x border-zinc-500 shadow-inner -mt-1.5 relative z-0 flex flex-col items-center justify-start pt-3 gap-1">
                    <div className="w-0.5 h-0.5 bg-zinc-800 rounded-full opacity-60"></div>
                    <div className="w-0.5 h-0.5 bg-zinc-800 rounded-full opacity-60"></div>
                </div>
              </div>
            )}
          </div>

          {/* CONTROLS (Date & SMS Toggle) */}
          <div className="flex flex-col items-end gap-3 shrink-0">
            <div className="flex items-center gap-3 bg-white border border-stone-300 rounded-xl px-4 py-2 shadow-sm">
               <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Service Date:</span>
               <input 
                 type="date" 
                 value={selectedDate}
                 onChange={(e) => setSelectedDate(e.target.value)}
                 className="font-bold text-stone-900 outline-none bg-transparent cursor-pointer"
               />
               <button onClick={fetchCheatSheet} className="ml-2 text-stone-400 hover:text-amber-600 transition" title="Refresh">
                 🔄
               </button>
            </div>

            {/* SMS TOGGLE UI */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!smsEnabled}
                onChange={handleToggleTestMode}
                disabled={togglingSms}
                className="w-4 h-4 cursor-pointer accent-[#BB0000]"
              />
              <span className={`text-xs font-bold uppercase tracking-wider ${!smsEnabled ? 'text-[#BB0000]' : 'text-stone-500'}`}>
                {togglingSms ? 'Updating...' : !smsEnabled ? 'SMS Muted (Test Mode)' : 'SMS Live'}
              </span>
            </label>
          </div>
        </div>

        {/* THICK CRIMSON SEPARATOR */}
        <div className="mt-6 mb-8 border-b-[5px] border-[#8a1c32] w-full rounded-full"></div>
      </div>

      {/* CARDS CONTAINER */}
      <main className="max-w-4xl mx-auto px-6 space-y-8">
        {loading ? (
          <div className="text-center py-20 text-amber-700 font-mono font-bold text-lg">Loading Orders...</div>
        ) : sortedGroups.length === 0 ? (
          <div className="text-center text-stone-500 py-20 font-medium">No Orders Scheduled for {selectedDate}</div>
        ) : (
          sortedGroups.map((group, idx) => (
            <div key={idx} className="bg-[#f7f5f0] rounded-xl overflow-hidden shadow-xl border border-stone-200 flex flex-col">
              
              {/* CARD HEADER (Dark with Crimson Time Badge) */}
              <div className="bg-[#1a1815] border-b-4 border-amber-500 px-6 py-5 flex justify-between items-center">
                <div>
                  <h2 className="font-serif text-3xl text-white font-black tracking-wide">{group.roomName}</h2>
                  <span className="text-xs text-amber-500 font-bold tracking-widest uppercase mt-1 block">
                    {group.items.length} Plate Order{group.items.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="bg-[#8a1c32] text-white rounded-lg px-5 py-2.5 shadow-inner">
                  <span className="text-xl font-bold font-sans tracking-tight">{group.time}</span>
                </div>
              </div>

              {/* CARD BODY (White inner plates) */}
              <div className="p-6 bg-white space-y-6">
                {group.items.map((item, itemIdx) => {
                  // Parse the raw string into nice UI pieces!
                  const parsed = parseOrderDetails(item?.item_name);

                  return (
                    <div key={itemIdx} className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm relative overflow-hidden pl-7">
                      {/* Thick Black Left Accent Line */}
                      <div className="absolute left-0 top-0 bottom-0 w-2 bg-black"></div>
                      
                      {/* Plate Title */}
                      <div className="flex items-center gap-3 mb-5">
                        <span className="bg-amber-400 text-black text-xs font-black px-2 py-1 rounded shadow-sm shrink-0">
                          PLATE {itemIdx + 1}
                        </span>
                        <h3 className="text-2xl font-serif font-bold text-stone-900 leading-tight">
                          {parsed.mainCourse}
                        </h3>
                      </div>

                      {/* Accompaniments & Beverages Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                         <div>
                           <div className="text-[10px] text-stone-400 font-bold tracking-widest mb-1">ACCOMPANIMENTS / SIDES</div>
                           <div className="text-sm font-medium text-stone-800 flex gap-2">
                             <span className="opacity-60">🍴</span> {parsed.sides || 'None'}
                           </div>
                         </div>
                         <div>
                           <div className="text-[10px] text-stone-400 font-bold tracking-widest mb-1">BEVERAGES</div>
                           <div className="text-sm font-medium text-stone-800 flex gap-2">
                             <span className="opacity-60">☕</span> {parsed.drinks || 'None'}
                           </div>
                         </div>
                      </div>

                      {/* Special Request Warning Box */}
                      {parsed.special && (
                        <div className="mt-4 bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-[#8a1c32] font-bold flex items-center gap-2">
                          <span className="text-lg">⚠️</span> Special Request: {parsed.special}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </main>

    </div>
  );
}
