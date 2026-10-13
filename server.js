require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 3010;
const jwtSecret = process.env.JWT_SECRET || 'bctk-local-development-secret';
const pendingOtps = new Map();

app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bctk',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
});

async function migratePlaintextPasswords() {
  const [users] = await pool.query('SELECT id, password FROM users WHERE password IS NOT NULL');
  for (const user of users) {
    if (user.password && !String(user.password).startsWith('$2')) {
      const passwordHash = await bcrypt.hash(String(user.password), 12);
      await pool.query('UPDATE users SET password = ? WHERE id = ?', [passwordHash, user.id]);
    }
  }
}

async function ensureChecklistTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS taskChecklistItems (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      taskId INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      completed TINYINT(1) NOT NULL DEFAULT 0,
      createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      INDEX taskChecklistItems_taskId_idx (taskId)
    )
  `);
}

async function ensureNotificationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      taskId INT NOT NULL,
      userId INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type ENUM('upcoming', 'overdue') NOT NULL,
      notificationDate DATE NOT NULL,
      readAt DATETIME NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY notifications_task_user_day_idx (taskId, userId, notificationDate),
      INDEX notifications_user_created_idx (userId, createdAt)
    )
  `);
}

const getVietnamDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const addDays = (dateKey, days) => {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

async function createTaskReminders() {
  const today = getVietnamDate();
  const tomorrow = addDays(today, 1);
  const [tasks] = await pool.query(
    `SELECT id, title, assigneeId, dueDate
     FROM tasks
     WHERE assigneeId IS NOT NULL
       AND status <> 'done'
       AND dueDate IS NOT NULL
       AND dueDate <= ?`,
    [tomorrow],
  );

  for (const task of tasks) {
    const dueDate = String(task.dueDate).slice(0, 10);
    const type = dueDate < today ? 'overdue' : 'upcoming';
    const title = type === 'overdue' ? 'Task đã quá hạn' : 'Task sắp đến hạn';
    const message = type === 'overdue'
      ? `Task "${task.title}" đã quá hạn từ ${dueDate}.`
      : `Task "${task.title}" cần hoàn thành trước ${dueDate}.`;

    await pool.query(
      `INSERT IGNORE INTO notifications
        (taskId, userId, title, message, type, notificationDate)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [task.id, task.assigneeId, title, message, type, today],
    );
  }
}

const toDueDate = (value) => {
  const date = String(value || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return date || new Date().toISOString().slice(0, 10);
};

const createToken = (user) => jwt.sign({ sub: user.id, email: user.email, name: user.name, role: user.role, departmentId: user.departmentId }, jwtSecret, { expiresIn: '8h' });

async function sendOtpEmail(to, otp) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return false;
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Mã OTP đăng nhập BCTK',
    text: `Mã OTP của bạn là: ${otp}. Mã này có hiệu lực trong 5 phút.`,
  });
  return true;
}

const requireAuth = (req, res, next) => {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return res.status(401).json({ message: 'Vui lòng đăng nhập' });
  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ' });
  }
};

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const [rows] = await pool.query('SELECT id, name, email, password, role, departmentId, isActive FROM users WHERE LOWER(email) = ? LIMIT 1', [email]);
    const user = rows[0];
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    pendingOtps.set(email, { otp, expiresAt: Date.now() + 5 * 60 * 1000, userId: user.id });
    const sent = await sendOtpEmail(email, otp);
    res.json({ message: sent ? 'Mã OTP đã được gửi về email' : `Mã OTP thử nghiệm của bạn là ${otp}`, email });
  } catch (error) {
    res.status(500).json({ message: 'Không thể đăng nhập', error: String(error) });
  }
});

app.post('/api/auth/verify-login-otp', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();
    const pending = pendingOtps.get(email);
    if (!pending || pending.expiresAt < Date.now() || pending.otp !== otp) {
      return res.status(401).json({ message: 'Mã OTP không đúng hoặc đã hết hạn' });
    }

    const [rows] = await pool.query('SELECT id, name, email, role, departmentId FROM users WHERE id = ? LIMIT 1', [pending.userId]);
    const user = rows[0];
    pendingOtps.delete(email);
    const accessToken = createToken(user);
    res.json({ accessToken, refreshToken: accessToken, user });
  } catch (error) {
    res.status(500).json({ message: 'Không thể xác nhận OTP', error: String(error) });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 as ok');
    res.json({ ok: true, db: rows[0]?.ok === 1 });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Database connection failed', error: String(error) });
  }
});

app.get('/api/tasks', requireAuth, async (req, res) => {
  try {
    const [userRows] = await pool.query('SELECT role, departmentId FROM users WHERE id = ? LIMIT 1', [req.user.sub]);
    const currentUser = userRows[0];
    const role = currentUser?.role?.toLowerCase();
    const isAdmin = role === 'admin';
    const isDepartmentHead = role === 'manager';
    const visibility = isAdmin
      ? ''
      : isDepartmentHead
        ? 'WHERE u.departmentId = ?'
        : 'WHERE t.assigneeId = ? OR t.createdById = ?';
      const visibilityParams = isAdmin ? [] : isDepartmentHead ? [currentUser.departmentId] : [req.user.sub, req.user.sub];
    const [rows] = await pool.query(`
            SELECT t.id, t.title, u.name AS assignee, u.departmentId, d.name AS department, t.dueDate AS time, t.priority,
              t.status, t.progress, t.createdById, t.assigneeId,
              t.dueDate
      FROM tasks t
            LEFT JOIN users u ON u.id = t.assigneeId
            LEFT JOIN departments d ON d.id = u.departmentId
      ${visibility}
            ORDER BY t.createdAt DESC
    `, visibilityParams);

    const taskIds = rows.map((task) => Number(task.id));
    const checklistRows = taskIds.length
      ? (await pool.query('SELECT id, taskId, title, completed FROM taskChecklistItems WHERE taskId IN (?) ORDER BY id', [taskIds]))[0]
      : [];
    const tasks = rows.map((task) => ({
      id: String(task.id),
      title: task.title,
      assigneeId: task.assigneeId,
      departmentId: task.departmentId,
      createdById: task.createdById,
      assignee: task.assignee || 'Unassigned',
      department: task.department || undefined,
      time: task.time ? new Date(task.time).toISOString().slice(0, 10) : 'Chưa có thời gian',
      dueDate: task.time ? new Date(task.time).toISOString().slice(0, 10) : undefined,
      status: task.status,
      progress: Number(task.progress),
      priority: task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'Medium',
      checklist: checklistRows.filter((item) => Number(item.taskId) === Number(task.id)).map((item) => ({ id: item.id, title: item.title, completed: Boolean(item.completed) })),
    }));

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch tasks', error: String(error) });
  }
});

app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, taskId, title, message, type, notificationDate, readAt, createdAt
       FROM notifications
       WHERE userId = ?
       ORDER BY createdAt DESC
       LIMIT 50`,
      [req.user.sub],
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch notifications', error: String(error) });
  }
});

app.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE notifications SET readAt = COALESCE(readAt, NOW()) WHERE id = ? AND userId = ?',
      [req.params.id, req.user.sub],
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Notification not found' });
    const [rows] = await pool.query(
      'SELECT id, taskId, title, message, type, notificationDate, readAt, createdAt FROM notifications WHERE id = ? AND userId = ?',
      [req.params.id, req.user.sub],
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to mark notification as read', error: String(error) });
  }
});

