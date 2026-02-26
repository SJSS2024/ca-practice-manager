const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const dns = require('dns');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { 
    persistSession: false 
  }
});

// For table creation only - resolve IPv6 manually
async function getDirectPool() {
  const { Pool } = require('pg');
  const addrs = await dns.promises.resolve6(process.env.DB_HOST || 'localhost');
  return new Pool({
    host: addrs[0],
    port: 5432,
    database: 'postgres',
    user: 'postgres', 
    password: process.env.DB_PASSWORD || '',
    ssl: { 
      rejectUnauthorized: false, 
      servername: process.env.DB_HOST || 'localhost' 
    },
    max: 2,
    connectionTimeoutMillis: 10000
  });
}

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

// Create tables function (using direct PostgreSQL connection)
const createTables = async () => {
  const pool = await getDirectPool();
  
  try {
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

    // Create PostgreSQL functions for complex queries
    await pool.query(`
      CREATE OR REPLACE FUNCTION get_dashboard_stats() 
      RETURNS JSON AS $$
      SELECT json_build_object(
        'totalClients', (SELECT COUNT(*) FROM clients WHERE active = true),
        'todayTasks', (SELECT COUNT(*) FROM tasks WHERE DATE(due_date) = CURRENT_DATE AND status != 'completed'),
        'overdueTasks', (SELECT COUNT(*) FROM tasks WHERE due_date < CURRENT_DATE AND status != 'completed'),
        'pendingBills', (SELECT COUNT(*) FROM bills WHERE status = 'pending'),
        'monthlyIncome', (SELECT COALESCE(SUM(amount), 0) FROM income WHERE DATE(income_date) >= DATE_TRUNC('month', CURRENT_DATE)),
        'monthlyExpenses', (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE DATE(expense_date) >= DATE_TRUNC('month', CURRENT_DATE)),
        'netProfit', (
          (SELECT COALESCE(SUM(amount), 0) FROM income WHERE DATE(income_date) >= DATE_TRUNC('month', CURRENT_DATE)) -
          (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE DATE(expense_date) >= DATE_TRUNC('month', CURRENT_DATE))
        )
      );
      $$ LANGUAGE sql;
    `);

    await pool.query(`
      CREATE OR REPLACE FUNCTION log_activity(
        p_user_id INT, 
        p_action TEXT, 
        p_entity_type TEXT, 
        p_entity_id INT, 
        p_details TEXT DEFAULT NULL
      ) 
      RETURNS VOID AS $$
      INSERT INTO activitylogs (user_id, action, entity_type, entity_id, details) 
      VALUES (p_user_id, p_action, p_entity_type, p_entity_id, p_details);
      $$ LANGUAGE sql;
    `);

    await pool.query(`
      CREATE OR REPLACE FUNCTION get_dashboard_activities()
      RETURNS JSON AS $$
      SELECT json_agg(t) FROM (
        SELECT a.id, a.action, a.entity_type, a.entity_id, a.details, a.created_at, u.name as user_name
        FROM activitylogs a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC 
        LIMIT 10
      ) t;
      $$ LANGUAGE sql;
    `);

    await pool.query(`
      CREATE OR REPLACE FUNCTION get_task_stats()
      RETURNS JSON AS $$
      SELECT json_agg(
        json_build_object(
          'status', status,
          'count', count
        )
      )
      FROM (
        SELECT status, COUNT(*) as count
        FROM tasks
        GROUP BY status
      ) t;
      $$ LANGUAGE sql;
    `);

    await pool.query(`
      CREATE OR REPLACE FUNCTION get_income_chart()
      RETURNS JSON AS $$
      SELECT json_agg(
        json_build_object(
          'month', month,
          'total', total
        )
      )
      FROM (
        SELECT TO_CHAR(income_date, 'YYYY-MM') as month, SUM(amount) as total
        FROM income
        WHERE income_date >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY TO_CHAR(income_date, 'YYYY-MM')
        ORDER BY month
      ) i;
      $$ LANGUAGE sql;
    `);

    await pool.query(`
      CREATE OR REPLACE FUNCTION sum_payments_for_bill(bill_id_param INT)
      RETURNS DECIMAL AS $$
      SELECT COALESCE(SUM(amount), 0) FROM payments WHERE bill_id = bill_id_param;
      $$ LANGUAGE sql;
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
  } finally {
    await pool.end();
  }
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

// Activity logging helper using Supabase RPC
const logActivity = async (userId, action, entityType, entityId, details = null) => {
  try {
    await supabase.rpc('log_activity', {
      p_user_id: userId,
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_details: details
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

// AUTH ROUTES
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('active', true)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, data.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: data.id, email: data.email, role: data.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logActivity(data.id, 'LOGIN', 'user', data.id);

    res.json({
      token,
      user: {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// USERS ROUTES
app.get('/api/users', authenticateToken, requireRole(['Admin']), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, active, created_at')
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', authenticateToken, requireRole(['Admin']), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const { data, error } = await supabase
      .from('users')
      .insert({ name, email, password: hashedPassword, role })
      .select('id')
      .single();
    
    if (error) throw error;
    
    await logActivity(req.user.id, 'CREATE', 'user', data.id);
    
    res.status(201).json({ id: data.id, message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id', authenticateToken, requireRole(['Admin']), async (req, res) => {
  try {
    const { name, email, role, active } = req.body;
    
    const { error } = await supabase
      .from('users')
      .update({ name, email, role, active, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);
    
    if (error) throw error;
    
    await logActivity(req.user.id, 'UPDATE', 'user', req.params.id);
    
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', authenticateToken, requireRole(['Admin']), async (req, res) => {
  try {
    const { error } = await supabase
      .from('users')
      .update({ active: false })
      .eq('id', req.params.id);
      
    if (error) throw error;
    await logActivity(req.user.id, 'DELETE', 'user', req.params.id);
    res.json({ message: 'User deleted' });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

// CLIENTS ROUTES
app.get('/api/clients', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('active', true)
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clients', authenticateToken, async (req, res) => {
  try {
    const { name, email, phone, address, pan, gstin, business_type, contact_person } = req.body;
    
    const { data, error } = await supabase
      .from('clients')
      .insert({ name, email, phone, address, pan, gstin, business_type, contact_person })
      .select('id')
      .single();
    
    if (error) throw error;
    
    await logActivity(req.user.id, 'CREATE', 'client', data.id);
    
    res.status(201).json({ id: data.id, message: 'Client created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const { name, email, phone, address, pan, gstin, business_type, contact_person } = req.body;
    
    const { error } = await supabase
      .from('clients')
      .update({ 
        name, email, phone, address, pan, gstin, business_type, contact_person,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id);
    
    if (error) throw error;
    
    await logActivity(req.user.id, 'UPDATE', 'client', req.params.id);
    
    res.json({ message: 'Client updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/clients/:id', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    const { error } = await supabase
      .from('clients')
      .update({ active: false })
      .eq('id', req.params.id);
      
    if (error) throw error;
    await logActivity(req.user.id, 'DELETE', 'client', req.params.id);
    
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SERVICES ROUTES
app.get('/api/services', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('active', true)
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/services', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    const { name, description, base_price, category, gst_applicable } = req.body;
    
    const { data, error } = await supabase
      .from('services')
      .insert({ name, description, base_price, category, gst_applicable })
      .select('id')
      .single();
    
    if (error) throw error;
    
    await logActivity(req.user.id, 'CREATE', 'service', data.id);
    
    res.status(201).json({ id: data.id, message: 'Service created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/services/:id', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    const { name, description, base_price, category, gst_applicable } = req.body;
    
    const { error } = await supabase
      .from('services')
      .update({ name, description, base_price, category, gst_applicable })
      .eq('id', req.params.id);
    
    if (error) throw error;
    
    await logActivity(req.user.id, 'UPDATE', 'service', req.params.id);
    
    res.json({ message: 'Service updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/services/:id', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    const { error } = await supabase
      .from('services')
      .update({ active: false })
      .eq('id', req.params.id);
      
    if (error) throw error;
    await logActivity(req.user.id, 'DELETE', 'service', req.params.id);
    res.json({ message: 'Service deleted successfully' });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

// TASKS ROUTES
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const { client, staff, service, status } = req.query;
    
    let query = supabase
      .from('tasks')
      .select('*, client_name:clients(name), service_name:services(name), assigned_name:users(name)');

    if (client) query = query.eq('client_id', client);
    if (staff) query = query.eq('assigned_to', staff);
    if (service) query = query.eq('service_id', service);
    if (status) query = query.eq('status', status);

    query = query.order('due_date', { ascending: true });

    const { data, error } = await query;
    
    if (error) throw error;

    // Flatten the nested objects for compatibility with existing frontend
    const formattedData = data.map(task => ({
      ...task,
      client_name: task.client_name?.name || null,
      service_name: task.service_name?.name || null,
      assigned_name: task.assigned_name?.name || null
    }));

    res.json(formattedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const { title, description, client_id, service_id, assigned_to, priority, due_date, notes } = req.body;
    
    const { data, error } = await supabase
      .from('tasks')
      .insert({ title, description, client_id, service_id, assigned_to, priority, due_date, notes })
      .select('id')
      .single();
    
    if (error) throw error;
    
    await logActivity(req.user.id, 'CREATE', 'task', data.id);
    
    res.status(201).json({ id: data.id, message: 'Task created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, client_id, service_id, assigned_to, status, priority, due_date, notes } = req.body;
    
    let completionDate = null;
    if (status === 'completed') {
      completionDate = new Date().toISOString();
    }
    
    const { error } = await supabase
      .from('tasks')
      .update({ 
        title, description, client_id, service_id, assigned_to, status, priority, 
        due_date, notes, completion_date: completionDate, updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id);
    
    if (error) throw error;
    
    await logActivity(req.user.id, 'UPDATE', 'task', req.params.id);
    
    res.json({ message: 'Task updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', req.params.id);
      
    if (error) throw error;
    await logActivity(req.user.id, 'DELETE', 'task', req.params.id);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

// RECURRING RULES ROUTES
app.get('/api/recurring-rules', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('recurringrules')
      .select('*, client_name:clients(name), service_name:services(name), assigned_name:users(name)')
      .eq('active', true)
      .order('name');

    if (error) throw error;

    // Flatten the nested objects
    const formattedData = data.map(rule => ({
      ...rule,
      client_name: rule.client_name?.name || null,
      service_name: rule.service_name?.name || null,
      assigned_name: rule.assigned_name?.name || null
    }));

    res.json(formattedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/recurring-rules', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    const { name, client_id, service_id, assigned_to, frequency, day_of_month, day_of_week, start_date, end_date } = req.body;
    
    const { data, error } = await supabase
      .from('recurringrules')
      .insert({ name, client_id, service_id, assigned_to, frequency, day_of_month, day_of_week, start_date, end_date })
      .select('id')
      .single();
    
    if (error) throw error;
    
    await logActivity(req.user.id, 'CREATE', 'recurring_rule', data.id);
    
    res.status(201).json({ id: data.id, message: 'Recurring rule created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/recurring-rules/:id', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    const { name, client_id, service_id, assigned_to, frequency, day_of_month, day_of_week, start_date, end_date, active } = req.body;
    
    const { error } = await supabase
      .from('recurringrules')
      .update({ name, client_id, service_id, assigned_to, frequency, day_of_month, day_of_week, start_date, end_date, active })
      .eq('id', req.params.id);
    
    if (error) throw error;
    await logActivity(req.user.id, 'UPDATE', 'recurring_rule', req.params.id);
    res.json({ message: 'Recurring rule updated' });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

app.delete('/api/recurring-rules/:id', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    const { error } = await supabase
      .from('recurringrules')
      .delete()
      .eq('id', req.params.id);
      
    if (error) throw error;
    await logActivity(req.user.id, 'DELETE', 'recurring_rule', req.params.id);
    res.json({ message: 'Recurring rule deleted' });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

// BILLS ROUTES
app.get('/api/bills', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bills')
      .select('*, client_name:clients(name)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Flatten the nested objects
    const formattedData = data.map(bill => ({
      ...bill,
      client_name: bill.client_name?.name || null
    }));

    res.json(formattedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bills/:id', authenticateToken, async (req, res) => {
  try {
    const { data: bill, error: billError } = await supabase
      .from('bills')
      .select('*, client_name:clients(name), client_address:clients(address), client_gstin:clients(gstin)')
      .eq('id', req.params.id)
      .single();
    
    if (billError || !bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const { data: items, error: itemsError } = await supabase
      .from('bill_items')
      .select('*, service_name:services(name)')
      .eq('bill_id', req.params.id);

    if (itemsError) throw itemsError;

    // Format the bill data
    const formattedBill = {
      ...bill,
      client_name: bill.client_name?.name || null,
      address: bill.client_address?.address || null,
      gstin: bill.client_gstin?.gstin || null,
      items: items.map(item => ({
        ...item,
        service_name: item.service_name?.name || null
      }))
    };

    res.json(formattedBill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bills', authenticateToken, async (req, res) => {
  try {
    const { client_id, items, notes, due_date } = req.body;
    
    // Get bill count for numbering
    const { count } = await supabase
      .from('bills')
      .select('*', { count: 'exact', head: true });
    
    const billNumber = `INV-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`;
    
    // Calculate totals
    let subtotal = 0;
    items.forEach(item => {
      subtotal += parseFloat(item.amount);
    });
    
    const gstRate = 18.00;
    const gstAmount = (subtotal * gstRate) / 100;
    const totalAmount = subtotal + gstAmount;
    
    const { data: billData, error: billError } = await supabase
      .from('bills')
      .insert({
        client_id, bill_number, bill_date: new Date().toISOString().split('T')[0],
        due_date, subtotal, gst_rate: gstRate, gst_amount: gstAmount,
        total_amount: totalAmount, notes
      })
      .select('id')
      .single();
    
    if (billError) throw billError;
    
    const billId = billData.id;
    
    // Insert bill items
    const itemsToInsert = items.map(item => ({
      bill_id: billId,
      service_id: item.service_id,
      task_id: item.task_id,
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.amount
    }));

    const { error: itemsError } = await supabase
      .from('bill_items')
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;
    
    await logActivity(req.user.id, 'CREATE', 'bill', billId);
    
    res.status(201).json({ id: billId, bill_number: billNumber, message: 'Bill created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/bills/:id', authenticateToken, async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    const { error } = await supabase
      .from('bills')
      .update({ status, notes, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);
    
    if (error) throw error;
    await logActivity(req.user.id, 'UPDATE', 'bill', req.params.id);
    res.json({ message: 'Bill updated' });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

app.delete('/api/bills/:id', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    // Delete bill items first
    await supabase
      .from('bill_items')
      .delete()
      .eq('bill_id', req.params.id);

    // Delete bill
    const { error } = await supabase
      .from('bills')
      .delete()
      .eq('id', req.params.id);
    
    if (error) throw error;
    await logActivity(req.user.id, 'DELETE', 'bill', req.params.id);
    res.json({ message: 'Bill deleted' });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

// PAYMENTS ROUTES
app.get('/api/payments', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*, client_name:clients(name), bill_number:bills(bill_number)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Flatten the nested objects
    const formattedData = data.map(payment => ({
      ...payment,
      client_name: payment.client_name?.name || null,
      bill_number: payment.bill_number?.bill_number || null
    }));

    res.json(formattedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payments', authenticateToken, async (req, res) => {
  try {
    const { bill_id, client_id, amount, payment_date, payment_method, reference_number, notes } = req.body;
    
    // Insert payment
    const { data: paymentData, error: paymentError } = await supabase
      .from('payments')
      .insert({ bill_id, client_id, amount, payment_date, payment_method, reference_number, notes })
      .select('id')
      .single();
    
    if (paymentError) throw paymentError;
    
    // Check if bill is fully paid
    const { data: bill, error: billError } = await supabase
      .from('bills')
      .select('total_amount')
      .eq('id', bill_id)
      .single();

    if (billError) throw billError;

    // Get total payments for this bill
    const { data: paymentsSum, error: sumError } = await supabase
      .rpc('sum_payments_for_bill', { bill_id_param: bill_id });

    if (!sumError) {
      const totalPaid = parseFloat(paymentsSum || 0);
      if (totalPaid >= parseFloat(bill.total_amount)) {
        // Update bill status to paid
        await supabase
          .from('bills')
          .update({ status: 'paid' })
          .eq('id', bill_id);
      }
    }
    
    // Create income record
    await supabase
      .from('income')
      .insert({
        client_id, bill_id, payment_id: paymentData.id, amount,
        description: 'Payment received', category: 'Service Income',
        income_date: payment_date
      });
    
    await logActivity(req.user.id, 'CREATE', 'payment', paymentData.id);
    
    res.status(201).json({ id: paymentData.id, message: 'Payment recorded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/payments/:id', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', req.params.id);
      
    if (error) throw error;
    await logActivity(req.user.id, 'DELETE', 'payment', req.params.id);
    res.json({ message: 'Payment deleted' });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

// FOLLOWUPS ROUTES
app.get('/api/followups', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('followups')
      .select('*, client_name:clients(name), assigned_name:users(name)')
      .order('due_date', { ascending: true });

    if (error) throw error;

    // Flatten the nested objects
    const formattedData = data.map(followup => ({
      ...followup,
      client_name: followup.client_name?.name || null,
      assigned_name: followup.assigned_name?.name || null
    }));

    res.json(formattedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/followups', authenticateToken, async (req, res) => {
  try {
    const { client_id, task_id, bill_id, type, subject, description, priority, due_date, assigned_to } = req.body;
    
    const { data, error } = await supabase
      .from('followups')
      .insert({ client_id, task_id, bill_id, type, subject, description, priority, due_date, assigned_to })
      .select('id')
      .single();
    
    if (error) throw error;
    
    await logActivity(req.user.id, 'CREATE', 'followup', data.id);
    
    res.status(201).json({ id: data.id, message: 'Followup created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/followups/:id', authenticateToken, async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    let completionDate = null;
    if (status === 'completed') {
      completionDate = new Date().toISOString();
    }
    
    const { error } = await supabase
      .from('followups')
      .update({ status, notes, completion_date: completionDate, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);
    
    if (error) throw error;
    
    await logActivity(req.user.id, 'UPDATE', 'followup', req.params.id);
    
    res.json({ message: 'Followup updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/followups/:id', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase
      .from('followups')
      .delete()
      .eq('id', req.params.id);
      
    if (error) throw error;
    await logActivity(req.user.id, 'DELETE', 'followup', req.params.id);
    res.json({ message: 'Followup deleted' });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

// INCOME ROUTES
app.get('/api/income', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('income')
      .select('*, client_name:clients(name), service_name:services(name)')
      .order('income_date', { ascending: false });

    if (error) throw error;

    // Flatten the nested objects
    const formattedData = data.map(income => ({
      ...income,
      client_name: income.client_name?.name || null,
      service_name: income.service_name?.name || null
    }));

    res.json(formattedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/income', authenticateToken, async (req, res) => {
  try {
    const { client_id, service_id, amount, description, category, income_date } = req.body;
    
    const { data, error } = await supabase
      .from('income')
      .insert({ client_id, service_id, amount, description, category, income_date })
      .select('id')
      .single();
    
    if (error) throw error;
    
    await logActivity(req.user.id, 'CREATE', 'income', data.id);
    
    res.status(201).json({ id: data.id, message: 'Income record created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/income/:id', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase
      .from('income')
      .delete()
      .eq('id', req.params.id);
      
    if (error) throw error;
    await logActivity(req.user.id, 'DELETE', 'income', req.params.id);
    res.json({ message: 'Income deleted' });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

// EXPENSES ROUTES
app.get('/api/expenses', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/expenses', authenticateToken, async (req, res) => {
  try {
    const { amount, description, category, expense_date, receipt_number, vendor, notes } = req.body;
    
    const { data, error } = await supabase
      .from('expenses')
      .insert({ amount, description, category, expense_date, receipt_number, vendor, notes })
      .select('id')
      .single();
    
    if (error) throw error;
    
    await logActivity(req.user.id, 'CREATE', 'expense', data.id);
    
    res.status(201).json({ id: data.id, message: 'Expense record created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/expenses/:id', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', req.params.id);
      
    if (error) throw error;
    await logActivity(req.user.id, 'DELETE', 'expense', req.params.id);
    res.json({ message: 'Expense deleted' });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

// DOCUMENT TEMPLATES ROUTES
app.get('/api/document-templates', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('documenttemplates')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/document-templates', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    const { name, service_type, registration_type, required_documents, description } = req.body;
    
    const { data, error } = await supabase
      .from('documenttemplates')
      .insert({ name, service_type, registration_type, required_documents, description })
      .select('id')
      .single();
    
    if (error) throw error;
    
    await logActivity(req.user.id, 'CREATE', 'document_template', data.id);
    
    res.status(201).json({ id: data.id, message: 'Document template created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/document-templates/:id', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    const { error } = await supabase
      .from('documenttemplates')
      .delete()
      .eq('id', req.params.id);
      
    if (error) throw error;
    await logActivity(req.user.id, 'DELETE', 'document_template', req.params.id);
    res.json({ message: 'Template deleted' });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

// DROPDOWN OPTIONS ROUTES
app.get('/api/dropdown-options', authenticateToken, async (req, res) => {
  try {
    const { category } = req.query;
    if (category) {
      const { data, error } = await supabase
        .from('dropdown_options')
        .select('*')
        .eq('category', category)
        .eq('active', true)
        .order('sort_order')
        .order('label');
        
      if (error) throw error;
      return res.json(data);
    }
    
    const { data, error } = await supabase
      .from('dropdown_options')
      .select('*')
      .eq('active', true)
      .order('category')
      .order('sort_order')
      .order('label');
      
    if (error) throw error;
    
    // Group by category
    const grouped = {};
    data.forEach(o => {
      if (!grouped[o.category]) grouped[o.category] = [];
      grouped[o.category].push(o);
    });
    res.json(grouped);
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

app.post('/api/dropdown-options', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    const { category, label, value, sort_order } = req.body;
    if (!category || !label) return res.status(400).json({ error: 'Category and label required' });
    
    const { data, error } = await supabase
      .from('dropdown_options')
      .insert({ category, label, value: value || label, sort_order: sort_order || 0 })
      .select('id')
      .single();
      
    if (error) throw error;
    await logActivity(req.user.id, 'CREATE', 'dropdown_option', data.id);
    res.status(201).json({ id: data.id, message: 'Option added' });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

app.put('/api/dropdown-options/:id', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    const { label, value, sort_order, active } = req.body;
    
    const { error } = await supabase
      .from('dropdown_options')
      .update({ 
        label, 
        value: value || label, 
        sort_order: sort_order || 0, 
        active: active !== undefined ? active : true 
      })
      .eq('id', req.params.id);
      
    if (error) throw error;
    await logActivity(req.user.id, 'UPDATE', 'dropdown_option', req.params.id);
    res.json({ message: 'Option updated' });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

app.delete('/api/dropdown-options/:id', authenticateToken, requireRole(['Admin']), async (req, res) => {
  try {
    const { error } = await supabase
      .from('dropdown_options')
      .delete()
      .eq('id', req.params.id);
      
    if (error) throw error;
    await logActivity(req.user.id, 'DELETE', 'dropdown_option', req.params.id);
    res.json({ message: 'Option deleted' });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

// DASHBOARD ROUTES
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    // Get dashboard stats using RPC function
    const { data: stats, error: statsError } = await supabase.rpc('get_dashboard_stats');
    if (statsError) throw statsError;

    // Get recent activities using RPC function  
    const { data: recentActivities, error: activitiesError } = await supabase.rpc('get_dashboard_activities');
    if (activitiesError) throw activitiesError;

    // Get task stats using RPC function
    const { data: taskStats, error: taskStatsError } = await supabase.rpc('get_task_stats');
    if (taskStatsError) throw taskStatsError;

    // Get income chart using RPC function
    const { data: incomeChart, error: incomeChartError } = await supabase.rpc('get_income_chart');
    if (incomeChartError) throw incomeChartError;

    res.json({
      stats,
      recentActivities: recentActivities || [],
      taskStats: taskStats || [],
      incomeChart: incomeChart || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ACTIVITY LOGS ROUTES
app.get('/api/activity-logs', authenticateToken, requireRole(['Admin', 'CA']), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('activitylogs')
      .select('*, user_name:users(name)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Flatten the nested objects
    const formattedData = data.map(log => ({
      ...log,
      user_name: log.user_name?.name || null
    }));

    res.json(formattedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// REPORTS ROUTES
app.get('/api/reports/productivity', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Since this is a complex query, we'll do it in JS for simplicity
    const { data, error } = await supabase
      .from('tasks')
      .select('*, assigned_name:users(name)')
      .gte('created_at', startDate || '2024-01-01')
      .lte('created_at', endDate || '2024-12-31');

    if (error) throw error;

    // Process data in JavaScript
    const staffStats = {};
    data.forEach(task => {
      const staffName = task.assigned_name?.name || 'Unassigned';
      if (!staffStats[staffName]) {
        staffStats[staffName] = {
          staff_name: staffName,
          total_tasks: 0,
          completed_tasks: 0,
          overdue_tasks: 0
        };
      }
      
      staffStats[staffName].total_tasks++;
      if (task.status === 'completed') staffStats[staffName].completed_tasks++;
      if (task.due_date < new Date().toISOString().split('T')[0] && task.status !== 'completed') {
        staffStats[staffName].overdue_tasks++;
      }
    });

    const result = Object.values(staffStats).sort((a, b) => b.completed_tasks - a.completed_tasks);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/revenue', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Get bills with client info
    const { data: bills, error: billsError } = await supabase
      .from('bills')
      .select('*, client_name:clients(name)')
      .gte('bill_date', startDate || '2024-01-01')
      .lte('bill_date', endDate || '2024-12-31');

    if (billsError) throw billsError;

    // Get all payments for these bills
    const billIds = bills.map(b => b.id);
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('bill_id, amount')
      .in('bill_id', billIds);

    if (paymentsError) throw paymentsError;

    // Process data in JavaScript
    const clientStats = {};
    bills.forEach(bill => {
      const clientName = bill.client_name?.name || 'Unknown Client';
      if (!clientStats[clientName]) {
        clientStats[clientName] = {
          client_name: clientName,
          total_bills: 0,
          total_billed: 0,
          total_paid: 0,
          outstanding: 0
        };
      }
      
      clientStats[clientName].total_bills++;
      clientStats[clientName].total_billed += parseFloat(bill.total_amount || 0);
    });

    // Add payments data
    payments.forEach(payment => {
      const bill = bills.find(b => b.id === payment.bill_id);
      if (bill) {
        const clientName = bill.client_name?.name || 'Unknown Client';
        if (clientStats[clientName]) {
          clientStats[clientName].total_paid += parseFloat(payment.amount || 0);
        }
      }
    });

    // Calculate outstanding
    Object.values(clientStats).forEach(client => {
      client.outstanding = client.total_billed - client.total_paid;
    });

    const result = Object.values(clientStats).sort((a, b) => b.total_billed - a.total_billed);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seed data function (using direct PostgreSQL connection)
const seedData = async () => {
  const pool = await getDirectPool();
  
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
  } finally {
    await pool.end();
  }
};

// Automation functions (using Supabase client)
const createTasksFromRecurringRules = async () => {
  try {
    const { data: activeRules, error } = await supabase
      .from('recurringrules')
      .select('*')
      .eq('active', true)
      .or('end_date.is.null,end_date.gte.' + new Date().toISOString().split('T')[0]);

    if (error) throw error;

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
        // Create task using Supabase
        await supabase
          .from('tasks')
          .insert({
            title: rule.name,
            client_id: rule.client_id,
            service_id: rule.service_id,
            assigned_to: rule.assigned_to,
            due_date: dueDate.toISOString().split('T')[0],
            notes: `Auto-generated from recurring rule: ${rule.name}`
          });

        // Update last generated date
        await supabase
          .from('recurringrules')
          .update({ last_generated: new Date().toISOString() })
          .eq('id', rule.id);

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
    const { data, error } = await supabase
      .from('tasks')
      .update({ status: 'overdue' })
      .lt('due_date', new Date().toISOString().split('T')[0])
      .in('status', ['pending', 'in_progress'])
      .select('id');
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      console.log(`Marked ${data.length} tasks as overdue`);
    }
  } catch (error) {
    console.error('Error marking overdue tasks:', error);
  }
};

const triggerReminders = async () => {
  try {
    // Get tasks due tomorrow that don't have reminders yet
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, title, client_id, assigned_to')
      .eq('due_date', tomorrowStr)
      .not('status', 'in', '(completed,cancelled)');

    if (tasksError) throw tasksError;

    let remindersCreated = 0;
    
    for (const task of tasks) {
      // Check if reminder already exists for today
      const { data: existingReminder, error: reminderCheckError } = await supabase
        .from('reminders')
        .select('id')
        .eq('task_id', task.id)
        .eq('type', 'task_due')
        .gte('reminder_date', todayStr + ' 00:00:00')
        .lt('reminder_date', todayStr + ' 23:59:59')
        .single();

      if (reminderCheckError && reminderCheckError.code !== 'PGRST116') throw reminderCheckError;

      if (!existingReminder) {
        await supabase
          .from('reminders')
          .insert({
            task_id: task.id,
            client_id: task.client_id,
            user_id: task.assigned_to,
            type: 'task_due',
            message: `Task "${task.title}" is due tomorrow`,
            reminder_date: new Date().toISOString()
          });
        
        remindersCreated++;
      }
    }
    
    if (remindersCreated > 0) {
      console.log(`Created ${remindersCreated} task due reminders`);
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
// Start HTTP server FIRST so Render health check passes, then init DB
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`CA Practice Management System running on port ${PORT}`);
  try {
    console.log('Connecting to Supabase...');
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    if (error) throw error;
    console.log('Supabase connected!');
    
    await createTables();
    console.log('Tables ready');
    await seedData();
    console.log('Seed complete');
    
    try {
      await createTasksFromRecurringRules();
      await markOverdueTasks();
      await triggerReminders();
    } catch (e) {
      console.error('Automation error (non-fatal):', e.message);
    }
    console.log('Server fully initialized');
  } catch (error) {
    console.error('Database initialization error:', error.message);
    console.error(error.stack);
  }
});

// Schedule daily automation
cron.schedule('0 6 * * *', () => {
  console.log('Running daily automation...');
  createTasksFromRecurringRules();
  markOverdueTasks();
  triggerReminders();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});