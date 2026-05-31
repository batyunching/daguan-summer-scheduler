const SHEET_DEFINITIONS = {
  System_Settings: {
    name: "系統設定",
    fields: {
      settingKey: "設定鍵",
      settingValue: "設定值",
      description: "說明",
    },
  },
  Users: {
    name: "使用者帳號",
    fields: {
      userId: "使用者代碼",
      name: "姓名",
      email: "電子郵件",
      role: "角色",
      passwordHash: "密碼雜湊",
      teacherId: "教師代碼",
      isActive: "是否啟用",
      lastLoginAt: "最後登入時間",
    },
  },
  Teacher_Settings: {
    name: "教師設定",
    fields: {
      teacherId: "教師代碼",
      teacherName: "教師姓名",
      subjectGroup: "科目群組",
      subjects: "可授科目",
      availableWeeks: "可授課週次",
      maxWeeklyPeriods: "每週節數上限",
      note: "備註",
      assignedClasses: "授課班級",
      teacherPosition: "教師職位",
    },
  },
  Class_Settings: {
    name: "班級設定",
    fields: {
      classId: "班級代碼",
      grade: "年級",
      className: "班級名稱",
      socialMode: "社會科模式",
      manualSocialSubjects: "手動指定社會科",
      note: "備註",
    },
  },
  Course_Quota: {
    name: "課程節數配額",
    fields: {
      grade: "年級",
      subject: "科目",
      targetPeriods: "目標節數",
      doublePeriodRequired: "是否連堂",
      roomType: "場地類型",
      roomNeedCount: "需要場地數",
    },
  },
  Room_Settings: {
    name: "場地設定",
    fields: {
      roomType: "場地類型",
      roomName: "場地名稱",
      capacityCount: "同時容量",
      note: "備註",
    },
  },
  Social_Assignment: {
    name: "社會科安排",
    fields: {
      classId: "班級代碼",
      mode: "模式",
      subjectA: "科目 A",
      teacherA: "教師 A",
      subjectB: "科目 B",
      teacherB: "教師 B",
      updatedAt: "更新時間",
    },
  },
  Pre_Assignments: {
    name: "預排與鎖定",
    fields: {
      week: "週次",
      day: "星期",
      slotStart: "連堂起點",
      classId: "班級代碼",
      subject: "科目",
      teacherId: "教師代碼",
      isLocked: "是否鎖定",
      note: "備註",
    },
  },
  Schedule_Database: {
    name: "課表資料庫",
    fields: {
      versionId: "版本代碼",
      week: "週次",
      day: "星期",
      period: "節次",
      classId: "班級代碼",
      subject: "科目",
      teacherId: "教師代碼",
      roomType: "場地類型",
      isLocked: "是否鎖定",
      createdAt: "建立時間",
      updatedAt: "更新時間",
    },
  },
  Schedule_Versions: {
    name: "課表版本",
    fields: {
      versionId: "版本代碼",
      versionName: "版本名稱",
      createdBy: "建立者",
      createdAt: "建立時間",
      note: "備註",
      isActive: "是否啟用",
    },
  },
  Change_Log: {
    name: "操作紀錄",
    fields: {
      logId: "紀錄代碼",
      userId: "使用者代碼",
      action: "操作",
      targetTable: "目標資料表",
      targetId: "目標代碼",
      createdAt: "建立時間",
      detailJson: "詳細內容",
    },
  },
};

const FIELD_TO_KEY = buildFieldToKey_();

