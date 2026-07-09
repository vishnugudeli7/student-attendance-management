const express = require('express');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const db = require('../db/database');
const { adminOnly } = require('../middleware/auth');

const router = express.Router();

function canAccessClass(req, classId) {
  if (req.user.role === 'admin') return true;
  const cls = db.prepare('SELECT teacher_id FROM classes WHERE id = ?').get(classId);
  return cls && cls.teacher_id === req.user.id;
}

// GET /api/students?class_id=1
router.get('/', (req, res) => {
  const { class_id } = req.query;
  if (!class_id) return res.status(400).json({ error: 'class_id query param required' });
  if (!canAccessClass(req, class_id)) return res.status(403).json({ error: 'Not authorized for this class' });

  const rows = db.prepare('SELECT id, roll_no, name, class_id, email, phone, qr_token FROM students WHERE class_id = ? ORDER BY roll_no').all(class_id);
  res.json(rows);
});

// POST /api/students - admin only, creates student + unique QR token
router.post('/', adminOnly, (req, res) => {
  const { roll_no, name, class_id, email, phone } = req.body;
  if (!roll_no || !name || !class_id) {
    return res.status(400).json({ error: 'roll_no, name, class_id are required' });
  }
  const qr_token = uuidv4();
  const result = db.prepare(
    'INSERT INTO students (roll_no, name, class_id, qr_token, email, phone) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(roll_no, name, class_id, qr_token, email || null, phone || null);

  res.status(201).json({
    id: Number(result.lastInsertRowid),
    roll_no, name, class_id, qr_token, email, phone
  });
});

// GET /api/students/:id/qrcode - returns QR code as PNG data URL
router.get('/:id/qrcode', async (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (!canAccessClass(req, student.class_id)) return res.status(403).json({ error: 'Not authorized' });

  try {
    const dataUrl = await QRCode.toDataURL(student.qr_token, { width: 300, margin: 2 });
    res.json({ student_id: student.id, name: student.name, roll_no: student.roll_no, qrImage: dataUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// PUT /api/students/:id - admin only
router.put('/:id', adminOnly, (req, res) => {
  const { roll_no, name, email, phone } = req.body;
  const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Student not found' });

  db.prepare('UPDATE students SET roll_no = ?, name = ?, email = ?, phone = ? WHERE id = ?')
    .run(roll_no ?? existing.roll_no, name ?? existing.name, email ?? existing.email, phone ?? existing.phone, req.params.id);
  res.json({ message: 'Updated' });
});

// DELETE /api/students/:id - admin only
router.delete('/:id', adminOnly, (req, res) => {
  db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// POST /api/students/:id/regenerate-qr - admin only, invalidates old QR (e.g. lost ID card)
router.post('/:id/regenerate-qr', adminOnly, (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const newToken = uuidv4();
  db.prepare('UPDATE students SET qr_token = ? WHERE id = ?').run(newToken, req.params.id);
  res.json({ message: 'QR token regenerated', qr_token: newToken });
});

module.exports = router;
