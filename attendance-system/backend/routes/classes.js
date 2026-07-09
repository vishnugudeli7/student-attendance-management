const express = require('express');
const db = require('../db/database');
const { adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/classes  - list classes (teachers see only theirs, admin sees all)
router.get('/', (req, res) => {
  let rows;
  if (req.user.role === 'admin') {
    rows = db.prepare(`
      SELECT c.*, u.name as teacher_name,
        (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) as student_count
      FROM classes c LEFT JOIN users u ON c.teacher_id = u.id
      ORDER BY c.name, c.section
    `).all();
  } else {
    rows = db.prepare(`
      SELECT c.*, u.name as teacher_name,
        (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) as student_count
      FROM classes c LEFT JOIN users u ON c.teacher_id = u.id
      WHERE c.teacher_id = ?
      ORDER BY c.name, c.section
    `).all(req.user.id);
  }
  res.json(rows);
});

// POST /api/classes  - admin only
router.post('/', adminOnly, (req, res) => {
  const { name, section, teacher_id } = req.body;
  if (!name || !section) return res.status(400).json({ error: 'name and section required' });

  const result = db.prepare('INSERT INTO classes (name, section, teacher_id) VALUES (?, ?, ?)')
    .run(name, section, teacher_id || null);
  res.status(201).json({ id: Number(result.lastInsertRowid), name, section, teacher_id });
});

// PUT /api/classes/:id - admin only
router.put('/:id', adminOnly, (req, res) => {
  const { name, section, teacher_id } = req.body;
  const existing = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Class not found' });

  db.prepare('UPDATE classes SET name = ?, section = ?, teacher_id = ? WHERE id = ?')
    .run(name ?? existing.name, section ?? existing.section, teacher_id ?? existing.teacher_id, req.params.id);
  res.json({ message: 'Updated' });
});

// DELETE /api/classes/:id - admin only
router.delete('/:id', adminOnly, (req, res) => {
  db.prepare('DELETE FROM classes WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// GET /api/classes/teachers-list - for populating dropdown (admin only)
router.get('/meta/teachers', adminOnly, (req, res) => {
  const rows = db.prepare("SELECT id, name, email FROM users WHERE role = 'teacher'").all();
  res.json(rows);
});

module.exports = router;