function doGet(e) {
  return handleRequest_(e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  const body = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
  return handleRequest_(JSON.parse(body));
}

function handleRequest_(payload) {
  try {
    const data = route_(payload || {});
    return json_({ ok: true, data });
  } catch (error) {
    return json_({ ok: false, message: error.message || String(error) });
  }
}

function route_(payload) {
  const action = String(payload.action || "status").trim();
  if (action === "status" || action === "ping" || action === "health") return status_();
  if (action === "readTable") return readTable_(payload.sheetName);
  if (action === "readAllTables") return readAllTables_(payload.sheetNames);
  if (action === "writeSchedule") return writeSchedule_(payload.versionId, payload.schedule || []);
  if (action === "createVersion") return createVersion_(payload.version || {}, payload.schedule || []);
  if (action === "loadVersion") return loadVersion_(payload.versionId);
  if (action === "login") return login_(payload.email, payload.passwordHash);
  if (action === "appendChangeLog") return appendChangeLog_(payload.entry || {});
  if (action === "initializeSheets") return initializeSheets_(parseBool_(payload.forceHeaders));
  if (action === "localizeHeaders") return localizeHeaders_();
  throw new Error("未知 API action：" + action);
}

function status_() {
  return {
    message: "大觀國中暑期排課系統 GAS Web App 正常運作",
    usage: "前端系統會用 POST 自動傳送 action；直接開啟網址只會顯示此狀態檢查。",
    testUrls: {
      initializeSheets: "?action=initializeSheets",
      localizeHeaders: "?action=localizeHeaders",
      forceHeaders: "?action=initializeSheets&forceHeaders=true",
    },
  };
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error("找不到試算表，請設定 Script Property：SPREADSHEET_ID");
  return active;
}

function buildFieldToKey_() {
  const map = {};
  Object.keys(SHEET_DEFINITIONS).forEach((sheetId) => {
    Object.entries(SHEET_DEFINITIONS[sheetId].fields).forEach(([key, label]) => {
      map[label] = key;
      map[key] = key;
    });
  });
  return map;
}

function sheetIdFromName_(name) {
  if (SHEET_DEFINITIONS[name]) return name;
  return Object.keys(SHEET_DEFINITIONS).find((sheetId) => SHEET_DEFINITIONS[sheetId].name === name) || name;
}

function sheetName_(sheetIdOrName) {
  const sheetId = sheetIdFromName_(sheetIdOrName);
  return SHEET_DEFINITIONS[sheetId] ? SHEET_DEFINITIONS[sheetId].name : sheetIdOrName;
}

function fieldKeys_(sheetIdOrName) {
  const sheetId = sheetIdFromName_(sheetIdOrName);
  return SHEET_DEFINITIONS[sheetId] ? Object.keys(SHEET_DEFINITIONS[sheetId].fields) : [];
}

function fieldLabels_(sheetIdOrName) {
  const sheetId = sheetIdFromName_(sheetIdOrName);
  return SHEET_DEFINITIONS[sheetId] ? Object.values(SHEET_DEFINITIONS[sheetId].fields) : [];
}

function sheet_(sheetIdOrName, createIfMissing) {
  const ss = spreadsheet_();
  const sheetId = sheetIdFromName_(sheetIdOrName);
  const preferredName = sheetName_(sheetId);
  let sheet = ss.getSheetByName(preferredName);
  if (!sheet && SHEET_DEFINITIONS[sheetId]) sheet = ss.getSheetByName(sheetId);
  if (!sheet && createIfMissing) sheet = ss.insertSheet(preferredName);
  if (!sheet) throw new Error("找不到工作表：" + preferredName);
  return sheet;
}

function parseBool_(value) {
  return value === true || String(value).toLowerCase() === "true" || String(value) === "1" || String(value) === "是";
}

function isEnabled_(value) {
  const text = String(value || "").trim().toLowerCase();
  return !["false", "0", "no", "n", "否", "停用", "未啟用"].includes(text);
}

function initializeSheets_(forceHeaders) {
  Object.keys(SHEET_DEFINITIONS).forEach((sheetId) => {
    const sheet = sheet_(sheetId, true);
    const desiredName = sheetName_(sheetId);
    if (sheet.getName() !== desiredName) sheet.setName(desiredName);

    const headers = fieldLabels_(sheetId);
    if (forceHeaders) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    } else if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    } else {
      const firstRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
      const emptyHeader = firstRow.every((cell) => cell === "");
      if (emptyHeader) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  });
  return {
    initialized: Object.keys(SHEET_DEFINITIONS).length,
    forceHeaders: Boolean(forceHeaders),
    sheetNames: Object.keys(SHEET_DEFINITIONS).map((sheetId) => sheetName_(sheetId)),
  };
}

function localizeHeaders_() {
  return initializeSheets_(true);
}

function readAllTables_(sheetNames) {
  const names = sheetNames && sheetNames.length ? sheetNames : Object.keys(SHEET_DEFINITIONS);
  const result = {};
  names.forEach((name) => {
    const sheetId = sheetIdFromName_(name);
    const outputName = SHEET_DEFINITIONS[sheetId] ? SHEET_DEFINITIONS[sheetId].name : name;
    result[outputName] = readTable_(sheetId);
  });
  return result;
}

function readTable_(sheetIdOrName) {
  const sheetId = sheetIdFromName_(sheetIdOrName);
  const sheet = sheet_(sheetId, true);
  const lastRow = sheet.getLastRow();
  const labels = fieldLabels_(sheetId);
  const lastCol = Math.max(sheet.getLastColumn(), labels.length);
  if (lastRow === 0) {
    if (labels.length) sheet.getRange(1, 1, 1, labels.length).setValues([labels]);
    return [];
  }

  const values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  const headers = values.shift().map((header) => FIELD_TO_KEY[String(header)] || String(header));
  return values
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) => {
      const item = {};
      headers.forEach((header, index) => {
        if (!header) return;
        item[header] = row[index];
      });
      return item;
    });
}

