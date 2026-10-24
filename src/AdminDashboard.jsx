import React, { useState, useEffect } from 'react';

const API_BASE = "https://api-peaufx4prq-uc.a.run.app/api/admin";

const formatPlacedTime = (value) => {
  if (!value) return 'Placed time unavailable';

  try {
    let dateObj = null;

    if (typeof value === 'string' || typeof value === 'number') {
      dateObj = new Date(value);
    } else if (value?._seconds) {
      dateObj = new Date(value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1e6));
    } else if (typeof value?.toDate === 'function') {
      dateObj = value.toDate();
    } else if (value?.seconds) {
      dateObj = new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6));
    }

    if (!dateObj || Number.isNaN(dateObj.getTime())) return 'Placed time unavailable';

    return `Placed ${dateObj.toLocaleTimeString('en-US', {
      timeZone: 'America/Chicago',
      hour: 'numeric',
      minute: '2-digit'
    })}`;
  } catch {
    return 'Placed time unavailable';
  }
};

const getLocalDateString = () => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);

  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
};

export default function AdminDashboard() {
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [togglingSms, setTogglingSms] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getLocalDateString);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [expandedCards, setExpandedCards] = useState({}); // collapsed by default

  useEffect(() => {
    fetchSmsStatus();
    fetchCheatSheet();

    const interval = setInterval(() => {
      fetchCheatSheet(false);
    }, 30000);

    return () => clearInterval(interval);
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
      console.warn('Could not load SMS status:', err.message);
    }
  };

  const handleToggleTestMode = async () => {
    const targetSmsState = !smsEnabled;
    setTogglingSms(true);
    try {
      const res = await fetch(`${API_BASE}/sms-toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: targetSmsState })
      });
      const data = await res.json();
      if (data && data.success) {
        setSmsEnabled(targetSmsState);
      }
    } catch (err) {
      alert('Network error while updating SMS toggle.');
    } finally {
      setTogglingSms(false);
    }
  };

  const fetchCheatSheet = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/cheat-sheet?date=${selectedDate}`);
      if (!res.ok) throw new Error('Server returned status ' + res.status);
      const data = await res.json();
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      setErrorMsg('Could not connect to server.');
      setOrders([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleDeleteOrder = async (orderId, roomName) => {
    if (!window.confirm(`Are you sure you want to permanently delete the entire order for the ${roomName}?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}`, { method: 'DELETE' });
      if (res.ok) {
        setExpandedCards(prev => {
          const next = { ...prev };
          delete next[orderId];
          return next;
        });
        fetchCheatSheet(false);
      } else {
        alert('Failed to delete the order from the database.');
      }
    } catch (err) {
      alert('Network error while trying to delete the order.');
    }
  };

  const parseOrderDetails = (rawStr = '') => {
    let mainCourse = rawStr || 'Breakfast Plate';
    let sides = '';
    let drinks = '';
    let special = '';

    const specialMatch = rawStr.match(/\[Special Request:\s*(.*?)\]/i);
    if (specialMatch) {
      special = specialMatch[1];
      mainCourse = mainCourse.replace(specialMatch[0], '');
    }

    const parts = mainCourse.split('|');
    const mainPart = parts[0] || '';
    const drinksPart = parts[1] || '';

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

  const getRoomBg = (roomName) => {
    const lower = String(roomName || '').toLowerCase();
    if (lower.includes('bissing')) return "url('/bissing.jpg')";
    if (lower.includes('basgall')) return "url('/basgall.jpg')";
    if (lower.includes('tea')) return "url('/tearose.jpg')";
    return 'none';
  };

  const safeOrders = Array.isArray(orders) ? orders : [];

  const groupedMap = safeOrders.reduce((acc, item, idx) => {
    if (!item) return acc;

    const roomName = item?.room_name || `Suite ${item?.room_id || 1}`;
    let time = item?.requested_time || '08:30 AM';
    if (!String(time).toUpperCase().includes('M')) time = `${time} AM`;

    const orderId = item?.order_id || `fallback-${idx}`;
    const groupKey = String(orderId);

    if (!acc[groupKey]) {
      acc[groupKey] = {
        groupKey,
        orderId,
        roomName,
        time,
        placedAt: item?.created_at || item?.placed_at || item?.timestamp || null,
        items: []
      };
    }

    acc[groupKey].items.push(item);
    return acc;
  }, {});

  const sortedGroups = Object.values(groupedMap).sort((a, b) => {
    const parse = (t) => {
      const raw = String(t || '08:30 AM').trim();
      let [h, m] = raw.split(' ')[0].split(':').map(Number);
      if (h === 12) h = 0;
      if (raw.toUpperCase().includes('PM')) h += 12;
      return h * 60 + (m || 0);
    };
    return parse(a.time) - parse(b.time);
  });

  const toggleCard = (groupKey) => {
    setExpandedCards(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  return (
    <div
      className="min-h-screen text-white flex flex-col select-none overflow-x-hidden"
      style={{
        backgroundColor: '#0a0709',
        fontFamily: '"Segoe UI", Tahoma, "Helvetica Neue", Arial, sans-serif'
      }}
    >
      <header className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 bg-[#0d090b] border-b border-[#23151b]">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black font-bold text-xs">
            BH
          </div>
          <div className="leading-tight">
            <div className="text-[#d4af37] text-[10px] tracking-[0.2em] uppercase font-bold mb-1">Bissing House • Kitchen OS</div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Kitchen Dashboard</h1>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-3 bg-[#150e12] border border-[#23151b] rounded-md px-3 py-1.5">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white text-sm outline-none cursor-pointer [color-scheme:dark]"
            />
          </div>

          <button
            onClick={handleToggleTestMode}
            disabled={togglingSms}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#40202a] bg-[#231218] transition-colors"
          >
            <span className={`w-2 h-2 rounded-full ${smsEnabled ? 'bg-pink-500' : 'bg-gray-500'}`}></span>
            <span className="text-xs font-bold uppercase tracking-widest text-pink-100">
              {smsEnabled ? 'SMS Live' : 'SMS Muted'}
            </span>
          </button>
        </div>
      </header>

      <div className="px-6 py-4 text-sm text-[#a39aa2] shrink-0">
        {sortedGroups.length} order{sortedGroups.length === 1 ? '' : 's'} scheduled
      </div>

      <main className="flex-1 p-6 pt-2 overflow-y-auto">
        {loading ? (
          <div className="text-xl font-bold text-[#888] w-full text-center pt-10">Loading Orders...</div>
        ) : errorMsg ? (
          <div className="text-xl font-bold text-[#d18b8b] w-full text-center pt-10">{errorMsg}</div>
        ) : sortedGroups.length === 0 ? (
          <div className="text-xl font-bold text-[#888] w-full text-center pt-10">No Orders Scheduled</div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6 items-start">
            {sortedGroups.map((group) => {
              const isExpanded = !!expandedCards[group.groupKey];
              return (
                <div
                  key={group.groupKey}
                  className="w-full flex flex-col rounded-xl overflow-hidden relative"
                  style={{
                    backgroundColor: '#181118',
                    backgroundImage: `linear-gradient(to bottom, rgba(20, 15, 22, 1) 40%, rgba(20, 15, 22, 0.22)), ${getRoomBg(group.roomName)}`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'bottom',
                    border: '1px solid #4a2b32'
                  }}
                >
                  <div className="px-5 py-4 flex justify-between items-start z-10">
                    <div>
                      <div className="text-[10px] text-[#d4af37] font-bold tracking-[0.2em] uppercase mb-1">Now Serving</div>
                      <h2 className="text-2xl font-bold text-white mb-1">{group.roomName}</h2>
                      <div className="text-[10px] text-[#aaa] tracking-widest uppercase font-semibold">
                        {group.items.length} Plate{group.items.length > 1 ? 's' : ''}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="bg-[#38232e] border border-[#4a2e3d] text-white px-4 py-1.5 rounded-full text-lg font-bold shadow-sm">
                        {group.time}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-[#888]">{formatPlacedTime(group.placedAt)}</span>
                        <button
                          onClick={() => handleDeleteOrder(group.orderId, group.roomName)}
                          className="text-[#666] hover:text-[#ff4444] transition-colors"
                          title="Delete Order"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 pb-4 z-10">
                    <button
                      type="button"
                      onClick={() => toggleCard(group.groupKey)}
                      className="text-[#d4af37] text-sm font-bold underline underline-offset-4 hover:text-[#f1d978] transition-colors"
                    >
                      {isExpanded ? 'Collapse order' : 'Expand order'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="p-4 pt-0 z-10 space-y-3">
                      {group.items.map((item, itemIdx) => {
                        const parsed = parseOrderDetails(item?.item_name);
                        return (
                          <div key={`${group.groupKey}-${itemIdx}`} className="bg-[#1c0f14] border border-[#2d1820] rounded-md p-4">
                            <div className="text-[9px] font-bold tracking-[0.2em] text-[#d4af37] mb-1.5 uppercase">Plate {itemIdx + 1}</div>

                            <h3 className="text-lg font-bold text-white mb-3">{parsed.mainCourse}</h3>

                            <div className="flex flex-row gap-6">
                              <div className="flex-1">
                                <div className="text-[9px] font-bold text-[#b36b89] tracking-widest uppercase mb-1">Sides</div>
                                <div className="text-sm font-semibold text-[#e5e5e5] leading-snug">{parsed.sides || 'None'}</div>
                              </div>
                              <div className="flex-1">
                                <div className="text-[9px] font-bold text-[#b36b89] tracking-widest uppercase mb-1">Drinks</div>
                                <div className="text-sm font-semibold text-[#e5e5e5] leading-snug">{parsed.drinks || 'None'}</div>
                              </div>
                            </div>

                            {parsed.special && (
                              <div className="mt-4 border-t border-[#2d1820] pt-3 text-sm text-[#ff9d8f] font-medium">
                                <strong>Note:</strong> {parsed.special}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
