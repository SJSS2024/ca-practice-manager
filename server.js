const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
// PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST || 'db.qkmeywbgxwjyiifsncvp.supabase.co',
  port: parseInt(process.env.DB_PORT || '6543'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Sjss@2025$%',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 5
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow CDN resources
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown'
});
app.use('/api', limiter);

// Trust proxy for Cloudflare tunnel
app.set('trust proxy', true);

// Create tables
const createTables = async () => {
  // Users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('Admin', 'CA', 'Article', 'Accountant')),
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Clients table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      pan TEXT,
      gstin TEXT,
      business_type TEXT,
      contact_person TEXT,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Services table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS services (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      base_price DECIMAL(10,2),
      category TEXT,
      gst_applicable BOOLEAN DEFAULT true,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Tasks table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      client_id INTEGER,
      service_id INTEGER,
      assigned_to INTEGER,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
      priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
      due_date DATE,
      completion_date TIMESTAMP,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (service_id) REFERENCES services(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    )
  `);

  // Recurring Rules table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS recurringrules (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      client_id INTEGER,
      service_id INTEGER,
      assigned_to INTEGER,
      frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
      day_of_month INTEGER,
      day_of_week INTEGER,
      start_date DATE,
      end_date DATE,
      active BOOLEAN DEFAULT true,
      last_generated TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (service_id) REFERENCES services(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    )
  `);

  // Reminders table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reminders (
      id SERIAL PRIMARY KEY,
      task_id INTEGER,
      client_id INTEGER,
      user_id INTEGER,
      type TEXT NOT NULL CHECK (type IN ('task_due', 'followup', 'compliance', 'custom')),
      message TEXT NOT NULL,
      reminder_date TIMESTAMP,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'dismissed')),
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Bills table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bills (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL,
      bill_number TEXT UNIQUE NOT NULL,
      bill_date DATE NOT NULL,
      due_date DATE,
      subtotal DECIMAL(10,2) NOT NULL,
      gst_rate DECIMAL(5,2) DEFAULT 18.00,
      gst_amount DECIMAL(10,2) NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )
  `);

  // Bill Items table (for line items in bills)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bill_items (
      id SERIAL PRIMARY KEY,
      bill_id INTEGER NOT NULL,
      service_id INTEGER,
      task_id INTEGER,
      description TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      rate DECIMAL(10,2) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (bill_id) REFERENCES bills(id),
      FOREIGN KEY (service_id) REFERENCES services(id),
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `);

  // Payments table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      bill_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      payment_date DATE NOT NULL,
      payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'cheque', 'bank_transfer', 'upi', 'card')),
      reference_number TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (bill_id) REFERENCES bills(id),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )
  `);

  // Followups table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS followups (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL,
      task_id INTEGER,
      bill_id INTEGER,
      type TEXT NOT NULL CHECK (type IN ('payment', 'document', 'compliance', 'general')),
      subject TEXT NOT NULL,
      description TEXT,
      priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
      due_date DATE,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
      assigned_to INTEGER,
      completion_date TIMESTAMP,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (bill_id) REFERENCES bills(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    )
  `);

  // Income table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS income (
      id SERIAL PRIMARY KEY,
      client_id INTEGER,
      bill_id INTEGER,
      payment_id INTEGER,
      service_id INTEGER,
      amount DECIMAL(10,2) NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      income_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (bill_id) REFERENCES bills(id),
      FOREIGN KEY (payment_id) REFERENCES payments(id),
      FOREIGN KEY (service_id) REFERENCES services(id)
    )
  `);

  // Expenses table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      amount DECIMAL(10,2) NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      expense_date DATE NOT NULL,
      receipt_number TEXT,
      vendor TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Document Templates table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documenttemplates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      service_type TEXT NOT NULL,
      registration_type TEXT,
      required_documents TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Activity Logs table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activitylogs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Dropdown Options table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dropdown_options (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      label TEXT NOT NULL,
      value TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Seed default dropdown options if empty
  const optResult = await pool.query('SELECT COUNT(*) as count FROM dropdown_options');
  const optCount = parseInt(optResult.rows[0].count);
  if (optCount === 0) {
    const defaults = [
      ['business_type', 'Individual', 'Individual', 1],
      ['business_type', 'Partnership Firm', 'Partnership', 2],
      ['business_type', 'Private Limited', 'Private Limited', 3],
      ['business_type', 'LLP', 'LLP', 4],
      ['business_type', 'Trust', 'Trust', 5],
      ['business_type', 'Sole Proprietorship', 'Sole Proprietorship', 6],
      ['business_type', 'HUF', 'HUF', 7],
      ['business_type', 'Society', 'Society', 8],
      ['service_category', 'Compliance', 'Compliance', 1],
      ['service_category', 'Taxation', 'Taxation', 2],
      ['service_category', 'Audit', 'Audit', 3],
      ['service_category', 'Accounts', 'Accounts', 4],
      ['service_category', 'HR', 'HR', 5],
      ['service_category', 'Registration', 'Registration', 6],
      ['service_category', 'Advisory', 'Advisory', 7],
      ['expense_category', 'Office Rent', 'Office Rent', 1],
      ['expense_category', 'Salary', 'Salary', 2],
      ['expense_category', 'Software', 'Software', 3],
      ['expense_category', 'Travel', 'Travel', 4],
      ['expense_category', 'Utilities', 'Utilities', 5],
      ['expense_category', 'Stationery', 'Stationery', 6],
      ['expense_category', 'Professional Fees', 'Professional Fees', 7],
      ['expense_category', 'Internet & Phone', 'Internet & Phone', 8],
      ['expense_category', 'Other', 'Other', 99],
      ['income_category', 'Service Fee', 'Service Fee', 1],
      ['income_category', 'Consultation', 'Consultation', 2],
      ['income_category', 'Filing Fee', 'Filing Fee', 3],
      ['income_category', 'Audit Fee', 'Audit Fee', 4],
      ['income_category', 'Other', 'Other', 99],
      ['payment_method', 'Cash', 'cash', 1],
      ['payment_method', 'Cheque', 'cheque', 2],
      ['payment_method', 'Bank Transfer', 'bank_transfer', 3],
      ['payment_method', 'UPI', 'upi', 4],
      ['payment_method', 'Card', 'card', 5],
      ['task_priority', 'Low', 'low', 1],
      ['task_priority', 'Medium', 'medium', 2],
      ['task_priority', 'High', 'high', 3],
      ['task_priority', 'Urgent', 'urgent', 4],
      ['followup_type', 'Payment', 'payment', 1],
      ['followup_type', 'Document', 'document', 2],
      ['followup_type', 'Compliance', 'compliance', 3],
      ['followup_type', 'General', 'general', 4],
      ['document_service_type', 'GST', 'GST', 1],
      ['document_service_type', 'Income Tax', 'Income Tax', 2],
      ['document_service_type', 'TDS', 'TDS', 3],
      ['document_service_type', 'ROC', 'ROC', 4],
      ['document_service_type', 'Audit', 'Audit', 5],
      ['document_service_type', 'Company Registration', 'Company Registration', 6],
      ['document_service_type', 'Other', 'Other', 99],
      ['gst_rate', '0%', '0', 1],
      ['gst_rate', '5%', '5', 2],
      ['gst_rate', '12%', '12', 3],
      ['gst_rate', '18%', '18', 4],
      ['gst_rate', '28%', '28', 5],
    ];
    
    for (const d of defaults) {
      await pool.query(
        'INSERT INTO dropdown_options (category, label, value, sort_order) VALUES ($1, $2, $3, $4)',
        [d[0], d[1], d[2], d[3]]
      );
    }
  }

  console.log('Database tables created successfully');
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Role-based access control
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Activity logging helper
const logActivity = async (userId, action, entityType, entityId, details = null) => {
  try {
    await pool.query(`
      INSERT INTO activitylogs (user_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5)
    `, [userId, action, entityType, entityId, details]);
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

// AUTH ROUTES
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND active = true', [email]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logActivity(user.id, 'LOGIN', 'user', user.id);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [req.user.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// USERS ROUTES
app.get('/api/users', authenticateToken, requireRole(['Admin']), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, active, created_at FROM users ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', authenticateToken, requireRole(['Admin']), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(`
      INSERT INTO users (name, email, password, role)
      VALUES ($1, $2, $3, $4) RETURNING id
    `, [name, email, hashedPassword, role]);
    
    await logActivity(req.user.id, 'CREATE', 'user', result.rows[0].id);
    
    res.status(201).json({ id: result.rows[0].id, message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id', authenticateToken, requireRole(['Admin']), async (req, res) => {
  try {
    const { name, email, role, active } = req.body;
    
    await pool.query(`
      UPDATE users SET name = $1, email = $2, role = $3, active = $4, updated_at = NOW()
      WHERE id = $5
    `, [name, email, role, active, req.params.id]);
    
    await logActivity(req.user.id, 'UPDATE', 'user', req.params.id);
    
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CLIENTS ROUTES
app.get('/api/clients', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clients WHERE active = true ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clients', authenticateToken, async (req, res) => {
  try {
    const { name, email, phone, address, pan, gstin, business_type, contact_person } = req.body;
    
    const result = await pool.query(`
      INSERT INTO clients (name, email, phone, address, pan, gstin, business_type, contact_person)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
    `, [name, email, phone, address, pan, gstin, business_type, contact_person]);
    
    await logActivity(req.user.id, 'CREATE', 'client', result.rows[0].id);
    
    res.status(201).json({ id: result.rows[0].id, message: 'Client created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const { name, email, phone, address, pan, gstin, business_type, contact_person } = req.body;
    
    await pool.query(`
      UPDATE clients SET name = $1, email = $2, phone = $3, address = $4, pan = $5, gstin = $6, 
      business_type = $7, contact_person = $8, updated_at = NOW()
      WHERE id = $9
    `, [name, email, phone, address, pan, gstin, business_type, contact_person, req.params.id]);
    
    await logActivity(req.user.id, 'UPDATE', 'client', req.params.id);
    
    res.json({ message: 'Client updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/clients/:id', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    await pool.query('UPDATE clients SET active = false WHERE id = $1', [req.params.id]);
    await logActivity(req.user.id, 'DELETE', 'client', req.params.id);
    
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SERVICES ROUTES
app.get('/api/services', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM services WHERE active = true ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/services', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    const { name, description, base_price, category, gst_applicable } = req.body;
    
    const result = await pool.query(`
      INSERT INTO services (name, description, base_price, category, gst_applicable)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [name, description, base_price, category, gst_applicable]);
    
    await logActivity(req.user.id, 'CREATE', 'service', result.rows[0].id);
    
    res.status(201).json({ id: result.rows[0].id, message: 'Service created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/services/:id', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    const { name, description, base_price, category, gst_applicable } = req.body;
    
    await pool.query(`
      UPDATE services SET name = $1, description = $2, base_price = $3, category = $4, gst_applicable = $5
      WHERE id = $6
    `, [name, description, base_price, category, gst_applicable, req.params.id]);
    
    await logActivity(req.user.id, 'UPDATE', 'service', req.params.id);
    
    res.json({ message: 'Service updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/services/:id', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    await pool.query('UPDATE services SET active = false WHERE id = $1', [req.params.id]);
    await logActivity(req.user.id, 'DELETE', 'service', req.params.id);
    res.json({ message: 'Service deleted successfully' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// TASKS ROUTES
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const { client, staff, service, status } = req.query;
    let query = `
      SELECT t.*, c.name as client_name, s.name as service_name, u.name as assigned_name
      FROM tasks t
      LEFT JOIN clients c ON t.client_id = c.id
      LEFT JOIN services s ON t.service_id = s.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (client) {
      query += ` AND t.client_id = $${paramIndex}`;
      params.push(client);
      paramIndex++;
    }
    if (staff) {
      query += ` AND t.assigned_to = $${paramIndex}`;
      params.push(staff);
      paramIndex++;
    }
    if (service) {
      query += ` AND t.service_id = $${paramIndex}`;
      params.push(service);
      paramIndex++;
    }
    if (status) {
      query += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ' ORDER BY t.due_date ASC, t.priority DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const { title, description, client_id, service_id, assigned_to, priority, due_date, notes } = req.body;
    
    const result = await pool.query(`
      INSERT INTO tasks (title, description, client_id, service_id, assigned_to, priority, due_date, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
    `, [title, description, client_id, service_id, assigned_to, priority, due_date, notes]);
    
    await logActivity(req.user.id, 'CREATE', 'task', result.rows[0].id);
    
    res.status(201).json({ id: result.rows[0].id, message: 'Task created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, client_id, service_id, assigned_to, status, priority, due_date, notes } = req.body;
    
    let completionDate = null;
    if (status === 'completed') {
      completionDate = new Date();
    }
    
    await pool.query(`
      UPDATE tasks SET title = $1, description = $2, client_id = $3, service_id = $4, 
      assigned_to = $5, status = $6, priority = $7, due_date = $8, notes = $9, 
      completion_date = $10, updated_at = NOW()
      WHERE id = $11
    `, [title, description, client_id, service_id, assigned_to, status, priority, due_date, notes, completionDate, req.params.id]);
    
    await logActivity(req.user.id, 'UPDATE', 'task', req.params.id);
    
    res.json({ message: 'Task updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    await logActivity(req.user.id, 'DELETE', 'task', req.params.id);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// RECURRING RULES ROUTES
app.get('/api/recurring-rules', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, c.name as client_name, s.name as service_name, u.name as assigned_name
      FROM recurringrules r
      LEFT JOIN clients c ON r.client_id = c.id
      LEFT JOIN services s ON r.service_id = s.id
      LEFT JOIN users u ON r.assigned_to = u.id
      WHERE r.active = true
      ORDER BY r.name
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/recurring-rules', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    const { name, client_id, service_id, assigned_to, frequency, day_of_month, day_of_week, start_date, end_date } = req.body;
    
    const result = await pool.query(`
      INSERT INTO recurringrules (name, client_id, service_id, assigned_to, frequency, day_of_month, day_of_week, start_date, end_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
    `, [name, client_id, service_id, assigned_to, frequency, day_of_month, day_of_week, start_date, end_date]);
    
    await logActivity(req.user.id, 'CREATE', 'recurring_rule', result.rows[0].id);
    
    res.status(201).json({ id: result.rows[0].id, message: 'Recurring rule created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/recurring-rules/:id', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    const { name, client_id, service_id, assigned_to, frequency, day_of_month, day_of_week, start_date, end_date, active } = req.body;
    await pool.query(
      'UPDATE recurringrules SET name=$1, client_id=$2, service_id=$3, assigned_to=$4, frequency=$5, day_of_month=$6, day_of_week=$7, start_date=$8, end_date=$9, active=$10 WHERE id=$11',
      [name, client_id, service_id, assigned_to, frequency, day_of_month, day_of_week, start_date, end_date, active, req.params.id]
    );
    await logActivity(req.user.id, 'UPDATE', 'recurring_rule', req.params.id);
    res.json({ message: 'Recurring rule updated' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/recurring-rules/:id', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    await pool.query('DELETE FROM recurringrules WHERE id = $1', [req.params.id]);
    await logActivity(req.user.id, 'DELETE', 'recurring_rule', req.params.id);
    res.json({ message: 'Recurring rule deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// BILLS ROUTES
app.get('/api/bills', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, c.name as client_name
      FROM bills b
      LEFT JOIN clients c ON b.client_id = c.id
      ORDER BY b.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bills/:id', authenticateToken, async (req, res) => {
  try {
    const billResult = await pool.query(`
      SELECT b.*, c.name as client_name, c.address, c.gstin
      FROM bills b
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.id = $1
    `, [req.params.id]);
    
    if (billResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const itemsResult = await pool.query(`
      SELECT bi.*, s.name as service_name
      FROM bill_items bi
      LEFT JOIN services s ON bi.service_id = s.id
      WHERE bi.bill_id = $1
    `, [req.params.id]);

    const bill = billResult.rows[0];
    bill.items = itemsResult.rows;
    res.json(bill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bills', authenticateToken, async (req, res) => {
  try {
    const { client_id, items, notes, due_date } = req.body;
    
    // Generate bill number
    const billCountResult = await pool.query('SELECT COUNT(*) as count FROM bills');
    const billCount = parseInt(billCountResult.rows[0].count);
    const billNumber = `INV-${new Date().getFullYear()}-${String(billCount + 1).padStart(4, '0')}`;
    
    // Calculate totals
    let subtotal = 0;
    items.forEach(item => {
      subtotal += parseFloat(item.amount);
    });
    
    const gstRate = 18.00;
    const gstAmount = (subtotal * gstRate) / 100;
    const totalAmount = subtotal + gstAmount;
    
    const billResult = await pool.query(`
      INSERT INTO bills (client_id, bill_number, bill_date, due_date, subtotal, gst_rate, gst_amount, total_amount, notes)
      VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8) RETURNING id
    `, [client_id, billNumber, due_date, subtotal, gstRate, gstAmount, totalAmount, notes]);
    
    const billId = billResult.rows[0].id;
    
    // Insert bill items
    for (const item of items) {
      await pool.query(`
        INSERT INTO bill_items (bill_id, service_id, task_id, description, quantity, rate, amount)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [billId, item.service_id, item.task_id, item.description, item.quantity, item.rate, item.amount]);
    }
    
    await logActivity(req.user.id, 'CREATE', 'bill', billId);
    
    res.status(201).json({ id: billId, bill_number: billNumber, message: 'Bill created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/bills/:id', authenticateToken, async (req, res) => {
  try {
    const { status, notes } = req.body;
    await pool.query('UPDATE bills SET status=$1, notes=$2, updated_at=NOW() WHERE id=$3', [status, notes, req.params.id]);
    await logActivity(req.user.id, 'UPDATE', 'bill', req.params.id);
    res.json({ message: 'Bill updated' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/bills/:id', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    await pool.query('DELETE FROM bill_items WHERE bill_id = $1', [req.params.id]);
    await pool.query('DELETE FROM bills WHERE id = $1', [req.params.id]);
    await logActivity(req.user.id, 'DELETE', 'bill', req.params.id);
    res.json({ message: 'Bill deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// PAYMENTS ROUTES
app.get('/api/payments', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.name as client_name, b.bill_number
      FROM payments p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN bills b ON p.bill_id = b.id
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payments', authenticateToken, async (req, res) => {
  try {
    const { bill_id, client_id, amount, payment_date, payment_method, reference_number, notes } = req.body;
    
    // Insert payment
    const paymentResult = await pool.query(`
      INSERT INTO payments (bill_id, client_id, amount, payment_date, payment_method, reference_number, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [bill_id, client_id, amount, payment_date, payment_method, reference_number, notes]);
    
    // Check if bill is fully paid
    const billResult = await pool.query('SELECT total_amount FROM bills WHERE id = $1', [bill_id]);
    const totalPaidResult = await pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE bill_id = $1', [bill_id]);
    
    const bill = billResult.rows[0];
    const totalPaid = parseFloat(totalPaidResult.rows[0].total);
    
    if (totalPaid >= parseFloat(bill.total_amount)) {
      // Update bill status to paid
      await pool.query('UPDATE bills SET status = $1 WHERE id = $2', ['paid', bill_id]);
    }
    
    // Create income record
    await pool.query(`
      INSERT INTO income (client_id, bill_id, payment_id, amount, description, category, income_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [client_id, bill_id, paymentResult.rows[0].id, amount, 'Payment received', 'Service Income', payment_date]);
    
    await logActivity(req.user.id, 'CREATE', 'payment', paymentResult.rows[0].id);
    
    res.status(201).json({ id: paymentResult.rows[0].id, message: 'Payment recorded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/payments/:id', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    await pool.query('DELETE FROM payments WHERE id = $1', [req.params.id]);
    await logActivity(req.user.id, 'DELETE', 'payment', req.params.id);
    res.json({ message: 'Payment deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// FOLLOWUPS ROUTES
app.get('/api/followups', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT f.*, c.name as client_name, u.name as assigned_name
      FROM followups f
      LEFT JOIN clients c ON f.client_id = c.id
      LEFT JOIN users u ON f.assigned_to = u.id
      ORDER BY f.due_date ASC, f.priority DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/followups', authenticateToken, async (req, res) => {
  try {
    const { client_id, task_id, bill_id, type, subject, description, priority, due_date, assigned_to } = req.body;
    
    const result = await pool.query(`
      INSERT INTO followups (client_id, task_id, bill_id, type, subject, description, priority, due_date, assigned_to)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
    `, [client_id, task_id, bill_id, type, subject, description, priority, due_date, assigned_to]);
    
    await logActivity(req.user.id, 'CREATE', 'followup', result.rows[0].id);
    
    res.status(201).json({ id: result.rows[0].id, message: 'Followup created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/followups/:id', authenticateToken, async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    let completionDate = null;
    if (status === 'completed') {
      completionDate = new Date();
    }
    
    await pool.query(`
      UPDATE followups SET status = $1, notes = $2, completion_date = $3, updated_at = NOW()
      WHERE id = $4
    `, [status, notes, completionDate, req.params.id]);
    
    await logActivity(req.user.id, 'UPDATE', 'followup', req.params.id);
    
    res.json({ message: 'Followup updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/followups/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM followups WHERE id = $1', [req.params.id]);
    await logActivity(req.user.id, 'DELETE', 'followup', req.params.id);
    res.json({ message: 'Followup deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// INCOME ROUTES
app.get('/api/income', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.*, c.name as client_name, s.name as service_name
      FROM income i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN services s ON i.service_id = s.id
      ORDER BY i.income_date DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/income', authenticateToken, async (req, res) => {
  try {
    const { client_id, service_id, amount, description, category, income_date } = req.body;
    
    const result = await pool.query(`
      INSERT INTO income (client_id, service_id, amount, description, category, income_date)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `, [client_id, service_id, amount, description, category, income_date]);
    
    await logActivity(req.user.id, 'CREATE', 'income', result.rows[0].id);
    
    res.status(201).json({ id: result.rows[0].id, message: 'Income record created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/income/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM income WHERE id = $1', [req.params.id]);
    await logActivity(req.user.id, 'DELETE', 'income', req.params.id);
    res.json({ message: 'Income deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// EXPENSES ROUTES
app.get('/api/expenses', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM expenses ORDER BY expense_date DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/expenses', authenticateToken, async (req, res) => {
  try {
    const { amount, description, category, expense_date, receipt_number, vendor, notes } = req.body;
    
    const result = await pool.query(`
      INSERT INTO expenses (amount, description, category, expense_date, receipt_number, vendor, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [amount, description, category, expense_date, receipt_number, vendor, notes]);
    
    await logActivity(req.user.id, 'CREATE', 'expense', result.rows[0].id);
    
    res.status(201).json({ id: result.rows[0].id, message: 'Expense record created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/expenses/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
    await logActivity(req.user.id, 'DELETE', 'expense', req.params.id);
    res.json({ message: 'Expense deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// DOCUMENT TEMPLATES ROUTES
app.get('/api/document-templates', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM documenttemplates ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/document-templates', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    const { name, service_type, registration_type, required_documents, description } = req.body;
    
    const result = await pool.query(`
      INSERT INTO documenttemplates (name, service_type, registration_type, required_documents, description)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [name, service_type, registration_type, required_documents, description]);
    
    await logActivity(req.user.id, 'CREATE', 'document_template', result.rows[0].id);
    
    res.status(201).json({ id: result.rows[0].id, message: 'Document template created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/document-templates/:id', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    await pool.query('DELETE FROM documenttemplates WHERE id = $1', [req.params.id]);
    await logActivity(req.user.id, 'DELETE', 'document_template', req.params.id);
    res.json({ message: 'Template deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/users/:id', authenticateToken, requireRole(['Admin']), async (req, res) => {
  try {
    await pool.query('UPDATE users SET active = false WHERE id = $1', [req.params.id]);
    await logActivity(req.user.id, 'DELETE', 'user', req.params.id);
    res.json({ message: 'User deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// DROPDOWN OPTIONS ROUTES
app.get('/api/dropdown-options', authenticateToken, async (req, res) => {
  try {
    const { category } = req.query;
    if (category) {
      const result = await pool.query('SELECT * FROM dropdown_options WHERE category = $1 AND active = true ORDER BY sort_order, label', [category]);
      return res.json(result.rows);
    }
    const result = await pool.query('SELECT * FROM dropdown_options WHERE active = true ORDER BY category, sort_order, label');
    // Group by category
    const grouped = {};
    result.rows.forEach(o => {
      if (!grouped[o.category]) grouped[o.category] = [];
      grouped[o.category].push(o);
    });
    res.json(grouped);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/dropdown-options', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    const { category, label, value, sort_order } = req.body;
    if (!category || !label) return res.status(400).json({ error: 'Category and label required' });
    const result = await pool.query('INSERT INTO dropdown_options (category, label, value, sort_order) VALUES ($1, $2, $3, $4) RETURNING id', [category, label, value || label, sort_order || 0]);
    await logActivity(req.user.id, 'CREATE', 'dropdown_option', result.rows[0].id);
    res.status(201).json({ id: result.rows[0].id, message: 'Option added' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/dropdown-options/:id', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    const { label, value, sort_order, active } = req.body;
    await pool.query('UPDATE dropdown_options SET label=$1, value=$2, sort_order=$3, active=$4 WHERE id=$5', [label, value || label, sort_order || 0, active !== undefined ? active : true, req.params.id]);
    await logActivity(req.user.id, 'UPDATE', 'dropdown_option', req.params.id);
    res.json({ message: 'Option updated' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/dropdown-options/:id', authenticateToken, requireRole(['Admin']), async (req, res) => {
  try {
    await pool.query('DELETE FROM dropdown_options WHERE id = $1', [req.params.id]);
    await logActivity(req.user.id, 'DELETE', 'dropdown_option', req.params.id);
    res.json({ message: 'Option deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// DASHBOARD ROUTES
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const stats = {};
    
    const clientsResult = await pool.query('SELECT COUNT(*) as count FROM clients WHERE active = true');
    stats.totalClients = parseInt(clientsResult.rows[0].count);
    
    const todayTasksResult = await pool.query("SELECT COUNT(*) as count FROM tasks WHERE DATE(due_date) = CURRENT_DATE AND status != 'completed'");
    stats.todayTasks = parseInt(todayTasksResult.rows[0].count);
    
    const overdueTasksResult = await pool.query("SELECT COUNT(*) as count FROM tasks WHERE due_date < CURRENT_DATE AND status != 'completed'");
    stats.overdueTasks = parseInt(overdueTasksResult.rows[0].count);
    
    const pendingBillsResult = await pool.query("SELECT COUNT(*) as count FROM bills WHERE status = 'pending'");
    stats.pendingBills = parseInt(pendingBillsResult.rows[0].count);
    
    const monthlyIncomeResult = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE DATE(income_date) >= DATE_TRUNC('month', CURRENT_DATE)");
    stats.monthlyIncome = parseFloat(monthlyIncomeResult.rows[0].total);
    
    const monthlyExpensesResult = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE DATE(expense_date) >= DATE_TRUNC('month', CURRENT_DATE)");
    stats.monthlyExpenses = parseFloat(monthlyExpensesResult.rows[0].total);

    stats.netProfit = stats.monthlyIncome - stats.monthlyExpenses;

    // Recent activities
    const recentActivitiesResult = await pool.query(`
      SELECT a.*, u.name as user_name 
      FROM activitylogs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC 
      LIMIT 10
    `);

    // Task status distribution
    const taskStatsResult = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM tasks
      GROUP BY status
    `);

    // Monthly income trend (last 6 months)
    const incomeChartResult = await pool.query(`
      SELECT TO_CHAR(income_date, 'YYYY-MM') as month, SUM(amount) as total
      FROM income
      WHERE income_date >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY TO_CHAR(income_date, 'YYYY-MM')
      ORDER BY month
    `);

    res.json({
      stats,
      recentActivities: recentActivitiesResult.rows,
      taskStats: taskStatsResult.rows,
      incomeChart: incomeChartResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ACTIVITY LOGS ROUTES
app.get('/api/activity-logs', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, u.name as user_name
      FROM activitylogs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// REPORTS ROUTES
app.get('/api/reports/productivity', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const result = await pool.query(`
      SELECT 
        u.name as staff_name,
        COUNT(*) as total_tasks,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN t.due_date < CURRENT_DATE AND t.status != 'completed' THEN 1 ELSE 0 END) as overdue_tasks
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE DATE(t.created_at) BETWEEN $1 AND $2
      GROUP BY t.assigned_to, u.name
      ORDER BY completed_tasks DESC
    `, [startDate || '2024-01-01', endDate || '2024-12-31']);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/revenue', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const result = await pool.query(`
      SELECT 
        c.name as client_name,
        COUNT(DISTINCT b.id) as total_bills,
        SUM(b.total_amount) as total_billed,
        SUM(p.amount) as total_paid,
        SUM(b.total_amount) - COALESCE(SUM(p.amount), 0) as outstanding
      FROM bills b
      LEFT JOIN clients c ON b.client_id = c.id
      LEFT JOIN payments p ON b.id = p.bill_id
      WHERE DATE(b.bill_date) BETWEEN $1 AND $2
      GROUP BY b.client_id, c.name
      ORDER BY total_billed DESC
    `, [startDate || '2024-01-01', endDate || '2024-12-31']);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seed data function
const seedData = async () => {
  try {
    // Check if data already exists
    const userCountResult = await pool.query('SELECT COUNT(*) as count FROM users');
    const userCount = parseInt(userCountResult.rows[0].count);
    if (userCount > 0) {
      console.log('Data already seeded');
      return;
    }

    console.log('Seeding database...');

    // Create default admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await pool.query(`
      INSERT INTO users (name, email, password, role)
      VALUES ($1, $2, $3, $4)
    `, ['Admin User', 'admin@ca.com', hashedPassword, 'Admin']);

    // Create sample staff
    const staffPassword = await bcrypt.hash('password123', 10);
    const staff = [
      { name: 'Rajesh Kumar', email: 'rajesh@ca.com', role: 'CA' },
      { name: 'Priya Sharma', email: 'priya@ca.com', role: 'Accountant' },
      { name: 'Amit Singh', email: 'amit@ca.com', role: 'Article' }
    ];

    for (const s of staff) {
      await pool.query(`
        INSERT INTO users (name, email, password, role)
        VALUES ($1, $2, $3, $4)
      `, [s.name, s.email, staffPassword, s.role]);
    }

    // Create sample clients
    const clients = [
      { name: 'ABC Pvt Ltd', email: 'info@abc.com', phone: '9876543210', business_type: 'Private Limited', pan: 'ABCPY1234F', gstin: '29ABCPY1234F1Z5' },
      { name: 'XYZ Enterprises', email: 'contact@xyz.com', phone: '9876543211', business_type: 'Partnership', pan: 'XYZPQ5678G', gstin: '29XYZPQ5678G1Z1' },
      { name: 'LMN Industries', email: 'admin@lmn.com', phone: '9876543212', business_type: 'LLP', pan: 'LMNRS9012H', gstin: '29LMNRS9012H1Z2' },
      { name: 'PQR Services', email: 'info@pqr.com', phone: '9876543213', business_type: 'Sole Proprietorship', pan: 'PQRTU3456I', gstin: '29PQRTU3456I1Z3' },
      { name: 'DEF Solutions', email: 'hello@def.com', phone: '9876543214', business_type: 'Private Limited', pan: 'DEFVW7890J', gstin: '29DEFVW7890J1Z4' }
    ];

    for (const c of clients) {
      await pool.query(`
        INSERT INTO clients (name, email, phone, business_type, pan, gstin)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [c.name, c.email, c.phone, c.business_type, c.pan, c.gstin]);
    }

    // Create services
    const services = [
      { name: 'GST Return Filing', description: 'Monthly GST return filing', base_price: 2500.00, category: 'Compliance' },
      { name: 'TDS Return Filing', description: 'Quarterly TDS return filing', base_price: 1500.00, category: 'Compliance' },
      { name: 'Income Tax Filing', description: 'Annual income tax return filing', base_price: 5000.00, category: 'Taxation' },
      { name: 'Audit Services', description: 'Statutory audit services', base_price: 25000.00, category: 'Audit' },
      { name: 'ROC Filing', description: 'ROC compliance filing', base_price: 3000.00, category: 'Compliance' },
      { name: 'Bookkeeping', description: 'Monthly bookkeeping services', base_price: 8000.00, category: 'Accounts' },
      { name: 'Payroll Processing', description: 'Employee payroll processing', base_price: 150.00, category: 'HR' },
      { name: 'Company Registration', description: 'New company registration', base_price: 15000.00, category: 'Registration' },
      { name: 'Tax Advisory', description: 'Tax planning and advisory', base_price: 10000.00, category: 'Advisory' },
      { name: 'Financial Statements', description: 'Preparation of financial statements', base_price: 12000.00, category: 'Accounts' }
    ];

    for (const s of services) {
      await pool.query(`
        INSERT INTO services (name, description, base_price, category)
        VALUES ($1, $2, $3, $4)
      `, [s.name, s.description, s.base_price, s.category]);
    }

    // Create sample tasks
    const tasks = [
      { title: 'GST Return - ABC Pvt Ltd', client_id: 1, service_id: 1, assigned_to: 2, priority: 'high', due_date: '2024-02-15' },
      { title: 'Income Tax Filing - XYZ Enterprises', client_id: 2, service_id: 3, assigned_to: 2, priority: 'medium', due_date: '2024-03-31' },
      { title: 'TDS Return - LMN Industries', client_id: 3, service_id: 2, assigned_to: 3, priority: 'high', due_date: '2024-01-31' },
      { title: 'Audit - PQR Services', client_id: 4, service_id: 4, assigned_to: 2, priority: 'urgent', due_date: '2024-04-30' },
      { title: 'ROC Filing - DEF Solutions', client_id: 5, service_id: 5, assigned_to: 4, priority: 'medium', due_date: '2024-03-15' }
    ];

    for (const t of tasks) {
      await pool.query(`
        INSERT INTO tasks (title, client_id, service_id, assigned_to, priority, due_date)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [t.title, t.client_id, t.service_id, t.assigned_to, t.priority, t.due_date]);
    }

    // Create recurring rules
    const recurringRules = [
      { name: 'Monthly GST Returns', client_id: 1, service_id: 1, assigned_to: 2, frequency: 'monthly', day_of_month: 20, start_date: '2024-01-01' },
      { name: 'Quarterly TDS Returns - All Clients', service_id: 2, assigned_to: 3, frequency: 'quarterly', day_of_month: 30, start_date: '2024-01-01' }
    ];

    for (const r of recurringRules) {
      await pool.query(`
        INSERT INTO recurringrules (name, client_id, service_id, assigned_to, frequency, day_of_month, start_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [r.name, r.client_id, r.service_id, r.assigned_to, r.frequency, r.day_of_month, r.start_date]);
    }

    // Create document templates
    const docTemplates = [
      { 
        name: 'GST Registration Documents', 
        service_type: 'GST Registration', 
        required_documents: JSON.stringify([
          'PAN Card', 'Aadhaar Card', 'Business Registration Certificate', 
          'Address Proof', 'Bank Statement', 'Digital Signature'
        ])
      },
      { 
        name: 'Company Registration Documents', 
        service_type: 'Company Registration', 
        required_documents: JSON.stringify([
          'DIN Application', 'DSC', 'MOA & AOA', 'Registered Office Proof', 
          'Directors Address Proof', 'Directors ID Proof', 'No Objection Certificate'
        ])
      }
    ];

    for (const d of docTemplates) {
      await pool.query(`
        INSERT INTO documenttemplates (name, service_type, required_documents)
        VALUES ($1, $2, $3)
      `, [d.name, d.service_type, d.required_documents]);
    }

    console.log('Database seeded successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
};

// Automation functions
const createTasksFromRecurringRules = async () => {
  try {
    const result = await pool.query(`
      SELECT * FROM recurringrules 
      WHERE active = true AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    `);
    const activeRules = result.rows;

    let tasksCreated = 0;

    for (const rule of activeRules) {
      const today = new Date();
      const lastGenerated = rule.last_generated ? new Date(rule.last_generated) : new Date('2000-01-01');
      
      let shouldGenerate = false;
      let dueDate = new Date(today);

      switch (rule.frequency) {
        case 'daily':
          if (today.toDateString() !== lastGenerated.toDateString()) {
            shouldGenerate = true;
            dueDate.setDate(today.getDate() + 1);
          }
          break;
        case 'weekly':
          const daysDiff = Math.floor((today - lastGenerated) / (24 * 60 * 60 * 1000));
          if (daysDiff >= 7) {
            shouldGenerate = true;
            dueDate.setDate(today.getDate() + 7);
          }
          break;
        case 'monthly':
          if (rule.day_of_month && today.getDate() >= rule.day_of_month && 
              (today.getMonth() !== lastGenerated.getMonth() || today.getFullYear() !== lastGenerated.getFullYear())) {
            shouldGenerate = true;
            dueDate = new Date(today.getFullYear(), today.getMonth() + 1, rule.day_of_month);
          }
          break;
        case 'quarterly':
          const monthsDiff = (today.getFullYear() - lastGenerated.getFullYear()) * 12 + 
                           (today.getMonth() - lastGenerated.getMonth());
          if (monthsDiff >= 3) {
            shouldGenerate = true;
            dueDate = new Date(today.getFullYear(), today.getMonth() + 3, rule.day_of_month || 30);
          }
          break;
        case 'yearly':
          if (today.getFullYear() > lastGenerated.getFullYear()) {
            shouldGenerate = true;
            dueDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
          }
          break;
      }

      if (shouldGenerate) {
        // Create task
        await pool.query(`
          INSERT INTO tasks (title, client_id, service_id, assigned_to, due_date, notes)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          rule.name,
          rule.client_id,
          rule.service_id,
          rule.assigned_to,
          dueDate.toISOString().split('T')[0],
          `Auto-generated from recurring rule: ${rule.name}`
        ]);

        // Update last generated date
        await pool.query(`
          UPDATE recurringrules SET last_generated = NOW() WHERE id = $1
        `, [rule.id]);

        tasksCreated++;
      }
    }

    if (tasksCreated > 0) {
      console.log(`Created ${tasksCreated} tasks from recurring rules`);
    }
  } catch (error) {
    console.error('Error creating tasks from recurring rules:', error);
  }
};

const markOverdueTasks = async () => {
  try {
    const result = await pool.query(`
      UPDATE tasks 
      SET status = 'overdue' 
      WHERE due_date < CURRENT_DATE AND status IN ('pending', 'in_progress')
    `);
    
    if (result.rowCount > 0) {
      console.log(`Marked ${result.rowCount} tasks as overdue`);
    }
  } catch (error) {
    console.error('Error marking overdue tasks:', error);
  }
};

const triggerReminders = async () => {
  try {
    // Create reminders for tasks due tomorrow
    const result = await pool.query(`
      INSERT INTO reminders (task_id, client_id, user_id, type, message, reminder_date)
      SELECT t.id, t.client_id, t.assigned_to, 'task_due', 
             'Task "' || t.title || '" is due tomorrow', 
             NOW()
      FROM tasks t
      WHERE DATE(t.due_date) = CURRENT_DATE + INTERVAL '1 day'
      AND t.status NOT IN ('completed', 'cancelled')
      AND NOT EXISTS (
        SELECT 1 FROM reminders r 
        WHERE r.task_id = t.id AND r.type = 'task_due' 
        AND DATE(r.reminder_date) = CURRENT_DATE
      )
    `);
    
    if (result.rowCount > 0) {
      console.log(`Created ${result.rowCount} task due reminders`);
    }
  } catch (error) {
    console.error('Error triggering reminders:', error);
  }
};

// Serve the main page
app.get('/healthz', (req, res) => res.status(200).send('OK'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database and start server
async function startServer() {
  try {
    await createTables();
    await seedData();
    
    app.listen(PORT, '0.0.0.0', async () => {
      console.log(`CA Practice Management System running on port ${PORT}`);
      try {
        await createTasksFromRecurringRules();
        await markOverdueTasks();
        await triggerReminders();
      } catch (e) {
        console.error('Automation error (non-fatal):', e.message);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Schedule daily automation
cron.schedule('0 6 * * *', () => {
  console.log('Running daily automation...');
  createTasksFromRecurringRules();
  markOverdueTasks();
  triggerReminders();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing database connection...');
  try { 
    await pool.end(); 
  } catch(e) {
    console.error('Error closing pool:', e);
  }
  process.exit(0);
});