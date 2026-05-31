(function (global) {
  const pairs = [
    ["公民", "歷史"],
    ["公民", "地理"],
    ["歷史", "地理"],
  ];

  function socialTeachers(data, subject, classId) {
    return (data.teachers || []).filter(
      (teacher) =>
        teacher.subjectGroup === "社會" &&
        (teacher.subjects || []).includes(subject) &&
        (!classId || global.DgConstraints.teacherCanTeachClass(teacher, classId))
    );
  }

  function pickTeacher(data, subject, teacherLoad, classId) {
    const candidates = socialTeachers(data, subject, classId);
    if (!candidates.length) return "";
    return candidates
      .slice()
      .sort((a, b) => {
        const loadA = teacherLoad[a.teacherId] || 0;
        const loadB = teacherLoad[b.teacherId] || 0;
        if (loadA !== loadB) return loadA - loadB;
        return a.teacherName.localeCompare(b.teacherName, "zh-Hant");
      })[0].teacherId;
  }

  function parseManualSubjects(value) {
    return String(value || "")
      .split(/[,\u3001]/)
      .map((item) => item.trim())
      .filter((item) => global.DgConfig.socialSubjects.includes(item))
      .slice(0, 2);
  }

  function normalizeExisting(assignments) {
    const map = new Map();
    (assignments || []).forEach((item) => {
      if (item.classId) map.set(item.classId, { ...item });
    });
    return map;
  }

  function autoAssign(data, keepManual) {
    const existing = normalizeExisting(data.socialAssignments);
    const subjectLoad = Object.fromEntries(global.DgConfig.socialSubjects.map((subject) => [subject, 0]));
    const teacherLoad = {};
    const result = [];

    (data.classes || []).forEach((classInfo) => {
      const old = existing.get(classInfo.classId);
      const manualSubjects = parseManualSubjects(classInfo.manualSocialSubjects);
      const shouldKeepManual = keepManual !== false && (classInfo.socialMode === "manual" || old?.mode === "manual");

      if (shouldKeepManual) {
        const subjectA = old?.subjectA || manualSubjects[0] || "公民";
        const subjectB = old?.subjectB || manualSubjects[1] || (subjectA === "歷史" ? "地理" : "歷史");
        const teacherAList = socialTeachers(data, subjectA, classInfo.classId);
        const teacherBList = socialTeachers(data, subjectB, classInfo.classId);
        const teacherA = teacherAList.some((teacher) => teacher.teacherId === old?.teacherA)
          ? old.teacherA
          : pickTeacher(data, subjectA, teacherLoad, classInfo.classId);
        const teacherB = teacherBList.some((teacher) => teacher.teacherId === old?.teacherB)
          ? old.teacherB
          : pickTeacher(data, subjectB, teacherLoad, classInfo.classId);
        subjectLoad[subjectA] = (subjectLoad[subjectA] || 0) + 1;
        subjectLoad[subjectB] = (subjectLoad[subjectB] || 0) + 1;
        teacherLoad[teacherA] = (teacherLoad[teacherA] || 0) + 1;
        teacherLoad[teacherB] = (teacherLoad[teacherB] || 0) + 1;
        result.push({
          classId: classInfo.classId,
          mode: "manual",
          subjectA,
          teacherA,
          subjectB,
          teacherB,
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      const selectedPair = pairs
        .map((pair) => {
          const teacherA = pickTeacher(data, pair[0], teacherLoad, classInfo.classId);
          const teacherB = pickTeacher(data, pair[1], teacherLoad, classInfo.classId);
          const score = (subjectLoad[pair[0]] || 0) + (subjectLoad[pair[1]] || 0) + (teacherLoad[teacherA] || 0) + (teacherLoad[teacherB] || 0);
          return { pair, teacherA, teacherB, score };
        })
        .sort((a, b) => a.score - b.score || a.pair.join("").localeCompare(b.pair.join(""), "zh-Hant"))[0];

      const [subjectA, subjectB] = selectedPair.pair;
      subjectLoad[subjectA] += 1;
      subjectLoad[subjectB] += 1;
      teacherLoad[selectedPair.teacherA] = (teacherLoad[selectedPair.teacherA] || 0) + 1;
      teacherLoad[selectedPair.teacherB] = (teacherLoad[selectedPair.teacherB] || 0) + 1;

      result.push({
        classId: classInfo.classId,
        mode: "auto",
        subjectA,
        teacherA: selectedPair.teacherA,
        subjectB,
        teacherB: selectedPair.teacherB,
        updatedAt: new Date().toISOString(),
      });
    });

    return result;
  }

  function setManual(assignments, classId, subjectA, teacherA, subjectB, teacherB) {
    const next = (assignments || []).filter((item) => item.classId !== classId);
    next.push({
      classId,
      mode: "manual",
      subjectA,
      teacherA,
      subjectB,
      teacherB,
      updatedAt: new Date().toISOString(),
    });
    return next;
  }

  function setAuto(assignments, classId) {
    return (assignments || []).map((item) =>
      item.classId === classId ? { ...item, mode: "auto", updatedAt: new Date().toISOString() } : item
    );
  }

  function assignmentForClass(assignments, classId) {
    return (assignments || []).find((item) => item.classId === classId);
  }

  function subjectsForClass(assignments, classId) {
    const row = assignmentForClass(assignments, classId);
    return row ? [row.subjectA, row.subjectB].filter(Boolean) : [];
  }

  function teacherForSubject(assignments, classId, subject) {
    const row = assignmentForClass(assignments, classId);
    if (!row) return "";
    if (row.subjectA === subject) return row.teacherA;
    if (row.subjectB === subject) return row.teacherB;
    return "";
  }

  global.DgSocialAssignment = {
    autoAssign,
    setManual,
    setAuto,
    assignmentForClass,
    subjectsForClass,
    teacherForSubject,
    socialTeachers,
  };
})(typeof window !== "undefined" ? window : globalThis);