app.post('/api/tasks', requireAuth, async (req, res) => {
  try {
    const { title, assignee, assigneeId, time, dueDate, priority, status, progress } = req.body;

    const assigneeName = assignee || 'Unassigned';
    let resolvedAssigneeId = assigneeId || null;

    if (!resolvedAssigneeId && assigneeName && assigneeName !== 'Unassigned') {
      const [userRows] = await pool.query('SELECT id FROM users WHERE name = ? LIMIT 1', [assigneeName]);
      if (userRows.length > 0) {
        resolvedAssigneeId = userRows[0].id;
      }
    }

    const taskDueDate = toDueDate(time || dueDate);

    const [result] = await pool.query(
      'INSERT INTO tasks (title, assigneeId, dueDate, priority, isRecurring, status, progress, createdById) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, resolvedAssigneeId, taskDueDate, (priority || 'medium').toLowerCase(), status === 'todo', status || 'todo', Number(progress || 0), req.user.sub]
    );

    const insertedId = result.insertId;

    const task = {
      id: String(insertedId),
      title: title,
      assignee: assigneeName,
      time: taskDueDate,
      status: status || 'todo',
      progress: Number(progress || 0),
      priority: (priority || 'Medium').charAt(0).toUpperCase() + (priority || 'Medium').slice(1),
    };

    await pool.query(
      'INSERT INTO task_logs (taskId, userId, logDate, status) VALUES (?, ?, CURDATE(), ?)',
      [insertedId, resolvedAssigneeId || null, status === 'done' ? 'done' : 'pending']
    );

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create task', error: String(error) });
  }
});

