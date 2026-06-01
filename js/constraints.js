(function (global) {
  const TEACHER_WEEKLY_WARNING_PERIODS = 12;

  function indexBy(items, key) {
    return Object.fromEntries((items || []).map((item) => [item[key], item]));
  }

  function slotKey(lesson) {
    return [lesson.classId, lesson.week, lesson.day, lesson.blockStart || lesson.slotStart || lesson.period].join("|");
  }

  function teacherSlotKey(lesson) {
    return [lesson.teacherId, lesson.week, lesson.day, lesson.blockStart || lesson.slotStart || lesson.period].join("|");
  }

  function roomSlotKey(lesson) {
    return [lesson.roomType, lesson.week, lesson.day, lesson.blockStart || lesson.slotStart || lesson.period].join("|");
  }

  function findTeacher(data, teacherId) {
    return (data.teachers || []).find((teacher) => teacher.teacherId === teacherId);
  }

  function findClass(data, classId) {
    return (data.classes || []).find((item) => item.classId === classId);
  }

  function teacherName(data, teacherId) {
    return findTeacher(data, teacherId)?.teacherName || teacherId || "未指定教師";
  }

  function teacherSubjectLabel(teacher, subjects) {
    const subjectList = Array.from(new Set((subjects || []).filter(Boolean)));
    const subjectText =
      subjectList.join("、") || teacher?.subjectGroup || (teacher?.subjects || []).join("、") || "未指定科目";
    const name = teacher?.teacherName || teacher?.teacherId || "未指定教師";
    return `${subjectText}老師 ${name}`;
  }

  function teacherLabel(data, teacherId, subjectHint) {
    return teacherSubjectLabel(findTeacher(data, teacherId), subjectHint ? [subjectHint] : []);
  }

  function teacherLabelForLessons(data, teacherId, lessons) {
    const subjects = Array.from(new Set((lessons || []).map((lesson) => lesson.subject).filter(Boolean)));
    return teacherSubjectLabel(findTeacher(data, teacherId), subjects);
  }

  function className(data, classId) {
    return findClass(data, classId)?.className || classId || "未指定班級";
  }

  function dayLabel(day) {
    return global.DgConfig.days.find((item) => item.id === Number(day))?.label || `星期 ${day}`;
  }

  function blockLabel(blockStart) {
    return global.DgConfig.blocks.find((item) => item.start === Number(blockStart))?.label || `第 ${blockStart} 節`;
  }

  function formatSlot(lesson) {
    return `第 ${lesson.week} 週 ${dayLabel(lesson.day)} ${blockLabel(lesson.blockStart)}`;
  }

  function pushIssue(issues, level, code, message, lessonIds, detail) {
    issues.push({
      id: global.DgConfig.createId(level === "error" ? "ERR" : "WARN"),
      level,
      code,
      message,
      lessonIds: lessonIds || [],
      detail: detail || "",
      suggestion: detail || "",
    });
  }

  function getSocialSubjectsForClass(assignments, classId) {
    const row = (assignments || []).find((item) => item.classId === classId);
    if (!row) return [];
    return [row.subjectA, row.subjectB].filter(Boolean);
  }

  function teacherCanTeachClass(teacher, classId) {
    const assignedClasses = (teacher?.assignedClasses || []).map((item) => String(item).trim()).filter(Boolean);
    return (
      !assignedClasses.length ||
      assignedClasses.includes("*") ||
      assignedClasses.includes("全部") ||
      assignedClasses.includes(String(classId))
    );
  }

  function availableDaysForTeacher(teacher) {
    const days = (teacher?.availableDays || [])
      .map(Number)
      .filter((day) => Number.isFinite(day) && day >= 1 && day <= 5);
    return days.length ? days : global.DgConfig.days.map((day) => day.id);
  }

  function teacherCanTeachDay(teacher, day) {
    return availableDaysForTeacher(teacher).includes(Number(day));
  }

  function teachersForSubject(data, subject, classId, week, day) {
    return (data.teachers || []).filter((teacher) => {
      const canTeachSubject = (teacher.subjects || []).includes(subject);
      const canTeachClass = teacherCanTeachClass(teacher, classId);
      const canTeachWeek = !week || (teacher.availableWeeks || []).map(Number).includes(Number(week));
      const canTeachDay = !day || teacherCanTeachDay(teacher, day);
      return canTeachSubject && canTeachClass && canTeachWeek && canTeachDay;
    });
  }

  function teacherNames(teachers) {
    return teachers.map((teacher) => teacherSubjectLabel(teacher)).filter(Boolean).join("、");
  }

  function getGradeWeeks(classInfo) {
    return global.DgConfig.gradeSettings[String(classInfo.grade)]?.weeks || 3;
  }

  function allSlotsForClass(classInfo) {
    const slots = [];
    const weeks = getGradeWeeks(classInfo);
    for (let week = 1; week <= weeks; week += 1) {
      global.DgConfig.days.forEach((day) => {
        global.DgConfig.blocks.forEach((block) => {
          slots.push({ classId: classInfo.classId, week, day: day.id, blockStart: block.start });
        });
      });
    }
    return slots;
  }

  function lessonMatchesSlot(lesson, slot) {
    return (
      String(lesson.classId) === String(slot.classId) &&
      Number(lesson.week) === Number(slot.week) &&
      Number(lesson.day) === Number(slot.day) &&
      Number(lesson.blockStart || lesson.slotStart || lesson.period) === Number(slot.blockStart)
    );
  }

  function occupiedAt(schedule, slot) {
    return (schedule || []).find((lesson) => lessonMatchesSlot(lesson, slot));
  }

  function teacherBusyAt(schedule, teacherId, slot) {
    return (schedule || []).some(
      (lesson) =>
        lesson.teacherId === teacherId &&
        Number(lesson.week) === Number(slot.week) &&
        Number(lesson.day) === Number(slot.day) &&
        Number(lesson.blockStart || lesson.slotStart || lesson.period) === Number(slot.blockStart)
    );
  }

  function sameSubjectOnDay(schedule, slot, subject) {
    return (schedule || []).some(
      (lesson) =>
        String(lesson.classId) === String(slot.classId) &&
        Number(lesson.week) === Number(slot.week) &&
        Number(lesson.day) === Number(slot.day) &&
        lesson.subject === subject
    );
  }

  function assignedTeacherForClassSubject(schedule, classId, subject) {
    return (
      (schedule || []).find(
        (lesson) =>
          String(lesson.classId) === String(classId) &&
          lesson.subject === subject &&
          lesson.teacherId
      )?.teacherId || ""
    );
  }

  function quotaSubjectOptions(data, classInfo, quota) {
    if (!global.DgConfig.socialSubjects.includes(quota.subject) && quota.subject !== "社會") return [quota.subject];
    const assigned = getSocialSubjectsForClass(data.socialAssignments, classInfo.classId);
    return assigned.length ? assigned : global.DgConfig.socialSubjects;
  }

  function diagnoseSubjectPlacement(data, schedule, classInfo, subject, emptySlots) {
    const classLabel = classInfo.className || classInfo.classId;
    if (!emptySlots.length) return `「${subject}」暫無可嘗試的空白時段，需先空出連堂區塊。`;
    const subjectTeachers = (data.teachers || []).filter((teacher) => (teacher.subjects || []).includes(subject));
    if (!subjectTeachers.length) return `「${subject}」沒有設定可授課教師。`;

    const classTeachers = subjectTeachers.filter((teacher) => teacherCanTeachClass(teacher, classInfo.classId));
    if (!classTeachers.length) {
      return `「${subject}」教師目前未設定可授課 ${classLabel}，請檢查教師設定的「授課班級」。`;
    }

    const assignedTeacherId = assignedTeacherForClassSubject(schedule, classInfo.classId, subject);
    const candidateTeachers = assignedTeacherId
      ? classTeachers.filter((teacher) => teacher.teacherId === assignedTeacherId)
      : classTeachers;

    if (assignedTeacherId && !candidateTeachers.length) {
      return `${classLabel}「${subject}」已被同科同班規則綁定給 ${teacherLabel(
        data,
        assignedTeacherId,
        subject
      )}，但該教師不符合目前授課班級設定。`;
    }

    const emptyWeeks = Array.from(new Set(emptySlots.map((slot) => Number(slot.week)))).sort((a, b) => a - b);
    const weekTeachers = candidateTeachers.filter((teacher) =>
      emptyWeeks.some((week) => (teacher.availableWeeks || []).map(Number).includes(week))
    );
    if (!weekTeachers.length) {
      return `剩餘空白區塊在第 ${emptyWeeks.join("、")} 週，但「${subject}」可用教師的可授課週次不符合。`;
    }

    const dayTeachers = weekTeachers.filter((teacher) =>
      emptySlots.some((slot) => teacherCanTeachDay(teacher, slot.day))
    );
    if (!dayTeachers.length) {
      const emptyDays = Array.from(new Set(emptySlots.map((slot) => dayLabel(slot.day)))).sort().join("、");
      return `剩餘空白區塊在${emptyDays}，但「${subject}」可用教師的可授課星期不符合。`;
    }

    const viable = [];
    emptySlots.forEach((slot) => {
      dayTeachers.forEach((teacher) => {
        const availableWeek = (teacher.availableWeeks || []).map(Number).includes(Number(slot.week));
        if (!availableWeek) return;
        if (!teacherCanTeachDay(teacher, slot.day)) return;
        if (teacherBusyAt(schedule, teacher.teacherId, slot)) return;
        if (sameSubjectOnDay(schedule, slot, subject)) return;
        viable.push({ slot, teacher });
      });
    });

    if (!viable.length) {
      return `「${subject}」可用教師在剩餘空白時段已被其他班使用，或 ${classLabel} 當天已排過同科連堂。`;
    }

    const sample = viable[0];
    return `可嘗試在 ${formatSlot(sample.slot)} 補入「${subject}」，教師可先考慮 ${teacherSubjectLabel(sample.teacher, [
      subject,
    ])}。`;
  }

  function quotaPlacementDiagnosis(data, schedule, classInfo, quota, diff) {
    const missingBlocks = Math.ceil(diff / 2);
    const emptySlots = allSlotsForClass(classInfo).filter((slot) => !occupiedAt(schedule, slot));
    const reasons = [];

    if (!emptySlots.length) {
      reasons.push("班級課表已沒有空白連堂區塊，需要先移動或移除其他課程。");
    } else if (emptySlots.length < missingBlocks) {
      reasons.push(`還需要 ${missingBlocks} 個連堂區塊，但目前只剩 ${emptySlots.length} 個空白區塊。`);
    }

    quotaSubjectOptions(data, classInfo, quota).forEach((subject) => {
      reasons.push(diagnoseSubjectPlacement(data, schedule, classInfo, subject, emptySlots));
    });

    return reasons.filter(Boolean).join(" ");
  }

  function quotaSuggestion(data, schedule, classInfo, quota, actual) {
    const target = Number(quota.targetPeriods);
    const diff = target - actual;
    const subject = quota.subject;
    const classLabel = classInfo.className || classInfo.classId;
    const candidateMap = new Map();
    quotaSubjectOptions(data, classInfo, quota).forEach((subjectOption) => {
      teachersForSubject(data, subjectOption, classInfo.classId).forEach((teacher) => {
        candidateMap.set(teacher.teacherId, teacher);
      });
    });
    const candidateNames = teacherNames(Array.from(candidateMap.values()));

    if (diff > 0) {
      const blocks = Math.ceil(diff / 2);
      const teacherText = candidateNames
        ? `可優先安排給：${candidateNames}。`
        : "目前沒有符合科目與授課班級的教師，請先到「教師設定」檢查可授科目、可授課週次、授課班級。";
      return `建議補排 ${blocks} 個連堂區塊（${diff} 節）到 ${classLabel}「${subject}」。${teacherText}原因判斷：${quotaPlacementDiagnosis(
        data,
        schedule,
        classInfo,
        quota,
        diff
      )}`;
    }

    if (diff < 0) {
      const blocks = Math.ceil(Math.abs(diff) / 2);
      return `建議從 ${classLabel}「${subject}」移除或改排 ${blocks} 個連堂區塊（多出 ${Math.abs(diff)} 節），再把空出的時段補給缺節科目。`;
    }

    return "";
  }

  function teacherWeeklyLoadSuggestion(data, teacher, week, lessons, periods) {
    const subjectNames = Array.from(new Set((lessons || []).map((lesson) => lesson.subject).filter(Boolean)));
    const subjectText = subjectNames.length ? `本週主要科目：${subjectNames.join("、")}。` : "";
    const alternativeNames = new Set();

    (lessons || []).forEach((lesson) => {
      teachersForSubject(data, lesson.subject, lesson.classId, week)
        .filter((candidate) => candidate.teacherId !== teacher.teacherId)
        .forEach((candidate) => alternativeNames.add(teacherSubjectLabel(candidate, [lesson.subject])));
    });

    const alternativeText = alternativeNames.size
      ? `可檢查是否能將部分「班級＋科目」整組改派給：${Array.from(alternativeNames).slice(0, 4).join("、")}。`
      : "目前沒有明顯可替代的同科教師。";

    return `建議將 ${teacherSubjectLabel(
      teacher,
      subjectNames
    )} 第 ${week} 週課程由 ${periods} 節降到 ${TEACHER_WEEKLY_WARNING_PERIODS} 節以內。${subjectText}可先把部分課程移到其他可授課週次；${alternativeText}若現有教師都無法支援，建議請主任徵詢是否增加該科授課老師或協調支援教師。`;
  }

  function validateSchedule(schedule, data, options) {
    const settings = {
      includeWarnings: true,
      includeQuotaWarnings: true,
      ...(options || {}),
    };
    const issues = [];
    const teachers = indexBy(data.teachers, "teacherId");
    const classes = indexBy(data.classes, "classId");
    const rooms = indexBy(data.rooms, "roomType");
    const classSlots = new Map();
    const teacherSlots = new Map();
    const roomSlots = new Map();
    const classDaySubjects = new Map();
    const classSubjectTeachers = new Map();
    const teacherWeekLoads = new Map();
    const quotaCounts = new Map();

    (schedule || []).forEach((lesson) => {
      const lessonId = lesson.id || "";
      const blockStart = Number(lesson.blockStart || lesson.slotStart || lesson.period);
      const week = Number(lesson.week);
      const day = Number(lesson.day);
      const classInfo = classes[lesson.classId];
      const teacherInfo = teachers[lesson.teacherId];

      if (![1, 3].includes(blockStart)) {
        pushIssue(
          issues,
          "error",
          "INVALID_BLOCK_START",
          `${className(data, lesson.classId)} ${formatSlot({ ...lesson, blockStart })} 不是合法連堂起點，只能使用第 1 節或第 3 節。`,
          [lessonId]
        );
      }

      if (!classInfo) {
        pushIssue(issues, "error", "UNKNOWN_CLASS", `找不到班級 ${lesson.classId}。`, [lessonId]);
      }

      if (!teacherInfo) {
        pushIssue(
          issues,
          "error",
          "UNKNOWN_TEACHER",
          `${className(data, lesson.classId)} ${formatSlot({ ...lesson, blockStart })} 找不到教師 ${lesson.teacherId || "未指定"}。`,
          [lessonId]
        );
      } else if (!teacherInfo.availableWeeks.includes(week)) {
        pushIssue(
          issues,
          "error",
          "TEACHER_WEEK_LIMIT",
          `${teacherSubjectLabel(teacherInfo, [lesson.subject])} 不在第 ${week} 週可授課名單中。`,
          [lessonId]
        );
      } else if (!teacherCanTeachDay(teacherInfo, day)) {
        pushIssue(
          issues,
          "error",
          "TEACHER_DAY_LIMIT",
          `${teacherSubjectLabel(teacherInfo, [lesson.subject])} 不在${dayLabel(day)}可授課名單中。`,
          [lessonId]
        );
      }

      if (teacherInfo && !teacherInfo.subjects.includes(lesson.subject)) {
        pushIssue(
          issues,
          "warning",
          "TEACHER_SUBJECT_MISMATCH",
          `${teacherSubjectLabel(teacherInfo)} 的授課科目未包含「${lesson.subject}」。`,
          [lessonId]
        );
      }

      if (teacherInfo && !teacherCanTeachClass(teacherInfo, lesson.classId)) {
        pushIssue(
          issues,
          "error",
          "TEACHER_CLASS_LIMIT",
          `${teacherSubjectLabel(teacherInfo, [lesson.subject])} 未設定可授課 ${className(data, lesson.classId)}。`,
          [lessonId]
        );
      }

      if (global.DgConfig.socialSubjects.includes(lesson.subject)) {
        const allowed = getSocialSubjectsForClass(data.socialAssignments, lesson.classId);
        if (allowed.length && !allowed.includes(lesson.subject)) {
          pushIssue(
            issues,
            "error",
            "SOCIAL_SUBJECT_LIMIT",
            `${className(data, lesson.classId)} 社會科指定為 ${allowed.join("、")}，不可排入 ${lesson.subject}。`,
            [lessonId]
          );
        }
      }

      const cKey = slotKey({ ...lesson, blockStart });
      const sameClassSlot = classSlots.get(cKey) || [];
      sameClassSlot.push(lesson);
      classSlots.set(cKey, sameClassSlot);

      if (lesson.teacherId) {
        const tKey = teacherSlotKey({ ...lesson, blockStart });
        const sameTeacherSlot = teacherSlots.get(tKey) || [];
        sameTeacherSlot.push(lesson);
        teacherSlots.set(tKey, sameTeacherSlot);

        const teacherWeekKey = [lesson.teacherId, week].join("|");
        const sameTeacherWeek = teacherWeekLoads.get(teacherWeekKey) || [];
        sameTeacherWeek.push(lesson);
        teacherWeekLoads.set(teacherWeekKey, sameTeacherWeek);
      }

      if (lesson.roomType) {
        const rKey = roomSlotKey({ ...lesson, blockStart });
        const sameRoomSlot = roomSlots.get(rKey) || [];
        sameRoomSlot.push(lesson);
        roomSlots.set(rKey, sameRoomSlot);
      }

      const fatigueKey = [lesson.classId, week, day, lesson.subject].join("|");
      const sameSubjectDay = classDaySubjects.get(fatigueKey) || [];
      sameSubjectDay.push(lesson);
      classDaySubjects.set(fatigueKey, sameSubjectDay);

      if (lesson.teacherId) {
        const classSubjectKey = [lesson.classId, lesson.subject].join("|");
        const sameClassSubject = classSubjectTeachers.get(classSubjectKey) || [];
        sameClassSubject.push(lesson);
        classSubjectTeachers.set(classSubjectKey, sameClassSubject);
      }

      const quotaSubject = global.DgConfig.socialSubjects.includes(lesson.subject) ? "社會" : lesson.subject;
      const quotaKey = [lesson.classId, quotaSubject].join("|");
      quotaCounts.set(quotaKey, (quotaCounts.get(quotaKey) || 0) + 2);
    });

    classSlots.forEach((lessons) => {
      if (lessons.length > 1) {
        pushIssue(
          issues,
          "error",
          "CLASS_SLOT_DUPLICATE",
          `${className(data, lessons[0].classId)} ${formatSlot(lessons[0])} 同時排了 ${lessons.length} 個課程。`,
          lessons.map((item) => item.id)
        );
      }
    });

    teacherSlots.forEach((lessons) => {
      if (lessons.length > 1) {
        pushIssue(
          issues,
          "error",
          "TEACHER_COLLISION",
          `${teacherLabelForLessons(data, lessons[0].teacherId, lessons)} 在 ${formatSlot(lessons[0])} 同時被排到 ${lessons
            .map((item) => className(data, item.classId))
            .join("、")}。`,
          lessons.map((item) => item.id)
        );
      }
    });

    teacherWeekLoads.forEach((lessons) => {
      const teacherId = lessons[0].teacherId;
      const week = Number(lessons[0].week);
      const teacherInfo = teachers[teacherId];
      const periods = lessons.length * 2;
      if (teacherInfo && periods > TEACHER_WEEKLY_WARNING_PERIODS) {
        pushIssue(
          issues,
          "warning",
          "TEACHER_WEEKLY_LOAD_OVER_12",
          `${teacherLabelForLessons(data, teacherId, lessons)} 第 ${week} 週目前已排 ${periods} 節，超過每週 ${TEACHER_WEEKLY_WARNING_PERIODS} 節建議上限。`,
          lessons.map((item) => item.id),
          teacherWeeklyLoadSuggestion(data, teacherInfo, week, lessons, periods)
        );
      }
    });

    classSubjectTeachers.forEach((lessons) => {
      const teacherIds = Array.from(new Set(lessons.map((lesson) => lesson.teacherId).filter(Boolean)));
      if (teacherIds.length > 1) {
        pushIssue(
          issues,
          "error",
          "CLASS_SUBJECT_TEACHER_SPLIT",
          `${className(data, lessons[0].classId)}「${lessons[0].subject}」被排給 ${teacherIds
            .map((teacherId) => teacherLabel(data, teacherId, lessons[0].subject))
            .join("、")}，同一班同一科目必須由同一位老師授課。`,
          lessons.map((item) => item.id)
        );
      }
    });

    roomSlots.forEach((lessons) => {
      const room = rooms[lessons[0].roomType];
      const capacity = room ? Number(room.capacityCount) : 0;
      if (capacity > 0 && lessons.length > capacity) {
        pushIssue(
          issues,
          "error",
          "ROOM_CAPACITY",
          `${formatSlot(lessons[0])}「${lessons[0].roomType}」使用 ${lessons.length} 間，超過容量 ${capacity}。`,
          lessons.map((item) => item.id)
        );
      }
    });

    classDaySubjects.forEach((lessons) => {
      if (lessons.length >= 2) {
        pushIssue(
          issues,
          "warning",
          "CLASS_SUBJECT_FATIGUE",
          `${className(data, lessons[0].classId)} 第 ${lessons[0].week} 週 ${dayLabel(lessons[0].day)}「${lessons[0].subject}」連上 4 節。`,
          lessons.map((item) => item.id)
        );
      }
    });

    if (settings.includeWarnings && settings.includeQuotaWarnings && schedule.length) {
      (data.classes || []).forEach((classInfo) => {
        const quotas = (data.courseQuotas || []).filter((quota) => String(quota.grade) === String(classInfo.grade));
        const missingQuotas = [];
        quotas.forEach((quota) => {
          const key = [classInfo.classId, quota.subject].join("|");
          const actual = quotaCounts.get(key) || 0;
          if (actual < Number(quota.targetPeriods)) {
            missingQuotas.push({ quota, actual, missing: Number(quota.targetPeriods) - actual });
          }
          if (actual !== Number(quota.targetPeriods)) {
            pushIssue(
              issues,
              "warning",
              "QUOTA_MISMATCH",
              `${classInfo.className}「${quota.subject}」目前 ${actual} 節，目標 ${quota.targetPeriods} 節。`,
              [],
              quotaSuggestion(data, schedule, classInfo, quota, actual)
            );
          }
        });

        const emptySlots = allSlotsForClass(classInfo).filter((slot) => !occupiedAt(schedule, slot));
        if (emptySlots.length && missingQuotas.length) {
          const missingText = missingQuotas
            .map((item) => `「${item.quota.subject}」差 ${item.missing} 節`)
            .join("、");
          const slotText = emptySlots
            .slice(0, 5)
            .map((slot) => formatSlot(slot))
            .join("、");
          pushIssue(
            issues,
            "warning",
            "CLASS_EMPTY_BLOCKS",
            `${classInfo.className} 尚有 ${emptySlots.length} 個空白連堂區塊；未排滿科目：${missingText}。`,
            [],
            `空白區塊包含：${slotText}${emptySlots.length > 5 ? "等" : ""}。原因可先看上方 QUOTA_MISMATCH 的診斷；通常與可授課教師、授課週次、授課星期、同班同科同師規則，或可用空白時段不足有關。`
          );
        }
      });
    }

    if (!settings.includeWarnings) {
      return issues.filter((issue) => issue.level === "error");
    }
    return issues;
  }

  function getHardErrors(schedule, data) {
    return validateSchedule(schedule, data, { includeWarnings: false });
  }

  function lessonsWithIssues(schedule, issues) {
    const ids = new Set();
    (issues || []).forEach((issue) => (issue.lessonIds || []).forEach((id) => ids.add(id)));
    return new Set((schedule || []).filter((lesson) => ids.has(lesson.id)).map((lesson) => lesson.id));
  }

  global.DgConstraints = {
    slotKey,
    teacherSlotKey,
    roomSlotKey,
    validateSchedule,
    getHardErrors,
    lessonsWithIssues,
    teacherName,
    className,
    dayLabel,
    blockLabel,
    formatSlot,
    teacherCanTeachClass,
    teacherCanTeachDay,
  };
})(typeof window !== "undefined" ? window : globalThis);
