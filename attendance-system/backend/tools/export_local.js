const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const db = require('../db/database');

// Usage: node tools/export_local.js <class_id> [from] [to] [out.csv]
const [,, classId, from, to, outFile] = process.argv;
if (!classId) {
  console.error('Usage: node tools/export_local.js <class_id> [from] [to] [out.csv]');
  process.exit(1);
}

const dateFilter = (from && to) ? 'AND s.session_date BETWEEN ? AND ?' : '';
const params = (from && to) ? [classId, from, to] : [classId];

const rows = db.prepare(`
  SELECT st.roll_no, st.name, s.session_date, s.period_name,
         CASE WHEN a.id IS NULL THEN 'Absent' ELSE 'Present' END as status,
         a.scanned_at
  FROM students st
  CROSS JOIN sessions s ON s.class_id = st.class_id ${dateFilter}
  LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = st.id
  WHERE st.class_id = ?
  ORDER BY st.roll_no, s.session_date
`).all(...params, classId);

const fields = ['roll_no', 'name', 'session_date', 'period_name', 'status', 'scanned_at'];
const parser = new Parser({ fields });
const csv = rows.length === 0 ? fields.join(',') + '\n' : parser.parse(rows);

const outPath = outFile ? path.resolve(outFile) : path.resolve(`attendance_class_${classId}.csv`);
fs.writeFileSync(outPath, csv);
console.log('Wrote CSV to', outPath);
