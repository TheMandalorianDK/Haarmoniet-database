const express = require('express');
const mysql   = require('mysql2/promise');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));   // serves your barbershop.html

const pool = mysql.createPool({
  host:     'localhost',
  user:     'root',         // your MySQL username
  password: '8981Dyrbyvej32', // your MySQL password
  database: 'barbershop',
  waitForConnections: true,
});

// ── AUTH ──────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE email=? AND password=?', [email, password]
  );
  if (!rows.length) return res.status(401).json({ error: 'Forkert email eller adgangskode.' });
  const u = rows[0];
  delete u.password;
  res.json(u);
});

app.post('/api/register', async (req, res) => {
  const { name, email, phone, password } = req.body;
  try {
    const [r] = await pool.query(
      'INSERT INTO users (name,email,phone,password,role) VALUES (?,?,?,?,?)',
      [name, email, phone, password, 'customer']
    );
    res.json({ id: r.insertId, name, email, phone, role: 'customer' });
  } catch (e) {
    res.status(400).json({ error: 'Email er allerede i brug.' });
  }
});

// ── SERVICES ──────────────────────────────────
app.get('/api/services', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM services');
  res.json(rows);
});

app.post('/api/services', async (req, res) => {
  const { name, description, price, duration } = req.body;
  const [r] = await pool.query(
    'INSERT INTO services (name,description,price,duration) VALUES (?,?,?,?)',
    [name, description, price, duration]
  );
  res.json({ id: r.insertId, name, description, price, duration });
});

app.put('/api/services/:id', async (req, res) => {
  const { name, description, price, duration } = req.body;
  await pool.query(
    'UPDATE services SET name=?,description=?,price=?,duration=? WHERE id=?',
    [name, description, price, duration, req.params.id]
  );
  res.json({ ok: true });
});

app.delete('/api/services/:id', async (req, res) => {
  await pool.query('DELETE FROM services WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── BARBERS ───────────────────────────────────
app.get('/api/barbers', async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id,name,email,phone,specialty FROM users WHERE role='barber'"
  );
  res.json(rows);
});

app.post('/api/barbers', async (req, res) => {
  const { name, email, phone, password, specialty } = req.body;
  try {
    const [r] = await pool.query(
      'INSERT INTO users (name,email,phone,password,role,specialty) VALUES (?,?,?,?,?,?)',
      [name, email, phone, password, 'barber', specialty]
    );
    res.json({ id: r.insertId, name, email, phone, specialty });
  } catch (e) {
    res.status(400).json({ error: 'Email er allerede i brug.' });
  }
});

app.delete('/api/barbers/:id', async (req, res) => {
  await pool.query("DELETE FROM users WHERE id=? AND role='barber'", [req.params.id]);
  res.json({ ok: true });
});

// ── BOOKINGS ──────────────────────────────────
app.get('/api/bookings', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT b.*, 
      c.name  AS customer_name,  c.email AS customer_email, c.phone AS customer_phone,
      br.name AS barber_name
    FROM bookings b
    LEFT JOIN users c  ON b.customer_id = c.id
    LEFT JOIN users br ON b.barber_id   = br.id
    ORDER BY b.date, b.time
  `);
  res.json(rows);
});

app.get('/api/bookings/customer/:id', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT b.*, br.name AS barber_name FROM bookings b
     LEFT JOIN users br ON b.barber_id=br.id
     WHERE b.customer_id=? ORDER BY b.date DESC, b.time DESC`,
    [req.params.id]
  );
  res.json(rows);
});

app.get('/api/bookings/barber/:id', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT b.*, c.name AS customer_name, c.phone AS customer_phone FROM bookings b
     LEFT JOIN users c ON b.customer_id=c.id
     WHERE b.barber_id=? ORDER BY b.date, b.time`,
    [req.params.id]
  );
  res.json(rows);
});

app.post('/api/bookings', async (req, res) => {
  const { customer_id, barber_id, service_name, date, time, price } = req.body;
  const [r] = await pool.query(
    'INSERT INTO bookings (customer_id,barber_id,service_name,date,time,price) VALUES (?,?,?,?,?,?)',
    [customer_id || null, barber_id || null, service_name, date, time, price]
  );
  res.json({ id: r.insertId, service_name, date, time, price, status: 'Bekræftet' });
});

app.put('/api/bookings/:id/cancel', async (req, res) => {
  await pool.query("UPDATE bookings SET status='Annulleret' WHERE id=?", [req.params.id]);
  res.json({ ok: true });
});

// ── TIMES ─────────────────────────────────────
app.get('/api/extra-times', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM extra_times');
  res.json(rows);
});

app.post('/api/extra-times', async (req, res) => {
  const { date, time } = req.body;
  const [r] = await pool.query('INSERT INTO extra_times (date,time) VALUES (?,?)', [date, time]);
  res.json({ id: r.insertId, date, time });
});

app.delete('/api/extra-times/:id', async (req, res) => {
  await pool.query('DELETE FROM extra_times WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/blocked-dates', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM blocked_dates');
  res.json(rows);
});

app.post('/api/blocked-dates', async (req, res) => {
  const { date } = req.body;
  try {
    await pool.query('INSERT INTO blocked_dates (date) VALUES (?)', [date]);
    res.json({ ok: true });
  } catch(e) {
    res.status(400).json({ error: 'Dato allerede blokeret.' });
  }
});

app.delete('/api/blocked-dates/:date', async (req, res) => {
  await pool.query('DELETE FROM blocked_dates WHERE date=?', [req.params.date]);
  res.json({ ok: true });
});

// ── CUSTOMERS ─────────────────────────────────
app.get('/api/customers', async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id,name,email,phone FROM users WHERE role='customer'"
  );
  res.json(rows);
});

app.delete('/api/customers/:id', async (req, res) => {
  await pool.query("DELETE FROM users WHERE id=? AND role='customer'", [req.params.id]);
  res.json({ ok: true });
});

app.listen(3000, () => console.log('Server kører på http://localhost:3000'));