app.patch('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    const { title, assignee, assigneeId, time, dueDate, priority, status } = req.body;
    let resolvedAssigneeId = assigneeId || null;

    if (!resolvedAssigneeId && assignee && assignee !== 'Unassigned') {
      const [userRows] = await pool.query('SELECT id FROM users WHERE name = ? LIMIT 1', [assignee]);
      resolvedAssigneeId = userRows[0]?.id || null;
    }

    const ownership = req.user.role?.toLowerCase() === 'admin' ? '' : ' AND (assigneeId = ? OR createdById = ?)';
    const ownershipParams = req.user.role?.toLowerCase() === 'admin' ? [req.params.id] : [req.params.id, req.user.sub, req.user.sub];
    const [result] = await pool.query(
      `UPDATE tasks
       SET title = ?, assigneeId = ?, dueDate = ?, priority = ?, isRecurring = ?, status = ?, progress = ?
       WHERE id = ?${ownership}`,
      [title, resolvedAssigneeId, toDueDate(time || dueDate), (priority || 'medium').toLowerCase(), status === 'todo', status || 'todo', Number(req.body.progress ?? 0), ...ownershipParams]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({ id: String(req.params.id), title, assignee: assignee || 'Unassigned', time: time || dueDate, status, progress: Number(req.body.progress ?? 50), priority: priority || 'Medium' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update task', error: String(error) });
  }
});

app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    const ownership = req.user.role?.toLowerCase() === 'admin' ? '' : ' AND (assigneeId = ? OR createdById = ?)';
    const params = req.user.role?.toLowerCase() === 'admin' ? [req.params.id] : [req.params.id, req.user.sub, req.user.sub];
    const [result] = await pool.query(`DELETE FROM tasks WHERE id = ?${ownership}`, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete task', error: String(error) });
  }
});

const taskAccess = async (req, taskId) => {
  const isAdmin = req.user.role?.toLowerCase() === 'admin';
  const [rows] = await pool.query(
    `SELECT id FROM tasks WHERE id = ?${isAdmin ? '' : ' AND (assigneeId = ? OR createdById = ?)'}`,
    isAdmin ? [taskId] : [taskId, req.user.sub, req.user.sub],
  );
  return Boolean(rows[0]);
};

app.post('/api/tasks/:id/checklist', requireAuth, async (req, res) => {
  try {
    if (!(await taskAccess(req, req.params.id))) return res.status(404).json({ message: 'Task not found' });
    const title = String(req.body.title || '').trim();
    if (!title) return res.status(400).json({ message: 'Checklist title is required' });
    const [result] = await pool.query('INSERT INTO taskChecklistItems (taskId, title, completed) VALUES (?, ?, 0)', [req.params.id, title]);
    res.status(201).json({ id: result.insertId, title, completed: false });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add checklist item', error: String(error) });
  }
});

