const express = require('express');
const { Parser } = require('json2csv');
const db = require('../db/database');

const router = express.Router();

function canAccessClass(req, classId) {
  if (req.user.role === 'admin') return true;
  const cls = db.prepare('SELECT teacher_id FROM classes WHERE id = ?').get(classId);
  return cls && cls.teacher_id === req.user.id;
}

// GET /api/export/attendance-csv?class_id=1&from=&to=
router.get('/attendance-csv', (req, res) => {
  const { class_id, from, to } = req.query;
  if (!class_id) return res.status(400).json({ error: 'class_id required' });
  if (!canAccessClass(req, class_id)) return res.status(403).json({ error: 'Not authorized' });

  const dateFilter = from && to ? 'AND s.session_date BETWEEN ? AND ?' : '';
  const params = from && to ? [class_id, from, to] : [class_id];

  const rows = db.prepare(`
    SELECT st.roll_no, st.name, s.session_date, s.period_name,
           CASE WHEN a.id IS NULL THEN 'Absent' ELSE 'Present' END as status,
           a.scanned_at
    FROM students st
    CROSS JOIN sessions s ON s.class_id = st.class_id ${dateFilter}
    LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = st.id
    WHERE st.class_id = ?
    ORDER BY st.roll_no, s.session_date
  `).all(...params, class_id);

  if (rows.length === 0) {
    return res.status(404).json({ error: 'No attendance data found for this class/date range' });
  }

  const fields = ['roll_no', 'name', 'session_date', 'period_name', 'status', 'scanned_at'];
  const parser = new Parser({ fields });
  const csv = parser.parse(rows);

  res.header('Content-Type', 'text/csv');
  res.attachment(`attendance_class_${class_id}.csv`);
  res.send(csv);
});

module.exports = router;
