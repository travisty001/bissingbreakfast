const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');
const nodemailer = require('nodemailer');
const { sendOrderAlert, testOnly } = require('./sms');

admin.initializeApp();
const dbFirestore = admin.firestore();
dbFirestore.settings({ ignoreUndefinedProperties: true });

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// =====================================================================
// SMS TOGGLE STATE (persisted in Firestore so it survives restarts)
// =====================================================================
async function getSmsEnabled() {
    try {
        const doc = await dbFirestore.collection('settings').doc('sms').get();
        if (doc.exists && typeof doc.data().enabled === 'boolean') {
            return doc.data().enabled;
        }
    } catch (err) {
        console.error("Could not read SMS settings:", err.message);
    }
    return false;
}

app.get('/api/admin/sms-status', async (req, res) => {
    const enabled = await getSmsEnabled();
    res.json({ enabled, test_only: testOnly() });
});

app.put('/api/admin/sms-toggle', async (req, res) => {
    const next = !!req.body.enabled;
    try {
        await dbFirestore.collection('settings').doc('sms').set({
            enabled: next,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        res.json({ success: true, enabled: next });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =====================================================================
// SQLITE DATABASE INIT
// =====================================================================
const originalDbPath = path.resolve(__dirname, 'breakfast.db');
const tempDbPath = path.join(os.tmpdir(), 'breakfast.db');

if (!fs.existsSync(tempDbPath) && fs.existsSync(originalDbPath)) {
    fs.copyFileSync(originalDbPath, tempDbPath);
}

const db = new sqlite3.Database(tempDbPath, (err) => {
    if (err) console.error("Database connection error:", err.message);
    else console.log("Connected to SQLite (Read-Only Catalog).");
});

const queryDb = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// =====================================================================
// GUEST ORDERING ROUTES
// =====================================================================
app.get('/api/menu', async (req, res) => {
    try {
        const rows = await queryDb(`SELECT * FROM menu_items WHERE is_available = 1 ORDER BY category, name`);
        res.json({ success: true, items: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// The room's current service-day order, used to prefill guest corrections.
app.get('/api/orders/current', async (req, res) => {
    try {
        const room = Number(req.query.room_id);
        const orderId = String(req.query.order_id || '');
        const date = String(req.query.service_date || '');
        if (![1, 2, 3].includes(room) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^[A-Za-z0-9]{10,80}$/.test(orderId)) {
            return res.status(400).json({ success: false, error: 'Invalid room or service date.' });
        }
        const doc = await dbFirestore.collection('orders').doc(orderId).get();
        const order = doc.exists ? doc.data() : null;
        if (!order || order.status === 'archived' || Number(order.room_id) !== room || order.service_date !== date) {
            return res.json({ success: true, order: null });
        }
        res.json({ success: true, order: { order_id: doc.id, ...order,
            created_at: order.created_at?.toDate?.().toISOString() || null } });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/api/orders', async (req, res) => {
    try {
        const { room_id, service_date, requested_time, guest_count, dietary_notes, order_items } = req.body;

        if (!room_id || !service_date || !requested_time) {
            return res.status(400).json({ success: false, error: "Missing required booking details." });
        }

        const suiteMap = {
            1: "Bissing Suite",
            2: "Basgall Suite",
            3: "Tea Rose Suite",
            "Bissing": "Bissing Suite",
            "Basgall": "Basgall Suite",
            "TeaRose": "Tea Rose Suite"
        };
        const roomName = suiteMap[room_id] || `Room ${room_id}`;

        const enrichedItems = [];
        if (Array.isArray(order_items)) {
            for (const item of order_items) {
                const menus = await queryDb("SELECT name, category FROM menu_items WHERE id = ?", [item.menu_item_id || 1]);
                const baseItem = menus.length > 0 ? menus[0] : { name: 'Unknown Item', category: 'Uncategorized' };

                enrichedItems.push({
                    category: baseItem.category || 'Uncategorized',
                    item_name: item.customization_note ? item.customization_note : (baseItem.name || 'Unknown Item'),
                    quantity: item.quantity || 1,
                    menu_item_id: item.menu_item_id || 1
                });
            }
        }

        const orderDoc = {
            room_id: room_id || 'Unknown',
            room_name: roomName,
            service_date: service_date,
            requested_time: requested_time,
            guest_count: guest_count || 1,
            dietary_notes: dietary_notes || '',
            status: 'pending',
            items: enrichedItems,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        // One active order per room per breakfast service date. A correction replaces its
        // plates rather than creating another kitchen card. Retain original placed time.
        const existingSnap = await dbFirestore.collection('orders')
            .where('service_date', '==', service_date).get();
        const matching = existingSnap.docs.filter(d => d.data().status !== 'archived' &&
            Number(d.data().room_id) === Number(room_id));
        matching.sort((a,b) => (b.data().created_at?.toMillis?.() || 0) -
            (a.data().created_at?.toMillis?.() || 0));
        let docRef;
        const updated = matching.length > 0;
        if (updated) {
            docRef = matching[0].ref;
            delete orderDoc.created_at;
            await docRef.update({ ...orderDoc,
                updated_at: admin.firestore.FieldValue.serverTimestamp() });
        } else {
            docRef = await dbFirestore.collection('orders').add(orderDoc);
        }

        // Await transport completion before ending the function request.
        const sms = await sendOrderAlert({
            enabled: await getSmsEnabled(),
            orderId: docRef.id,
            text: `${updated ? 'Updated' : 'New'} Breakfast Order: ${roomName} for ${requested_time}.`
        }, { mailer: nodemailer });

        res.json({ success: true, order_id: docRef.id, updated, sms });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================================
// ADMIN & KITCHEN ROUTES
// =====================================================================
app.get('/api/admin/cheat-sheet', async (req, res) => {
    try {
        const { date } = req.query;
        const snapshot = await dbFirestore.collection('orders')
            .where('service_date', '==', date)
            .get();

        let cheatSheet = [];
        
        snapshot.forEach(doc => {
            const order = doc.data();
            if (order.status !== 'archived') {
                if (order.items && Array.isArray(order.items)) {
                    order.items.forEach(item => {
                        cheatSheet.push({
                            order_id: doc.id,
                            // Firestore timestamps are UTC instants. Send ISO 8601 for reliable local formatting.
                            created_at: order.created_at?.toDate?.().toISOString() || null,
                            updated_at: order.updated_at?.toDate?.().toISOString() || null,
                            room_name: order.room_name || 'Unknown Room',
                            requested_time: order.requested_time || '00:00',
                            dietary_notes: order.dietary_notes || '',
                            category: item.category || 'Uncategorized',
                            item_name: item.item_name || 'Unknown Item',
                            quantity: item.quantity || 1
                        });
                    });
                }
            }
        });

        cheatSheet.sort((a, b) => {
            if (a.category !== b.category) return a.category.localeCompare(b.category);
            if (a.item_name !== b.item_name) return a.item_name.localeCompare(b.item_name);
            return a.requested_time.localeCompare(b.requested_time);
        });

        res.json({ success: true, orders: cheatSheet });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// <-- NEW DELETE ROUTE -->
app.delete('/api/admin/orders/:id', async (req, res) => {
    try {
        await dbFirestore.collection('orders').doc(req.params.id).delete();
        res.json({ success: true, message: "Order successfully deleted." });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

exports.api = functions.https.onRequest(app);
