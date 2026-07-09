const express = require('express');
const db = require('../db/database');

const router = express.Router();

function canAccessClass(req, classId) {
  if (req.user.role === 'admin') return true;
  const cls = db.prepare('SELECT teacher_id FROM classes WHERE id = ?').get(classId);
  return cls && cls.teacher_id === req.user.id;
}

// POST /api/attendance/sessions - start/open a session for scanning (e.g. today's Period 1)
router.post('/sessions', (req, res) => {
  const { class_id, session_date, period_name } = req.body;
  if (!class_id || !session_date) {
    return res.status(400).json({ error: 'class_id and session_date required' });
  }
  if (!canAccessClass(req, class_id)) return res.status(403).json({ error: 'Not authorized for this class' });

  // Reuse existing session for same class/date/period instead of duplicating
  let session = db.prepare(
    'SELECT * FROM sessions WHERE class_id = ? AND session_date = ? AND period_name = ?'
  ).get(class_id, session_date, period_name || 'General');

  if (!session) {
    const result = db.prepare(
      'INSERT INTO sessions (class_id, session_date, period_name, created_by) VALUES (?, ?, ?, ?)'
    ).run(class_id, session_date, period_name || 'General', req.user.id);
    session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(result.lastInsertRowid);
  }

  res.status(201).json(session);
});

// POST /api/attendance/scan - the core scan endpoint
// body: { session_id, qr_token }
router.post('/scan', (req, res) => {
  const { session_id, qr_token } = req.body;
  if (!session_id || !qr_token) {
    return res.status(400).json({ error: 'session_id and qr_token required' });
  }

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(session_id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!canAccessClass(req, session.class_id)) return res.status(403).json({ error: 'Not authorized for this session' });

  const student = db.prepare('SELECT * FROM students WHERE qr_token = ?').get(qr_token);
  if (!student) return res.status(404).json({ error: 'Invalid QR code - student not recognized' });

  if (student.class_id !== session.class_id) {
    return res.status(400).json({
      error: `${student.name} belongs to a different class, not this session's class`
    });
  }

  // Check duplicate scan
  const existing = db.prepare(
    'SELECT * FROM attendance WHERE session_id = ? AND student_id = ?'
  ).get(session_id, student.id);

  if (existing) {
    return res.status(200).json({
      status: 'duplicate',
      message: `${student.name} (Roll ${student.roll_no}) already marked present at ${existing.scanned_at}`,
      student: { id: student.id, name: student.name, roll_no: student.roll_no }
    });
  }

  db.prepare('INSERT INTO attendance (session_id, student_id, status) VALUES (?, ?, ?)')
    .run(session_id, student.id, 'present');

  res.status(201).json({
    status: 'marked',
    message: `${student.name} (Roll ${student.roll_no}) marked present`,
    student: { id: student.id, name: student.name, roll_no: student.roll_no }
  });
});

// GET /api/attendance/sessions/:id - view attendance for a session (who's present/absent)
router.get('/sessions/:id', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!canAccessClass(req, session.class_id)) return res.status(403).json({ error: 'Not authorized' });

  const allStudents = db.prepare('SELECT id, roll_no, name FROM students WHERE class_id = ? ORDER BY roll_no').all(session.class_id);
  const present = db.prepare('SELECT student_id, scanned_at FROM attendance WHERE session_id = ?').all(req.params.id);
  const presentMap = new Map(present.map(p => [p.student_id, p.scanned_at]));

  const roster = allStudents.map(s => ({
    ...s,
    status: presentMap.has(s.id) ? 'present' : 'absent',
    scanned_at: presentMap.get(s.id) || null
  }));

  res.json({ session, roster, present_count: present.length, total: allStudents.length });
});

// GET /api/attendance/report?class_id=1&from=2026-01-01&to=2026-01-31
router.get('/report', (req, res) => {
  const { class_id, from, to } = req.query;
  if (!class_id) return res.status(400).json({ error: 'class_id required' });
  if (!canAccessClass(req, class_id)) return res.status(403).json({ error: 'Not authorized' });

  const dateFilter = from && to ? 'AND s.session_date BETWEEN ? AND ?' : '';
  const params = from && to ? [class_id, from, to] : [class_id];

  const sessions = db.prepare(
    `SELECT id FROM sessions s WHERE s.class_id = ? ${dateFilter}`
  ).all(...params);
  const totalSessions = sessions.length;

  const students = db.prepare('SELECT id, roll_no, name FROM students WHERE class_id = ? ORDER BY roll_no').all(class_id);

  const report = students.map(st => {
    const attended = db.prepare(`
      SELECT COUNT(*) as cnt FROM attendance a
      JOIN sessions s ON a.session_id = s.id
      WHERE a.student_id = ? AND s.class_id = ? ${dateFilter}
    `).get(st.id, class_id, ...(from && to ? [from, to] : []));

    const percentage = totalSessions > 0 ? Math.round((attended.cnt / totalSessions) * 100) : 0;
    return {
      ...st,
      attended: attended.cnt,
      total_sessions: totalSessions,
      percentage,
      is_defaulter: percentage < 75
    };
  });

  res.json({ total_sessions: totalSessions, students: report });
});

module.exports = router;
