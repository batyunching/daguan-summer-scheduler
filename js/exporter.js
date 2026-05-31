(function (global) {
  function csvEscape(value) {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  }

  function toCsv(rows) {
    if (!rows.length) return "";
    const headers = Object.keys(rows[0]);
    const body = rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","));
    return [headers.join(","), ...body].join("\n");
  }

  function downloadCsv(filename, rows) {
    const csv = "\ufeff" + toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function baseRows(schedule, data) {
    return (schedule || [])
      .slice()
      .sort((a, b) => a.week - b.week || a.day - b.day || a.blockStart - b.blockStart || a.classId.localeCompare(b.classId))
      .map((lesson) => ({
        週次: `第 ${lesson.week} 週`,
        週次日期: global.DgConfig.getWeekDateRange(lesson.week, data),
        日期: global.DgConfig.formatMonthDay(global.DgConfig.getDayDate(lesson.week, lesson.day, data)),
        星期: global.DgConstraints.dayLabel(lesson.day),
        節次: global.DgConstraints.blockLabel(lesson.blockStart),
        班級: global.DgConstraints.className(data, lesson.classId),
        科目: lesson.subject,
        教師: global.DgConstraints.teacherName(data, lesson.teacherId),
        場地: lesson.roomType || "",
        鎖定: lesson.isLocked ? "是" : "否",
        備註: lesson.note || "",
      }));
  }

  function classRows(schedule, data, classId) {
    return baseRows(
      (schedule || []).filter((lesson) => lesson.classId === classId),
      data
    );
  }

  function teacherRows(schedule, data, teacherId) {
    return baseRows(
      (schedule || []).filter((lesson) => lesson.teacherId === teacherId),
      data
    );
  }

  function printSchedule() {
    document.body.classList.add("print-schedule");
    window.print();
    setTimeout(() => document.body.classList.remove("print-schedule"), 500);
  }

  global.DgExporter = {
    downloadCsv,
    classRows,
    teacherRows,
    allRows: baseRows,
    printSchedule,
  };
})(typeof window !== "undefined" ? window : globalThis);
