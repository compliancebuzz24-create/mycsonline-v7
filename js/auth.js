function setSession(data) {
  localStorage.setItem("mycs_v7_session", JSON.stringify(data));
}

function getSession() {
  try { return JSON.parse(localStorage.getItem("mycs_v7_session")); }
  catch { return null; }
}

function logout() {
  localStorage.removeItem("mycs_v7_session");
  location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", () => {
  const studentForm = document.getElementById("studentLoginForm");
  if (studentForm) studentForm.addEventListener("submit", studentLogin);

  const adminForm = document.getElementById("adminLoginForm");
  if (adminForm) adminForm.addEventListener("submit", adminLogin);
});

async function studentLogin(e) {
  e.preventDefault();
  const email = document.getElementById("studentEmail").value.trim().toLowerCase();
  const msg = document.getElementById("loginMessage");
  msg.textContent = "Checking Supabase access...";

  try {
    const students = await MYCS.select(
      "students",
      `select=*&email=eq.${encodeURIComponent(email)}&status=eq.Active&limit=1`
    );

    if (!students.length) {
      msg.textContent = "Access not allowed. Please contact admin.";
      msg.className = "message error";
      return;
    }

    const student = students[0];

    await MYCS.update(
      "students",
      `id=eq.${student.id}`,
      { last_login: new Date().toISOString() }
    );

    setSession({ role: "student", student });
    location.href = "dashboard.html";
  } catch (err) {
    msg.textContent = err.message;
    msg.className = "message error";
  }
}

async function adminLogin(e) {
  e.preventDefault();
  const username = document.getElementById("adminUser").value.trim();
  const password = document.getElementById("adminPass").value.trim();
  const msg = document.getElementById("adminMessage");
  msg.textContent = "Checking admin access...";

  try {
    const admins = await MYCS.select(
      "admins",
      `select=*&username=eq.${encodeURIComponent(username)}&password=eq.${encodeURIComponent(password)}&limit=1`
    );

    if (!admins.length) {
      msg.textContent = "Invalid admin login.";
      msg.className = "message error";
      return;
    }

    setSession({ role: "admin", admin: admins[0] });
    location.href = "admin-dashboard.html";
  } catch (err) {
    msg.textContent = err.message;
    msg.className = "message error";
  }
}