app.patch('/api/tasks/:taskId/checklist/:itemId', requireAuth, async (req, res) => {
  try {
    if (!(await taskAccess(req, req.params.taskId))) return res.status(404).json({ message: 'Task not found' });
    const [result] = await pool.query('UPDATE taskChecklistItems SET completed = ? WHERE id = ? AND taskId = ?', [req.body.completed ? 1 : 0, req.params.itemId, req.params.taskId]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Checklist item not found' });
    const [rows] = await pool.query('SELECT COUNT(*) AS total, SUM(completed) AS completed FROM taskChecklistItems WHERE taskId = ?', [req.params.taskId]);
    const total = Number(rows[0].total);
    const completed = Number(rows[0].completed || 0);
    const progress = total ? Math.round((completed / total) * 100) : 0;
    const status = progress === 100 ? 'done' : progress > 0 ? 'doing' : 'todo';
    await pool.query('UPDATE tasks SET status = ?, progress = ? WHERE id = ?', [status, progress, req.params.taskId]);
    res.json({ status, progress });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update checklist item', error: String(error) });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, role, departmentId, isActive FROM users ORDER BY name');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users', error: String(error) });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, u.departmentId, d.name AS departmentName, u.isActive
      FROM users u
      LEFT JOIN departments d ON d.id = u.departmentId
      WHERE u.id = ?
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user', error: String(error) });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, email, password, role = 'staff', departmentId } = req.body;
    const passwordHash = await bcrypt.hash(String(password), 12);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role, departmentId, isActive) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, passwordHash, role, departmentId || null, 1]
    );
    res.status(201).json({ id: result.insertId, name, email, role, departmentId: departmentId || null, isActive: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create user', error: String(error) });
  }
});

app.patch('/api/users/:id', async (req, res) => {
  try {
    const fields = [];
    const values = [];
    for (const field of ['name', 'email', 'role', 'departmentId', 'isActive', 'password']) {
      if (req.body[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(field === 'password' ? await bcrypt.hash(String(req.body[field]), 12) : req.body[field]);
      }
    }
    if (!fields.length) return res.status(400).json({ message: 'No user fields to update' });
    values.push(req.params.id);
    const [result] = await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    if (!result.affectedRows) return res.status(404).json({ message: 'User not found' });
    const [rows] = await pool.query('SELECT id, name, email, role, departmentId, isActive FROM users WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update user', error: String(error) });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'User not found' });
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete user', error: String(error) });
  }
});

app.get('/api/departments', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, branchId FROM departments ORDER BY name');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch departments', error: String(error) });
  }
});

app.post('/api/departments', async (req, res) => {
  try {
    const { name, branchId } = req.body;
    const [result] = await pool.query('INSERT INTO departments (name, branchId) VALUES (?, ?)', [name, branchId || null]);
    res.status(201).json({ id: result.insertId, name, branchId: branchId || null });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create department', error: String(error) });
  }
});

app.patch('/api/departments/:id', async (req, res) => {
  try {
    const [result] = await pool.query('UPDATE departments SET name = ?, branchId = ? WHERE id = ?', [req.body.name, req.body.branchId || null, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Department not found' });
    res.json({ id: Number(req.params.id), name: req.body.name, branchId: req.body.branchId || null });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update department', error: String(error) });
  }
});

app.delete('/api/departments/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM departments WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Department not found' });
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete department', error: String(error) });
  }
});

