document.addEventListener("DOMContentLoaded", loadAdminDashboard);

async function loadAdminDashboard() {
  const session = getSession();
  if (!session || session.role !== "admin") {
    location.href = "admin.html";
    return;
  }

  try {
    const [students, courses, modules, videos] = await Promise.all([
      MYCS.select("students", "select=id"),
      MYCS.select("courses", "select=id"),
      MYCS.select("modules", "select=id"),
      MYCS.select("videos", "select=id")
    ]);

    document.getElementById("studentCount").textContent = students.length;
    document.getElementById("adminCourseCount").textContent = courses.length;
    document.getElementById("moduleCount").textContent = modules.length;
    document.getElementById("videoCount").textContent = videos.length;

    document.getElementById("adminStatus").textContent =
      "Supabase connected successfully.\nV7.1 foundation is working.";
  } catch (err) {
    document.getElementById("adminStatus").textContent = err.message;
  }
}
