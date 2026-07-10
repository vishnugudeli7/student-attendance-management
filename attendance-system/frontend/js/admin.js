requireAuth();
renderTopbar();
const user = getUser();
const isAdmin = user && user.role === 'admin';

if (isAdmin) {
  document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
}

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.remove('hidden');
    if (tab.dataset.tab === 'classes') loadClasses();
    if (tab.dataset.tab === 'students') loadClassesForDropdown('student-class-select', loadStudents);
    if (tab.dataset.tab === 'reports') loadClassesForDropdown('report-class-select');
    if (tab.dataset.tab === 'teachers') loadTeachers();
  });
});

// ---------- Overview ----------
async function loadOverview() {
  try {
    const classes = await api('/classes');
    document.getElementById('stat-classes').textContent = classes.length;
    const totalStudents = classes.reduce((sum, c) => sum + c.student_count, 0);
    document.getElementById('stat-students').textContent = totalStudents;

    let presentToday = 0;
    const today = new Date().toISOString().slice(0, 10);
    for (const c of classes) {
      try {
        const report = await api(`/attendance/report?class_id=${c.id}&from=${today}&to=${today}`);
        presentToday += report.students.filter(s => s.attended > 0).length;
      } catch (e) { /* ignore classes with no sessions yet */ }
    }
    document.getElementById('stat-today').textContent = presentToday;
  } catch (err) {
    console.error(err);
  }
}
loadOverview();

// ---------- Classes ----------
async function loadClasses() {
  const tbody = document.querySelector('#classes-table tbody');
  tbody.innerHTML = '<tr><td colspan="5">Loading…</td></tr>';
  const classes = await api('/classes');
  tbody.innerHTML = '';
  if (classes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--ink-soft)">No classes yet. Add one to get started.</td></tr>';
    return;
  }
  classes.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.name}</td>
      <td class="mono">${c.section}</td>
      <td>${c.teacher_name || '<span style="color:var(--ink-soft)">Unassigned</span>'}</td>
      <td class="mono">${c.student_count}</td>
      <td>${isAdmin ? `<button class="btn danger small" onclick="deleteClass(${c.id})">Delete</button>` : ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function deleteClass(id) {
  if (!confirm('Delete this class and all its students/attendance records?')) return;
  await api(`/classes/${id}`, { method: 'DELETE' });
  loadClasses();
  loadOverview();
}

if (isAdmin) {
  api('/classes/meta/teachers').then(teachers => {
    const sel = document.getElementById('c-teacher');
    teachers.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id; opt.textContent = `${t.name} (${t.email})`;
      sel.appendChild(opt);
    });
  }).catch(() => {});

  document.getElementById('class-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('c-name').value.trim();
    const section = document.getElementById('c-section').value.trim();
    const teacher_id = document.getElementById('c-teacher').value || null;
    try {
      await api('/classes', { method: 'POST', body: JSON.stringify({ name, section, teacher_id }) });
      e.target.reset();
      loadClasses();
      loadOverview();
    } catch (err) { alert(err.message); }
  });
}

