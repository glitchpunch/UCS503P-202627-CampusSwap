// Talks to the CampusSwap server. Every call returns parsed JSON or throws ApiError.

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api(path, { method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "network", "Can't reach the CampusSwap server. Check that it is running.");
  }
  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    throw new ApiError(response.status, data?.error || "http_error", data?.message || `Request failed (${response.status}).`);
  }
  return data;
}

// Returns the logged-in user, or sends the browser to the right page.
export async function requireUser(role) {
  try {
    const me = await api("/api/auth/me");
    if (role && me.role !== role) {
      location.replace(me.role === "admin" ? "/admin.html" : "/dashboard.html");
      return new Promise(() => {});
    }
    return me;
  } catch (error) {
    if (error.status === 401) {
      location.replace("/");
      return new Promise(() => {});
    }
    throw error;
  }
}

export async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    location.replace("/");
  }
}
