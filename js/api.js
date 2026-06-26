/*
  MYCSONLINE V7.1 SUPABASE BRIDGE
  This keeps your existing V6 UI working but replaces Google Apps Script with Supabase.
*/

const API = (() => {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json"
  };

  const cachePrefix = "mycs_v7_bridge_";

  function cacheKey(action, params = {}) {
    return cachePrefix + action + "_" + JSON.stringify(params);
  }

  function getCache(action, params = {}, minutes = 5) {
    try {
      const raw = localStorage.getItem(cacheKey(action, params));
      if (!raw) return null;
      const item = JSON.parse(raw);
      if (Date.now() - item.time > minutes * 60 * 1000) return null;
      return item.data;
    } catch {
      return null;
    }
  }

  function setCache(action, params, data) {
    try {
      localStorage.setItem(cacheKey(action, params), JSON.stringify({ time: Date.now(), data }));
    } catch {}
  }

  function clearCache() {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(cachePrefix) || k.startsWith("mycs_v67_cache_") || k.startsWith("mycs_v6_cache_")) {
        localStorage.removeItem(k);
      }
    });
  }

  async function request(path, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) }
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Supabase request failed");
    }

    if (res.status === 204) return null;
    return res.json();
  }

  async function select(table, query = "select=*") {
    return request(`${table}?${query}`);
  }

  async function insert(table, data) {
    return request(table, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(data)
    });
  }

  async function update(table, query, data) {
    return request(`${table}?${query}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(data)
    });
  }

  async function remove(table, query) {
    return request(`${table}?${query}`, { method: "DELETE" });
  }

  function oldStudent(s) {
    return {
      Email: s.email,
      Name: s.name,
      Status: s.status,
      LastLogin: s.last_login,
      id: s.id
    };
  }

  function oldCourse(c) {
    return {
      CourseID: c.id,
      "Course Name": c.title,
      Category: c.category || "Course",
      Description: c.description || "",
      id: c.id
    };
  }

  function oldModule(m) {
    return {
      ModuleID: m.id,
      CourseID: m.course_id,
      "Module Name": m.title,
      Description: m.description || "",
      Order: m.sort_order || 0,
      id: m.id
    };
  }

  function oldVideo(v) {
    return {
      VideoID: v.id,
      ModuleID: v.module_id,
      Title: v.title,
      "Embed Link": v.drive_link,
      Order: v.sort_order || 0,
      id: v.id
    };
  }

  function oldNote(r) {
    return {
      NoteID: r.id,
      ModuleID: r.module_id,
      Title: r.title,
      Type: r.type || "Resource",
      Link: r.link,
      id: r.id
    };
  }

  function oldAccess(a) {
    return {
      Email: a.students?.email || a.email || "",
      CourseID: a.course_id,
      id: a.id
    };
  }

  function oldProgress(p) {
    return {
      Email: p.students?.email || "",
      CourseID: p.course_id,
      ModuleID: p.module_id,
      VideoID: p.video_id,
      Completed: p.completed,
      WatchPercent: p.watch_percent,
      LastWatchedAt: p.last_watched_at,
      id: p.id
    };
  }

  function oldActivity(a) {
    return {
      Timestamp: a.created_at,
      Email: a.students?.email || "",
      CourseID: a.course_id,
      ModuleID: a.module_id,
      VideoID: a.video_id,
      Action: a.action,
      Details: a.details,
      id: a.id
    };
  }

  async function getAdminAnalytics() {
    const [students, courses, modules, videos, notes, access, progress, activity] = await Promise.all([
      select("students", "select=*"),
      select("courses", "select=*"),
      select("modules", "select=*"),
      select("videos", "select=*"),
      select("resources", "select=*"),
      select("access", "select=id,course_id,students(email)"),
      select("progress", "select=*,students(email)"),
      select("activity", "select=*,students(email)&order=created_at.desc&limit=100")
    ]);

    return {
      success: true,
      students: students.map(oldStudent),
      courses: courses.map(oldCourse),
      modules: modules.map(oldModule),
      videos: videos.map(oldVideo),
      notes: notes.map(oldNote),
      access: access.map(oldAccess),
      progress: progress.map(oldProgress),
      activity: activity.map(oldActivity),
      lastLogin: students.map(s => ({
        Email: s.email,
        Name: s.name,
        LastLoginAt: s.last_login,
        UserAgent: "Supabase"
      })),
      serverVersion: "V7.1 Supabase Bridge"
    };
  }

  async function studentLogin(email) {
    email = String(email || "").toLowerCase().trim();

    const students = await select(
      "students",
      `select=*&email=eq.${encodeURIComponent(email)}&status=eq.Active&limit=1`
    );

    if (!students.length) {
      return { success: false, message: "Access Not Allowed. Please Contact Administrator." };
    }

    const student = students[0];

    await update("students", `id=eq.${student.id}`, { last_login: new Date().toISOString() });

    const access = await select(
      "access",
      `select=course_id,courses(*),students(email)&student_id=eq.${student.id}`
    );

    const courseIds = access.map(a => a.course_id);
    const courseFilter = courseIds.length ? `course_id=in.(${courseIds.join(",")})` : "course_id=eq.none";

    const modules = courseIds.length
      ? await select("modules", `select=*&${courseFilter}&order=sort_order.asc`)
      : [];

    const moduleIds = modules.map(m => m.id);
    const videos = moduleIds.length
      ? await select("videos", `select=*&module_id=in.(${moduleIds.join(",")})&order=sort_order.asc`)
      : [];

    const notes = moduleIds.length
      ? await select("resources", `select=*&module_id=in.(${moduleIds.join(",")})`)
      : [];

    const progress = await select(
      "progress",
      `select=*,students(email)&student_id=eq.${student.id}`
    );

    const activity = await select(
      "activity",
      `select=*,students(email)&student_id=eq.${student.id}&order=created_at.desc&limit=50`
    );

    return {
      success: true,
      student: oldStudent(student),
      courses: access.map(a => oldCourse(a.courses)),
      modules: modules.map(oldModule),
      videos: videos.map(oldVideo),
      notes: notes.map(oldNote),
      access: courseIds,
      progress: progress.map(oldProgress),
      activity: activity.map(oldActivity),
      serverVersion: "V7.1 Supabase Bridge"
    };
  }

  async function get(action, params = {}, options = {}) {
    if (options.cache !== false) {
      const cached = getCache(action, params, MYCS_CACHE_MINUTES || 10);
      if (cached) return cached;
    }

    let data;

    if (action === "getAdminAnalytics" || action === "getData") {
      data = await getAdminAnalytics();
    } else if (action === "studentLogin" || action === "fastStudentData") {
      data = await studentLogin(params.email);
    } else if (action === "ping") {
      data = { success: true, version: "V7.1 Supabase Bridge" };
    } else {
      data = { success: false, message: "Invalid action: " + action };
    }

    if (options.cache !== false) setCache(action, params, data);
    return data;
  }

  async function post(action, body = {}) {
    clearCache();

    if (action === "adminLogin") {
      const admins = await select(
        "admins",
        `select=*&username=eq.${encodeURIComponent(body.username)}&password=eq.${encodeURIComponent(body.password)}&limit=1`
      );
      return admins.length ? { success: true } : { success: false, message: "Invalid User ID or Password." };
    }

    if (action === "addCourse") {
      await insert("courses", {
        title: body.courseName || body.title,
        category: body.category || "Course",
        description: body.description || ""
      });
      return { success: true };
    }

    if (action === "updateCourse") {
      await update("courses", `id=eq.${body.courseId}`, {
        title: body.courseName || body.title,
        category: body.category || "Course",
        description: body.description || ""
      });
      return { success: true };
    }

    if (action === "deleteCourse") {
      await remove("courses", `id=eq.${body.courseId}`);
      return { success: true };
    }

    if (action === "addModule") {
      await insert("modules", {
        course_id: body.courseId,
        title: body.moduleName || body.title,
        description: body.description || "",
        sort_order: Number(body.order || 0)
      });
      return { success: true };
    }

    if (action === "updateModule") {
      await update("modules", `id=eq.${body.moduleId}`, {
        course_id: body.courseId,
        title: body.moduleName || body.title,
        description: body.description || "",
        sort_order: Number(body.order || 0)
      });
      return { success: true };
    }

    if (action === "deleteModule") {
      await remove("modules", `id=eq.${body.moduleId}`);
      return { success: true };
    }

    if (action === "addVideo") {
      await insert("videos", {
        module_id: body.moduleId,
        title: body.title,
        drive_link: body.embedLink || body.link,
        sort_order: Number(body.order || 0)
      });
      return { success: true };
    }

    if (action === "updateVideo") {
      await update("videos", `id=eq.${body.videoId}`, {
        module_id: body.moduleId,
        title: body.title,
        drive_link: body.embedLink || body.link,
        sort_order: Number(body.order || 0)
      });
      return { success: true };
    }

    if (action === "deleteVideo") {
      await remove("videos", `id=eq.${body.videoId}`);
      return { success: true };
    }

    if (action === "addNote") {
      await insert("resources", {
        module_id: body.moduleId,
        title: body.title,
        type: body.type || "Resource",
        link: body.link
      });
      return { success: true };
    }

    if (action === "addStudent") {
      await insert("students", {
        name: body.name,
        email: String(body.email || "").toLowerCase().trim(),
        status: body.status || "Active"
      });
      return { success: true };
    }

    if (action === "updateStudent") {
      const oldEmail = String(body.oldEmail || body.email || "").toLowerCase().trim();
      const students = await select("students", `select=*&email=eq.${encodeURIComponent(oldEmail)}&limit=1`);
      if (!students.length) return { success: false, message: "Student not found" };

      await update("students", `id=eq.${students[0].id}`, {
        name: body.name,
        email: String(body.email || "").toLowerCase().trim(),
        status: body.status || "Active"
      });
      return { success: true };
    }

    if (action === "deleteStudent") {
      const email = String(body.email || "").toLowerCase().trim();
      const students = await select("students", `select=id&email=eq.${encodeURIComponent(email)}&limit=1`);
      if (students.length) await remove("students", `id=eq.${students[0].id}`);
      return { success: true };
    }

    if (action === "setStudentStatus") {
      const email = String(body.email || "").toLowerCase().trim();
      const students = await select("students", `select=id&email=eq.${encodeURIComponent(email)}&limit=1`);
      if (students.length) await update("students", `id=eq.${students[0].id}`, { status: body.status || "Active" });
      return { success: true };
    }

    if (action === "grantAccess") {
      const email = String(body.email || "").toLowerCase().trim();
      const students = await select("students", `select=id&email=eq.${encodeURIComponent(email)}&limit=1`);
      if (!students.length) return { success: false, message: "Student not found" };

      await insert("access", {
        student_id: students[0].id,
        course_id: body.courseId
      });

      return { success: true };
    }

    if (action === "removeAccess") {
      const email = String(body.email || "").toLowerCase().trim();
      const students = await select("students", `select=id&email=eq.${encodeURIComponent(email)}&limit=1`);
      if (students.length) {
        await remove("access", `student_id=eq.${students[0].id}&course_id=eq.${body.courseId}`);
      }
      return { success: true };
    }

    if (action === "saveProgress") {
      const email = String(body.email || "").toLowerCase().trim();
      const students = await select("students", `select=id&email=eq.${encodeURIComponent(email)}&limit=1`);
      if (!students.length) return { success: false, message: "Student not found" };

      const studentId = students[0].id;

      const existing = await select(
        "progress",
        `select=id&student_id=eq.${studentId}&video_id=eq.${body.videoId}&limit=1`
      );

      const data = {
        student_id: studentId,
        course_id: body.courseId,
        module_id: body.moduleId,
        video_id: body.videoId,
        completed: !!body.completed,
        watch_percent: Number(body.watchPercent || (body.completed ? 100 : 0)),
        last_watched_at: new Date().toISOString()
      };

      if (existing.length) await update("progress", `id=eq.${existing[0].id}`, data);
      else await insert("progress", data);

      await insert("activity", {
        student_id: studentId,
        course_id: body.courseId,
        module_id: body.moduleId,
        video_id: body.videoId,
        action: body.completed ? "completed" : "watched",
        details: String(data.watch_percent) + "%"
      });

      return { success: true };
    }

    return { success: false, message: "Invalid POST action: " + action };
  }

  async function backgroundRefreshStudent(email) {
    const data = await studentLogin(email);
    if (data.success) {
      localStorage.setItem("mycs_v6_student_data", JSON.stringify({
        student: data.student,
        courses: normalizeCloudData(data),
        progress: data.progress || [],
        activity: data.activity || [],
        email,
        loadedAt: new Date().toISOString()
      }));
    }
    return data;
  }

  return { get, post, clearCache, backgroundRefreshStudent };
})();
