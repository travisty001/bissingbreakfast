import React, { useState, useEffect } from 'react';

const API_BASE = "https://api-peaufx4prq-uc.a.run.app/api/admin";

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
      const res = await fetch(`${API_BASE}/sms-status`);
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
          "Content-Type": "application/json"
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
      const res = await fetch(`${API_BASE}/cheat-sheet?date=${selectedDate}`);
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
        method: 'DELETE'
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
    <div
      className="min-h-screen text-white overflow-hidden flex flex-col select-none"
      style={{
        background: 'radial-gradient(ellipse at 50% -10%, #0d1526 0%, #070b14 55%, #03040a 100%)',
        fontFamily: '"Segoe UI", Tahoma, "Helvetica Neue", Arial, sans-serif'
      }}
    >
      <header className="px-4 md:px-10 py-4 md:py-5 flex items-center gap-4 shrink-0 bg-[#060a13]/85 border-b-2 border-[#1d3358] shadow-[0_2px_14px_rgba(0,0,0,0.5)]">
        <div
          className="relative w-11 h-11 md:w-12 md:h-12 rounded-full shrink-0"
          style={{
            background: 'radial-gradient(circle at 35% 30%, #9ef5a0 0%, #4ade80 25%, #15803d 68%, #04240f 100%)',
            boxShadow: '0 0 18px rgba(74,222,128,0.55), inset 0 0 6px rgba(255,255,255,0.4), inset 0 -4px 8px rgba(0,0,0,0.35)'
          }}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-6 md:h-6 absolute inset-0 m-auto">
            <rect x="2.5" y="3.5" width="19" height="13.5" rx="2.5" fill="#ffffff"/>
            <rect x="6.5" y="7" width="11" height="6.5" rx="1" fill="#16a34a"/>
            <rect x="9" y="19.5" width="6" height="2.2" rx="1.1" fill="#ffffff" opacity="0.9"/>
          </svg>
        </div>

        <div className="leading-tight min-w-0">
          <div className="text-[#8fa8d4] text-[10px] md:text-[11px] tracking-[0.35em] uppercase font-semibold">Bissing House</div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight whitespace-nowrap" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
            Kitchen Dashboard
          </h1>
        </div>

        <div className="ml-auto flex items-center gap-2 md:gap-4 shrink-0">
          <div className="flex items-center gap-3 bg-[#0b1322]/80 border border-[#2b4670] rounded-md px-3 md:px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white font-semibold outline-none cursor-pointer text-sm md:text-base w-full [color-scheme:dark]"
            />
          </div>

          <button
            onClick={handleToggleTestMode}
            disabled={togglingSms}
            className={`flex items-center gap-2 px-4 md:px-5 py-2 rounded-md border-2 transition-all duration-300 ${
              smsEnabled
                ? 'bg-[#0e2417] border-[#2fbf71] text-[#5dff9c] shadow-[0_0_16px_rgba(47,191,113,0.35)]'
                : 'bg-[#250f0f] border-[#c0392b] text-[#ff7b6b] shadow-[0_0_12px_rgba(192,57,43,0.25)]'
            }`}
          >
            <span className="text-sm md:text-base font-bold uppercase tracking-widest whitespace-nowrap">
              {smsEnabled ? 'SMS Live' : 'SMS Muted'}
            </span>
          </button>
        </div>
      </header>

      <main
        className="flex-1 w-full overflow-y-auto md:overflow-x-auto md:overflow-y-hidden md:snap-x md:snap-mandatory flex flex-col md:flex-row items-center md:items-stretch px-4 md:px-10 gap-6 md:gap-8 pb-12 pt-6 md:pt-6 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {loading ? (
           <div className="text-xl md:text-3xl font-bold text-[#5f76a3] w-full text-center tracking-wider pt-10 md:pt-0" style={{ textShadow: '0 0 20px rgba(95,118,163,0.5)' }}>Loading Orders...</div>
        ) : sortedGroups.length === 0 ? (
           <div className="text-xl md:text-3xl font-bold text-[#5f76a3] w-full text-center tracking-wider pt-10 md:pt-0" style={{ textShadow: '0 0 20px rgba(95,118,163,0.5)' }}>No Orders Scheduled</div>
        ) : (
           <>
             {sortedGroups.map((group, idx) => {
                
                let dynamicWidth = 'md:w-[500px]';
                let dynamicHeight = 'md:h-[560px]';

                if (group.items.length === 2) {
                    dynamicWidth = 'md:w-[515px]';
                    dynamicHeight = 'md:h-[820px]';
                } else if (group.items.length > 2) {
                    dynamicHeight = 'md:h-[85vh]';
                }

                return (
                  <div
                    key={idx}
                    className={`md:snap-center shrink-0 w-full max-w-[520px] md:max-w-none ${dynamicWidth} h-auto ${dynamicHeight} rounded-xl flex flex-col overflow-hidden transition-all duration-300 group shadow-2xl border-2 border-[#2a4168] hover:border-[#4d7cff] hover:shadow-[0_0_32px_rgba(77,124,255,0.4)]`}
                    style={{
                      background: 'linear-gradient(180deg, #13203a 0%, #0c1526 40%, #0a0f1c 100%)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 20px 40px rgba(0,0,0,0.55)'
                    }}
                  >
                    <div className="px-5 md:px-7 py-4 border-b border-[#1d3358] bg-[#0b1424]/90 flex justify-between items-start">
                      <div className="pr-2">
                        <div className="text-[10px] text-[#6f8fc4] font-semibold tracking-[0.3em] uppercase mb-1">Now Playing</div>
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-1 tracking-wide" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>{group.roomName}</h2>
                        <div className="text-xs md:text-sm text-[#5d9dff] font-semibold tracking-[0.2em] uppercase">
                          {group.items.length} Plate{group.items.length > 1 ? 's' : ''}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-3 shrink-0">
                         <span className="bg-[#0f1a30]/80 border border-[#3d5a8f] text-[#9cc2ff] px-3 py-1.5 md:px-4 md:py-2 rounded-full text-sm md:text-base font-bold whitespace-nowrap" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' }}>
                           {group.time}
                         </span>
                         <button
                           onClick={() => handleDeleteOrder(group.orderId, group.roomName)}
                           className="text-[#55709f] hover:text-[#ff6b5e] transition-colors p-1"
                           title="Delete Order"
                         >
                           <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                         </button>
                      </div>
                    </div>

                    <div className="p-4 md:p-6 flex-1 overflow-y-auto overflow-x-hidden space-y-5 md:space-y-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-[#2a4168] [&::-webkit-scrollbar-thumb]:rounded-full">
                      {group.items.map((item, itemIdx) => {
                        const parsed = parseOrderDetails(item?.item_name);
                        return (
                          <div key={itemIdx} className="bg-[#0d1526]/70 border border-[#24406b] rounded-md p-4 md:p-6 relative overflow-hidden" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3b82f6]"></div>

                            <div className="text-[10px] md:text-xs font-semibold tracking-[0.25em] text-[#7d9bd0] mb-2 uppercase">Plate {itemIdx + 1}</div>
                            
                            <h3 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-4" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{parsed.mainCourse}</h3>

                            <div className="space-y-3 md:space-y-4">
                               <div>
                                 <div className="text-[10px] md:text-xs font-bold text-[#5d9dff] tracking-[0.2em] uppercase mb-1">Sides</div>
                                 <div className="text-base md:text-lg font-medium text-[#c9d6ee]">{parsed.sides || 'None'}</div>
                               </div>
                               <div>
                                 <div className="text-[10px] md:text-xs font-bold text-[#5d9dff] tracking-[0.2em] uppercase mb-1">Drinks</div>
                                 <div className="text-base md:text-lg font-medium text-[#c9d6ee]">{parsed.drinks || 'None'}</div>
                               </div>
                            </div>

                            {parsed.special && (
                              <div className="mt-5 bg-[#2a1215] border border-[#7f3939] rounded p-3 text-sm md:text-base text-[#ffb4ac] font-medium shadow-sm">
                                <span className="font-bold text-[#ff9d8f]">⚠️ Request:</span> {parsed.special}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
             })}
             
             <div className="hidden md:block shrink-0 w-8 h-full"></div>
           </>
        )}
      </main>
    </div>
  );
}
