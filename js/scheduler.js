(function (global) {
  function getGradeWeeks(grade) {
    return global.DgConfig.gradeSettings[String(grade)]?.weeks || 3;
  }

  function allSlotsForClass(classInfo) {
    const slots = [];
    const weeks = getGradeWeeks(classInfo.grade);
    for (let week = 1; week <= weeks; week += 1) {
      global.DgConfig.days.forEach((day) => {
        global.DgConfig.blocks.forEach((block) => {
          slots.push({ classId: classInfo.classId, week, day: day.id, blockStart: block.start });
        });
      });
    }
    return slots;
  }

  function normalizeLesson(raw, source) {
    const blockStart = Number(raw.blockStart || raw.slotStart || raw.period);
    return {
      id: raw.id || global.DgConfig.createId(source === "pre" ? "PRE" : "L"),
      versionId: raw.versionId || "",
      week: Number(raw.week),
      day: Number(raw.day),
      blockStart,
      classId: raw.classId,
      subject: raw.subject,
      teacherId: raw.teacherId,
      roomType: raw.roomType || "普通",
      isLocked: raw.isLocked === true || String(raw.isLocked).toUpperCase() === "TRUE",
      fatigueApproved:
        raw.fatigueApproved === true ||
        String(raw.fatigueApproved || "").toUpperCase() === "TRUE" ||
        String(raw.fatigueApproved || "") === "是",
      note: raw.note || "",
      source: raw.source || source || "manual",
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  function preAssignmentsToSchedule(data) {
    return (data.preAssignments || []).map((item) => normalizeLesson(item, "pre"));
  }

  function lessonMatchesSlot(lesson, slot) {
    return (
      String(lesson.classId) === String(slot.classId) &&
      Number(lesson.week) === Number(slot.week) &&
      Number(lesson.day) === Number(slot.day) &&
      Number(lesson.blockStart) === Number(slot.blockStart)
    );
  }

  function occupiedAt(schedule, slot, ignoreIds) {
    const ignore = new Set(ignoreIds || []);
    return (schedule || []).find((lesson) => !ignore.has(lesson.id) && lessonMatchesSlot(lesson, slot));
  }

  function quotaSubject(subject) {
    return global.DgConfig.socialSubjects.includes(subject) ? "社會" : subject;
  }

  function countPeriods(schedule, classId, subject) {
    return (schedule || [])
      .filter((lesson) => String(lesson.classId) === String(classId) && quotaSubject(lesson.subject) === subject)
      .reduce((sum) => sum + 2, 0);
  }

  function countSubjectPeriods(schedule, classId, subject) {
    return (schedule || [])
      .filter((lesson) => String(lesson.classId) === String(classId) && lesson.subject === subject)
      .reduce((sum) => sum + 2, 0);
  }

  function countSubjectBlocksByWeek(schedule, classId, subject) {
    const counts = {};
    (schedule || []).forEach((lesson) => {
      if (String(lesson.classId) !== String(classId) || lesson.subject !== subject) return;
      counts[Number(lesson.week)] = (counts[Number(lesson.week)] || 0) + 1;
    });
    return counts;
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

  function teacherUnavailableDateKeys(teacher) {
    return new Set((teacher?.unavailableDates || []).map(String).filter(Boolean));
  }

  function slotDateKey(week, day, data) {
    return global.DgConfig.dateKey(global.DgConfig.getDayDate(week, day, data));
  }

  function teacherCanTeachDate(teacher, week, day, data) {
    if (!teacher || !week || !day) return true;
    const key = slotDateKey(week, day, data);
    return !teacherUnavailableDateKeys(teacher).has(key);
  }

  function schedulePeriodsForTeacher(teacher) {
    const periods = (teacher?.schedulePeriods || [])
      .map(Number)
      .filter((period) => Number.isFinite(period) && period >= 1 && period <= 4);
    return periods.length ? periods : [1, 2, 3, 4];
  }

  function blockPeriods(blockStart) {
    return global.DgConfig.blocks.find((block) => Number(block.start) === Number(blockStart))?.periods || [Number(blockStart)];
  }

  function teacherCanTeachBlock(teacher, blockStart) {
    if (!teacher || !blockStart) return true;
    const allowed = schedulePeriodsForTeacher(teacher);
    return blockPeriods(blockStart).every((period) => allowed.includes(Number(period)));
  }

  function teacherCanTeach(teacher, subject, week, classId, day, data, blockStart) {
    return (
      teacher &&
      (teacher.subjects || []).includes(subject) &&
      (teacher.availableWeeks || []).map(Number).includes(Number(week)) &&
      (!day || teacherCanTeachDay(teacher, day)) &&
      (!day || teacherCanTeachDate(teacher, week, day, data)) &&
      (!blockStart || teacherCanTeachBlock(teacher, blockStart)) &&
      teacherCanTeachClass(teacher, classId)
    );
  }

  function teacherCanTeachSubjectClass(teacher, subject, classId) {
    return teacher && (teacher.subjects || []).includes(subject) && teacherCanTeachClass(teacher, classId);
  }

  function weeksForTeacher(classInfo, teacher) {
    const gradeWeeks = getGradeWeeks(classInfo.grade);
    const available = (teacher?.availableWeeks || [])
      .map(Number)
      .filter((week) => Number.isFinite(week) && week >= 1 && week <= gradeWeeks);
    return Array.from(new Set(available)).sort((a, b) => a - b);
  }

  function weeklyLoad(schedule, teacherId, week) {
    return (schedule || []).filter((lesson) => lesson.teacherId === teacherId && Number(lesson.week) === Number(week)).length * 2;
  }

  function assignedTeacherForClassSubject(schedule, classId, subject, ignoreIds) {
    const ignore = new Set(ignoreIds || []);
    return (
      (schedule || []).find(
        (lesson) =>
          !ignore.has(lesson.id) &&
          String(lesson.classId) === String(classId) &&
          lesson.subject === subject &&
          lesson.teacherId
      )?.teacherId || ""
    );
  }

  function chooseTeacher(data, classId, subject, week, schedule, preferredTeacherId, ignoreIds, day, blockStart) {
    const assignedTeacherId = assignedTeacherForClassSubject(schedule, classId, subject, ignoreIds);
    if (assignedTeacherId) {
      const teacher = (data.teachers || []).find((item) => item.teacherId === assignedTeacherId);
      return teacherCanTeach(teacher, subject, week, classId, day, data, blockStart) ? assignedTeacherId : "";
    }

    if (preferredTeacherId) {
      const teacher = (data.teachers || []).find((item) => item.teacherId === preferredTeacherId);
      if (teacherCanTeach(teacher, subject, week, classId, day, data, blockStart)) return preferredTeacherId;
    }

    const load = global.DgAiOptimizer.teacherLoadMap(schedule);
    return (data.teachers || [])
      .filter((teacher) => teacherCanTeach(teacher, subject, week, classId, day, data, blockStart))
      .slice()
      .sort((a, b) => {
        const weeklyA = weeklyLoad(schedule, a.teacherId, week);
        const weeklyB = weeklyLoad(schedule, b.teacherId, week);
        const maxA = Number(a.maxWeeklyPeriods || 20);
        const maxB = Number(b.maxWeeklyPeriods || 20);
        const scoreA = (load[a.teacherId] || 0) + Math.max(0, weeklyA - maxA) * 4;
        const scoreB = (load[b.teacherId] || 0) + Math.max(0, weeklyB - maxB) * 4;
        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.teacherName.localeCompare(b.teacherName, "zh-Hant");
      })[0]?.teacherId || "";
  }

  function chooseTeacherForSubject(data, classInfo, subject, schedule, preferredTeacherId, plannedLoad) {
    const assignedTeacherId = assignedTeacherForClassSubject(schedule, classInfo.classId, subject);
    if (assignedTeacherId) {
      const assignedTeacher = (data.teachers || []).find((teacher) => teacher.teacherId === assignedTeacherId);
      if (teacherCanTeachSubjectClass(assignedTeacher, subject, classInfo.classId) && weeksForTeacher(classInfo, assignedTeacher).length) {
        return assignedTeacher;
      }
    }

    if (preferredTeacherId) {
      const preferredTeacher = (data.teachers || []).find((teacher) => teacher.teacherId === preferredTeacherId);
      if (teacherCanTeachSubjectClass(preferredTeacher, subject, classInfo.classId) && weeksForTeacher(classInfo, preferredTeacher).length) {
        return preferredTeacher;
      }
    }

    return (data.teachers || [])
      .filter((teacher) => teacherCanTeachSubjectClass(teacher, subject, classInfo.classId) && weeksForTeacher(classInfo, teacher).length)
      .slice()
      .sort((a, b) => {
        const loadA = plannedLoad[a.teacherId] || 0;
        const loadB = plannedLoad[b.teacherId] || 0;
        if (loadA !== loadB) return loadA - loadB;
        const weeksA = weeksForTeacher(classInfo, a).length;
        const weeksB = weeksForTeacher(classInfo, b).length;
        if (weeksA !== weeksB) return weeksB - weeksA;
        return a.teacherName.localeCompare(b.teacherName, "zh-Hant");
      })[0] || null;
  }

  function distributeBlocksAcrossWeeks(totalBlocks, availableWeeks, gradeWeeks) {
    const weeks = (availableWeeks.length ? availableWeeks : Array.from({ length: gradeWeeks }, (_, index) => index + 1))
      .filter((week) => week >= 1 && week <= gradeWeeks)
      .sort((a, b) => a - b);
    const plan = Object.fromEntries(weeks.map((week) => [week, 0]));
    if (!totalBlocks || !weeks.length) return plan;

    if (weeks.length >= gradeWeeks) {
      for (let index = 0; index < totalBlocks; index += 1) {
        plan[weeks[index % weeks.length]] += 1;
      }
      return plan;
    }

    const compressedLimit = Math.max(1, Math.ceil(totalBlocks / weeks.length));
    let remaining = totalBlocks;
    for (const week of weeks) {
      const blocks = Math.min(compressedLimit, remaining);
      plan[week] += blocks;
      remaining -= blocks;
      if (remaining <= 0) break;
    }
    let index = 0;
    while (remaining > 0) {
      plan[weeks[index % weeks.length]] += 1;
      remaining -= 1;
      index += 1;
    }
    return plan;
  }

  function pushWeeklyTasks(tasks, taskBase, totalBlocks, classInfo, teacher, preservedSchedule) {
    const gradeWeeks = getGradeWeeks(classInfo.grade);
    const weeklyPlan = distributeBlocksAcrossWeeks(totalBlocks, weeksForTeacher(classInfo, teacher), gradeWeeks);
    const existingByWeek = countSubjectBlocksByWeek(preservedSchedule, classInfo.classId, taskBase.subject);

    Object.entries(weeklyPlan).forEach(([weekText, targetBlocks]) => {
      const week = Number(weekText);
      const neededBlocks = Math.max(0, Number(targetBlocks) - (existingByWeek[week] || 0));
      for (let index = 0; index < neededBlocks; index += 1) {
        tasks.push({
          ...taskBase,
          week,
          fixedTeacherId: teacher?.teacherId || "",
        });
      }
    });
  }

  function buildTasks(data, preservedSchedule) {
    const tasks = [];
    const plannedLoad = {};
    (data.classes || []).forEach((classInfo) => {
      const quotas = (data.courseQuotas || []).filter((quota) => String(quota.grade) === String(classInfo.grade));
      quotas.forEach((quota) => {
        if (quota.subject === "社會") {
          const assignment = global.DgSocialAssignment.assignmentForClass(data.socialAssignments, classInfo.classId);
          const socialSubjects = assignment ? [assignment.subjectA, assignment.subjectB].filter(Boolean) : ["公民", "歷史"];
          const targetBlocks = Math.max(0, Math.floor(Number(quota.targetPeriods) / 2));
          const targetBySubject = {};
          for (let index = 0; index < targetBlocks; index += 1) {
            const subject = socialSubjects[index % socialSubjects.length];
            targetBySubject[subject] = (targetBySubject[subject] || 0) + 2;
          }
          Object.entries(targetBySubject).forEach(([subject, targetPeriods]) => {
            const targetBlocksForSubject = Math.max(0, Math.floor(Number(targetPeriods) / 2));
            const preferredTeacherId = global.DgSocialAssignment.teacherForSubject(data.socialAssignments, classInfo.classId, subject);
            const teacher = chooseTeacherForSubject(data, classInfo, subject, preservedSchedule, preferredTeacherId, plannedLoad);
            pushWeeklyTasks(
              tasks,
              {
                classId: classInfo.classId,
                grade: classInfo.grade,
                subject,
                roomType: quota.roomType,
                preferredTeacherId,
                difficulty: 4,
                priority: targetBlocks,
              },
              targetBlocksForSubject,
              classInfo,
              teacher,
              preservedSchedule
            );
            if (teacher) plannedLoad[teacher.teacherId] = (plannedLoad[teacher.teacherId] || 0) + targetBlocksForSubject * 2;
          });
          return;
        }

        const targetBlocks = Math.max(0, Math.floor(Number(quota.targetPeriods) / 2));
        const teacher = chooseTeacherForSubject(data, classInfo, quota.subject, preservedSchedule, "", plannedLoad);
        pushWeeklyTasks(
          tasks,
          {
            classId: classInfo.classId,
            grade: classInfo.grade,
            subject: quota.subject,
            roomType: quota.roomType,
            preferredTeacherId: "",
            difficulty: quota.roomType === "普通" ? 1 : 3,
            priority: Number(quota.targetPeriods) || 0,
          },
          targetBlocks,
          classInfo,
          teacher,
          preservedSchedule
        );
        if (teacher) plannedLoad[teacher.teacherId] = (plannedLoad[teacher.teacherId] || 0) + targetBlocks * 2;
      });
    });

    return tasks.sort((a, b) => {
      if (b.difficulty !== a.difficulty) return b.difficulty - a.difficulty;
      if (a.week !== b.week) return Number(a.week || 0) - Number(b.week || 0);
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (a.subject !== b.subject) return a.subject.localeCompare(b.subject, "zh-Hant");
      return String(a.classId).localeCompare(String(b.classId), "zh-Hant");
    });
  }

  function preservedLessons(existingSchedule, data) {
    const keep = (existingSchedule || []).filter(
      (lesson) => lesson.isLocked || lesson.source === "manual" || lesson.source === "pre"
    );
    const preLessons = preAssignmentsToSchedule(data);
    preLessons.forEach((preLesson) => {
      const alreadyKept = keep.some((lesson) => lessonMatchesSlot(lesson, preLesson));
      if (!alreadyKept) keep.push(preLesson);
    });
    return keep.map((lesson) => normalizeLesson(lesson, lesson.source || "manual"));
  }

  function findBestPlacement(task, schedule, data) {
    const classInfo = (data.classes || []).find((item) => String(item.classId) === String(task.classId));
    if (!classInfo) return null;

    let best = null;
    allSlotsForClass(classInfo)
      .filter((slot) => !task.week || Number(slot.week) === Number(task.week))
      .forEach((slot) => {
      if (occupiedAt(schedule, slot)) return;
      if (sameClassSubjectDay(schedule, task.classId, slot.week, slot.day, task.subject)) return;
      const teacherId = chooseTeacher(
        data,
        task.classId,
        task.subject,
        slot.week,
        schedule,
        task.fixedTeacherId || task.preferredTeacherId,
        undefined,
        slot.day,
        slot.blockStart
      );
      if (!teacherId) return;
      const candidate = normalizeLesson(
        {
          ...slot,
          subject: task.subject,
          teacherId,
          roomType: task.roomType,
          isLocked: false,
          source: "auto",
        },
        "auto"
      );
      const hardErrors = global.DgConstraints.getHardErrors([...schedule, candidate], data);
      if (hardErrors.length) return;
      const score = global.DgAiOptimizer.scorePlacement(schedule, candidate, data);
      if (!best || score < best.score) {
        best = { lesson: candidate, score };
      }
    });
    return best?.lesson || null;
  }

  function tryRepairUnplaced(task, schedule, data) {
    const classInfo = (data.classes || []).find((item) => String(item.classId) === String(task.classId));
    if (!classInfo) return null;
    const emptySlots = allSlotsForClass(classInfo).filter((slot) => !occupiedAt(schedule, slot));
    const movableLessons = schedule.filter(
      (lesson) =>
        String(lesson.classId) === String(task.classId) &&
        !lesson.isLocked &&
        lesson.source === "auto" &&
        lesson.subject !== task.subject
    );

    for (const emptySlot of emptySlots) {
      for (const lessonToMove of movableLessons) {
        const sourceSlot = {
          classId: lessonToMove.classId,
          week: lessonToMove.week,
          day: lessonToMove.day,
          blockStart: lessonToMove.blockStart,
        };
        if (task.week && Number(sourceSlot.week) !== Number(task.week)) continue;
        const teacherForTask = chooseTeacher(
          data,
          task.classId,
          task.subject,
          sourceSlot.week,
          schedule.filter((lesson) => lesson.id !== lessonToMove.id),
          task.fixedTeacherId || task.preferredTeacherId,
          undefined,
          sourceSlot.day,
          sourceSlot.blockStart
        );
        if (!teacherForTask) continue;

        const next = schedule.filter((lesson) => lesson.id !== lessonToMove.id);
        if (sameClassSubjectDay(next, task.classId, sourceSlot.week, sourceSlot.day, task.subject)) continue;
        if (sameClassSubjectDay(next, lessonToMove.classId, emptySlot.week, emptySlot.day, lessonToMove.subject)) continue;

        const movedLesson = {
          ...lessonToMove,
          ...emptySlot,
          updatedAt: new Date().toISOString(),
        };
        const insertedLesson = normalizeLesson(
          {
            ...sourceSlot,
            subject: task.subject,
            teacherId: teacherForTask,
            roomType: task.roomType,
            source: "auto",
            isLocked: false,
          },
          "auto"
        );
        next.push(movedLesson, insertedLesson);
        if (!global.DgConstraints.getHardErrors(next, data).length) {
          return next;
        }
      }
    }
    return null;
  }

  function teacherLabel(teacher, subject) {
    const subjectText = subject || teacher?.subjectGroup || (teacher?.subjects || []).join("、") || "未指定科目";
    const name = teacher?.teacherName || teacher?.teacherId || "未指定教師";
    return `${subjectText}老師 ${name}`;
  }

  function explainUnplacedTask(task, schedule, data) {
    const classInfo = (data.classes || []).find((item) => String(item.classId) === String(task.classId));
    if (!classInfo) return `找不到班級 ${task.classId}，請檢查「班級設定」。`;

    const classLabel = classInfo.className || classInfo.classId;
    const slots = allSlotsForClass(classInfo).filter((slot) => !task.week || Number(slot.week) === Number(task.week));
    const emptySlots = slots.filter((slot) => !occupiedAt(schedule, slot));
    if (!emptySlots.length) {
      return `${classLabel} 第 ${task.week || "指定"} 週已沒有空白連堂區塊，需先移動或移除其他課程。`;
    }

    const subjectTeachers = (data.teachers || []).filter((teacher) => (teacher.subjects || []).includes(task.subject));
    if (!subjectTeachers.length) return `「${task.subject}」沒有設定可授課教師。`;

    const classTeachers = subjectTeachers.filter((teacher) => teacherCanTeachClass(teacher, task.classId));
    if (!classTeachers.length) {
      return `「${task.subject}」教師未設定可授課 ${classLabel}，請檢查教師設定的「授課班級」。`;
    }

    const preferredId = task.fixedTeacherId || task.preferredTeacherId || "";
    const candidateTeachers = preferredId
      ? classTeachers.filter((teacher) => teacher.teacherId === preferredId)
      : classTeachers;
    if (preferredId && !candidateTeachers.length) {
      return `${classLabel}「${task.subject}」已指定 ${preferredId}，但該教師不符合科目或授課班級設定。`;
    }

    const emptyWeeks = Array.from(new Set(emptySlots.map((slot) => Number(slot.week)))).sort((a, b) => a - b);
    const weekTeachers = candidateTeachers.filter((teacher) =>
      emptyWeeks.some((week) => (teacher.availableWeeks || []).map(Number).includes(week))
    );
    if (!weekTeachers.length) {
      return `剩餘空白區塊在第 ${emptyWeeks.join("、")} 週，但「${task.subject}」教師的可授課週次不符合。`;
    }

    const dayTeachers = weekTeachers.filter((teacher) =>
      emptySlots.some((slot) => teacherCanTeachDay(teacher, slot.day))
    );
    if (!dayTeachers.length) {
      const emptyDays = Array.from(new Set(emptySlots.map((slot) => global.DgConstraints.dayLabel(slot.day)))).sort().join("、");
      return `剩餘空白區塊在${emptyDays}，但「${task.subject}」教師的可授課星期不符合。`;
    }

    const dateTeachers = dayTeachers.filter((teacher) =>
      emptySlots.some((slot) => teacherCanTeachDate(teacher, slot.week, slot.day, data))
    );
    if (!dateTeachers.length) {
      const emptyDates = Array.from(
        new Set(emptySlots.map((slot) => global.DgConfig.formatMonthDay(global.DgConfig.getDayDate(slot.week, slot.day, data))))
      )
        .slice(0, 8)
        .join("、");
      return `剩餘空白日期 ${emptyDates} 都落在「${task.subject}」教師的不可排課日期，請調整教師設定或改排其他日期。`;
    }

    const blockTeachers = dateTeachers.filter((teacher) =>
      emptySlots.some((slot) => teacherCanTeachBlock(teacher, slot.blockStart))
    );
    if (!blockTeachers.length) {
      const emptyBlocks = Array.from(new Set(emptySlots.map((slot) => global.DgConstraints.blockLabel(slot.blockStart))))
        .slice(0, 4)
        .join("、");
      return `剩餘空白區塊為${emptyBlocks}，但「${task.subject}」教師的排課節次不符合，請調整「排課節次」或改排其他節次。`;
    }

    let occupiedByTeacher = 0;
    let blockedBySameSubjectDay = 0;
    let hardErrorSample = "";
    for (const slot of emptySlots) {
      for (const teacher of blockTeachers) {
        if (!(teacher.availableWeeks || []).map(Number).includes(Number(slot.week))) continue;
        if (!teacherCanTeachDay(teacher, slot.day)) continue;
        if (!teacherCanTeachDate(teacher, slot.week, slot.day, data)) continue;
        if (!teacherCanTeachBlock(teacher, slot.blockStart)) continue;
        if (teacherBusyAtSlot(schedule, teacher.teacherId, slot)) {
          occupiedByTeacher += 1;
          continue;
        }
        if (sameClassSubjectDay(schedule, task.classId, slot.week, slot.day, task.subject)) {
          blockedBySameSubjectDay += 1;
          continue;
        }

        const candidate = normalizeLesson(
          {
            ...slot,
            subject: task.subject,
            teacherId: teacher.teacherId,
            roomType: task.roomType,
            source: "auto",
            isLocked: false,
          },
          "auto"
        );
        const hardErrors = global.DgConstraints.getHardErrors([...schedule, candidate], data);
        if (!hardErrors.length) {
          return `仍可嘗試手動補排：${classLabel} ${formatSlot(slot)}「${task.subject}」，教師可先考慮 ${teacherLabel(
            teacher,
            task.subject
          )}。`;
        }
        hardErrorSample = hardErrors[0]?.message || hardErrorSample;
      }
    }

    if (occupiedByTeacher) return `可授課教師在剩餘空白時段多數已被其他班使用，請嘗試換週次、換時段或增加同科授課老師。`;
    if (blockedBySameSubjectDay) return `${classLabel} 剩餘空白日期多半已排過「${task.subject}」連堂，需避免同一天同科連上 4 節。`;
    return hardErrorSample || `排課器找不到符合所有限制的時段，請檢查教師週次、授課班級、場地容量與鎖定課程。`;
  }

  function teacherBusyAtSlot(schedule, teacherId, slot) {
    return (schedule || []).some(
      (lesson) =>
        lesson.teacherId === teacherId &&
        Number(lesson.week) === Number(slot.week) &&
        Number(lesson.day) === Number(slot.day) &&
        Number(lesson.blockStart) === Number(slot.blockStart)
    );
  }

  function sameClassSubjectDay(schedule, classId, week, day, subject) {
    return (schedule || []).some(
      (lesson) =>
        String(lesson.classId) === String(classId) &&
        Number(lesson.week) === Number(week) &&
        Number(lesson.day) === Number(day) &&
        lesson.subject === subject
    );
  }

  function formatSlot(slot) {
    return `第 ${slot.week} 週 ${global.DgConstraints.dayLabel(slot.day)} ${global.DgConstraints.blockLabel(slot.blockStart)}`;
  }

  function autoSchedule(data, existingSchedule) {
    const schedule = preservedLessons(existingSchedule, data);
    const tasks = buildTasks(data, schedule);
    const unplaced = [];

    tasks.forEach((task) => {
      const lesson = findBestPlacement(task, schedule, data);
      if (lesson) {
        schedule.push(lesson);
      } else {
        const repaired = tryRepairUnplaced(task, schedule, data);
        if (repaired) {
          schedule.splice(0, schedule.length, ...repaired);
        } else {
          unplaced.push({ ...task, reason: explainUnplacedTask(task, schedule, data) });
        }
      }
    });

    return {
      schedule,
      unplaced,
      issues: global.DgConstraints.validateSchedule(schedule, data),
    };
  }

  function moveFatigueWarnings(schedule, current, targetLesson, originalSlot, targetSlot, data) {
    const warnings = [];
    const classLabel = (classId) => global.DgConstraints.className(data, classId);
    const dayLabel = (day) => global.DgConstraints.dayLabel(day);
    const countSubjectBlocks = (slot, subject) =>
      (schedule || []).filter(
        (lesson) =>
          String(lesson.classId) === String(slot.classId) &&
          Number(lesson.week) === Number(slot.week) &&
          Number(lesson.day) === Number(slot.day) &&
          lesson.subject === subject
      ).length;

    if (countSubjectBlocks(targetSlot, current.subject) >= 2) {
      warnings.push(
        `${classLabel(current.classId)} 第 ${targetSlot.week} 週 ${dayLabel(targetSlot.day)}「${current.subject}」會變成同一天 4 節。`
      );
    }

    if (targetLesson && countSubjectBlocks(originalSlot, targetLesson.subject) >= 2) {
      warnings.push(
        `${classLabel(targetLesson.classId)} 第 ${originalSlot.week} 週 ${dayLabel(originalSlot.day)}「${targetLesson.subject}」會變成同一天 4 節。`
      );
    }

    return warnings;
  }

  function approveFatigueGroups(schedule, groups) {
    const approvedKeys = new Set(
      (groups || [])
        .filter((item) => item?.slot && item?.subject)
        .map((item) => [item.slot.classId, item.slot.week, item.slot.day, item.subject].join("|"))
    );
    if (!approvedKeys.size) return schedule;

    const groupCounts = {};
    (schedule || []).forEach((lesson) => {
      const key = [lesson.classId, lesson.week, lesson.day, lesson.subject].join("|");
      if (approvedKeys.has(key)) groupCounts[key] = (groupCounts[key] || 0) + 1;
    });

    return (schedule || []).map((lesson) => {
      const key = [lesson.classId, lesson.week, lesson.day, lesson.subject].join("|");
      if (!approvedKeys.has(key) || groupCounts[key] < 2) return lesson;
      return {
        ...lesson,
        fatigueApproved: true,
        updatedAt: new Date().toISOString(),
      };
    });
  }

  function moveLesson(schedule, lessonId, target, data, options) {
    const settings = {
      allowClassSubjectFatigue: false,
      ...(options || {}),
    };
    const current = (schedule || []).find((lesson) => lesson.id === lessonId);
    if (!current) return { ok: false, message: "找不到要移動的課程。" };
    if (current.isLocked) return { ok: false, message: "鎖定課程不可拖拉移動。" };

    const originalSlot = {
      classId: current.classId,
      week: current.week,
      day: current.day,
      blockStart: current.blockStart,
    };
    const targetSlot = {
      classId: target.classId || current.classId,
      week: Number(target.week),
      day: Number(target.day),
      blockStart: Number(target.blockStart),
    };

    if (![1, 3].includes(targetSlot.blockStart)) {
      return { ok: false, message: "只能放在第 1 節或第 3 節起點。" };
    }

    const targetLesson = occupiedAt(schedule, targetSlot, [lessonId]);
    if (targetLesson?.isLocked) {
      return { ok: false, message: "目標位置是鎖定課程，不能覆蓋。" };
    }

    const next = schedule.map((lesson) => {
      if (lesson.id === current.id) {
        return { ...lesson, ...targetSlot, fatigueApproved: false, updatedAt: new Date().toISOString() };
      }
      if (targetLesson && lesson.id === targetLesson.id) {
        return { ...lesson, ...originalSlot, fatigueApproved: false, updatedAt: new Date().toISOString() };
      }
      return lesson;
    });

    const hardErrors = global.DgConstraints.getHardErrors(next, data, {
      allowClassSubjectFatigue: true,
    });
    if (hardErrors.length) {
      return {
        ok: false,
        message: hardErrors[0].message,
        issues: hardErrors,
      };
    }

    const fatigueWarnings = moveFatigueWarnings(next, current, targetLesson, originalSlot, targetSlot, data);
    if (fatigueWarnings.length && !settings.allowClassSubjectFatigue) {
      return {
        ok: false,
        canConfirm: true,
        confirmationType: "CLASS_SUBJECT_FATIGUE",
        message: fatigueWarnings.join(" "),
        warnings: fatigueWarnings,
        previewSchedule: next,
      };
    }

    const approvedSchedule = settings.allowClassSubjectFatigue
      ? approveFatigueGroups(
          next,
          [
            { slot: targetSlot, subject: current.subject },
            targetLesson ? { slot: originalSlot, subject: targetLesson.subject } : null,
          ].filter(Boolean)
        )
      : next;

    return { ok: true, schedule: approvedSchedule, warnings: fatigueWarnings };
  }

  function upsertLesson(schedule, lessonInput, data) {
    const slot = {
      classId: lessonInput.classId,
      week: Number(lessonInput.week),
      day: Number(lessonInput.day),
      blockStart: Number(lessonInput.blockStart),
    };
    const existingAtSlot = occupiedAt(schedule, slot, lessonInput.id ? [lessonInput.id] : []);
    if (existingAtSlot?.isLocked && existingAtSlot.id !== lessonInput.id) {
      return { ok: false, message: "目標位置已有鎖定課程。" };
    }

    const lesson = normalizeLesson(
      {
        ...lessonInput,
        ...slot,
        id: lessonInput.id || existingAtSlot?.id || global.DgConfig.createId("MAN"),
        source: "manual",
      },
      "manual"
    );
    const next = (schedule || []).filter((item) => item.id !== lesson.id && !lessonMatchesSlot(item, slot));
    next.push(lesson);
    const hardErrors = global.DgConstraints.getHardErrors(next, data);
    if (hardErrors.length) {
      return { ok: false, message: hardErrors[0].message, issues: hardErrors };
    }
    return { ok: true, schedule: next, lesson };
  }

  function clearLesson(schedule, slot) {
    return (schedule || []).filter((lesson) => !lessonMatchesSlot(lesson, slot));
  }

  global.DgScheduler = {
    normalizeLesson,
    preAssignmentsToSchedule,
    autoSchedule,
    moveLesson,
    upsertLesson,
    clearLesson,
    occupiedAt,
    lessonMatchesSlot,
    allSlotsForClass,
    getGradeWeeks,
  };
})(typeof window !== "undefined" ? window : globalThis);