// ---------- Students ----------
async function loadClassesForDropdown(selectId, onLoaded) {
  const classes = await api('/classes');
  const sel = document.getElementById(selectId);
  const currentVal = sel.value;
  sel.innerHTML = '';
  if (classes.length === 0) {
    sel.innerHTML = '<option value="">No classes available</option>';
    return;
  }
  classes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} - ${c.section}`;
    sel.appendChild(opt);
  });
  if (currentVal) sel.value = currentVal;
  sel.onchange = () => onLoaded && onLoaded();
  if (onLoaded) onLoaded();
}

async function loadStudents() {
  const classId = document.getElementById('student-class-select').value;
  const tbody = document.querySelector('#students-table tbody');
  if (!classId) { tbody.innerHTML = ''; return; }
  tbody.innerHTML = '<tr><td colspan="3">Loading…</td></tr>';
  const students = await api(`/students?class_id=${classId}`);
  tbody.innerHTML = '';
  if (students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="color:var(--ink-soft)">No students in this class yet.</td></tr>';
    return;
  }
  students.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono">${s.roll_no}</td>
      <td>${s.name}</td>
      <td>${s.email || '<span style="color:var(--ink-soft)">—</span>'}</td>
      <td>${s.phone || '<span style="color:var(--ink-soft)">—</span>'}</td>
      <td>
        <button class="btn outline small" onclick="showQr(${s.id})">View QR</button>
        <button class="btn danger small" onclick="deleteStudent(${s.id})">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById('student-form') && document.getElementById('student-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const classId = document.getElementById('student-class-select').value;
  if (!classId) { alert('Select a class first'); return; }
  const roll_no = document.getElementById('s-roll').value.trim();
  const name = document.getElementById('s-name').value.trim();
  const email = document.getElementById('s-email').value.trim();
  const phone = document.getElementById('s-phone').value.trim();
  try {
    await api('/students', {
      method: 'POST',
      body: JSON.stringify({ roll_no, name, class_id: Number(classId), email, phone })
    });
    e.target.reset();
    loadStudents();
    loadOverview();
  } catch (err) { alert(err.message); }
});

async function showQr(studentId) {
  const data = await api(`/students/${studentId}/qrcode`);
  document.getElementById('qr-modal-name').textContent = data.name;
  document.getElementById('qr-modal-roll').textContent = `Roll No. ${data.roll_no}`;
  document.getElementById('qr-modal-img').src = data.qrImage;
  document.getElementById('qr-modal').classList.remove('hidden');
}

async function deleteStudent(studentId) {
  if (!confirm('Delete this student and all related attendance records?')) return;
  await api(`/students/${studentId}`, { method: 'DELETE' });
  loadStudents();
  loadOverview();
}

// ---------- Reports ----------
document.getElementById('run-report').addEventListener('click', runReport);
async function runReport() {
  const classId = document.getElementById('report-class-select').value;
  if (!classId) { alert('Select a class'); return; }
  const from = document.getElementById('report-from').value;
  const to = document.getElementById('report-to').value;
  let url = `/attendance/report?class_id=${classId}`;
  if (from && to) url += `&from=${from}&to=${to}`;

  try {
    const data = await api(url);
    document.getElementById('report-panel-wrap').style.display = 'block';
    document.getElementById('report-summary').textContent = `${data.total_sessions} session(s) recorded`;
    const tbody = document.querySelector('#report-table tbody');
    tbody.innerHTML = '';
    if (data.students.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No students in this class.</td></tr>';
      return;
    }
    data.students.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono">${s.roll_no}</td>
        <td>${s.name}</td>
        <td class="mono">${s.attended} / ${s.total_sessions}</td>
        <td class="mono">${s.percentage}%</td>
        <td><span class="tag ${s.is_defaulter ? 'warn' : 'ok'}">${s.is_defaulter ? 'Defaulter' : 'Good'}</span></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) { alert(err.message); }
}

document.getElementById('export-csv').addEventListener('click', () => {
  const classId = document.getElementById('report-class-select').value;
  if (!classId) { alert('Select a class'); return; }
  const from = document.getElementById('report-from').value;
  const to = document.getElementById('report-to').value;
  let url = `/api/export/attendance-csv?class_id=${classId}`;
  if (from && to) url += `&from=${from}&to=${to}`;
  fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
    .then(res => {
      if (!res.ok) return res.text().then(text => {
        try {
          const d = JSON.parse(text);
          throw new Error(d.error || text);
        } catch {
          throw new Error(text || 'Failed to export CSV');
        }
      });
      return res.blob();
    })
    .then(blob => {
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = `attendance_class_${classId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    })
    .catch(err => alert(err.message));
});

// ---------- Teachers ----------
async function loadTeachers() {
  if (!isAdmin) return;
  const teachers = await api('/classes/meta/teachers');
  const tbody = document.querySelector('#teachers-table tbody');
  tbody.innerHTML = '';
  if (teachers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="2" style="color:var(--ink-soft)">No teacher accounts yet.</td></tr>';
    return;
  }
  teachers.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${t.name}</td><td class="mono">${t.email}</td>`;
    tbody.appendChild(tr);
  });
}

document.getElementById('teacher-form') && document.getElementById('teacher-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('t-name').value.trim();
  const email = document.getElementById('t-email').value.trim();
  const password = document.getElementById('t-password').value;
  try {
    await api('/admin/register-teacher', { method: 'POST', body: JSON.stringify({ name, email, password }) });
    e.target.reset();
    loadTeachers();
  } catch (err) { alert(err.message); }
});
