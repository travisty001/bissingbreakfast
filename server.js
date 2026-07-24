import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';

const app = express();
const PORT = 8080;

// Enable CORS for local Vite testing and JSON body parsing
app.use(cors());
app.use(express.json());

// Initialize SQLite Database (creates file automatically if it doesn't exist)
const db = new Database('bissing_orders.db');

// Enable foreign keys and create schema
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER,
    service_date TEXT,
    requested_time TEXT,
    guest_count INTEGER,
    dietary_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    menu_item_id INTEGER,
    quantity INTEGER,
    customization_note TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );
`);

// POST /api/orders — Submit a new breakfast order from a guest
app.post('/api/orders', (req, res) => {
  try {
    const { room_id, service_date, requested_time, guest_count, dietary_notes, order_items } = req.body;

    const insertOrder = db.prepare(`
      INSERT INTO orders (room_id, service_date, requested_time, guest_count, dietary_notes)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = insertOrder.run(room_id || 1, service_date, requested_time, guest_count || 1, dietary_notes || '');
    const orderId = result.lastInsertRowid;

    if (order_items && Array.isArray(order_items)) {
      const insertItem = db.prepare(`
        INSERT INTO order_items (order_id, menu_item_id, quantity, customization_note)
        VALUES (?, ?, ?, ?)
      `);
      
      const insertMany = db.transaction((items) => {
        for (const item of items) {
          insertItem.run(orderId, item.menu_item_id || 1, item.quantity || 1, item.customization_note || '');
        }
      });
      
      insertMany(order_items);
    }

    console.log(`✅ [NEW ORDER] Order #${orderId} received for Room ${room_id} at ${requested_time}`);
    res.json({ success: true, order_id: orderId });
  } catch (err) {
    console.error("❌ Database insert error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/orders — Fetch orders for the kitchen screen (optional ?date=YYYY-MM-DD filter)
app.get('/api/orders', (req, res) => {
  try {
    const { date } = req.query;
    let orders;

    if (date) {
      orders = db.prepare('SELECT * FROM orders WHERE service_date = ? ORDER BY requested_time ASC').all(date);
    } else {
      orders = db.prepare('SELECT * FROM orders ORDER BY service_date DESC, requested_time ASC').all();
    }

    // Attach order_items array to each order so the kitchen grouping logic works seamlessly
    const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
    for (const order of orders) {
      order.order_items = getItems.all(order.id);
    }

    res.json(orders);
  } catch (err) {
    console.error("❌ Database fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🍳 Bissing House Local Kitchen API running at http://localhost:${PORT}`);
  console.log(`📦 SQLite database stored locally in: bissing_orders.db\n`);
});
