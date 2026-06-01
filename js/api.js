(function (global) {
  const tableKeyMap = {
    System_Settings: "systemSettings",
    Users: "users",
    Teacher_Settings: "teachers",
    Class_Settings: "classes",
    Course_Quota: "courseQuotas",
    Room_Settings: "rooms",
    Social_Assignment: "socialAssignments",
    Pre_Assignments: "preAssignments",
    Schedule_Versions: "versions",
    Change_Log: "changeLog",
  };

  function sheetNameCandidates(sheetName) {
    const localized = global.DgConfig.sheetLabels[sheetName];
    return localized && localized !== sheetName ? [localized, sheetName] : [sheetName];
  }

  function normalizeRow(row) {
    const next = {};
    Object.entries(row || {}).forEach(([key, value]) => {
      const internalKey = global.DgConfig.fieldKeys[key] || key;
      next[internalKey] = value;
    });
    return next;
  }

  function hasRemote() {
    return Boolean(global.DgConfig.getApiUrl());
  }

  async function request(action, payload) {
    const apiUrl = global.DgConfig.getApiUrl();
    if (!apiUrl) {
      throw new Error("尚未設定 GAS Web App URL");
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...(payload || {}) }),
    });

    if (!response.ok) {
      throw new Error(`GAS API 回應異常：${response.status}`);
    }

    const result = await response.json();
    if (!result.ok) {
      throw new Error(result.message || "GAS API 執行失敗");
    }
    return result.data;
  }

  function splitList(value) {
    if (Array.isArray(value)) return value;
    return String(value || "")
      .split(/[,\u3001;；\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function splitClassList(value) {
    const items = splitList(value).map(asText).filter(Boolean);
    if (items.length === 1 && /^\d{6,}$/.test(items[0]) && items[0].length % 3 === 0) {
      return items[0].match(/\d{3}/g) || items;
    }
    return items;
  }

  function parseBool(value) {
    if (typeof value === "boolean") return value;
    const text = String(value || "").trim().toLowerCase();
    return ["true", "1", "y", "yes", "是", "啟用"].includes(text);
  }

  function normalizeRole(value) {
    const text = String(value || "").trim().toLowerCase();
    if (["admin", "administrator", "管理者", "教務處"].includes(text)) return "admin";
    if (["teacher", "教師", "老師"].includes(text)) return "teacher";
    return text;
  }

  function normalizeTeacherPosition(value) {
    const text = String(value || "").trim();
    if (text === "組長") return "組長";
    if (text === "導師") return "導師";
    if (text === "專任") return "專任";
    return "專任";
  }

  function parseDay(value) {
    const text = asText(value).replace(/[星期週周禮拜]/g, "");
    const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5 };
    if (map[text]) return map[text];
    const number = Number(text);
    return Number.isFinite(number) && number >= 1 && number <= 5 ? number : 0;
  }

  function parseDayList(value) {
    return Array.from(new Set(splitList(value).map(parseDay).filter(Boolean))).sort((a, b) => a - b);
  }

  function parseNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function asText(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  function normalizeTables(tables) {
    const data = global.DgConfig.cloneMockData();
    Object.entries(tableKeyMap).forEach(([sheetName, key]) => {
      const rows = sheetNameCandidates(sheetName)
        .map((candidate) => tables[candidate])
        .find((candidateRows) => Array.isArray(candidateRows));
      if (rows) data[key] = rows.map(normalizeRow);
    });

    data.users = data.users.map((row) => ({
      ...row,
      userId: asText(row.userId),
      email: asText(row.email),
      role: normalizeRole(row.role),
      teacherId: asText(row.teacherId),
      passwordHash: asText(row.passwordHash),
      isActive: parseBool(row.isActive),
    }));

    data.teachers = data.teachers.map((row) => ({
      ...row,
      teacherId: asText(row.teacherId),
      teacherName: asText(row.teacherName),
      subjectGroup: asText(row.subjectGroup),
      subjects: splitList(row.subjects),
      assignedClasses: splitClassList(row.assignedClasses),
      teacherPosition: normalizeTeacherPosition(row.teacherPosition),
      availableDays: parseDayList(row.availableDays),
      availableWeeks: splitList(row.availableWeeks).map((week) => parseNumber(week, 0)).filter(Boolean),
      maxWeeklyPeriods: parseNumber(row.maxWeeklyPeriods, 20),
    }));

    data.classes = data.classes.map((row) => ({
      ...row,
      classId: asText(row.classId),
      grade: String(row.grade || ""),
      className: asText(row.className || row.classId),
      socialMode: row.socialMode || "auto",
    }));

    data.courseQuotas = data.courseQuotas.map((row) => ({
      ...row,
      grade: String(row.grade || ""),
      targetPeriods: parseNumber(row.targetPeriods, 0),
      doublePeriodRequired: parseBool(row.doublePeriodRequired),
      roomNeedCount: parseNumber(row.roomNeedCount, 1),
    }));

    data.rooms = data.rooms.map((row) => ({
      ...row,
      capacityCount: parseNumber(row.capacityCount, 0),
    }));

    data.preAssignments = data.preAssignments.map((row) => ({
      ...row,
      week: parseNumber(row.week, 1),
      day: parseNumber(row.day, 1),
      slotStart: parseNumber(row.slotStart, 1),
      classId: asText(row.classId),
      teacherId: asText(row.teacherId),
      isLocked: parseBool(row.isLocked),
    }));

    data.socialAssignments = data.socialAssignments.map((row) => ({
      ...row,
      classId: asText(row.classId),
      teacherA: asText(row.teacherA),
      teacherB: asText(row.teacherB),
    }));

    return data;
  }

  async function readAllTables() {
    if (!hasRemote()) {
      return global.DgConfig.cloneMockData();
    }
    const sheetNames = Object.keys(global.DgConfig.sheetSchemas).flatMap(sheetNameCandidates);
    const tables = await request("readAllTables", { sheetNames });
    return normalizeTables(tables || {});
  }

  async function readTable(sheetName) {
    if (!hasRemote()) {
      const data = global.DgConfig.cloneMockData();
      return data[tableKeyMap[sheetName]] || [];
    }
    return request("readTable", { sheetName: global.DgConfig.sheetLabels[sheetName] || sheetName });
  }

  async function login(email, passwordHash) {
    if (!hasRemote()) {
      throw new Error("尚未設定 GAS Web App URL");
    }
    return request("login", { email, passwordHash });
  }

  async function writeSchedule(versionId, schedule) {
    if (!hasRemote()) {
      throw new Error("尚未設定 GAS Web App URL");
    }
    return request("writeSchedule", { versionId, schedule });
  }

  async function createVersion(version, schedule) {
    if (!hasRemote()) {
      throw new Error("尚未設定 GAS Web App URL");
    }
    return request("createVersion", { version, schedule });
  }

  async function loadVersion(versionId) {
    if (!hasRemote()) {
      throw new Error("尚未設定 GAS Web App URL");
    }
    return request("loadVersion", { versionId });
  }

  async function appendChangeLog(entry) {
    if (!hasRemote()) return null;
    return request("appendChangeLog", { entry });
  }

  global.DgApi = {
    hasRemote,
    request,
    readAllTables,
    readTable,
    login,
    writeSchedule,
    createVersion,
    loadVersion,
    appendChangeLog,
  };
})(typeof window !== "undefined" ? window : globalThis);
