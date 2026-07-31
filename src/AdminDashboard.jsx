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

  const handleToggleTestMode = async () => {
    const targetSmsState = !smsEnabled; 
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

  const handleDeleteOrder = async (orderId, roomName) => {
    if (!window.confirm(`Are you sure you want to permanently delete the entire order for the ${roomName}?`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}`, {
        method: 'DELETE',
        headers: { "x-kitchen-pin": KITCHEN_PIN }
      });
      
      if (res.ok) {
        fetchCheatSheet(); 
      } else {
        alert("Failed to delete the order from the database.");
      }
    } catch (err) {
      alert("Network error while trying to delete the order.");
    }
  };

  const parseOrderDetails = (rawStr) => {
    let mainCourse = rawStr || "Breakfast Plate";
    let sides = "";
    let drinks = "";
    let special = "";

    const specialMatch = rawStr.match(/\[Special Request:\s*(.*?)\]/i);
    if (specialMatch) {
      special = specialMatch[1];
      mainCourse = mainCourse.replace(specialMatch[0], '');
    }

    const parts = mainCourse.split('|');
    let mainPart = parts[0] || '';
    let drinksPart = parts[1] || '';

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
    
    if (!acc[groupKey]) {
      acc[groupKey] = { roomName, time, orderId: item.order_id, items: [] };
    }
    
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
    <div className="min-h-screen bg-black text-white font-sans overflow-hidden flex flex-col select-none">
      
      {/* HEADER: Adjusted for vertical stacking on mobile */}
      <header className="px-4 md:px-12 pt-6 md:pt-12 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end shrink-0 border-b-2 border-[#222] gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white">KITCHEN</h1>
          <div className="text-lg md:text-xl font-bold text-[#FFD700] tracking-widest uppercase mt-1">
            Bissing House Service
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:gap-6">
          <div className="flex items-center gap-3 bg-[#111] border-2 border-[#555] rounded-md px-3 md:px-5 py-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white font-bold outline-none cursor-pointer [color-scheme:dark] text-sm md:text-base w-full"
            />
          </div>

          <button
            onClick={handleToggleTestMode}
            disabled={togglingSms}
            className={`flex items-center gap-2 px-4 md:px-6 py-2 rounded-md border-2 transition-colors duration-300 ${
              smsEnabled
                ? 'bg-[#00FF66] border-[#00FF66] text-black hover:bg-[#00CC52]'
                : 'bg-[#FF0000] border-[#FF0000] text-white hover:bg-[#CC0000]'
            }`}
          >
            <span className="text-sm md:text-base font-black uppercase tracking-widest whitespace-nowrap">
              {smsEnabled ? 'SMS alerts LIVE' : 'SMS alerts MUTED'}
            </span>
          </button>
        </div>
      </header>

      {/* MAIN: Vertical scroll on mobile, Horizontal snap on desktop */}
      <main 
        className="flex-1 w-full overflow-y-auto md:overflow-x-auto md:overflow-y-hidden md:snap-x md:snap-mandatory flex flex-col md:flex-row items-center md:items-stretch px-4 md:px-12 gap-6 md:gap-8 pb-12 pt-6 md:pt-4 [&::-webkit-scrollbar]:hidden" 
        style={{ scrollbarWidth: 'none' }}
      >
        {loading ? (
           <div className="text-xl md:text-3xl font-black text-[#555] w-full text-center tracking-widest uppercase pt-10 md:pt-0">Loading Orders...</div>
        ) : sortedGroups.length === 0 ? (
           <div className="text-xl md:text-3xl font-black text-[#555] w-full text-center tracking-widest uppercase pt-10 md:pt-0">No Orders Scheduled</div>
        ) : (
           <>
             {sortedGroups.map((group, idx) => (
                <div
                  key={idx}
                  // CARD: Full width on mobile, 480px on desktop. Height auto on mobile, fixed on desktop.
                  className="md:snap-center shrink-0 w-full max-w-[480px] md:max-w-none md:w-[480px] h-auto md:h-[550px] bg-[#151515] border-[3px] border-[#333] rounded-xl flex flex-col overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:border-[#FFD700] group shadow-2xl"
                >
                  <div className="p-4 md:p-6 border-b-[4px] border-[#FFD700] flex justify-between items-start bg-black">
                    <div className="pr-2">
                      <h2 className="text-2xl md:text-4xl font-black tracking-tight text-white mb-1 md:mb-2 uppercase break-words">{group.roomName}</h2>
                      <div className="text-xs md:text-sm text-[#FFD700] font-black tracking-[0.2em] uppercase">
                        {group.items.length} Plate{group.items.length > 1 ? 's' : ''}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2 md:gap-3 shrink-0">
                       <span className="bg-[#FFD700] text-black px-3 py-1 md:px-4 md:py-1.5 rounded-md text-lg md:text-xl font-black whitespace-nowrap">
                         {group.time}
                       </span>
                       <button
                         onClick={() => handleDeleteOrder(group.orderId, group.roomName)}
                         className="text-[#555] hover:text-[#FF0000] transition-colors p-1"
                         title="Delete Order"
                       >
                         <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                       </button>
                    </div>
                  </div>

                  <div className="p-4 md:p-6 flex-1 overflow-y-auto overflow-x-hidden space-y-6 md:space-y-8 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-[#444] [&::-webkit-scrollbar-thumb]:rounded-full">
                    {group.items.map((item, itemIdx) => {
                      const parsed = parseOrderDetails(item?.item_name);
                      return (
                        <div key={itemIdx} className="relative pl-4 md:pl-6">
                          <div className="absolute left-0 top-1 bottom-1 w-1 md:w-1.5 bg-[#FFD700]"></div>

                          <div className="text-xs md:text-sm font-black tracking-widest text-[#777] mb-1.5 uppercase">Plate {itemIdx + 1}</div>
                          
                          <h3 className="text-xl md:text-3xl font-black text-white leading-tight mb-3 md:mb-4">{parsed.mainCourse}</h3>

                          <div className="space-y-3 md:space-y-4">
                             <div>
                               <div className="text-xs md:text-sm font-black text-[#FFD700] tracking-widest uppercase mb-1">Sides</div>
                               <div className="text-lg md:text-xl font-bold text-white">{parsed.sides || 'None'}</div>
                             </div>
                             <div>
                               <div className="text-xs md:text-sm font-black text-[#FFD700] tracking-widest uppercase mb-1">Drinks</div>
                               <div className="text-lg md:text-xl font-bold text-white">{parsed.drinks || 'None'}</div>
                             </div>
                          </div>

                          {parsed.special && (
                            <div className="mt-4 md:mt-5 bg-[#CC0000] border-2 border-[#FF3333] rounded-md p-3 md:p-4 text-base md:text-xl text-white font-black shadow-lg">
                              <span className="text-[#FFD700]">⚠️ REQUEST:</span> {parsed.special}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
             ))}
             
             {/* THE INVISIBLE FIX: Spacer for desktop */}
             <div className="hidden md:block shrink-0 w-8 h-full"></div>
           </>
        )}
      </main>
    </div>
  );
}
