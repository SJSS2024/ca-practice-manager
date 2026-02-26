const express = require('express');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const DB_PATH = path.join(__dirname, 'ca_practice.db');

// sql.js wrapper to mimic better-sqlite3 API
let rawDb;
function sanitizeParams(params) {
  return params.map(p => p === undefined ? null : p);
}

function saveToDisk() {
  try {
    const data = rawDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch(e) { console.error('DB save error:', e); }
}

function rowFromStmt(stmt) {
  const cols = stmt.getColumnNames();
  const vals = stmt.get();
  const row = {};
  cols.forEach((c, i) => row[c] = vals[i]);
  return row;
}

const db = {
  exec(sql) { rawDb.run(sql); },
  prepare(sql) {
    return {
      get(...params) {
        const stmt = rawDb.prepare(sql);
        try {
          stmt.bind(sanitizeParams(params));
          if (stmt.step()) {
            return rowFromStmt(stmt);
          }
          return undefined;
        } finally { stmt.free(); }
      },
      all(...params) {
        const results = [];
        const stmt = rawDb.prepare(sql);
        try {
          stmt.bind(sanitizeParams(params));
          while (stmt.step()) {
            results.push(rowFromStmt(stmt));
          }
          return results;
        } finally { stmt.free(); }
      },
      run(...params) {
        rawDb.run(sql, sanitizeParams(params));
        const lastId = rawDb.exec("SELECT last_insert_rowid() as id")[0]?.values[0][0] || 0;
        const changes = rawDb.getRowsModified();
        saveToDisk();
        return { lastInsertRowid: lastId, changes };
      }
    };
  },
  close() {
    const data = rawDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    rawDb.close();
  }
};

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
const createTables = () => {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('Admin', 'CA', 'Article', 'Accountant')),
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Clients table
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      pan TEXT,
      gstin TEXT,
      business_type TEXT,
      contact_person TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Services table
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      base_price DECIMAL(10,2),
      category TEXT,
      gst_applicable INTEGER DEFAULT 1,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      client_id INTEGER,
      service_id INTEGER,
      assigned_to INTEGER,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
      priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
      due_date DATE,
      completion_date DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (service_id) REFERENCES services(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    )
  `);

  // Recurring Rules table
  db.exec(`
    CREATE TABLE IF NOT EXISTS recurringRules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      client_id INTEGER,
      service_id INTEGER,
      assigned_to INTEGER,
      frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
      day_of_month INTEGER,
      day_of_week INTEGER,
      start_date DATE,
      end_date DATE,
      active INTEGER DEFAULT 1,
      last_generated DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (service_id) REFERENCES services(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    )
  `);

  // Reminders table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      client_id INTEGER,
      user_id INTEGER,
      type TEXT NOT NULL CHECK (type IN ('task_due', 'followup', 'compliance', 'custom')),
      message TEXT NOT NULL,
      reminder_date DATETIME,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'dismissed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Bills table
  db.exec(`
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )
  `);

  // Bill Items table (for line items in bills)
  db.exec(`
    CREATE TABLE IF NOT EXISTS bill_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      payment_date DATE NOT NULL,
      payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'cheque', 'bank_transfer', 'upi', 'card')),
      reference_number TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bill_id) REFERENCES bills(id),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )
  `);

  // Followups table
  db.exec(`
    CREATE TABLE IF NOT EXISTS followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      completion_date DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (bill_id) REFERENCES bills(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    )
  `);

  // Income table
  db.exec(`
    CREATE TABLE IF NOT EXISTS income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      bill_id INTEGER,
      payment_id INTEGER,
      service_id INTEGER,
      amount DECIMAL(10,2) NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      income_date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (bill_id) REFERENCES bills(id),
      FOREIGN KEY (payment_id) REFERENCES payments(id),
      FOREIGN KEY (service_id) REFERENCES services(id)
    )
  `);

  // Expenses table
  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount DECIMAL(10,2) NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      expense_date DATE NOT NULL,
      receipt_number TEXT,
      vendor TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Document Templates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS documentTemplates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      service_type TEXT NOT NULL,
      registration_type TEXT,
      required_documents TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Activity Logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS activityLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Dropdown Options table
  db.exec(`
    CREATE TABLE IF NOT EXISTS dropdown_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      label TEXT NOT NULL,
      value TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed default dropdown options if empty
  const optCount = db.prepare('SELECT COUNT(*) as count FROM dropdown_options').get().count;
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
    const ins = db.prepare('INSERT INTO dropdown_options (category, label, value, sort_order) VALUES (?, ?, ?, ?)');
    defaults.forEach(d => ins.run(d[0], d[1], d[2], d[3]));
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
const logActivity = (userId, action, entityType, entityId, details = null) => {
  try {
    const stmt = db.prepare(`
      INSERT INTO activityLogs (user_id, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(userId, action, entityType, entityId, details);
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

// AUTH ROUTES
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email);
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

    logActivity(user.id, 'LOGIN', 'user', user.id);

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

app.get('/api/auth/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.user.id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// USERS ROUTES
app.get('/api/users', authenticateToken, requireRole(['Admin']), (req, res) => {
  try {
    const users = db.prepare('SELECT id, name, email, role, active, created_at FROM users ORDER BY name').all();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', authenticateToken, requireRole(['Admin']), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const stmt = db.prepare(`
      INSERT INTO users (name, email, password, role)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(name, email, hashedPassword, role);
    logActivity(req.user.id, 'CREATE', 'user', result.lastInsertRowid);
    
    res.status(201).json({ id: result.lastInsertRowid, message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id', authenticateToken, requireRole(['Admin']), async (req, res) => {
  try {
    const { name, email, role, active } = req.body;
    
    const stmt = db.prepare(`
      UPDATE users SET name = ?, email = ?, role = ?, active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(name, email, role, active, req.params.id);
    logActivity(req.user.id, 'UPDATE', 'user', req.params.id);
    
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CLIENTS ROUTES
app.get('/api/clients', authenticateToken, (req, res) => {
  try {
    const clients = db.prepare('SELECT * FROM clients WHERE active = 1 ORDER BY name').all();
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/clients/:id', authenticateToken, (req, res) => {
  try {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clients', authenticateToken, (req, res) => {
  try {
    const { name, email, phone, address, pan, gstin, business_type, contact_person } = req.body;
    
    const stmt = db.prepare(`
      INSERT INTO clients (name, email, phone, address, pan, gstin, business_type, contact_person)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(name, email, phone, address, pan, gstin, business_type, contact_person);
    logActivity(req.user.id, 'CREATE', 'client', result.lastInsertRowid);
    
    res.status(201).json({ id: result.lastInsertRowid, message: 'Client created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/clients/:id', authenticateToken, (req, res) => {
  try {
    const { name, email, phone, address, pan, gstin, business_type, contact_person } = req.body;
    
    const stmt = db.prepare(`
      UPDATE clients SET name = ?, email = ?, phone = ?, address = ?, pan = ?, gstin = ?, 
      business_type = ?, contact_person = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(name, email, phone, address, pan, gstin, business_type, contact_person, req.params.id);
    logActivity(req.user.id, 'UPDATE', 'client', req.params.id);
    
    res.json({ message: 'Client updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/clients/:id', authenticateToken, requireRole(['Admin', 'CA']), (req, res) => {
  try {
    const stmt = db.prepare('UPDATE clients SET active = 0 WHERE id = ?');
    stmt.run(req.params.id);
    logActivity(req.user.id, 'DELETE', 'client', req.params.id);
    
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SERVICES ROUTES
app.get('/api/services', authenticateToken, (req, res) => {
  try {
    const services = db.prepare('SELECT * FROM services WHERE active = 1 ORDER BY name').all();
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/services', authenticateToken, requireRole(['Admin', 'CA']), (req, res) => {
  try {
    const { name, description, base_price, category, gst_applicable } = req.body;
    
    const stmt = db.prepare(`
      INSERT INTO services (name, description, base_price, category, gst_applicable)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(name, description, base_price, category, gst_applicable);
    logActivity(req.user.id, 'CREATE', 'service', result.lastInsertRowid);
    
    res.status(201).json({ id: result.lastInsertRowid, message: 'Service created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/services/:id', authenticateToken, requireRole(['Admin', 'CA']), (req, res) => {
  try {
    const { name, description, base_price, category, gst_applicable } = req.body;
    
    const stmt = db.prepare(`
      UPDATE services SET name = ?, description = ?, base_price = ?, category = ?, gst_applicable = ?
      WHERE id = ?
    `);
    
    stmt.run(name, description, base_price, category, gst_applicable, req.params.id);
    logActivity(req.user.id, 'UPDATE', 'service', req.params.id);
    
    res.json({ message: 'Service updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/services/:id', authenticateToken, requireRole(['Admin', 'CA']), (req, res) => {
  try {
    db.prepare('UPDATE services SET active = 0 WHERE id = ?').run(req.params.id);
    logActivity(req.user.id, 'DELETE', 'service', req.params.id);
    res.json({ message: 'Service deleted successfully' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// TASKS ROUTES
app.get('/api/tasks', authenticateToken, (req, res) => {
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

    if (client) {
      query += ' AND t.client_id = ?';
      params.push(client);
    }
    if (staff) {
      query += ' AND t.assigned_to = ?';
      params.push(staff);
    }
    if (service) {
      query += ' AND t.service_id = ?';
      params.push(service);
    }
    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }

    query += ' ORDER BY t.due_date ASC, t.priority DESC';

    const tasks = db.prepare(query).all(...params);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks', authenticateToken, (req, res) => {
  try {
    const { title, description, client_id, service_id, assigned_to, priority, due_date, notes } = req.body;
    
    const stmt = db.prepare(`
      INSERT INTO tasks (title, description, client_id, service_id, assigned_to, priority, due_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(title, description, client_id, service_id, assigned_to, priority, due_date, notes);
    logActivity(req.user.id, 'CREATE', 'task', result.lastInsertRowid);
    
    res.status(201).json({ id: result.lastInsertRowid, message: 'Task created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tasks/:id', authenticateToken, (req, res) => {
  try {
    const { title, description, client_id, service_id, assigned_to, status, priority, due_date, notes } = req.body;
    
    let completionDate = null;
    if (status === 'completed') {
      completionDate = new Date().toISOString();
    }
    
    const stmt = db.prepare(`
      UPDATE tasks SET title = ?, description = ?, client_id = ?, service_id = ?, 
      assigned_to = ?, status = ?, priority = ?, due_date = ?, notes = ?, 
      completion_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(title, description, client_id, service_id, assigned_to, status, priority, due_date, notes, completionDate, req.params.id);
    logActivity(req.user.id, 'UPDATE', 'task', req.params.id);
    
    res.json({ message: 'Task updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
  try {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    logActivity(req.user.id, 'DELETE', 'task', req.params.id);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// RECURRING RULES ROUTES
app.get('/api/recurring-rules', authenticateToken, (req, res) => {
  try {
    const rules = db.prepare(`
      SELECT r.*, c.name as client_name, s.name as service_name, u.name as assigned_name
      FROM recurringRules r
      LEFT JOIN clients c ON r.client_id = c.id
      LEFT JOIN services s ON r.service_id = s.id
      LEFT JOIN users u ON r.assigned_to = u.id
      WHERE r.active = 1
      ORDER BY r.name
    `).all();
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/recurring-rules', authenticateToken, requireRole(['Admin', 'CA']), (req, res) => {
  try {
    const { name, client_id, service_id, assigned_to, frequency, day_of_month, day_of_week, start_date, end_date } = req.body;
    
    const stmt = db.prepare(`
      INSERT INTO recurringRules (name, client_id, service_id, assigned_to, frequency, day_of_month, day_of_week, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(name, client_id, service_id, assigned_to, frequency, day_of_month, day_of_week, start_date, end_date);
    logActivity(req.user.id, 'CREATE', 'recurring_rule', result.lastInsertRowid);
    
    res.status(201).json({ id: result.lastInsertRowid, message: 'Recurring rule created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/recurring-rules/:id', authenticateToken, requireRole(['Admin', 'CA']), (req, res) => {
  try {
    const { name, client_id, service_id, assigned_to, frequency, day_of_month, day_of_week, start_date, end_date, active } = req.body;
    db.prepare('UPDATE recurringRules SET name=?, client_id=?, service_id=?, assigned_to=?, frequency=?, day_of_month=?, day_of_week=?, start_date=?, end_date=?, active=? WHERE id=?')
      .run(name, client_id, service_id, assigned_to, frequency, day_of_month, day_of_week, start_date, end_date, active ? 1 : 0, req.params.id);
    logActivity(req.user.id, 'UPDATE', 'recurring_rule', req.params.id);
    res.json({ message: 'Recurring rule updated' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/recurring-rules/:id', authenticateToken, requireRole(['Admin', 'CA']), (req, res) => {
  try {
    db.prepare('DELETE FROM recurringRules WHERE id = ?').run(req.params.id);
    logActivity(req.user.id, 'DELETE', 'recurring_rule', req.params.id);
    res.json({ message: 'Recurring rule deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// BILLS ROUTES
app.get('/api/bills', authenticateToken, (req, res) => {
  try {
    const bills = db.prepare(`
      SELECT b.*, c.name as client_name
      FROM bills b
      LEFT JOIN clients c ON b.client_id = c.id
      ORDER BY b.created_at DESC
    `).all();
    res.json(bills);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bills/:id', authenticateToken, (req, res) => {
  try {
    const bill = db.prepare(`
      SELECT b.*, c.name as client_name, c.address, c.gstin
      FROM bills b
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.id = ?
    `).get(req.params.id);
    
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const items = db.prepare(`
      SELECT bi.*, s.name as service_name
      FROM bill_items bi
      LEFT JOIN services s ON bi.service_id = s.id
      WHERE bi.bill_id = ?
    `).all(req.params.id);

    bill.items = items;
    res.json(bill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bills', authenticateToken, (req, res) => {
  try {
    const { client_id, items, notes, due_date } = req.body;
    
    // Generate bill number
    const billCount = db.prepare('SELECT COUNT(*) as count FROM bills').get().count;
    const billNumber = `INV-${new Date().getFullYear()}-${String(billCount + 1).padStart(4, '0')}`;
    
    // Calculate totals
    let subtotal = 0;
    items.forEach(item => {
      subtotal += parseFloat(item.amount);
    });
    
    const gstRate = 18.00;
    const gstAmount = (subtotal * gstRate) / 100;
    const totalAmount = subtotal + gstAmount;
    
    const billStmt = db.prepare(`
      INSERT INTO bills (client_id, bill_number, bill_date, due_date, subtotal, gst_rate, gst_amount, total_amount, notes)
      VALUES (?, ?, DATE('now'), ?, ?, ?, ?, ?, ?)
    `);
    
    const billResult = billStmt.run(client_id, billNumber, due_date, subtotal, gstRate, gstAmount, totalAmount, notes);
    const billId = billResult.lastInsertRowid;
    
    // Insert bill items
    const itemStmt = db.prepare(`
      INSERT INTO bill_items (bill_id, service_id, task_id, description, quantity, rate, amount)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    items.forEach(item => {
      itemStmt.run(billId, item.service_id, item.task_id, item.description, item.quantity, item.rate, item.amount);
    });
    
    logActivity(req.user.id, 'CREATE', 'bill', billId);
    
    res.status(201).json({ id: billId, bill_number: billNumber, message: 'Bill created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/bills/:id', authenticateToken, (req, res) => {
  try {
    const { status, notes } = req.body;
    db.prepare('UPDATE bills SET status=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status, notes, req.params.id);
    logActivity(req.user.id, 'UPDATE', 'bill', req.params.id);
    res.json({ message: 'Bill updated' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/bills/:id', authenticateToken, requireRole(['Admin', 'CA']), (req, res) => {
  try {
    db.prepare('DELETE FROM bill_items WHERE bill_id = ?').run(req.params.id);
    db.prepare('DELETE FROM bills WHERE id = ?').run(req.params.id);
    logActivity(req.user.id, 'DELETE', 'bill', req.params.id);
    res.json({ message: 'Bill deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// PAYMENTS ROUTES
app.get('/api/payments', authenticateToken, (req, res) => {
  try {
    const payments = db.prepare(`
      SELECT p.*, c.name as client_name, b.bill_number
      FROM payments p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN bills b ON p.bill_id = b.id
      ORDER BY p.created_at DESC
    `).all();
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payments', authenticateToken, (req, res) => {
  try {
    const { bill_id, client_id, amount, payment_date, payment_method, reference_number, notes } = req.body;
    
    // Insert payment
    const paymentStmt = db.prepare(`
      INSERT INTO payments (bill_id, client_id, amount, payment_date, payment_method, reference_number, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const paymentResult = paymentStmt.run(bill_id, client_id, amount, payment_date, payment_method, reference_number, notes);
    
    // Check if bill is fully paid
    const bill = db.prepare('SELECT total_amount FROM bills WHERE id = ?').get(bill_id);
    const totalPaid = db.prepare('SELECT SUM(amount) as total FROM payments WHERE bill_id = ?').get(bill_id).total;
    
    if (totalPaid >= bill.total_amount) {
      // Update bill status to paid
      db.prepare('UPDATE bills SET status = ? WHERE id = ?').run('paid', bill_id);
    }
    
    // Create income record
    const incomeStmt = db.prepare(`
      INSERT INTO income (client_id, bill_id, payment_id, amount, description, category, income_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    incomeStmt.run(client_id, bill_id, paymentResult.lastInsertRowid, amount, 'Payment received', 'Service Income', payment_date);
    
    logActivity(req.user.id, 'CREATE', 'payment', paymentResult.lastInsertRowid);
    
    res.status(201).json({ id: paymentResult.lastInsertRowid, message: 'Payment recorded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/payments/:id', authenticateToken, requireRole(['Admin', 'CA']), (req, res) => {
  try {
    db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
    logActivity(req.user.id, 'DELETE', 'payment', req.params.id);
    res.json({ message: 'Payment deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// FOLLOWUPS ROUTES
app.get('/api/followups', authenticateToken, (req, res) => {
  try {
    const followups = db.prepare(`
      SELECT f.*, c.name as client_name, u.name as assigned_name
      FROM followups f
      LEFT JOIN clients c ON f.client_id = c.id
      LEFT JOIN users u ON f.assigned_to = u.id
      ORDER BY f.due_date ASC, f.priority DESC
    `).all();
    res.json(followups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/followups', authenticateToken, (req, res) => {
  try {
    const { client_id, task_id, bill_id, type, subject, description, priority, due_date, assigned_to } = req.body;
    
    const stmt = db.prepare(`
      INSERT INTO followups (client_id, task_id, bill_id, type, subject, description, priority, due_date, assigned_to)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(client_id, task_id, bill_id, type, subject, description, priority, due_date, assigned_to);
    logActivity(req.user.id, 'CREATE', 'followup', result.lastInsertRowid);
    
    res.status(201).json({ id: result.lastInsertRowid, message: 'Followup created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/followups/:id', authenticateToken, (req, res) => {
  try {
    const { status, notes } = req.body;
    
    let completionDate = null;
    if (status === 'completed') {
      completionDate = new Date().toISOString();
    }
    
    const stmt = db.prepare(`
      UPDATE followups SET status = ?, notes = ?, completion_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(status, notes, completionDate, req.params.id);
    logActivity(req.user.id, 'UPDATE', 'followup', req.params.id);
    
    res.json({ message: 'Followup updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/followups/:id', authenticateToken, (req, res) => {
  try {
    db.prepare('DELETE FROM followups WHERE id = ?').run(req.params.id);
    logActivity(req.user.id, 'DELETE', 'followup', req.params.id);
    res.json({ message: 'Followup deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// INCOME ROUTES
app.get('/api/income', authenticateToken, (req, res) => {
  try {
    const income = db.prepare(`
      SELECT i.*, c.name as client_name, s.name as service_name
      FROM income i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN services s ON i.service_id = s.id
      ORDER BY i.income_date DESC
    `).all();
    res.json(income);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/income', authenticateToken, (req, res) => {
  try {
    const { client_id, service_id, amount, description, category, income_date } = req.body;
    
    const stmt = db.prepare(`
      INSERT INTO income (client_id, service_id, amount, description, category, income_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(client_id, service_id, amount, description, category, income_date);
    logActivity(req.user.id, 'CREATE', 'income', result.lastInsertRowid);
    
    res.status(201).json({ id: result.lastInsertRowid, message: 'Income record created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/income/:id', authenticateToken, (req, res) => {
  try {
    db.prepare('DELETE FROM income WHERE id = ?').run(req.params.id);
    logActivity(req.user.id, 'DELETE', 'income', req.params.id);
    res.json({ message: 'Income deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// EXPENSES ROUTES
app.get('/api/expenses', authenticateToken, (req, res) => {
  try {
    const expenses = db.prepare('SELECT * FROM expenses ORDER BY expense_date DESC').all();
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/expenses', authenticateToken, (req, res) => {
  try {
    const { amount, description, category, expense_date, receipt_number, vendor, notes } = req.body;
    
    const stmt = db.prepare(`
      INSERT INTO expenses (amount, description, category, expense_date, receipt_number, vendor, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(amount, description, category, expense_date, receipt_number, vendor, notes);
    logActivity(req.user.id, 'CREATE', 'expense', result.lastInsertRowid);
    
    res.status(201).json({ id: result.lastInsertRowid, message: 'Expense record created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/expenses/:id', authenticateToken, (req, res) => {
  try {
    db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
    logActivity(req.user.id, 'DELETE', 'expense', req.params.id);
    res.json({ message: 'Expense deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// DOCUMENT TEMPLATES ROUTES
app.get('/api/document-templates', authenticateToken, (req, res) => {
  try {
    const templates = db.prepare('SELECT * FROM documentTemplates ORDER BY name').all();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/document-templates', authenticateToken, requireRole(['Admin', 'CA']), (req, res) => {
  try {
    const { name, service_type, registration_type, required_documents, description } = req.body;
    
    const stmt = db.prepare(`
      INSERT INTO documentTemplates (name, service_type, registration_type, required_documents, description)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(name, service_type, registration_type, required_documents, description);
    logActivity(req.user.id, 'CREATE', 'document_template', result.lastInsertRowid);
    
    res.status(201).json({ id: result.lastInsertRowid, message: 'Document template created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/document-templates/:id', authenticateToken, requireRole(['Admin', 'CA']), (req, res) => {
  try {
    db.prepare('DELETE FROM documentTemplates WHERE id = ?').run(req.params.id);
    logActivity(req.user.id, 'DELETE', 'document_template', req.params.id);
    res.json({ message: 'Template deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/users/:id', authenticateToken, requireRole(['Admin']), (req, res) => {
  try {
    db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id);
    logActivity(req.user.id, 'DELETE', 'user', req.params.id);
    res.json({ message: 'User deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// DROPDOWN OPTIONS ROUTES
app.get('/api/dropdown-options', authenticateToken, (req, res) => {
  try {
    const { category } = req.query;
    if (category) {
      const options = db.prepare('SELECT * FROM dropdown_options WHERE category = ? AND active = 1 ORDER BY sort_order, label').all(category);
      return res.json(options);
    }
    const all = db.prepare('SELECT * FROM dropdown_options WHERE active = 1 ORDER BY category, sort_order, label').all();
    // Group by category
    const grouped = {};
    all.forEach(o => {
      if (!grouped[o.category]) grouped[o.category] = [];
      grouped[o.category].push(o);
    });
    res.json(grouped);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/dropdown-options', authenticateToken, requireRole(['Admin', 'CA']), (req, res) => {
  try {
    const { category, label, value, sort_order } = req.body;
    if (!category || !label) return res.status(400).json({ error: 'Category and label required' });
    const result = db.prepare('INSERT INTO dropdown_options (category, label, value, sort_order) VALUES (?, ?, ?, ?)').run(category, label, value || label, sort_order || 0);
    logActivity(req.user.id, 'CREATE', 'dropdown_option', result.lastInsertRowid);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Option added' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/dropdown-options/:id', authenticateToken, requireRole(['Admin', 'CA']), (req, res) => {
  try {
    const { label, value, sort_order, active } = req.body;
    db.prepare('UPDATE dropdown_options SET label=?, value=?, sort_order=?, active=? WHERE id=?').run(label, value || label, sort_order || 0, active !== undefined ? (active ? 1 : 0) : 1, req.params.id);
    logActivity(req.user.id, 'UPDATE', 'dropdown_option', req.params.id);
    res.json({ message: 'Option updated' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/dropdown-options/:id', authenticateToken, requireRole(['Admin']), (req, res) => {
  try {
    db.prepare('DELETE FROM dropdown_options WHERE id = ?').run(req.params.id);
    logActivity(req.user.id, 'DELETE', 'dropdown_option', req.params.id);
    res.json({ message: 'Option deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// DASHBOARD ROUTES
app.get('/api/dashboard', authenticateToken, (req, res) => {
  try {
    const stats = {
      totalClients: db.prepare('SELECT COUNT(*) as count FROM clients WHERE active = 1').get().count,
      todayTasks: db.prepare("SELECT COUNT(*) as count FROM tasks WHERE DATE(due_date) = DATE('now') AND status != 'completed'").get().count,
      overdueTasks: db.prepare("SELECT COUNT(*) as count FROM tasks WHERE due_date < DATE('now') AND status != 'completed'").get().count,
      pendingBills: db.prepare("SELECT COUNT(*) as count FROM bills WHERE status = 'pending'").get().count,
      monthlyIncome: db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE DATE(income_date) >= DATE('now', 'start of month')").get().total,
      monthlyExpenses: db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE DATE(expense_date) >= DATE('now', 'start of month')").get().total
    };

    stats.netProfit = stats.monthlyIncome - stats.monthlyExpenses;

    // Recent activities
    const recentActivities = db.prepare(`
      SELECT a.*, u.name as user_name 
      FROM activityLogs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC 
      LIMIT 10
    `).all();

    // Task status distribution
    const taskStats = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM tasks
      GROUP BY status
    `).all();

    // Monthly income trend (last 6 months)
    const incomeChart = db.prepare(`
      SELECT strftime('%Y-%m', income_date) as month, SUM(amount) as total
      FROM income
      WHERE income_date >= DATE('now', '-6 months')
      GROUP BY strftime('%Y-%m', income_date)
      ORDER BY month
    `).all();

    res.json({
      stats,
      recentActivities,
      taskStats,
      incomeChart
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ACTIVITY LOGS ROUTES
app.get('/api/activity-logs', authenticateToken, requireRole(['Admin', 'CA']), (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT a.*, u.name as user_name
      FROM activityLogs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 100
    `).all();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// REPORTS ROUTES
app.get('/api/reports/productivity', authenticateToken, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const productivity = db.prepare(`
      SELECT 
        u.name as staff_name,
        COUNT(*) as total_tasks,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN t.due_date < DATE('now') AND t.status != 'completed' THEN 1 ELSE 0 END) as overdue_tasks
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE DATE(t.created_at) BETWEEN ? AND ?
      GROUP BY t.assigned_to, u.name
      ORDER BY completed_tasks DESC
    `).all(startDate || '2024-01-01', endDate || '2024-12-31');

    res.json(productivity);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/revenue', authenticateToken, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const revenue = db.prepare(`
      SELECT 
        c.name as client_name,
        COUNT(DISTINCT b.id) as total_bills,
        SUM(b.total_amount) as total_billed,
        SUM(p.amount) as total_paid,
        SUM(b.total_amount) - COALESCE(SUM(p.amount), 0) as outstanding
      FROM bills b
      LEFT JOIN clients c ON b.client_id = c.id
      LEFT JOIN payments p ON b.id = p.bill_id
      WHERE DATE(b.bill_date) BETWEEN ? AND ?
      GROUP BY b.client_id, c.name
      ORDER BY total_billed DESC
    `).all(startDate || '2024-01-01', endDate || '2024-12-31');

    res.json(revenue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seed data function
const seedData = async () => {
  try {
    // Check if data already exists
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (userCount > 0) {
      console.log('Data already seeded');
      return;
    }

    console.log('Seeding database...');

    // Create default admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    db.prepare(`
      INSERT INTO users (name, email, password, role)
      VALUES ('Admin User', 'admin@ca.com', ?, 'Admin')
    `).run(hashedPassword);

    // Create sample staff
    const staffPassword = await bcrypt.hash('password123', 10);
    const staff = [
      { name: 'Rajesh Kumar', email: 'rajesh@ca.com', role: 'CA' },
      { name: 'Priya Sharma', email: 'priya@ca.com', role: 'Accountant' },
      { name: 'Amit Singh', email: 'amit@ca.com', role: 'Article' }
    ];

    staff.forEach(s => {
      db.prepare(`
        INSERT INTO users (name, email, password, role)
        VALUES (?, ?, ?, ?)
      `).run(s.name, s.email, staffPassword, s.role);
    });

    // Create sample clients
    const clients = [
      { name: 'ABC Pvt Ltd', email: 'info@abc.com', phone: '9876543210', business_type: 'Private Limited', pan: 'ABCPY1234F', gstin: '29ABCPY1234F1Z5' },
      { name: 'XYZ Enterprises', email: 'contact@xyz.com', phone: '9876543211', business_type: 'Partnership', pan: 'XYZPQ5678G', gstin: '29XYZPQ5678G1Z1' },
      { name: 'LMN Industries', email: 'admin@lmn.com', phone: '9876543212', business_type: 'LLP', pan: 'LMNRS9012H', gstin: '29LMNRS9012H1Z2' },
      { name: 'PQR Services', email: 'info@pqr.com', phone: '9876543213', business_type: 'Sole Proprietorship', pan: 'PQRTU3456I', gstin: '29PQRTU3456I1Z3' },
      { name: 'DEF Solutions', email: 'hello@def.com', phone: '9876543214', business_type: 'Private Limited', pan: 'DEFVW7890J', gstin: '29DEFVW7890J1Z4' }
    ];

    clients.forEach(c => {
      db.prepare(`
        INSERT INTO clients (name, email, phone, business_type, pan, gstin)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(c.name, c.email, c.phone, c.business_type, c.pan, c.gstin);
    });

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

    services.forEach(s => {
      db.prepare(`
        INSERT INTO services (name, description, base_price, category)
        VALUES (?, ?, ?, ?)
      `).run(s.name, s.description, s.base_price, s.category);
    });

    // Create sample tasks
    const tasks = [
      { title: 'GST Return - ABC Pvt Ltd', client_id: 1, service_id: 1, assigned_to: 2, priority: 'high', due_date: '2024-02-15' },
      { title: 'Income Tax Filing - XYZ Enterprises', client_id: 2, service_id: 3, assigned_to: 2, priority: 'medium', due_date: '2024-03-31' },
      { title: 'TDS Return - LMN Industries', client_id: 3, service_id: 2, assigned_to: 3, priority: 'high', due_date: '2024-01-31' },
      { title: 'Audit - PQR Services', client_id: 4, service_id: 4, assigned_to: 2, priority: 'urgent', due_date: '2024-04-30' },
      { title: 'ROC Filing - DEF Solutions', client_id: 5, service_id: 5, assigned_to: 4, priority: 'medium', due_date: '2024-03-15' }
    ];

    tasks.forEach(t => {
      db.prepare(`
        INSERT INTO tasks (title, client_id, service_id, assigned_to, priority, due_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(t.title, t.client_id, t.service_id, t.assigned_to, t.priority, t.due_date);
    });

    // Create recurring rules
    const recurringRules = [
      { name: 'Monthly GST Returns', client_id: 1, service_id: 1, assigned_to: 2, frequency: 'monthly', day_of_month: 20, start_date: '2024-01-01' },
      { name: 'Quarterly TDS Returns - All Clients', service_id: 2, assigned_to: 3, frequency: 'quarterly', day_of_month: 30, start_date: '2024-01-01' }
    ];

    recurringRules.forEach(r => {
      db.prepare(`
        INSERT INTO recurringRules (name, client_id, service_id, assigned_to, frequency, day_of_month, start_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(r.name, r.client_id, r.service_id, r.assigned_to, r.frequency, r.day_of_month, r.start_date);
    });

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

    docTemplates.forEach(d => {
      db.prepare(`
        INSERT INTO documentTemplates (name, service_type, required_documents)
        VALUES (?, ?, ?)
      `).run(d.name, d.service_type, d.required_documents);
    });

    console.log('Database seeded successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
};

// Automation functions
const createTasksFromRecurringRules = () => {
  try {
    const activeRules = db.prepare(`
      SELECT * FROM recurringRules 
      WHERE active = 1 AND (end_date IS NULL OR end_date >= DATE('now'))
    `).all();

    let tasksCreated = 0;

    activeRules.forEach(rule => {
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
        const taskStmt = db.prepare(`
          INSERT INTO tasks (title, client_id, service_id, assigned_to, due_date, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        taskStmt.run(
          rule.name,
          rule.client_id,
          rule.service_id,
          rule.assigned_to,
          dueDate.toISOString().split('T')[0],
          `Auto-generated from recurring rule: ${rule.name}`
        );

        // Update last generated date
        const updateStmt = db.prepare(`
          UPDATE recurringRules SET last_generated = CURRENT_TIMESTAMP WHERE id = ?
        `);
        updateStmt.run(rule.id);

        tasksCreated++;
      }
    });

    if (tasksCreated > 0) {
      console.log(`Created ${tasksCreated} tasks from recurring rules`);
    }
  } catch (error) {
    console.error('Error creating tasks from recurring rules:', error);
  }
};

const markOverdueTasks = () => {
  try {
    const stmt = db.prepare(`
      UPDATE tasks 
      SET status = 'overdue' 
      WHERE due_date < DATE('now') AND status IN ('pending', 'in_progress')
    `);
    
    const result = stmt.run();
    if (result.changes > 0) {
      console.log(`Marked ${result.changes} tasks as overdue`);
    }
  } catch (error) {
    console.error('Error marking overdue tasks:', error);
  }
};

const triggerReminders = () => {
  try {
    // Create reminders for tasks due tomorrow
    const stmt = db.prepare(`
      INSERT INTO reminders (task_id, client_id, user_id, type, message, reminder_date)
      SELECT t.id, t.client_id, t.assigned_to, 'task_due', 
             'Task "' || t.title || '" is due tomorrow', 
             DATETIME('now')
      FROM tasks t
      WHERE DATE(t.due_date) = DATE('now', '+1 day') 
      AND t.status NOT IN ('completed', 'cancelled')
      AND NOT EXISTS (
        SELECT 1 FROM reminders r 
        WHERE r.task_id = t.id AND r.type = 'task_due' 
        AND DATE(r.reminder_date) = DATE('now')
      )
    `);
    
    const result = stmt.run();
    if (result.changes > 0) {
      console.log(`Created ${result.changes} task due reminders`);
    }
  } catch (error) {
    console.error('Error triggering reminders:', error);
  }
};

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database and start server
async function startServer() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    rawDb = new SQL.Database(buf);
  } else {
    rawDb = new SQL.Database();
  }

  createTables();
  await seedData();
  
  app.listen(PORT, () => {
    console.log(`CA Practice Management System running on port ${PORT}`);
    createTasksFromRecurringRules();
    markOverdueTasks();
    triggerReminders();
  });
}

startServer().catch(err => { console.error('Failed to start:', err); process.exit(1); });

// Schedule daily automation
cron.schedule('0 6 * * *', () => {
  console.log('Running daily automation...');
  createTasksFromRecurringRules();
  markOverdueTasks();
  triggerReminders();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Closing database connection...');
  try { db.close(); } catch(e) {}
  process.exit(0);
});