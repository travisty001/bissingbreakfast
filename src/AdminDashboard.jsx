import React, { useState, useEffect, useRef } from 'react';

// Swap to http://localhost:5000/bhbreakfastmenu/us-central1/api/api/admin if testing local backend
const API_BASE = "https://api-peaufx4prq-uc.a.run.app/api/admin";
const KITCHEN_PIN = "1879"; 

export default function AdminDashboard() {
  // --- MUTE / UNMUTE SCRIPTS STATE ---
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [togglingSms, setTogglingSms] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const scrollTrackRef = useRef(null);

  useEffect(() => {
    fetchSmsStatus();
    fetchCheatSheet();
  }, [selectedDate]);

  // =====================================================================
  // RESTORED SMS SCRIPTS
  // =====================================================================
  const fetchSmsStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/sms-status`, {
        headers: { "x-kitchen-pin": KITCHEN_PIN }
      });
      if (!res.ok) throw new Error("Server status: " + res.status);
      const data = await res.json();
      if (data && typeof data.enabled !== 'undefined') {
        setSmsEnabled(data.enabled);
      }
    } catch (err) {
      console.warn("Could not load SMS status:", err.message);
    }
  };

  const handleToggleTestMode = async (e) => {
    const isTestMode = e.target.checked;
    const targetSmsState = !isTestMode; 
    
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
        setSuccessMsg(`Cell notifications are now ${targetSmsState ? 'LIVE 🟢' : 'MUTED (Test Mode) 🔕'}.`);
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        alert("Failed to update SMS status.");
      }
    } catch (err) {
      alert("Network error while updating SMS toggle.");
    } finally {
      setTogglingSms(false);
    }
  };
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
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans pb-12 w-full flex flex-col overflow-x-hidden">
      
      {/* HEADER */}
      <header className="bg-black border-b-2 border-stone-800 px-6 py-4 sticky top-0 z-50 shadow-2xl flex flex-wrap justify-between items-center gap-4 shrink-0">
        <div className="flex items-center space-x-4">
          <span className="text-3xl pb-2">☕</span>
          <div>
            <div className="flex items-end gap-5">
              <h1 className="font-serif text-xl md:text-2xl tracking-wider uppercase text-white font-black">
                Kitchen Reference
              </h1>

              {/* ========================================================= */}
              {/* REALISTIC "NO SMS" STREET SIGN (OHIO STATE RED #BB0000)   */}
              {/* ========================================================= */}
              {!smsEnabled && (
                <div className="flex flex-col items-center justify-start h-[75px] w-12 shrink-0 -mt-2 animate-bounce drop-shadow-2xl">
                  {/* Sign Plate */}
                  <div className="bg-stone-50 border-[3px] border-[#BB0000] rounded-[2px] w-full h-12 flex flex-col items-center justify-center shadow-md z-10 relative overflow-hidden">
                    {/* Mounting Bolts */}
                    <div className="absolute top-0.5 w-1 h-1 bg-stone-400 rounded-full shadow-inner border border-stone-500"></div>
                    <div className="absolute bottom-0.5 w-1 h-1 bg-stone-400 rounded-full shadow-inner border border-stone-500"></div>
                    
                    {/* Text */}
                    <div className="text-[#BB0000] font-black text-center leading-none flex flex-col items-center z-10 select-none" style={{ fontVariant: 'small-caps' }}>
                       <span className="text-[10px] tracking-widest block -mb-0.5">No</span>
                       <span className="text-[14px] tracking-tighter block">SMS</span>
                    </div>
                  </div>
                  {/* Metal U-Channel Post */}
                  <div className="w-2 h-10 bg-gradient-to-r from-zinc-500 via-zinc-300 to-zinc-600 border-x border-zinc-500 shadow-inner -mt-1.5 relative z-0 flex flex-col items-center justify-start pt-3 gap-1">
                      {/* Post Holes */}
                      <div className="w-0.5 h-0.5 bg-zinc-800 rounded-full opacity-60"></div>
                      <div className="w-0.5 h-0.5 bg-zinc-800 rounded-full opacity-60"></div>
                  </div>
                </div>
              )}
              {/* ========================================================= */}

            </div>
            <span className="text-xs uppercase tracking-widest text-amber-400 font-bold block mt-1">
              Bissing House • Morning Plating Schedule
            </span>
          </div>
        </div>

        {/* RESTORED SMS TOGGLE TICKER */}
        <label className={`flex items-center gap-3 border-2 px-4 py-2 rounded-xl font-mono text-xs font-bold uppercase tracking-wider cursor-pointer transition select-none shadow-lg ${
          !smsEnabled 
            ? 'bg-rose-950 border-[#BB0000] text-[#BB0000] animate-pulse font-black shadow-rose-950/50' 
            : 'bg-stone-900 border-emerald-500/80 text-emerald-400 hover:bg-stone-800'
        }`}>
          <input
            type="checkbox"
            checked={!smsEnabled}
            onChange={handleToggleTestMode}
            disabled={togglingSms}
            className="w-4 h-4 cursor-pointer rounded"
          />
          <span>
            {togglingSms 
              ? '⏳ Updating...' 
              : !smsEnabled 
                ? '🔕 Test Mode (Muted)' 
                : '🟢 Notifications Live'}
          </span>
        </label>
      </header>

      {/* TOOLBAR */}
      <div className="max-w-6xl w-full mx-auto px-6 pt-6 shrink-0">
        {successMsg && (
          <div className="bg-emerald-950 border-2 border-emerald-600 text-emerald-200 font-bold px-6 py-4 rounded-xl mb-4 text-sm flex justify-between items-center shadow-lg">
            <span>✓ {successMsg}</span>
          </div>
        )}
        <div className="bg-stone-900 border-2 border-stone-800 rounded-2xl p-4 md:p-6 flex flex-wrap items-center gap-4 shadow-xl">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-black border-2 border-stone-700 rounded-xl px-4 py-2 text-white font-mono text-base font-bold focus:outline-none focus:border-amber-400"
          />
          <button
            onClick={fetchCheatSheet}
            className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-white text-xs font-mono font-bold uppercase tracking-widest rounded-xl border border-stone-600 shadow"
          >
            🔄 Refresh List
          </button>
        </div>
      </div>

      {/* HORIZONTAL CARDS */}
      <main className="flex-1 flex flex-col justify-center mt-4 overflow-hidden">
        {loading ? (
          <div className="text-center py-20 text-amber-400 font-mono font-bold text-lg">Loading...</div>
        ) : sortedGroups.length === 0 ? (
          <div className="text-center text-stone-400 py-20">No Orders Scheduled</div>
        ) : (
          <div className="flex overflow-x-auto gap-8 py-8 px-[10vw] snap-x snap-mandatory scroll-smooth w-full no-scrollbar">
            {sortedGroups.map((group, idx) => (
              <div key={idx} className="w-[85vw] sm:w-[440px] md:w-[480px] shrink-0 snap-center bg-stone-900 border-2 border-stone-700 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                <div className="bg-black border-b-2 border-stone-800 px-6 py-5 flex justify-between items-center">
                  <h2 className="font-serif text-2xl text-white font-black tracking-wide uppercase">{group.roomName}</h2>
                  <div className="bg-amber-400 text-black rounded-2xl px-5 py-2.5 text-center min-w-[130px]">
                    <span className="block text-[10px] font-mono font-black uppercase tracking-widest">Time</span>
                    <span className="text-2xl font-black font-mono tracking-tight">{group.time}</span>
                  </div>
                </div>
                <div className="p-6 divide-y divide-stone-800 bg-stone-900/90 flex-1">
                  {group.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="pt-4 first:pt-0 pb-4 text-white font-serif text-xl">
                      {item?.item_name || 'Breakfast Plate'}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

    </div>
  );
}
