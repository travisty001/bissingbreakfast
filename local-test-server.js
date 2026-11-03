import express from 'express';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
const app = express();
app.use(express.json());
const db = new Database(new URL('./local-test-orders.db', import.meta.url).pathname);
db.exec('CREATE TABLE IF NOT EXISTS test_orders (id TEXT PRIMARY KEY, data TEXT NOT NULL)');
const all = () => db.prepare('SELECT id, data FROM test_orders').all().map(r => ({id:r.id,...JSON.parse(r.data)}));
const names = {1:'Bissing Suite',2:'Basgall Suite',3:'Tea Rose Suite'};
app.get('/api/orders/current', (req,res) => {
 const order=all().find(o=>o.id===req.query.order_id && Number(o.room_id)===Number(req.query.room_id) && o.service_date===req.query.service_date);
 res.json({success:true,order:order ? {...order,order_id:order.id}:null});
});
app.post('/api/orders', (req,res) => {
 const b=req.body;
 if (!names[b.room_id] || !/^\d{4}-\d{2}-\d{2}$/.test(b.service_date||'') || !b.requested_time || !Array.isArray(b.order_items) || !b.order_items.length) return res.status(400).json({success:false,error:'Missing or invalid order details.'});
 const old=all().find(o=>Number(o.room_id)===Number(b.room_id)&&o.service_date===b.service_date);
 const id=old?.id || randomUUID().replaceAll('-','');
 const order={...b,room_name:names[b.room_id],status:'pending',created_at:old?.created_at||new Date().toISOString(),updated_at:old?new Date().toISOString():null,items:b.order_items.map(i=>({menu_item_id:i.menu_item_id||1,category:'Breakfast',item_name:i.customization_note||'Breakfast',quantity:i.quantity||1}))};
 db.prepare('INSERT OR REPLACE INTO test_orders VALUES (?,?)').run(id,JSON.stringify(order));
 res.json({success:true,order_id:id,updated:!!old,sms:{status:'disabled',mode:'local_test'}});
});
app.get('/api/admin/cheat-sheet', (req,res) => res.json({success:true,orders:all().filter(o=>o.service_date===req.query.date).flatMap(o=>o.items.map(i=>({order_id:o.id,created_at:o.created_at,updated_at:o.updated_at,room_name:o.room_name,requested_time:o.requested_time,dietary_notes:o.dietary_notes||'',...i})))}));
app.delete('/api/admin/orders/:id',(req,res)=>{db.prepare('DELETE FROM test_orders WHERE id=?').run(req.params.id);res.json({success:true});});
app.listen(8081,'127.0.0.1',()=>console.log('Local test API on 127.0.0.1:8081; no external backend or SMS.'));