app.get('/api/kpi', requireAuth, async (req, res) => {
  try {
    const [userRows] = await pool.query('SELECT role, departmentId FROM users WHERE id = ? LIMIT 1', [req.user.sub]);
    const currentUser = userRows[0];
    const isDepartmentHead = currentUser?.role?.toLowerCase() === 'manager';
    if (isDepartmentHead && currentUser.departmentId == null) return res.json([]);
    const departmentFilter = isDepartmentHead ? 'WHERE u.departmentId = ?' : '';
    const departmentParams = isDepartmentHead ? [currentUser.departmentId] : [];
    const [rows] = await pool.query(`
      SELECT u.id, u.name, d.name AS department,
             COALESCE(ROUND(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) * 100 / NULLIF(COUNT(t.id), 0)), 0) AS score
      FROM users u
      LEFT JOIN departments d ON d.id = u.departmentId
      LEFT JOIN tasks t ON t.assigneeId = u.id
      ${departmentFilter}
      GROUP BY u.id, u.name, d.name
      ORDER BY score DESC, u.name
      LIMIT 10
    `, departmentParams);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch KPI', error: String(error) });
  }
});

app.get('/api/reports', requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user.role?.toLowerCase() === 'admin';
    const visibility = isAdmin ? '' : 'WHERE assigneeId = ? OR createdById = ?';
    const visibilityParams = isAdmin ? [] : [req.user.sub, req.user.sub];
    const [tasks] = await pool.query(`SELECT id, title, status, progress, priority, dueDate, createdAt FROM tasks ${visibility} ORDER BY createdAt DESC`, visibilityParams);
    const selected = new Date(String(req.query.date || new Date().toISOString().slice(0, 10)));
    const period = req.query.period || 'week';
    const from = new Date(selected);
    if (period === 'week') from.setDate(selected.getDate() - selected.getDay());
    if (period === 'month') from.setDate(1);
    const until = new Date(selected);
    if (period === 'week') until.setDate(from.getDate() + 6);
    if (period === 'month') until.setMonth(from.getMonth() + 1, 0);
    const inPeriod = tasks.filter((task) => {
      const date = new Date(task.dueDate || task.createdAt);
      return date >= new Date(from.toISOString().slice(0, 10)) && date <= new Date(`${until.toISOString().slice(0, 10)}T23:59:59`);
    });
    const totalTasks = inPeriod.length;
    const completedTasks = inPeriod.filter((task) => task.status === 'done').length;
    const lateTasks = inPeriod.filter((task) => task.status !== 'done' && new Date(task.dueDate) < new Date()).length;
    const avgScore = totalTasks ? Math.round(inPeriod.reduce((sum, task) => sum + Number(task.progress || 0), 0) / totalTasks) : 0;
    const byPriority = ['high', 'medium', 'low'].map((name) => {
      const group = inPeriod.filter((task) => task.priority === name);
      return { name: name.charAt(0).toUpperCase() + name.slice(1), count: group.length, progress: group.length ? Math.round(group.reduce((sum, task) => sum + Number(task.progress || 0), 0) / group.length) : 0, tone: name === 'high' ? 'red' : name === 'medium' ? 'amber' : 'green' };
    }).filter((item) => item.count);
    res.json({ data: { totalTasks, completedTasks, lateTasks, avgScore, categories: byPriority, highlights: inPeriod.slice(0, 5).map((task) => ({ name: task.title, status: task.status === 'done' ? 'Hoàn thành' : 'Đang xử lý', delta: `${Number(task.progress || 0)}%` })), chartData: totalTasks ? [{ label: period === 'day' ? 'Hôm nay' : period === 'week' ? 'Tuần này' : 'Tháng này', value: avgScore, done: completedTasks }] : [] } });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch reports', error: String(error) });
  }
});

Promise.all([migratePlaintextPasswords(), ensureChecklistTable(), ensureNotificationsTable()])
  .then(async () => {
    await createTaskReminders();
    app.listen(port, () => {
      console.log(`Backend running on http://localhost:${port}`);
    });
    setInterval(() => {
      void createTaskReminders().catch((error) => console.error('Unable to create task reminders:', error));
    }, 15 * 60 * 1000);
  })
  .catch((error) => {
    console.error('Unable to migrate user passwords:', error);
    process.exit(1);
  });
