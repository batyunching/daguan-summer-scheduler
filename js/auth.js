(function (global) {
  const SESSION_KEY = "daguanSchedulerSession";

  function hashPassword(password) {
    let hash = 2166136261;
    for (const char of String(password || "")) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function sanitizeUser(user) {
    if (!user) return null;
    const { passwordHash, ...safeUser } = user;
    return {
      ...safeUser,
      role: normalizeRole(safeUser.role),
    };
  }

  function normalizeRole(value) {
    const text = String(value || "").trim().toLowerCase();
    if (["admin", "administrator", "管理者", "教務處"].includes(text)) return "admin";
    if (["teacher", "教師", "老師"].includes(text)) return "teacher";
    return text;
  }

  function findLocalUser(data, email, passwordHash) {
    return (data.users || []).find(
      (user) =>
        String(user.email).toLowerCase() === String(email).toLowerCase() &&
        user.passwordHash === passwordHash &&
        user.isActive !== false
    );
  }

  function saveSession(user) {
    const session = {
      ...sanitizeUser(user),
      loginAt: new Date().toISOString(),
    };
    global.DgConfig.storage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function getSession() {
    try {
      return JSON.parse(global.DgConfig.storage.getItem(SESSION_KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  function logout() {
    global.DgConfig.storage.removeItem(SESSION_KEY);
  }

  async function login(email, password, data) {
    const passwordHash = hashPassword(password);
    let remoteError = null;

    if (global.DgApi.hasRemote()) {
      try {
        const user = await global.DgApi.login(email, passwordHash);
        return saveSession(user);
      } catch (error) {
        remoteError = error;
      }
    }

    const localUser = findLocalUser(data, email, passwordHash);
    if (!localUser) {
      const suffix = remoteError ? `（遠端驗證訊息：${remoteError.message}）` : "";
      throw new Error(`帳號或密碼不正確${suffix}`);
    }
    return saveSession(localUser);
  }

  function isAdmin(user) {
    return user && user.role === "admin";
  }

  function canEdit(user) {
    return isAdmin(user);
  }

  global.DgAuth = {
    hashPassword,
    normalizeRole,
    login,
    logout,
    getSession,
    isAdmin,
    canEdit,
    demoAccounts: {
      admin: { email: "admin@daguan.ntpc.edu.tw", password: "admin123" },
      teacher: { email: "teacher@daguan.ntpc.edu.tw", password: "teacher123" },
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
