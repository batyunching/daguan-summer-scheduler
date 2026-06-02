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
    flattenSchedule,
  };
})(typeof window !== "undefined" ? window : globalThis);
