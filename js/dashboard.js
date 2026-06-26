document.addEventListener("DOMContentLoaded", loadStudentDashboard);

async function loadStudentDashboard() {
  const session = getSession();
  if (!session || session.role !== "student") {
    location.href = "login.html";
    return;
  }

  document.getElementById("welcomeName").textContent = "Good day, " + session.student.name;
  document.getElementById("studentStatus").textContent = session.student.status;

  const access = await MYCS.select(
    "access",
    `select=course_id,courses(id,title,category,description)&student_id=eq.${session.student.id}`
  );

  document.getElementById("courseCount").textContent = access.length;

  const box = document.getElementById("courseList");
  if (!access.length) {
    box.innerHTML = `<div class="empty">No course assigned yet.</div>`;
    return;
  }

  box.innerHTML = access.map(a => `
    <div class="course-card">
      <small>${a.courses.category || "Course"}</small>
      <h3>${a.courses.title}</h3>
      <p>${a.courses.description || ""}</p>
      <button class="btn btn-primary">Open Course</button>
    </div>
  `).join("");
}

function refreshDashboard() {
  loadStudentDashboard();
}
