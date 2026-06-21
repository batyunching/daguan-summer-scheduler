(function (global) {
  const VERSION_KEY = "daguanScheduleVersions";

  function readVersions() {
    try {
      return JSON.parse(global.DgConfig.storage.getItem(VERSION_KEY) || "[]");
    } catch (error) {
      return [];
    }
  }

  function writeVersions(versions) {
    global.DgConfig.storage.setItem(VERSION_KEY, JSON.stringify(versions || []));
  }

  function createVersion(input) {
    const version = {
      versionId: global.DgConfig.createId("VER"),
      versionName: input.versionName || `版本 ${new Date().toLocaleString("zh-TW")}`,
      createdBy: input.createdBy || "",
      createdAt: new Date().toISOString(),
      note: input.note || "",
      isActive: true,
      schedule: global.DgConfig.clone(input.schedule || []),
    };
    const versions = readVersions().map((item) => ({ ...item, isActive: false }));
    versions.unshift(version);
    writeVersions(versions);
    return version;
  }

  function listVersions() {
    return readVersions();
  }

  function loadVersion(versionId) {
    const version = readVersions().find((item) => item.versionId === versionId);
    if (!version) return null;
    const versions = readVersions().map((item) => ({ ...item, isActive: item.versionId === versionId }));
    writeVersions(versions);
    return version;
  }

  function removeVersion(versionId) {
    writeVersions(readVersions().filter((item) => item.versionId !== versionId));
  }

  function asBoolean(value) {
    if (typeof value === "boolean") return value;
    return ["true", "1", "yes", "是"].includes(String(value || "").trim().toLowerCase());
  }

  function asTime(value) {
    const time = Date.parse(value || "");
    return Number.isFinite(time) ? time : 0;
  }

  function scheduleFromDatabase(rows, versionId) {
    const grouped = new Map();
    (rows || [])
      .filter((row) => String(row.versionId || "") === String(versionId || ""))
      .forEach((row) => {
        const period = Number(row.period || 1);
        const blockStart = period <= 2 ? 1 : 3;
        const key = [
          versionId,
          row.week,
          row.day,
          blockStart,
          row.classId,
          row.subject,
          row.teacherId,
          row.roomType,
          row.isLocked,
          row.fatigueApproved,
        ].join("|");
        if (!grouped.has(key)) {
          grouped.set(key, {
            id: `DB-${grouped.size + 1}-${versionId}`,
            versionId,
            week: Number(row.week || 1),
            day: Number(row.day || 1),
            blockStart,
            classId: String(row.classId || ""),
            subject: String(row.subject || ""),
            teacherId: String(row.teacherId || ""),
            roomType: String(row.roomType || "普通"),
            isLocked: asBoolean(row.isLocked),
            fatigueApproved: asBoolean(row.fatigueApproved),
            createdAt: row.createdAt || "",
            updatedAt: row.updatedAt || "",
            source: "auto",
          });
        }
      });
    return Array.from(grouped.values());
  }

  function syncRemoteVersions(remoteVersions, scheduleRows) {
    const localVersions = readVersions();
    const localById = new Map(localVersions.map((item) => [String(item.versionId), item]));
    const remoteById = new Map(
      (remoteVersions || [])
        .filter((item) => item?.versionId)
        .map((item) => [String(item.versionId), item])
    );
    const versionIds = new Set([
      ...remoteById.keys(),
      ...(scheduleRows || []).map((row) => String(row.versionId || "")).filter(Boolean),
    ]);
    const merged = [];
    let recoveredCount = 0;

    versionIds.forEach((versionId) => {
      const remote = remoteById.get(versionId) || {};
      const local = localById.get(versionId) || {};
      const schedule = scheduleFromDatabase(scheduleRows, versionId);
      const recoveredFromDatabase = !remote.versionName;
      if (recoveredFromDatabase) recoveredCount += 1;
      merged.push({
        ...local,
        ...remote,
        versionId,
        versionName: remote.versionName || local.versionName || `資料庫救回：${versionId}`,
        createdBy: remote.createdBy || local.createdBy || "",
        createdAt:
          remote.createdAt ||
          local.createdAt ||
          schedule.map((lesson) => lesson.createdAt || lesson.updatedAt).find(Boolean) ||
          "",
        note:
          remote.note ||
          local.note ||
          (recoveredFromDatabase ? "版本資訊遺失，已由課表資料庫自動重建。" : ""),
        isActive: asBoolean(remote.isActive) || (!remote.versionId && Boolean(local.isActive)),
        schedule: schedule.length ? schedule : global.DgConfig.clone(local.schedule || []),
        recoveredFromDatabase,
      });
      localById.delete(versionId);
    });

    localById.forEach((version) => merged.push(version));
    merged.sort((a, b) => asTime(b.createdAt) - asTime(a.createdAt));
    writeVersions(merged);
    return { versions: merged, recoveredCount };
  }

  function flattenSchedule(schedule, versionId) {
    const rows = [];
    (schedule || []).forEach((lesson) => {
      [lesson.blockStart, lesson.blockStart + 1].forEach((period) => {
        rows.push({
          versionId: versionId || lesson.versionId || "",
          week: lesson.week,
          day: lesson.day,
          period,
          classId: lesson.classId,
          subject: lesson.subject,
          teacherId: lesson.teacherId,
          roomType: lesson.roomType,
          isLocked: lesson.isLocked,
          fatigueApproved: lesson.fatigueApproved,
          createdAt: lesson.createdAt || "",
          updatedAt: lesson.updatedAt || "",
        });
      });
    });
    return rows;
  }

  global.DgVersion = {
    createVersion,
    listVersions,
    loadVersion,
    removeVersion,
    syncRemoteVersions,
    flattenSchedule,
  };
})(typeof window !== "undefined" ? window : globalThis);