function writeRows_(sheetIdOrName, rows, append) {
  const sheetId = sheetIdFromName_(sheetIdOrName);
  const keys = fieldKeys_(sheetId);
  const labels = fieldLabels_(sheetId);
  if (!keys.length) throw new Error("未定義工作表欄位：" + sheetIdOrName);

  const sheet = sheet_(sheetId, true);
  if (!append) sheet.clearContents();
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, labels.length).setValues([labels]);
    sheet.setFrozenRows(1);
  }
  if (!rows.length) return { written: 0 };

  const values = rows.map((row) => keys.map((key) => row[key] === undefined ? "" : row[key]));
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, labels.length).setValues(values);
  return { written: values.length };
}

function writeSchedule_(versionId, schedule) {
  const rows = expandScheduleRows_(schedule, versionId);
  const allRows = readTable_("Schedule_Database").filter((row) => row.versionId !== versionId);
  writeRows_("Schedule_Database", allRows.concat(rows), false);
  appendChangeLog_({
    action: "writeSchedule",
    targetTable: "課表資料庫",
    targetId: versionId,
    detailJson: JSON.stringify({ count: rows.length }),
  });
  return { versionId, rows: rows.length };
}

function createVersion_(version, schedule) {
  const versionId = version.versionId || makeId_("VER");
  const versions = readTable_("Schedule_Versions").map((row) => ({
    ...row,
    isActive: false,
  }));
  const nextVersion = {
    versionId,
    versionName: version.versionName || "未命名版本",
    createdBy: version.createdBy || "",
    createdAt: version.createdAt || new Date().toISOString(),
    note: version.note || "",
    isActive: true,
  };
  writeRows_("Schedule_Versions", versions.concat([nextVersion]), false);
  writeSchedule_(versionId, schedule);
  appendChangeLog_({
    action: "createVersion",
    targetTable: "課表版本",
    targetId: versionId,
    detailJson: JSON.stringify(nextVersion),
  });
  return nextVersion;
}

function loadVersion_(versionId) {
  const schedule = readTable_("Schedule_Database").filter((row) => row.versionId === versionId);
  const version = readTable_("Schedule_Versions").find((row) => row.versionId === versionId);
  return { version, schedule };
}

function login_(email, passwordHash) {
  const user = readTable_("Users").find((row) => {
    return String(row.email).toLowerCase() === String(email).toLowerCase() &&
      String(row.passwordHash) === String(passwordHash) &&
      isEnabled_(row.isActive);
  });
  if (!user) throw new Error("帳號或密碼不正確");
  updateUserLoginTime_(user.userId);
  delete user.passwordHash;
  return user;
}

function updateUserLoginTime_(userId) {
  const users = readTable_("Users").map((row) => {
    if (row.userId === userId) row.lastLoginAt = new Date().toISOString();
    return row;
  });
  writeRows_("Users", users, false);
}

function appendChangeLog_(entry) {
  const row = {
    logId: entry.logId || makeId_("LOG"),
    userId: entry.userId || "",
    action: entry.action || "",
    targetTable: entry.targetTable || "",
    targetId: entry.targetId || "",
    createdAt: entry.createdAt || new Date().toISOString(),
    detailJson: entry.detailJson || "",
  };
  writeRows_("Change_Log", [row], true);
  return row;
}

function expandScheduleRows_(schedule, versionId) {
  const rows = [];
  schedule.forEach((lesson) => {
    if (lesson.period && !lesson.blockStart) {
      rows.push({ ...lesson, versionId: versionId || lesson.versionId || "" });
      return;
    }
    const blockStart = Number(lesson.blockStart || lesson.slotStart || lesson.period);
    [blockStart, blockStart + 1].forEach((period) => {
      rows.push({
        versionId: versionId || lesson.versionId || "",
        week: lesson.week,
        day: lesson.day,
        period,
        classId: lesson.classId,
        subject: lesson.subject,
        teacherId: lesson.teacherId,
        roomType: lesson.roomType || "普通",
        isLocked: lesson.isLocked === true,
        createdAt: lesson.createdAt || "",
        updatedAt: lesson.updatedAt || new Date().toISOString(),
      });
    });
  });
  return rows;
}

function makeId_(prefix) {
  return prefix + "-" + Utilities.getUuid().slice(0, 8).toUpperCase();
}
