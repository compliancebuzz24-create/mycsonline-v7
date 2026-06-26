const MYCS = (() => {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json"
  };

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
    return request(`${table}?${query}`, {
      method: "DELETE"
    });
  }

  async function testConnection() {
    try {
      await select("admins", "select=id&limit=1");
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  return { request, select, insert, update, remove, testConnection };
})();
