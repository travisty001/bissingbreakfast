const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');
const nodemailer = require('nodemailer');

admin.initializeApp();
const dbFirestore = admin.firestore();
dbFirestore.settings({ ignoreUndefinedProperties: true });

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// SMS Area
// Global variable to hold state (or tie this to your database)
let smsNotificationsLive = true;

// 1. GET Script: Check current SMS status
app.get('/api/admin/sms-status', (req, res) => {
  res.json({ enabled: smsNotificationsLive });
});

// 2. PUT Script: Toggle SMS on/off
app.put('/api/admin/sms-toggle', (req, res) => {
  const { enabled } = req.body;
  smsNotificationsLive = !!enabled; // Force boolean
  res.json({ success: true, enabled: smsNotificationsLive });
});

// Initialize SQLite (Read-Only Menu & Suites)
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

// -----------------------------------------
// PUBLIC API ROUTES (For Guest Ordering)
// -----------------------------------------

app.get('/api/menu', async (req, res) => {
    try {
        const rows = await queryDb(`SELECT * FROM menu_items WHERE is_available = 1 ORDER BY category, name`);
        res.json({ success: true, items: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Submit a new breakfast order (Writes permanently to Firestore & Triggers SMS)
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

        const docRef = await dbFirestore.collection('orders').add(orderDoc);

        // --- SMS NOTIFICATION TRIGGER ---
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'travisty.001@gmail.com', // <-- Replace with Bissing House Gmail
                    pass: 'vukyiamzxorlhdwz'   // <-- Replace with 16-letter App Password
                }
            });

            const mailOptions = {
                from: 'travisty.001@gmail.com',
                to: [
                    '7852593556@vtext.com',              // Michelle (Straight Talk / Verizon)
                    '2143358780@tmomail.net',            // Casey (T-Mobile)
                    '7852596900@vtext.com'    // Self (Straight Talk / Verizon)
                ],
                subject: 'Bissing House',
                text: `New Breakfast Order: ${roomName} for ${requested_time}.`
            };

            transporter.sendMail(mailOptions, (err, info) => {
                if (err) console.error("SMS notification failed:", err);
                else console.log("SMS sent successfully:", info.response);
            });
        } catch (smsError) {
            console.error("SMS setup error:", smsError);
        }
        // --- END SMS TRIGGER ---

        res.json({ success: true, order_id: docRef.id });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/orders/:id', async (req, res) => {
    try {
        const doc = await dbFirestore.collection('orders').doc(req.params.id).get();
        if (!doc.exists) {
            return res.status(404).json({ success: false, error: "Order not found." });
        }
        res.json({ success: true, order: doc.data() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/orders/:id', async (req, res) => {
    try {
        const { room_id, order_items, dietary_notes, guest_count, requested_time } = req.body;
        
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

        await dbFirestore.collection('orders').doc(req.params.id).update({
            room_id: room_id || 'Unknown',
            room_name: roomName,
            items: enrichedItems,
            dietary_notes: dietary_notes || '',
            guest_count: guest_count || 1,
            requested_time: requested_time || '00:00',
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: "Order updated successfully." });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// -----------------------------------------
// KITCHEN SECURITY & ADMIN ROUTES
// -----------------------------------------

app.use('/api/admin', (req, res, next) => {
    const pin = req.headers['x-kitchen-pin'];
    const validPin = process.env.KITCHEN_PIN || "1879"; 
    if (pin === validPin) next();
    else res.status(401).json({ success: false, error: "Unauthorized. Invalid Kitchen PIN." });
});

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

app.put('/api/admin/archive-day', async (req, res) => {
    try {
        const { date } = req.query;
        const snapshot = await dbFirestore.collection('orders')
            .where('service_date', '==', date)
            .get();

        const batch = dbFirestore.batch();
        snapshot.forEach(doc => {
            batch.update(doc.ref, { status: 'archived' });
        });

        await batch.commit();
        res.json({ success: true, message: `Archived orders for ${date}.` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/admin/menu/:id/toggle', async (req, res) => {
    try {
        const { is_available } = req.body;
        await queryDb(`UPDATE menu_items SET is_available = ? WHERE id = ?`, [is_available, req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/menu', async (req, res) => {
    try {
        const rows = await queryDb(`SELECT * FROM menu_items ORDER BY category, name`);
        res.json({ success: true, items: rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

exports.api = functions.https.onRequest(app);
