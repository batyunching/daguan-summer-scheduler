(function (global) {
  const APP_BUILD = "20260601-3";

  const DAYS = [
    { id: 1, label: "星期一", short: "一" },
    { id: 2, label: "星期二", short: "二" },
    { id: 3, label: "星期三", short: "三" },
    { id: 4, label: "星期四", short: "四" },
    { id: 5, label: "星期五", short: "五" },
  ];

  const BLOCKS = [
    { start: 1, label: "第 1-2 節", periods: [1, 2] },
    { start: 3, label: "第 3-4 節", periods: [3, 4] },
  ];

  const GRADE_SETTINGS = {
    "8": { label: "國二", weeks: 3 },
    "9": { label: "國三", weeks: 5 },
  };

  const SOCIAL_SUBJECTS = ["公民", "歷史", "地理"];

  const SHEET_SCHEMAS = {
    System_Settings: ["settingKey", "settingValue", "description"],
    Users: ["userId", "name", "email", "role", "passwordHash", "teacherId", "isActive", "lastLoginAt"],
    Teacher_Settings: [
      "teacherId",
      "teacherName",
      "subjectGroup",
      "subjects",
      "availableWeeks",
      "maxWeeklyPeriods",
      "note",
      "assignedClasses",
      "teacherPosition",
      "availableDays",
    ],
    Class_Settings: ["classId", "grade", "className", "socialMode", "manualSocialSubjects", "note"],
    Course_Quota: ["grade", "subject", "targetPeriods", "doublePeriodRequired", "roomType", "roomNeedCount"],
    Room_Settings: ["roomType", "roomName", "capacityCount", "note"],
    Social_Assignment: ["classId", "mode", "subjectA", "teacherA", "subjectB", "teacherB", "updatedAt"],
    Pre_Assignments: ["week", "day", "slotStart", "classId", "subject", "teacherId", "isLocked", "note"],
    Schedule_Database: [
      "versionId",
      "week",
      "day",
      "period",
      "classId",
      "subject",
      "teacherId",
      "roomType",
      "isLocked",
      "createdAt",
      "updatedAt",
    ],
    Schedule_Versions: ["versionId", "versionName", "createdBy", "createdAt", "note", "isActive"],
    Change_Log: ["logId", "userId", "action", "targetTable", "targetId", "createdAt", "detailJson"],
  };

  const SHEET_LABELS = {
    System_Settings: "系統設定",
    Users: "使用者帳號",
    Teacher_Settings: "教師設定",
    Class_Settings: "班級設定",
    Course_Quota: "課程節數配額",
    Room_Settings: "場地設定",
    Social_Assignment: "社會科安排",
    Pre_Assignments: "預排與鎖定",
    Schedule_Database: "課表資料庫",
    Schedule_Versions: "課表版本",
    Change_Log: "操作紀錄",
  };

  const FIELD_LABELS = {
    settingKey: "設定鍵",
    settingValue: "設定值",
    description: "說明",
    userId: "使用者代碼",
    name: "姓名",
    email: "電子郵件",
    role: "角色",
    passwordHash: "密碼雜湊",
    teacherId: "教師代碼",
    isActive: "是否啟用",
    lastLoginAt: "最後登入時間",
    teacherName: "教師姓名",
    subjectGroup: "科目群組",
    subjects: "可授科目",
    assignedClasses: "授課班級",
    teacherPosition: "教師職位",
    availableDays: "可授課星期",
    availableWeeks: "可授課週次",
    maxWeeklyPeriods: "每週節數上限",
    note: "備註",
    classId: "班級代碼",
    grade: "年級",
    className: "班級名稱",
    socialMode: "社會科模式",
    manualSocialSubjects: "手動指定社會科",
    subject: "科目",
    targetPeriods: "目標節數",
    doublePeriodRequired: "是否連堂",
    roomType: "場地類型",
    roomNeedCount: "需要場地數",
    roomName: "場地名稱",
    capacityCount: "同時容量",
    mode: "模式",
    subjectA: "科目 A",
    teacherA: "教師 A",
    subjectB: "科目 B",
    teacherB: "教師 B",
    updatedAt: "更新時間",
    week: "週次",
    day: "星期",
    slotStart: "連堂起點",
    isLocked: "是否鎖定",
    versionId: "版本代碼",
    period: "節次",
    createdAt: "建立時間",
    versionName: "版本名稱",
    createdBy: "建立者",
    logId: "紀錄代碼",
    userId: "使用者代碼",
    action: "操作",
    targetTable: "目標資料表",
    targetId: "目標代碼",
    detailJson: "詳細內容",
  };

  const FIELD_KEYS = Object.fromEntries(Object.entries(FIELD_LABELS).map(([key, label]) => [label, key]));

  const mockData = {
    systemSettings: [
      { settingKey: "schoolName", settingValue: "大觀國中", description: "系統顯示校名" },
      { settingKey: "grade8Weeks", settingValue: "3", description: "國二暑輔週數" },
      { settingKey: "grade9Weeks", settingValue: "5", description: "國三暑輔週數" },
      { settingKey: "periodsPerDay", settingValue: "4", description: "每日節數" },
      { settingKey: "scheduleStartDate", settingValue: "2026-07-13", description: "第一週星期一日期" },
    ],
    users: [
      {
        userId: "U001",
        name: "教務處管理者",
        email: "admin@daguan.ntpc.edu.tw",
        role: "admin",
        passwordHash: "7045830c",
        teacherId: "",
        isActive: true,
        lastLoginAt: "",
      },
      {
        userId: "U101",
        name: "王文琳",
        email: "teacher@daguan.ntpc.edu.tw",
        role: "teacher",
        passwordHash: "6668142b",
        teacherId: "T101",
        isActive: true,
        lastLoginAt: "",
      },
      {
        userId: "U501",
        name: "社會科檢視帳號",
        email: "social@daguan.ntpc.edu.tw",
        role: "teacher",
        passwordHash: "8cc1fee6",
        teacherId: "T501",
        isActive: true,
        lastLoginAt: "",
      },
    ],
    teachers: [
      {
        teacherId: "T101",
        teacherName: "王文琳",
        subjectGroup: "國文",
        subjects: ["國文"],
        assignedClasses: [],
        teacherPosition: "導師",
        availableWeeks: [1, 2, 3, 4, 5],
        maxWeeklyPeriods: 18,
        note: "可支援國二與國三",
      },
      {
        teacherId: "T102",
        teacherName: "林思穎",
        subjectGroup: "國文",
        subjects: ["國文"],
        assignedClasses: [],
        teacherPosition: "專任",
        availableWeeks: [1, 2, 3, 4, 5],
        maxWeeklyPeriods: 16,
        note: "",
      },
      {
        teacherId: "T201",
        teacherName: "陳柏翰",
        subjectGroup: "英文",
        subjects: ["英文"],
        assignedClasses: [],
        teacherPosition: "專任",
        availableWeeks: [1, 2, 3, 4, 5],
        maxWeeklyPeriods: 18,
        note: "",
      },
      {
        teacherId: "T202",
        teacherName: "詹慧君",
        subjectGroup: "英文",
        subjects: ["英文"],
        assignedClasses: [],
        teacherPosition: "導師",
        availableWeeks: [1, 2, 3, 4, 5],
        maxWeeklyPeriods: 16,
        note: "",
      },
      {
        teacherId: "T301",
        teacherName: "李俊儀",
        subjectGroup: "數學",
        subjects: ["數學"],
        assignedClasses: [],
        teacherPosition: "專任",
        availableWeeks: [1, 2, 3, 4, 5],
        maxWeeklyPeriods: 20,
        note: "",
      },
      {
        teacherId: "T302",
        teacherName: "蔡雅如",
        subjectGroup: "數學",
        subjects: ["數學"],
        assignedClasses: [],
        teacherPosition: "導師",
        availableWeeks: [1, 2, 3, 4, 5],
        maxWeeklyPeriods: 18,
        note: "",
      },
      {
        teacherId: "T401",
        teacherName: "黃柏霖",
        subjectGroup: "自然",
        subjects: ["自然"],
        assignedClasses: [],
        teacherPosition: "組長",
        availableWeeks: [1, 2, 3, 4, 5],
        maxWeeklyPeriods: 18,
        note: "可用實驗室",
      },
      {
        teacherId: "T402",
        teacherName: "郭怡君",
        subjectGroup: "自然",
        subjects: ["自然"],
        assignedClasses: [],
        teacherPosition: "專任",
        availableWeeks: [1, 2, 3, 4, 5],
        maxWeeklyPeriods: 16,
        note: "可用實驗室",
      },
      {
        teacherId: "T501",
        teacherName: "吳承恩",
        subjectGroup: "社會",
        subjects: ["公民"],
        assignedClasses: [],
        teacherPosition: "導師",
        availableWeeks: [1, 2, 3, 4, 5],
        maxWeeklyPeriods: 14,
        note: "社會科：公民",
      },
      {
        teacherId: "T502",
        teacherName: "許芳瑜",
        subjectGroup: "社會",
        subjects: ["歷史"],
        assignedClasses: [],
        teacherPosition: "專任",
        availableWeeks: [1, 2, 3, 4, 5],
        maxWeeklyPeriods: 14,
        note: "社會科：歷史",
      },
      {
        teacherId: "T503",
        teacherName: "周佩君",
        subjectGroup: "社會",
        subjects: ["地理"],
        assignedClasses: [],
        teacherPosition: "組長",
        availableWeeks: [1, 2, 3, 4, 5],
        maxWeeklyPeriods: 14,
        note: "社會科：地理",
      },
      {
        teacherId: "T601",
        teacherName: "蘇雅婷",
        subjectGroup: "藝術",
        subjects: ["藝術"],
        assignedClasses: [],
        teacherPosition: "專任",
        availableWeeks: [1, 2, 3, 4, 5],
        maxWeeklyPeriods: 10,
        note: "藝術教室",
      },
      {
        teacherId: "T701",
        teacherName: "賴建宏",
        subjectGroup: "體育",
        subjects: ["體育"],
        assignedClasses: [],
        teacherPosition: "專任",
        availableWeeks: [1, 2, 3, 4, 5],
        maxWeeklyPeriods: 12,
        note: "操場",
      },
      {
        teacherId: "T702",
        teacherName: "謝明達",
        subjectGroup: "體育",
        subjects: ["體育"],
        assignedClasses: [],
        teacherPosition: "組長",
        availableWeeks: [1, 2, 3, 4, 5],
        maxWeeklyPeriods: 12,
        note: "操場",
      },
    ],
    classes: [
      { classId: "801", grade: "8", className: "801", socialMode: "auto", manualSocialSubjects: "", note: "" },
      { classId: "802", grade: "8", className: "802", socialMode: "auto", manualSocialSubjects: "", note: "" },
      { classId: "901", grade: "9", className: "901", socialMode: "auto", manualSocialSubjects: "", note: "" },
      { classId: "902", grade: "9", className: "902", socialMode: "manual", manualSocialSubjects: "公民,地理", note: "" },
    ],
    courseQuotas: [
      { grade: "8", subject: "國文", targetPeriods: 10, doublePeriodRequired: true, roomType: "普通", roomNeedCount: 1 },
      { grade: "8", subject: "英文", targetPeriods: 10, doublePeriodRequired: true, roomType: "普通", roomNeedCount: 1 },
      { grade: "8", subject: "數學", targetPeriods: 12, doublePeriodRequired: true, roomType: "普通", roomNeedCount: 1 },
      { grade: "8", subject: "自然", targetPeriods: 10, doublePeriodRequired: true, roomType: "實驗室", roomNeedCount: 1 },
      { grade: "8", subject: "社會", targetPeriods: 8, doublePeriodRequired: true, roomType: "普通", roomNeedCount: 1 },
      { grade: "8", subject: "體育", targetPeriods: 6, doublePeriodRequired: true, roomType: "操場", roomNeedCount: 1 },
      { grade: "8", subject: "藝術", targetPeriods: 4, doublePeriodRequired: true, roomType: "藝術教室", roomNeedCount: 1 },
      { grade: "9", subject: "國文", targetPeriods: 18, doublePeriodRequired: true, roomType: "普通", roomNeedCount: 1 },
      { grade: "9", subject: "英文", targetPeriods: 18, doublePeriodRequired: true, roomType: "普通", roomNeedCount: 1 },
      { grade: "9", subject: "數學", targetPeriods: 20, doublePeriodRequired: true, roomType: "普通", roomNeedCount: 1 },
      { grade: "9", subject: "自然", targetPeriods: 16, doublePeriodRequired: true, roomType: "實驗室", roomNeedCount: 1 },
      { grade: "9", subject: "社會", targetPeriods: 12, doublePeriodRequired: true, roomType: "普通", roomNeedCount: 1 },
      { grade: "9", subject: "體育", targetPeriods: 10, doublePeriodRequired: true, roomType: "操場", roomNeedCount: 1 },
      { grade: "9", subject: "藝術", targetPeriods: 6, doublePeriodRequired: true, roomType: "藝術教室", roomNeedCount: 1 },
    ],
    rooms: [
      { roomType: "普通", roomName: "一般教室", capacityCount: 99, note: "各班原教室" },
      { roomType: "實驗室", roomName: "自然實驗室", capacityCount: 2, note: "同時最多兩班" },
      { roomType: "操場", roomName: "操場 / 體育館", capacityCount: 2, note: "雨天需人工調整" },
      { roomType: "藝術教室", roomName: "藝術教室", capacityCount: 1, note: "同時最多一班" },
    ],
    socialAssignments: [
      {
        classId: "902",
        mode: "manual",
        subjectA: "公民",
        teacherA: "T501",
        subjectB: "地理",
        teacherB: "T503",
        updatedAt: "2026-05-30T00:00:00.000Z",
      },
    ],
    preAssignments: [
      {
        week: 1,
        day: 1,
        slotStart: 1,
        classId: "801",
        subject: "國文",
        teacherId: "T101",
        roomType: "普通",
        isLocked: true,
        note: "暑輔第一天導師確認",
      },
      {
        week: 1,
        day: 1,
        slotStart: 3,
        classId: "901",
        subject: "數學",
        teacherId: "T301",
        roomType: "普通",
        isLocked: true,
        note: "國三複習測驗後銜接",
      },
      {
        week: 1,
        day: 2,
        slotStart: 1,
        classId: "802",
        subject: "英文",
        teacherId: "T201",
        roomType: "普通",
        isLocked: false,
        note: "示範預排，可再拖拉調整",
      },
    ],
    versions: [],
    changeLog: [],
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  const DEFAULT_API_URL =
    "https://script.google.com/macros/s/AKfycbxl-MIvMZ2tJkg0Xm86MAfSfBuCnoscoQpIXTYReNaIzhvx8JUTzF7O360V_Wsu44OI/exec";
  const memoryStore = {};

  const safeStorage = {
    getItem(key) {
      try {
        return global.localStorage.getItem(key);
      } catch (error) {
        return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
      }
    },
    setItem(key, value) {
      try {
        global.localStorage.setItem(key, value);
      } catch (error) {
        memoryStore[key] = String(value);
      }
    },
    removeItem(key) {
      try {
        global.localStorage.removeItem(key);
      } catch (error) {
        delete memoryStore[key];
      }
    },
  };

  function getApiUrl() {
    return safeStorage.getItem("daguanGasApiUrl") || DEFAULT_API_URL;
  }

  function setApiUrl(url) {
    safeStorage.setItem("daguanGasApiUrl", String(url || "").trim());
  }

  function clearApiUrl() {
    safeStorage.removeItem("daguanGasApiUrl");
  }

  function createId(prefix) {
    const stamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 7);
    return `${prefix}-${stamp}-${random}`.toUpperCase();
  }

  function getSetting(data, key, fallback) {
    const row = (data?.systemSettings || mockData.systemSettings).find((item) => item.settingKey === key);
    return row?.settingValue || fallback;
  }

  function addDays(date, days) {
    const next = new Date(date.getTime());
    next.setDate(next.getDate() + days);
    return next;
  }

  function formatMonthDay(date) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function getScheduleStartDate(data) {
    const value = getSetting(data, "scheduleStartDate", "2026-07-13");
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? new Date("2026-07-13T00:00:00") : date;
  }

  function getWeekDateRange(week, data) {
    const start = addDays(getScheduleStartDate(data), (Number(week) - 1) * 7);
    const end = addDays(start, 4);
    return `${formatMonthDay(start)}~${formatMonthDay(end)}`;
  }

  function getDayDate(week, day, data) {
    return addDays(getScheduleStartDate(data), (Number(week) - 1) * 7 + (Number(day) - 1));
  }

  global.DgConfig = {
    appBuild: APP_BUILD,
    appName: "大觀國中暑期排課系統",
    days: DAYS,
    blocks: BLOCKS,
    gradeSettings: GRADE_SETTINGS,
    socialSubjects: SOCIAL_SUBJECTS,
    sheetSchemas: SHEET_SCHEMAS,
    sheetLabels: SHEET_LABELS,
    fieldLabels: FIELD_LABELS,
    fieldKeys: FIELD_KEYS,
    mockData,
    storage: safeStorage,
    clone,
    cloneMockData: () => clone(mockData),
    getApiUrl,
    setApiUrl,
    clearApiUrl,
    createId,
    getSetting,
    getWeekDateRange,
    getDayDate,
    formatMonthDay,
  };
})(typeof window !== "undefined" ? window : globalThis);
