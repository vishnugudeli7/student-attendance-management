const bcrypt = require('bcryptjs');
const db = require('./database');

function seed() {
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@school.com');
  if (existing) {
    console.log('Admin already exists:', existing.email);
    return;
  }
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
    .run('Super Admin', 'admin@school.com', hash, 'admin');
  console.log('Seeded default admin -> email: admin@school.com | password: admin123');
}

seed();
