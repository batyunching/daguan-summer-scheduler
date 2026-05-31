(function (global) {
  function teacherLoadMap(schedule) {
    const map = {};
    (schedule || []).forEach((lesson) => {
      if (!lesson.teacherId) return;
      map[lesson.teacherId] = (map[lesson.teacherId] || 0) + 2;
    });
    return map;
  }

  function scorePlacement(schedule, candidate, data) {
    let score = 0;
    const load = teacherLoadMap(schedule);
    const sameTeacherDay = schedule.filter(
      (lesson) =>
        lesson.teacherId === candidate.teacherId &&
        Number(lesson.week) === Number(candidate.week) &&
        Number(lesson.day) === Number(candidate.day)
    );
    const sameClassDaySubject = schedule.filter(
      (lesson) =>
        lesson.classId === candidate.classId &&
        Number(lesson.week) === Number(candidate.week) &&
        Number(lesson.day) === Number(candidate.day) &&
        lesson.subject === candidate.subject
    );
    const sameRoomSlot = schedule.filter(
      (lesson) =>
        lesson.roomType === candidate.roomType &&
        Number(lesson.week) === Number(candidate.week) &&
        Number(lesson.day) === Number(candidate.day) &&
        Number(lesson.blockStart) === Number(candidate.blockStart)
    );

    score += (load[candidate.teacherId] || 0) * 0.6;
    score += sameRoomSlot.length * 2;
    score += sameClassDaySubject.length * 12;
    if (sameTeacherDay.length > 0) score -= 3;

    const blockPreference = Number(candidate.blockStart) === 1 ? 0.2 : 0.4;
    score += blockPreference;
    return score;
  }

  function subjectsForTeacher(schedule, teacherId) {
    return Array.from(
      new Set((schedule || []).filter((lesson) => lesson.teacherId === teacherId).map((lesson) => lesson.subject).filter(Boolean))
    );
  }

  function alternateTeacherNames(data, teacher, subjects) {
    return (data.teachers || [])
      .filter(
        (candidate) =>
          candidate.teacherId !== teacher.teacherId &&
          subjects.some((subject) => (candidate.subjects || []).includes(subject))
      )
      .map((candidate) => `${(candidate.subjectGroup || (candidate.subjects || []).join("、") || "未指定科目")}老師 ${candidate.teacherName || candidate.teacherId}`)
      .slice(0, 3)
      .join("、");
  }

  function analyze(schedule, data) {
    const recommendations = [];
    const load = teacherLoadMap(schedule);
    const teachers = data.teachers || [];
    const values = Object.values(load);
    const avg = values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : 0;

    teachers.forEach((teacher) => {
      const actual = load[teacher.teacherId] || 0;
      if (actual > avg + 8) {
        const subjects = subjectsForTeacher(schedule, teacher.teacherId);
        const alternatives = alternateTeacherNames(data, teacher, subjects);
        const subjectText = subjects.length ? `主要集中在「${subjects.join("、")}」。` : "";
        const alternativeText = alternatives
          ? `可優先檢查是否能把部分同科課程改給 ${alternatives}。`
          : "目前找不到明顯的同科替代教師，請檢查教師設定是否有其他老師可授此科與班級。";
        const teacherLabel = `${(subjects.join("、") || teacher.subjectGroup || "未指定科目")}老師 ${teacher.teacherName}`;
        recommendations.push({
          level: "warning",
          title: `${teacherLabel} 授課負荷偏高`,
          body: `目前已排 ${actual} 節，平均約 ${Math.round(avg)} 節。${subjectText}${alternativeText}`,
        });
      }
    });

    const roomPeaks = {};
    (schedule || []).forEach((lesson) => {
      if (!lesson.roomType || lesson.roomType === "普通") return;
      const key = [lesson.roomType, lesson.week, lesson.day, lesson.blockStart].join("|");
      roomPeaks[key] = (roomPeaks[key] || 0) + 1;
    });

    Object.entries(roomPeaks).forEach(([key, count]) => {
      const [roomType, week, day, blockStart] = key.split("|");
      const room = (data.rooms || []).find((item) => item.roomType === roomType);
      if (room && count >= Number(room.capacityCount)) {
        recommendations.push({
          level: "info",
          title: `${roomType} 使用接近上限`,
          body: `第 ${week} 週 ${global.DgConstraints.dayLabel(day)} ${global.DgConstraints.blockLabel(blockStart)} 已使用 ${count} 間。若後續手動調課，建議優先避開此時段。`,
        });
      }
    });

    const hardIssues = global.DgConstraints.getHardErrors(schedule, data);
    if (hardIssues.length) {
      recommendations.unshift({
        level: "error",
        title: "目前仍有硬性衝突",
        body: `共有 ${hardIssues.length} 筆硬性衝突，請先處理再儲存到正式版本。`,
      });
    }

    if (!recommendations.length) {
      recommendations.push({
        level: "ok",
        title: "規則式最佳化檢查通過",
        body: "目前沒有發現明顯負荷失衡或場地尖峰；可以進行版本儲存或匯出。",
      });
    }
    return recommendations;
  }

  global.DgAiOptimizer = {
    scorePlacement,
    analyze,
    teacherLoadMap,
  };
})(typeof window !== "undefined" ? window : globalThis);
