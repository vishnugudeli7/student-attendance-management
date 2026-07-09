require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { authRequired, adminOnly } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const classRoutes = require('./routes/classes');
const studentRoutes = require('./routes/students');
const attendanceRoutes = require('./routes/attendance');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Serve the frontend (static files) so the whole app runs from one server
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes (require valid JWT)
app.use('/api/classes', authRequired, classRoutes);
app.use('/api/students', authRequired, studentRoutes);
app.use('/api/attendance', authRequired, attendanceRoutes);
app.use('/api/export', authRequired, exportRoutes);

// Admin-only: register new teacher accounts
app.post('/api/admin/register-teacher', authRequired, adminOnly, authRoutes.registerTeacherHandler);

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`\n  Attendance system backend running on http://localhost:${PORT}`);
  console.log(`  Default admin login -> admin@school.com / admin123\n`);
});
