(function (global) {
  const state = {
    data: null,
    schedule: [],
    currentUser: null,
    activeView: "schedule",
    viewMode: "class",
    selectedClassId: "",
    selectedTeacherId: "",
    selectedWeek: 1,
    selectedSlot: null,
    adjustLessonId: "",
    pendingMove: null,
    issues: [],
    unplaced: [],
    printAllWeeks: false,
    dismissedConflictKeys: new Set(),
  };

  const ALL_WEEKS_VALUE = "all";
  const els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function toast(message, type) {
    const item = document.createElement("div");
    item.className = `toast ${type || ""}`.trim();
    item.textContent = message;
    els.toastRegion.appendChild(item);
    setTimeout(() => item.remove(), 3800);
  }

  function canEdit() {
    return global.DgAuth.canEdit(state.currentUser);
  }

  async function loadData() {
    let loadedRemote = global.DgApi.hasRemote();
    try {
      state.data = await global.DgApi.readAllTables();
    } catch (error) {
      loadedRemote = false;
      state.data = global.DgConfig.cloneMockData();
      toast(`讀取遠端資料失敗，已改用示範資料：${error.message}`, "error");
    }
    state.data.socialAssignments = global.DgSocialAssignment.autoAssign(state.data, true);
    return loadedRemote;
  }

  function setupInitialState() {
    const classes = state.data.classes || [];
    const teachers = state.data.teachers || [];
    state.selectedClassId = state.selectedClassId || classes[0]?.classId || "";
    state.selectedTeacherId = state.currentUser?.teacherId || teachers[0]?.teacherId || "";
    state.viewMode = state.currentUser?.role === "teacher" ? "teacher" : "class";

    const activeVersion = global.DgVersion.listVersions().find((version) => version.isActive);
    if (activeVersion?.schedule?.length) {
      state.schedule = activeVersion.schedule;
      state.unplaced = [];
    } else {
      const result = global.DgScheduler.autoSchedule(state.data, []);
      state.schedule = result.schedule;
      state.unplaced = result.unplaced || [];
    }
    refreshIssues();
  }

  function refreshIssues() {
    state.issues = global.DgConstraints.validateSchedule(state.schedule, state.data);
  }

  function hardIssues() {
    return state.issues.filter((issue) => issue.level === "error");
  }

  function clearDismissedConflicts() {
    state.dismissedConflictKeys.clear();
  }

  function conflictKey(item, prefix) {
    const lessonIds = (item.lessonIds || []).map(String).sort().join(",");
    return [
      prefix || item.level || "item",
      item.code || item.title || "",
      item.message || item.body || "",
      item.detail || "",
      lessonIds,
    ].join("|");
  }

  function visibleConflictItems(items, prefix) {
    return (items || []).filter((item) => !state.dismissedConflictKeys.has(conflictKey(item, prefix)));
  }

  function bindElements() {
    [
      "loginView",
      "appShell",
      "loginForm",
      "loginEmail",
      "loginPassword",
      "loginGasUrl",
      "loginMessage",
      "buildState",
      "apiState",
      "currentUserLabel",
      "logoutButton",
      "apiNotice",
      "viewModeSelect",
      "classSelectorWrap",
      "teacherSelectorWrap",
      "classSelect",
      "teacherSelect",
      "weekSelect",
      "autoScheduleButton",
      "reloadDataButton",
      "validateButton",
      "saveVersionButton",
      "printButton",
      "scheduleContainer",
      "socialTable",
      "autoSocialButton",
      "conflictList",
      "copyConflictButton",
      "versionForm",
      "versionName",
      "versionNote",
      "versionList",
      "settingsForm",
      "gasUrlInput",
      "clearGasUrlButton",
      "schemaPreview",
      "editorPanel",
      "closeEditorButton",
      "lessonForm",
      "editorSlotLabel",
      "lessonSubject",
      "lessonTeacher",
      "lessonRoom",
      "lessonLocked",
      "lessonNote",
      "clearLessonButton",
      "editorMessage",
      "toastRegion",
      "metricClasses",
      "metricLessons",
      "metricConflicts",
    ].forEach((id) => {
      els[id] = $(id);
    });
  }

  function bindEvents() {
    window.addEventListener("error", (event) => {
      const message = event.error?.message || event.message || "未知錯誤";
      if (els.loginMessage && !els.loginView.classList.contains("hidden")) {
        els.loginMessage.textContent = message;
      }
      toast(`系統錯誤：${message}`, "error");
    });

    window.addEventListener("unhandledrejection", (event) => {
      const message = event.reason?.message || String(event.reason || "未知錯誤");
      if (els.loginMessage && !els.loginView.classList.contains("hidden")) {
        els.loginMessage.textContent = message;
      }
      toast(`系統錯誤：${message}`, "error");
    });

    els.loginForm.addEventListener("submit", handleLogin);
    document.querySelectorAll("[data-demo-login]").forEach((button) => {
      button.addEventListener("click", () => {
        const demo = global.DgAuth.demoAccounts[button.dataset.demoLogin];
        els.loginEmail.value = demo.email;
        els.loginPassword.value = demo.password;
        els.loginForm.requestSubmit();
      });
    });

    els.logoutButton.addEventListener("click", () => {
      global.DgAuth.logout();
      state.currentUser = null;
      showLogin();
    });

    document.querySelectorAll(".nav-button").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeView = button.dataset.view;
        renderAll();
      });
    });

    els.viewModeSelect.addEventListener("change", () => {
      state.viewMode = els.viewModeSelect.value;
      if (state.currentUser?.role === "teacher") state.viewMode = "teacher";
      if (state.selectedWeek !== ALL_WEEKS_VALUE) state.selectedWeek = 1;
      state.adjustLessonId = "";
      state.pendingMove = null;
      closeEditor();
      renderAll();
    });

    els.classSelect.addEventListener("change", () => {
      state.selectedClassId = els.classSelect.value;
      if (state.selectedWeek !== ALL_WEEKS_VALUE) state.selectedWeek = 1;
      state.adjustLessonId = "";
      state.pendingMove = null;
      closeEditor();
      renderAll();
    });

    els.teacherSelect.addEventListener("change", () => {
      state.selectedTeacherId = els.teacherSelect.value;
      if (state.selectedWeek !== ALL_WEEKS_VALUE) state.selectedWeek = 1;
      state.adjustLessonId = "";
      state.pendingMove = null;
      closeEditor();
      renderAll();
    });

    els.weekSelect.addEventListener("change", () => {
      state.selectedWeek =
        els.weekSelect.value === ALL_WEEKS_VALUE ? ALL_WEEKS_VALUE : Number(els.weekSelect.value);
      state.adjustLessonId = "";
      state.pendingMove = null;
      closeEditor();
      renderAll();
    });

    els.autoScheduleButton.addEventListener("click", handleAutoSchedule);
    els.reloadDataButton.addEventListener("click", handleReloadData);
    els.validateButton.addEventListener("click", () => {
      clearDismissedConflicts();
      refreshIssues();
      state.activeView = "conflicts";
      renderAll();
      toast(hardIssues().length ? "檢查完成，仍有硬性衝突。" : "檢查完成，沒有硬性衝突。");
    });

    els.saveVersionButton.addEventListener("click", () => {
      state.activeView = "versions";
      renderAll();
      els.versionName.focus();
    });

    els.printButton.addEventListener("click", () => printCurrentSchedule());
    els.copyConflictButton.addEventListener("click", copyConflictText);
    els.versionForm.addEventListener("submit", handleCreateVersion);
    els.settingsForm.addEventListener("submit", handleSaveSettings);
    els.clearGasUrlButton.addEventListener("click", () => {
      global.DgConfig.clearApiUrl();
      els.gasUrlInput.value = "";
      renderApiState();
      toast("已清除 GAS URL，目前改用示範資料。");
    });

    els.autoSocialButton.addEventListener("click", () => {
      clearDismissedConflicts();
      state.data.classes = state.data.classes.map((classInfo) => ({ ...classInfo, socialMode: "auto" }));
      state.data.socialAssignments = global.DgSocialAssignment.autoAssign(state.data, false);
      refreshIssues();
      renderAll();
      toast("已重新平均分配社會科。");
    });

    els.socialTable.addEventListener("change", handleSocialChange);
    els.conflictList.addEventListener("click", handleConflictListClick);
    els.scheduleContainer.addEventListener("click", handleScheduleClick);
    els.closeEditorButton.addEventListener("click", closeEditor);
    els.lessonForm.addEventListener("submit", handleLessonSubmit);
    els.lessonSubject.addEventListener("change", () => updateLessonTeacherOptions());
    els.clearLessonButton.addEventListener("click", handleClearLesson);
    document.querySelectorAll("[data-export]").forEach((button) => button.addEventListener("click", handleExport));

    global.DgDragDrop.bind({
      container: els.scheduleContainer,
      onMove: handleMoveLesson,
    });
  }

  async function handleLogin(event) {
    event.preventDefault();
    els.loginMessage.textContent = "";
    if (els.loginGasUrl.value.trim()) {
      global.DgConfig.setApiUrl(els.loginGasUrl.value.trim());
      renderApiState();
      await loadData();
    }
    try {
      state.currentUser = await global.DgAuth.login(els.loginEmail.value, els.loginPassword.value, state.data);
      setupInitialState();
      showApp();
    } catch (error) {
      els.loginMessage.textContent = error.message;
    }
  }

  async function handleReloadData() {
    const currentSchedule = state.schedule;
    const loadedRemote = await loadData();
    state.schedule = currentSchedule;
    state.adjustLessonId = "";
    state.pendingMove = null;
    clearDismissedConflicts();
    closeEditor();
    refreshIssues();
    renderAll();
    toast(loadedRemote ? "已重新讀取 Google Sheets 資料。" : "已重新讀取示範資料。");
  }

  function showLogin() {
    els.loginView.classList.remove("hidden");
    els.appShell.classList.add("hidden");
  }

  function showApp() {
    els.loginView.classList.add("hidden");
    els.appShell.classList.remove("hidden");
    renderAll();
  }

  function renderAll() {
    renderApiState();
    renderNavigation();
    renderUserState();
    renderSelectors();
    renderMetrics();
    renderActiveView();
    renderSchedule();
    renderSocialTable();
    renderConflicts();
    renderVersions();
    renderSettings();
  }

  function renderApiState() {
    const hasApi = global.DgApi.hasRemote();
    if (els.buildState) {
      els.buildState.textContent = `版本 ${global.DgConfig.appBuild || "未知"}`;
    }
    els.apiState.textContent = hasApi ? "已設定 GAS" : "尚未設定 GAS";
    els.apiState.className = `status-pill ${hasApi ? "ok" : "warning"}`;
    els.apiNotice.classList.toggle("hidden", hasApi);
    els.gasUrlInput.value = global.DgConfig.getApiUrl();
    if (els.loginGasUrl) els.loginGasUrl.value = global.DgConfig.getApiUrl();
  }

  function renderNavigation() {
    document.querySelectorAll(".nav-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === state.activeView);
    });
    document.querySelectorAll(".view-panel").forEach((panel) => panel.classList.remove("active"));
    $(`${state.activeView}View`)?.classList.add("active");
  }

  function renderUserState() {
    const roleLabel = state.currentUser?.role === "admin" ? "管理者" : "教師";
    els.currentUserLabel.textContent = `${state.currentUser?.name || ""}｜${roleLabel}`;
    const editable = canEdit();
    [els.autoScheduleButton, els.saveVersionButton, els.autoSocialButton].forEach((button) => {
      button.disabled = !editable;
    });
    els.viewModeSelect.disabled = state.currentUser?.role === "teacher";
  }

  function renderSelectors() {
    const classes = state.data.classes || [];
    const teachers = state.data.teachers || [];
    if (!classes.some((item) => item.classId === state.selectedClassId)) {
      state.selectedClassId = classes[0]?.classId || "";
    }
    if (!teachers.some((item) => item.teacherId === state.selectedTeacherId)) {
      state.selectedTeacherId = state.currentUser?.teacherId || teachers[0]?.teacherId || "";
    }

    els.viewModeSelect.value = state.viewMode;
    els.classSelect.innerHTML = classes
      .map((item) => `<option value="${escapeHtml(item.classId)}">${escapeHtml(item.className)}</option>`)
      .join("");
    els.classSelect.value = state.selectedClassId;

    const teacherOptions =
      state.currentUser?.role === "teacher"
        ? teachers.filter((teacher) => teacher.teacherId === state.currentUser.teacherId)
        : teachers;
    els.teacherSelect.innerHTML = teacherOptions
      .map((item) => `<option value="${escapeHtml(item.teacherId)}">${escapeHtml(item.teacherName)}（${escapeHtml(item.subjectGroup)}）</option>`)
      .join("");
    els.teacherSelect.value = state.selectedTeacherId;
    els.teacherSelect.disabled = state.currentUser?.role === "teacher";

    els.classSelectorWrap.classList.toggle("hidden", state.viewMode !== "class");
    els.teacherSelectorWrap.classList.toggle("hidden", state.viewMode !== "teacher");

    const maxWeeks =
      state.viewMode === "class"
        ? global.DgScheduler.getGradeWeeks((classes.find((item) => item.classId === state.selectedClassId) || {}).grade)
        : Math.max(...Object.values(global.DgConfig.gradeSettings).map((item) => item.weeks));
    if (state.selectedWeek !== ALL_WEEKS_VALUE && state.selectedWeek > maxWeeks) state.selectedWeek = maxWeeks;
    els.weekSelect.innerHTML = [
      `<option value="${ALL_WEEKS_VALUE}">全部 ${maxWeeks} 週</option>`,
      ...Array.from({ length: maxWeeks }, (_, index) => index + 1)
        .map((week) => `<option value="${week}">第 ${week} 週</option>`),
    ]
      .join("");
    els.weekSelect.value = state.selectedWeek;
  }

  function renderMetrics() {
    els.metricClasses.textContent = String((state.data.classes || []).length);
    els.metricLessons.textContent = String(state.schedule.length);
    els.metricConflicts.textContent = String(hardIssues().length);
  }

  function renderActiveView() {
    document.querySelectorAll(".view-panel").forEach((panel) => panel.classList.remove("active"));
    $(`${state.activeView}View`)?.classList.add("active");
  }

  function renderSchedule() {
    refreshIssues();
    const issueIds = global.DgConstraints.lessonsWithIssues(state.schedule, state.issues);
    if (state.viewMode === "teacher") {
      renderTeacherSchedule(issueIds);
      return;
    }
    renderClassSchedule(issueIds);
  }

  function maxOutputWeeks() {
    return Math.max(...Object.values(global.DgConfig.gradeSettings).map((item) => item.weeks), 5);
  }

  function selectedScheduleWeeks(classInfo) {
    const weeks = classInfo
      ? global.DgScheduler.getGradeWeeks(classInfo.grade)
      : maxOutputWeeks();
    return Array.from({ length: weeks }, (_, index) => index + 1);
  }

  function isAllWeeksView() {
    return state.selectedWeek === ALL_WEEKS_VALUE;
  }

  function weekRangeLabel(week) {
    return `第 ${week} 週 ${global.DgConfig.getWeekDateRange(week, state.data)}`;
  }

  function dayHeaderLabel(week, day) {
    const date = global.DgConfig.getDayDate(week, day.id, state.data);
    return `${day.label}<span>${global.DgConfig.formatMonthDay(date)}</span>`;
  }

  function renderScheduleHeading(title, subtitle) {
    return `
      <div class="schedule-output-heading">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(subtitle)}</p>
      </div>
    `;
  }

  function renderWeekTitle(week) {
    return `<h3 class="week-title">${escapeHtml(weekRangeLabel(week))}</h3>`;
  }

  function movingLesson() {
    return state.adjustLessonId ? state.schedule.find((lesson) => lesson.id === state.adjustLessonId) : null;
  }

  function resetAdjustMode() {
    state.adjustLessonId = "";
    state.pendingMove = null;
  }

  function targetLessonForSlot(slot) {
    return global.DgScheduler.occupiedAt(state.schedule, slot);
  }

  function sameSlot(lesson, slot) {
    return (
      lesson &&
      String(lesson.classId) === String(slot.classId) &&
      Number(lesson.week) === Number(slot.week) &&
      Number(lesson.day) === Number(slot.day) &&
      Number(lesson.blockStart) === Number(slot.blockStart)
    );
  }

  function sourceLabel(source) {
    if (source === "auto") return "系統排課";
    if (source === "pre") return "預排鎖定";
    return "手動調整";
  }

  function roomLabel(lesson) {
    const roomType = lesson.roomType || "普通";
    const room = (state.data.rooms || []).find((item) => item.roomType === roomType);
    if (room?.roomName) return room.roomName;
    return roomType === "普通" ? "一般教室" : roomType;
  }

  function moveSlotStatus(slot) {
    const lesson = movingLesson();
    if (!lesson || String(lesson.classId) !== String(slot.classId)) return null;
    if (sameSlot(lesson, slot)) {
      return { kind: "current", label: "目前位置", message: "這是目前位置。" };
    }

    const targetLesson = targetLessonForSlot(slot);
    const result = global.DgScheduler.moveLesson(state.schedule, lesson.id, slot, state.data);
    if (result.canConfirm && result.confirmationType === "CLASS_SUBJECT_FATIGUE") {
      return {
        kind: "caution",
        label: "需確認",
        message: result.message,
        warnings: result.warnings || [result.message],
        previewSchedule: result.previewSchedule,
        targetLesson,
      };
    }
    if (result.ok) {
      return {
        kind: targetLesson ? "swap" : "target",
        label: targetLesson ? "可交換" : "可移入",
        message: targetLesson ? "可與此課程交換時段。" : "可移到這個空白連堂區塊。",
        warnings: result.warnings || [],
        previewSchedule: result.schedule,
        targetLesson,
      };
    }
    return { kind: "blocked", label: "不可調", message: result.message || "不符合調課限制。" };
  }

  function slotText(slot) {
    return `第 ${slot.week} 週 ${global.DgConstraints.dayLabel(slot.day)} ${global.DgConstraints.blockLabel(slot.blockStart)}`;
  }

  function pendingMoveSchedule() {
    return state.pendingMove?.previewSchedule || state.schedule;
  }

  function renderAdjustBanner() {
    const lesson = movingLesson();
    if (!lesson) return "";
    const teacher = global.DgConstraints.teacherName(state.data, lesson.teacherId);
    return `
      <div class="adjust-banner">
        <div>
          <strong>調課模式</strong>
          <span>正在調整 ${escapeHtml(lesson.subject)}｜${escapeHtml(teacher)}。請先點選目標位置，系統會顯示調課後預覽，再按確認調課。</span>
        </div>
        <button type="button" data-cancel-adjust>取消調課</button>
      </div>
    `;
  }

  function renderPendingMovePanel() {
    const pending = state.pendingMove;
    const lesson = movingLesson();
    if (!pending || !lesson) {
      return `
        <div class="adjust-confirm-panel">
          <strong>尚未選擇目標位置</strong>
          <span>綠色表示可移入，藍色表示可交換，橘色表示會造成同科一天 4 節，需要再次確認。</span>
        </div>
      `;
    }

    const targetLesson = pending.targetLesson;
    const targetText = `${slotText(pending.target)}${targetLesson ? `，與「${targetLesson.subject}」交換` : ""}`;
    const warningText = pending.requiresConfirmation
      ? `<p class="adjust-warning">不建議這樣調課：${escapeHtml((pending.warnings || []).join(" "))} 若仍要調課，請再次按「我了解，仍要調課」。</p>`
      : "";

    return `
      <div class="adjust-confirm-panel ${pending.requiresConfirmation ? "caution" : ""}">
        <strong>調課後預覽</strong>
        <span>將「${escapeHtml(lesson.subject)}」調到 ${escapeHtml(targetText)}。</span>
        ${warningText}
        <div class="adjust-actions">
          <button type="button" class="primary-action" data-confirm-adjust>
            ${pending.requiresConfirmation ? "我了解，仍要調課" : "確認調課"}
          </button>
          <button type="button" data-clear-pending-move>重新選擇位置</button>
        </div>
      </div>
    `;
  }

  function renderClassWeekTable(classInfo, week, issueIds) {
    const rows = global.DgConfig.blocks
      .map((block) => {
        const cells = global.DgConfig.days
          .map((day) => {
            const slot = { classId: classInfo.classId, week, day: day.id, blockStart: block.start };
            const lesson = global.DgScheduler.occupiedAt(state.schedule, slot);
            return renderSlot(slot, lesson, issueIds, false);
          })
          .join("");
        return `<tr><th class="slot-label-cell"><span>${escapeHtml(block.label)}</span>連堂區塊</th>${cells}</tr>`;
      })
      .join("");

    return `
      <table class="schedule-table" aria-label="${escapeHtml(classInfo.className)} ${escapeHtml(weekRangeLabel(week))} 課表">
        <thead>
          <tr>
            <th>節次</th>
            ${global.DgConfig.days.map((day) => `<th>${dayHeaderLabel(week, day)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function renderTeacherWeekTable(teacher, week, issueIds, scheduleView) {
    const schedule = scheduleView || state.schedule;
    const rows = global.DgConfig.blocks
      .map((block) => {
        const cells = global.DgConfig.days
          .map((day) => {
            const lessons = schedule.filter(
              (lesson) =>
                lesson.teacherId === teacher.teacherId &&
                Number(lesson.week) === Number(week) &&
                Number(lesson.day) === day.id &&
                Number(lesson.blockStart) === block.start
            );
            const body = lessons.length
              ? lessons.map((lesson) => renderCourseCard(lesson, issueIds, { showClass: true, draggable: false })).join("")
              : `<div class="empty-slot">未排課</div>`;
            return `<td class="drop-slot readonly">${body}</td>`;
          })
          .join("");
        return `<tr><th class="slot-label-cell"><span>${escapeHtml(block.label)}</span>連堂區塊</th>${cells}</tr>`;
      })
      .join("");

    return `
      <table class="schedule-table" aria-label="${escapeHtml(teacher.teacherName)} ${escapeHtml(weekRangeLabel(week))} 課表">
        <thead>
          <tr>
            <th>節次</th>
            ${global.DgConfig.days.map((day) => `<th>${dayHeaderLabel(week, day)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function renderAdjustTeacherPreview(issueIds) {
    const lesson = movingLesson();
    if (!lesson || state.printAllWeeks) return "";

    const scheduleView = pendingMoveSchedule();
    const previewIssues = new Set(
      global.DgConstraints.lessonsWithIssues(
        scheduleView,
        global.DgConstraints.validateSchedule(scheduleView, state.data)
      )
    );
    const teacherIds = new Set([lesson.teacherId]);
    if (state.pendingMove?.targetLesson?.teacherId) teacherIds.add(state.pendingMove.targetLesson.teacherId);
    const teachers = Array.from(teacherIds)
      .map((teacherId) => (state.data.teachers || []).find((teacher) => teacher.teacherId === teacherId))
      .filter(Boolean);
    const weeks = Array.from({ length: maxOutputWeeks() }, (_, index) => index + 1);
    const title = state.pendingMove ? "相關教師課表：調課後預覽" : "相關教師課表：目前狀態";

    return `
      <section class="adjust-teacher-preview">
        <div class="section-heading compact-heading">
          <div>
            <p class="eyebrow">Teacher Preview</p>
            <h3>${escapeHtml(title)}</h3>
          </div>
        </div>
        ${teachers
          .map(
            (teacher) => `
              <article class="teacher-preview-block">
                <h4>${escapeHtml(teacher.subjectGroup || "")}老師 ${escapeHtml(teacher.teacherName)}</h4>
                <div class="all-week-schedule compact-weeks">
                  ${weeks
                    .map(
                      (week) =>
                        `<section class="week-block">${renderWeekTitle(week)}${renderTeacherWeekTable(
                          teacher,
                          week,
                          previewIssues,
                          scheduleView
                        )}</section>`
                    )
                    .join("")}
                </div>
              </article>
            `
          )
          .join("")}
      </section>
    `;
  }

  function renderClassSchedule(issueIds) {
    const classInfo = (state.data.classes || []).find((item) => item.classId === state.selectedClassId);
    if (!classInfo) {
      els.scheduleContainer.innerHTML = `<p>尚未建立班級資料。</p>`;
      return;
    }

    const showAllWeeks = state.printAllWeeks || isAllWeeksView() || Boolean(movingLesson());
    if (showAllWeeks) {
      const weeks = selectedScheduleWeeks(classInfo);
      els.scheduleContainer.innerHTML = `
        ${renderAdjustBanner()}
        ${movingLesson() ? renderPendingMovePanel() : ""}
        ${renderScheduleHeading(`${classInfo.className} 班級課表`, "大觀國中暑期輔導課表")}
        <div class="all-week-schedule">
          ${weeks.map((week) => `<section class="week-block">${renderWeekTitle(week)}${renderClassWeekTable(classInfo, week, issueIds)}</section>`).join("")}
        </div>
        ${renderAdjustTeacherPreview(issueIds)}
      `;
      return;
    }

    els.scheduleContainer.innerHTML = `
      ${renderAdjustBanner()}
      ${movingLesson() ? renderPendingMovePanel() : ""}
      ${renderScheduleHeading(`${classInfo.className} 班級課表`, weekRangeLabel(state.selectedWeek))}
      ${renderClassWeekTable(classInfo, state.selectedWeek, issueIds)}
    `;
  }

  function renderTeacherSchedule(issueIds) {
    const teacher = (state.data.teachers || []).find((item) => item.teacherId === state.selectedTeacherId);
    if (!teacher) {
      els.scheduleContainer.innerHTML = `<p>尚未建立教師資料。</p>`;
      return;
    }

    if (state.printAllWeeks || isAllWeeksView()) {
      const weeks = selectedScheduleWeeks();
      els.scheduleContainer.innerHTML = `
        ${renderScheduleHeading(`${teacher.teacherName} 教師課表`, "大觀國中暑期輔導課表")}
        <div class="all-week-schedule">
          ${weeks.map((week) => `<section class="week-block">${renderWeekTitle(week)}${renderTeacherWeekTable(teacher, week, issueIds)}</section>`).join("")}
        </div>
      `;
      return;
    }

    els.scheduleContainer.innerHTML = `
      ${renderScheduleHeading(`${teacher.teacherName} 教師課表`, weekRangeLabel(state.selectedWeek))}
      ${renderTeacherWeekTable(teacher, state.selectedWeek, issueIds)}
    `;
  }

  function renderSlot(slot, lesson, issueIds, readonly) {
    const moveStatus = moveSlotStatus(slot);
    const body = lesson
      ? renderCourseCard(lesson, issueIds, { showClass: false, draggable: canEdit() && !lesson.isLocked })
      : `<div class="empty-slot">${canEdit() ? "點選預排" : "未排課"}</div>`;
    const readonlyClass = readonly || !canEdit() ? " readonly" : "";
    const moveClass = moveStatus ? ` move-${moveStatus.kind}` : "";
    const title = moveStatus ? ` title="${escapeHtml(moveStatus.message)}"` : "";
    return `
      <td class="drop-slot${readonlyClass}${moveClass}"${title}
        data-class-id="${escapeHtml(slot.classId)}"
        data-week="${slot.week}"
        data-day="${slot.day}"
        data-block-start="${slot.blockStart}">
        ${body}
        ${moveStatus ? `<div class="move-slot-label">${escapeHtml(moveStatus.label)}</div>` : ""}
      </td>
    `;
  }

  function renderCourseCard(lesson, issueIds, options) {
    const isConflict = issueIds.has(lesson.id);
    const classes = ["course-card"];
    if (lesson.isLocked) classes.push("locked");
    if (isConflict) classes.push("conflict");
    if (lesson.id === state.adjustLessonId) classes.push("adjusting");
    const draggable = options.draggable ? "true" : "false";
    const title = options.showClass
      ? `${global.DgConstraints.className(state.data, lesson.classId)}｜${lesson.subject}`
      : lesson.subject;
    const canAdjustLesson = canEdit() && !lesson.isLocked && !options.showClass && !state.adjustLessonId;
    return `
      <article class="${classes.join(" ")}" draggable="${draggable}" data-lesson-id="${escapeHtml(lesson.id)}">
        <div class="course-main">
          <strong class="course-subject">${escapeHtml(title)}</strong>
          ${lesson.isLocked ? `<span class="chip locked">鎖定</span>` : ""}
        </div>
        <div class="course-meta">
          <span>${escapeHtml(global.DgConstraints.teacherName(state.data, lesson.teacherId))}</span>
          <span>${escapeHtml(lesson.note || "")}</span>
        </div>
        <div class="chip-row">
          <span class="chip room" title="場地類型">${escapeHtml(`場地：${roomLabel(lesson)}`)}</span>
          <span class="chip" title="課程來源">${escapeHtml(`來源：${sourceLabel(lesson.source)}`)}</span>
          ${lesson.id === state.adjustLessonId ? `<span class="chip adjust-chip">調課中</span>` : ""}
          ${canAdjustLesson ? `<button type="button" class="chip adjust-button" data-adjust-lesson="${escapeHtml(lesson.id)}">調課</button>` : ""}
        </div>
      </article>
    `;
  }

  function setPendingMove(slot, status) {
    const lesson = movingLesson();
    if (!lesson) return;
    let previewSchedule = status.previewSchedule;
    if (!previewSchedule && status.kind === "caution") {
      previewSchedule = global.DgScheduler.moveLesson(state.schedule, lesson.id, slot, state.data, {
        allowClassSubjectFatigue: true,
      }).schedule;
    }
    state.pendingMove = {
      target: slot,
      targetLesson: status.targetLesson || targetLessonForSlot(slot),
      previewSchedule,
      warnings: status.warnings || [],
      requiresConfirmation: status.kind === "caution",
    };
    closeEditor();
    renderAll();
    toast(status.kind === "caution" ? "已產生預覽，這個位置需要再次確認。" : "已產生調課後預覽，請確認是否套用。");
  }

  function confirmPendingMove() {
    if (!state.pendingMove || !state.adjustLessonId) return;
    handleMoveLesson(state.adjustLessonId, state.pendingMove.target, {
      allowClassSubjectFatigue: state.pendingMove.requiresConfirmation,
    });
  }

  function handleScheduleClick(event) {
    if (!canEdit() || state.viewMode !== "class") return;
    const cancelButton = event.target.closest("[data-cancel-adjust]");
    if (cancelButton) {
      resetAdjustMode();
      renderAll();
      toast("已取消調課模式。");
      return;
    }

    const clearPendingButton = event.target.closest("[data-clear-pending-move]");
    if (clearPendingButton) {
      state.pendingMove = null;
      renderAll();
      toast("請重新選擇調課位置。");
      return;
    }

    const confirmButton = event.target.closest("[data-confirm-adjust]");
    if (confirmButton) {
      confirmPendingMove();
      return;
    }

    const adjustButton = event.target.closest("[data-adjust-lesson]");
    if (adjustButton) {
      const lesson = state.schedule.find((item) => item.id === adjustButton.dataset.adjustLesson);
      if (!lesson) return;
      event.preventDefault();
      event.stopPropagation();
      state.adjustLessonId = lesson.id;
      state.pendingMove = null;
      state.selectedClassId = lesson.classId;
      state.viewMode = "class";
      closeEditor();
      renderAll();
      toast("已進入調課模式，請點選綠色或藍色位置。");
      return;
    }

    const slotEl = event.target.closest(".drop-slot");
    if (!slotEl || slotEl.classList.contains("readonly")) return;
    const slot = {
      classId: slotEl.dataset.classId,
      week: Number(slotEl.dataset.week),
      day: Number(slotEl.dataset.day),
      blockStart: Number(slotEl.dataset.blockStart),
    };
    if (state.adjustLessonId) {
      const status = moveSlotStatus(slot);
      if (status?.kind === "target" || status?.kind === "swap" || status?.kind === "caution") {
        setPendingMove(slot, status);
      } else {
        toast(status?.message || "這個位置不能調入。", "error");
      }
      return;
    }

    const lesson = global.DgScheduler.occupiedAt(state.schedule, slot);
    openEditor(slot, lesson);
  }

  function openEditor(slot, lesson) {
    state.selectedSlot = { ...slot, lessonId: lesson?.id || "" };
    els.editorSlotLabel.textContent = `${global.DgConstraints.className(state.data, slot.classId)}｜第 ${slot.week} 週 ${global.DgConstraints.dayLabel(slot.day)} ${global.DgConstraints.blockLabel(slot.blockStart)}`;
    renderLessonSubjectOptions(slot.classId);
    els.lessonSubject.value = lesson?.subject || els.lessonSubject.options[0]?.value || "";
    updateLessonTeacherOptions(lesson?.teacherId);
    els.lessonRoom.value = lesson?.roomType || roomForSubject(slot.classId, els.lessonSubject.value);
    els.lessonLocked.checked = Boolean(lesson?.isLocked);
    els.lessonNote.value = lesson?.note || "";
    els.editorMessage.textContent = "";
    els.editorPanel.classList.remove("hidden");
  }

  function closeEditor() {
    state.selectedSlot = null;
    els.editorPanel.classList.add("hidden");
  }

  function subjectsForClass(classId) {
    const classInfo = (state.data.classes || []).find((item) => item.classId === classId);
    if (!classInfo) return [];
    const subjects = [];
    (state.data.courseQuotas || [])
      .filter((quota) => String(quota.grade) === String(classInfo.grade))
      .forEach((quota) => {
        if (quota.subject === "社會") {
          subjects.push(...global.DgSocialAssignment.subjectsForClass(state.data.socialAssignments, classId));
        } else {
          subjects.push(quota.subject);
        }
      });
    return Array.from(new Set(subjects));
  }

  function roomForSubject(classId, subject) {
    const classInfo = (state.data.classes || []).find((item) => item.classId === classId);
    const lookupSubject = global.DgConfig.socialSubjects.includes(subject) ? "社會" : subject;
    return (
      (state.data.courseQuotas || []).find(
        (quota) => String(quota.grade) === String(classInfo?.grade) && quota.subject === lookupSubject
      )?.roomType || "普通"
    );
  }

  function assignedTeacherForClassSubject(classId, subject, ignoreLessonId) {
    return (
      (state.schedule || []).find(
        (lesson) =>
          lesson.id !== ignoreLessonId &&
          String(lesson.classId) === String(classId) &&
          lesson.subject === subject &&
          lesson.teacherId
      )?.teacherId || ""
    );
  }

  function renderLessonSubjectOptions(classId) {
    els.lessonSubject.innerHTML = subjectsForClass(classId)
      .map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`)
      .join("");
  }

  function updateLessonTeacherOptions(preferredTeacherId) {
    const subject = els.lessonSubject.value;
    const classId = state.selectedSlot?.classId || state.selectedClassId;
    const assignedTeacherId = assignedTeacherForClassSubject(classId, subject, state.selectedSlot?.lessonId);
    let teachers = (state.data.teachers || []).filter(
      (teacher) =>
        (teacher.subjects || []).includes(subject) &&
        global.DgConstraints.teacherCanTeachClass(teacher, classId)
    );
    if (assignedTeacherId) {
      teachers = teachers.filter((teacher) => teacher.teacherId === assignedTeacherId);
    }
    els.lessonTeacher.innerHTML = teachers.length
      ? teachers
          .map((teacher) => `<option value="${escapeHtml(teacher.teacherId)}">${escapeHtml(teacher.teacherName)}</option>`)
          .join("")
      : `<option value="">沒有可用教師</option>`;
    els.lessonTeacher.disabled = !teachers.length || Boolean(assignedTeacherId);
    if (preferredTeacherId && teachers.some((teacher) => teacher.teacherId === preferredTeacherId)) {
      els.lessonTeacher.value = preferredTeacherId;
    }
    if (assignedTeacherId && teachers.length) {
      els.lessonTeacher.value = assignedTeacherId;
    }
    if (state.selectedSlot) {
      els.lessonRoom.value = roomForSubject(state.selectedSlot.classId, subject);
    }
    els.lessonRoom.innerHTML = (state.data.rooms || [])
      .map((room) => `<option value="${escapeHtml(room.roomType)}">${escapeHtml(room.roomType)}｜${escapeHtml(room.roomName)}</option>`)
      .join("");
    els.lessonRoom.value = roomForSubject(state.selectedSlot?.classId || state.selectedClassId, subject);
  }

  function handleLessonSubmit(event) {
    event.preventDefault();
    if (!state.selectedSlot) return;
    if (!els.lessonTeacher.value) {
      els.editorMessage.textContent = "沒有符合授課班級與科目的教師。";
      return;
    }
    const result = global.DgScheduler.upsertLesson(
      state.schedule,
      {
        id: state.selectedSlot.lessonId,
        ...state.selectedSlot,
        subject: els.lessonSubject.value,
        teacherId: els.lessonTeacher.value,
        roomType: els.lessonRoom.value,
        isLocked: els.lessonLocked.checked,
        note: els.lessonNote.value.trim(),
      },
      state.data
    );
    if (!result.ok) {
      els.editorMessage.textContent = result.message;
      return;
    }
    state.schedule = result.schedule;
    clearDismissedConflicts();
    resetAdjustMode();
    state.unplaced = [];
    refreshIssues();
    closeEditor();
    renderAll();
    toast("已套用預排設定。");
  }

  function handleClearLesson() {
    if (!state.selectedSlot) return;
    const lesson = global.DgScheduler.occupiedAt(state.schedule, state.selectedSlot);
    if (lesson?.isLocked) {
      els.editorMessage.textContent = "此課程已鎖定，請先取消鎖定再清空。";
      return;
    }
    state.schedule = global.DgScheduler.clearLesson(state.schedule, state.selectedSlot);
    clearDismissedConflicts();
    resetAdjustMode();
    state.unplaced = [];
    refreshIssues();
    closeEditor();
    renderAll();
    toast("已清空此連堂區塊。");
  }

  function handleMoveLesson(lessonId, target, options) {
    if (!canEdit()) return;
    const result = global.DgScheduler.moveLesson(state.schedule, lessonId, target, state.data, options);
    if (result.canConfirm) {
      toast(`${result.message} 請使用調課預覽中的確認按鈕。`, "error");
      return;
    }
    if (!result.ok) {
      toast(result.message, "error");
      return;
    }
    state.schedule = result.schedule;
    clearDismissedConflicts();
    resetAdjustMode();
    state.unplaced = [];
    refreshIssues();
    renderAll();
    toast("已完成調課。");
  }

  function handleAutoSchedule() {
    if (!canEdit()) return;
    const result = global.DgScheduler.autoSchedule(state.data, state.schedule);
    state.schedule = result.schedule;
    state.issues = result.issues;
    clearDismissedConflicts();
    resetAdjustMode();
    state.unplaced = result.unplaced || [];
    closeEditor();
    renderAll();
    const message = result.unplaced.length
      ? `自動排課完成，但有 ${result.unplaced.length} 個區塊未排入，請查看衝突檢查。`
      : "自動排課完成。";
    toast(message, result.unplaced.length ? "error" : "");
  }

  function renderSocialTable() {
    const subjectOptions = (selected) =>
      global.DgConfig.socialSubjects
        .map((subject) => `<option value="${escapeHtml(subject)}" ${subject === selected ? "selected" : ""}>${escapeHtml(subject)}</option>`)
        .join("");
    const teacherOptions = (subject, selected, classId) =>
      global.DgSocialAssignment.socialTeachers(state.data, subject, classId)
        .map(
          (teacher) =>
            `<option value="${escapeHtml(teacher.teacherId)}" ${teacher.teacherId === selected ? "selected" : ""}>${escapeHtml(
              teacher.teacherName
            )}</option>`
        )
        .join("");

    const rows = (state.data.classes || [])
      .map((classInfo) => {
        const row = global.DgSocialAssignment.assignmentForClass(state.data.socialAssignments, classInfo.classId) || {};
        const disabled = canEdit() ? "" : "disabled";
        return `
          <tr data-class-id="${escapeHtml(classInfo.classId)}">
            <td><strong>${escapeHtml(classInfo.className)}</strong></td>
            <td>
              <select data-social-field="mode" ${disabled}>
                <option value="auto" ${row.mode !== "manual" ? "selected" : ""}>自動</option>
                <option value="manual" ${row.mode === "manual" ? "selected" : ""}>手動</option>
              </select>
            </td>
            <td><select data-social-field="subjectA" ${disabled}>${subjectOptions(row.subjectA)}</select></td>
            <td><select data-social-field="teacherA" ${disabled}>${teacherOptions(row.subjectA, row.teacherA, classInfo.classId)}</select></td>
            <td><select data-social-field="subjectB" ${disabled}>${subjectOptions(row.subjectB)}</select></td>
            <td><select data-social-field="teacherB" ${disabled}>${teacherOptions(row.subjectB, row.teacherB, classInfo.classId)}</select></td>
            <td>${escapeHtml(row.updatedAt ? new Date(row.updatedAt).toLocaleString("zh-TW") : "")}</td>
          </tr>
        `;
      })
      .join("");

    els.socialTable.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>班級</th>
            <th>模式</th>
            <th>科目 A</th>
            <th>教師 A</th>
            <th>科目 B</th>
            <th>教師 B</th>
            <th>更新時間</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function handleSocialChange(event) {
    if (!canEdit()) return;
    const rowEl = event.target.closest("tr[data-class-id]");
    if (!rowEl) return;
    const classId = rowEl.dataset.classId;
    const values = {};
    rowEl.querySelectorAll("[data-social-field]").forEach((field) => {
      values[field.dataset.socialField] = field.value;
    });
    const teacherAList = global.DgSocialAssignment.socialTeachers(state.data, values.subjectA, classId);
    const teacherBList = global.DgSocialAssignment.socialTeachers(state.data, values.subjectB, classId);
    if (!teacherAList.some((teacher) => teacher.teacherId === values.teacherA)) {
      values.teacherA = teacherAList[0]?.teacherId || "";
    }
    if (!teacherBList.some((teacher) => teacher.teacherId === values.teacherB)) {
      values.teacherB = teacherBList[0]?.teacherId || "";
    }

    state.data.classes = state.data.classes.map((classInfo) =>
      classInfo.classId === classId ? { ...classInfo, socialMode: values.mode } : classInfo
    );

    if (values.mode === "manual") {
      state.data.socialAssignments = global.DgSocialAssignment.setManual(
        state.data.socialAssignments,
        classId,
        values.subjectA,
        values.teacherA,
        values.subjectB,
        values.teacherB
      );
    } else {
      state.data.socialAssignments = global.DgSocialAssignment.setAuto(state.data.socialAssignments, classId);
      state.data.socialAssignments = global.DgSocialAssignment.autoAssign(state.data, true);
    }
    clearDismissedConflicts();
    refreshIssues();
    renderAll();
    toast("社會科設定已更新。");
  }

  function issueSuggestion(issue) {
    if (issue.suggestion || issue.detail) return issue.suggestion || issue.detail;
    const suggestions = {
      INVALID_BLOCK_START: "請把這堂課移到第 1-2 節或第 3-4 節的連堂區塊。",
      UNKNOWN_CLASS: "請到「班級設定」補上這個班級，或修正課表中的班級代碼。",
      UNKNOWN_TEACHER: "請到「教師設定」補上教師代碼，或把此課程改給已存在的教師。",
      TEACHER_WEEK_LIMIT: "請把課程移到該教師可授課週次，或到「教師設定」增加該教師的可授課週次。",
      TEACHER_DAY_LIMIT: "請把課程移到該教師可授課星期，或到「教師設定」調整該教師的可授課星期。",
      TEACHER_SUBJECT_MISMATCH: "請改派可授此科的教師，或到「教師設定」把此科加入該教師的可授科目。",
      TEACHER_CLASS_LIMIT: "請改派可教該班的教師，或到「教師設定」的「授課班級」加入該班班級代碼。",
      SOCIAL_SUBJECT_LIMIT: "請到「社會科安排」確認該班允許的兩個社會科科目，或把課表改成允許科目。",
      CLASS_SLOT_DUPLICATE: "請保留其中一堂，將其他課拖拉到同班空白連堂區塊。",
      TEACHER_COLLISION: "請把其中一個班級的課移到其他時段，或改派同科且可授該班的另一位教師。",
      CLASS_SUBJECT_TEACHER_SPLIT: "請統一該班該科授課教師；可先選定主要教師，再把其他教師的同科課程改回同一位。",
      ROOM_CAPACITY: "請把其中幾堂需要同場地的課移到其他時段，或到「場地設定」提高此場地同時容量。",
      CLASS_SUBJECT_FATIGUE: "請把同班同科其中一個連堂區塊移到其他日期，避免同一天連上 4 節。",
      QUOTA_MISMATCH: "請依目標節數補排或移除連堂區塊；每個連堂區塊等於 2 節。",
      CLASS_EMPTY_BLOCKS: "請優先處理同班缺節科目，再依診斷調整教師、週次或授課班級設定。",
      UNPLACED_AUTO_TASK: "請依原因調整教師設定、可授課週次、可授課星期、授課班級，或手動補排到建議時段。",
    };
    return suggestions[issue.code] || "請先查看衝突課程位置，再調整教師、週次、班級或場地設定。";
  }

  function issueTypeInfo(issue) {
    const code = issue?.code || "";
    if (code === "UNPLACED_AUTO_TASK") return { key: "unplaced", label: "未排入" };
    if (code === "QUOTA_MISMATCH") return { key: "quota", label: "節數不足" };
    if (code.startsWith("TEACHER") || code === "UNKNOWN_TEACHER") return { key: "teacher", label: "教師" };
    if (code.startsWith("CLASS") || code === "UNKNOWN_CLASS" || code === "INVALID_BLOCK_START") {
      return { key: "class", label: "班級" };
    }
    if (code.startsWith("ROOM")) return { key: "room", label: "場地" };
    if (code.startsWith("SOCIAL")) return { key: "social", label: "社會科" };
    return { key: "general", label: "一般" };
  }

  function recommendationTypeInfo(item) {
    const title = `${item?.title || ""} ${item?.body || ""}`;
    if (title.includes("教師") || title.includes("授課")) return { key: "teacher", label: "最佳化：教師" };
    if (title.includes("班級")) return { key: "class", label: "最佳化：班級" };
    if (title.includes("節")) return { key: "quota", label: "最佳化：節數" };
    return { key: "recommendation", label: "最佳化" };
  }

  function classLabel(classId) {
    const classInfo = (state.data.classes || []).find((item) => String(item.classId) === String(classId));
    return classInfo?.className || classId || "未指定班級";
  }

  function groupedUnplacedIssues() {
    const groups = new Map();
    (state.unplaced || []).forEach((task) => {
      const key = [task.classId, task.subject, task.week || "不限週次", task.reason || ""].join("|");
      const current = groups.get(key) || { ...task, count: 0 };
      current.count += 1;
      groups.set(key, current);
    });

    return Array.from(groups.values()).map((task) => ({
      id: `UNPLACED-${task.classId}-${task.subject}-${task.week || "ANY"}`,
      level: "warning",
      code: "UNPLACED_AUTO_TASK",
      message: `${classLabel(task.classId)}「${task.subject}」第 ${task.week || "可排"} 週有 ${
        task.count
      } 個連堂區塊未排入。`,
      lessonIds: [],
      detail: task.reason || "",
      suggestion: task.reason || "請檢查可授課教師、週次、授課班級與空白時段。",
    }));
  }

  function handleConflictListClick(event) {
    const button = event.target.closest("[data-conflict-action]");
    if (!button) return;

    if (button.dataset.conflictAction === "dismiss") {
      const key = button.dataset.issueKey;
      if (!key) return;
      state.dismissedConflictKeys.add(key);
      renderConflicts();
      toast("已從目前清單刪去這項提醒。");
      return;
    }

    if (button.dataset.conflictAction === "restore") {
      clearDismissedConflicts();
      renderConflicts();
      toast("已重新顯示全部檢查項目。");
    }
  }

  function renderConflicts() {
    refreshIssues();
    const allIssues = [...state.issues, ...groupedUnplacedIssues()];
    const recommendations = global.DgAiOptimizer.analyze(state.schedule, state.data);
    const visibleIssues = visibleConflictItems(allIssues);
    const visibleRecommendations = visibleConflictItems(recommendations, "recommendation");
    const hiddenCount = allIssues.length + recommendations.length - visibleIssues.length - visibleRecommendations.length;
    const issueHtml = visibleIssues.length
      ? visibleIssues
          .map(
            (issue) => {
              const key = conflictKey(issue);
              const typeInfo = issueTypeInfo(issue);
              return `
              <article class="conflict-item ${issue.level} issue-${typeInfo.key}">
                <div class="conflict-item-head">
                  <div class="conflict-title-row">
                    <span class="issue-kind kind-${typeInfo.key}">${escapeHtml(typeInfo.label)}</span>
                    <strong>${issue.level === "error" ? "硬性衝突" : "提醒"}｜${escapeHtml(issue.code)}</strong>
                  </div>
                  <button type="button" class="small-action" data-conflict-action="dismiss" data-issue-key="${escapeHtml(
                    key
                  )}">刪去</button>
                </div>
                <span>${escapeHtml(issue.message)}</span>
                <span class="issue-suggestion">建議：${escapeHtml(issueSuggestion(issue))}</span>
              </article>
            `;
            }
          )
          .join("")
      : hiddenCount
      ? ""
      : `<article class="conflict-item"><strong>沒有發現衝突</strong><span>目前課表可儲存。</span></article>`;

    const recommendationHtml = visibleRecommendations
      .map(
        (item) => {
          const key = conflictKey(item, "recommendation");
          const typeInfo = recommendationTypeInfo(item);
          return `
          <article class="conflict-item ${
            item.level === "error" ? "error" : item.level === "warning" ? "warning" : ""
          } issue-${typeInfo.key}">
            <div class="conflict-item-head">
              <div class="conflict-title-row">
                <span class="issue-kind kind-${typeInfo.key}">${escapeHtml(typeInfo.label)}</span>
                <strong>最佳化建議｜${escapeHtml(item.title)}</strong>
              </div>
              <button type="button" class="small-action" data-conflict-action="dismiss" data-issue-key="${escapeHtml(
                key
              )}">刪去</button>
            </div>
            <span>${escapeHtml(item.body)}</span>
          </article>
        `;
        }
      )
      .join("");
    const hiddenHtml = hiddenCount
      ? `
        <article class="conflict-item dismissed-summary">
          <strong>已刪去 ${hiddenCount} 項</strong>
          <button type="button" class="small-action" data-conflict-action="restore">重新顯示全部</button>
        </article>
      `
      : "";
    els.conflictList.innerHTML = issueHtml + recommendationHtml + hiddenHtml;
  }

  async function copyConflictText() {
    refreshIssues();
    const allIssues = [...state.issues, ...groupedUnplacedIssues()];
    const visibleIssues = visibleConflictItems(allIssues);
    const text = visibleIssues.length
      ? visibleIssues
          .map((issue) => `[${issue.level}] ${issue.code} ${issue.message}\n建議：${issueSuggestion(issue)}`)
          .join("\n\n")
      : state.dismissedConflictKeys.size
      ? "目前顯示清單沒有未刪去的檢查項目。"
      : "沒有發現衝突。";
    try {
      await navigator.clipboard.writeText(text);
      toast("已複製檢查結果。");
    } catch (error) {
      toast("瀏覽器不允許直接複製，請改用手動選取。", "error");
    }
  }

  async function handleCreateVersion(event) {
    event.preventDefault();
    refreshIssues();
    if (hardIssues().length) {
      state.activeView = "conflicts";
      renderAll();
      toast("仍有硬性衝突，暫不能儲存版本。", "error");
      return;
    }

    const versionInput = {
      versionName: els.versionName.value.trim() || `排課版本 ${new Date().toLocaleString("zh-TW")}`,
      note: els.versionNote.value.trim(),
      createdBy: state.currentUser?.userId || state.currentUser?.name || "",
      schedule: state.schedule,
    };
    const version = global.DgVersion.createVersion(versionInput);
    if (global.DgApi.hasRemote()) {
      try {
        await global.DgApi.createVersion(
          {
            versionId: version.versionId,
            versionName: version.versionName,
            createdBy: version.createdBy,
            createdAt: version.createdAt,
            note: version.note,
            isActive: true,
          },
          state.schedule
        );
      } catch (error) {
        toast(`本機版本已儲存，但寫入 GAS 失敗：${error.message}`, "error");
      }
    }
    els.versionName.value = "";
    els.versionNote.value = "";
    renderAll();
    toast("已建立課表版本。");
  }

  function renderVersions() {
    const versions = global.DgVersion.listVersions();
    els.versionList.innerHTML = versions.length
      ? versions
          .map(
            (version) => `
              <article class="version-item">
                <strong>${escapeHtml(version.versionName)}${version.isActive ? "｜目前載入" : ""}</strong>
                <p>${escapeHtml(new Date(version.createdAt).toLocaleString("zh-TW"))}　${escapeHtml(version.note || "")}</p>
                <button type="button" data-version-load="${escapeHtml(version.versionId)}">載入</button>
                <button type="button" data-version-delete="${escapeHtml(version.versionId)}">刪除</button>
              </article>
            `
          )
          .join("")
      : `<article class="version-item"><strong>尚無版本</strong><p>排課通過檢查後即可建立版本。</p></article>`;

    els.versionList.querySelectorAll("[data-version-load]").forEach((button) => {
      button.addEventListener("click", () => {
        const version = global.DgVersion.loadVersion(button.dataset.versionLoad);
        if (!version) return;
        state.schedule = global.DgConfig.clone(version.schedule || []);
        clearDismissedConflicts();
        resetAdjustMode();
        state.unplaced = [];
        refreshIssues();
        state.activeView = "schedule";
        closeEditor();
        renderAll();
        toast("已載入課表版本。");
      });
    });
    els.versionList.querySelectorAll("[data-version-delete]").forEach((button) => {
      button.addEventListener("click", () => {
        global.DgVersion.removeVersion(button.dataset.versionDelete);
        renderAll();
        toast("已刪除版本。");
      });
    });
  }

  async function handleSaveSettings(event) {
    event.preventDefault();
    global.DgConfig.setApiUrl(els.gasUrlInput.value);
    renderApiState();
    if (!global.DgApi.hasRemote()) {
      toast("尚未填入 URL，會繼續使用示範資料。");
      return;
    }
    try {
      await loadData();
      clearDismissedConflicts();
      setupInitialState();
      renderAll();
      toast("已儲存並重新讀取 Google Sheets 資料。");
    } catch (error) {
      toast(`URL 已儲存，但讀取資料失敗：${error.message}`, "error");
    }
  }

  function renderSettings() {
    const cards = Object.entries(global.DgConfig.sheetSchemas)
      .map(
        ([name, fields]) => `
          <article class="schema-card">
            <strong>${escapeHtml(global.DgConfig.sheetLabels[name] || name)}</strong>
            <small>試算表分頁：${escapeHtml(name)}</small>
            <div class="field-list">
              ${fields
                .map(
                  (field) => `
                    <span class="field-pill">
                      ${escapeHtml(global.DgConfig.fieldLabels[field] || field)}
                      <em>${escapeHtml(field)}</em>
                    </span>
                  `
                )
                .join("")}
            </div>
          </article>
        `
      )
      .join("");
    els.schemaPreview.innerHTML = cards;
  }

  function renderBatchClassBlock(classInfo, issueIds) {
    const weeks = selectedScheduleWeeks(classInfo);
    return `
      <article class="batch-print-block">
        ${renderScheduleHeading(`${classInfo.className} 班級課表`, "大觀國中暑期輔導課表")}
        <div class="all-week-schedule">
          ${weeks.map((week) => `<section class="week-block">${renderWeekTitle(week)}${renderClassWeekTable(classInfo, week, issueIds)}</section>`).join("")}
        </div>
      </article>
    `;
  }

  function renderBatchTeacherBlock(teacher, issueIds) {
    const weeks = selectedScheduleWeeks();
    return `
      <article class="batch-print-block">
        ${renderScheduleHeading(`${teacher.teacherName} 教師課表`, "大觀國中暑期輔導課表")}
        <div class="all-week-schedule">
          ${weeks.map((week) => `<section class="week-block">${renderWeekTitle(week)}${renderTeacherWeekTable(teacher, week, issueIds)}</section>`).join("")}
        </div>
      </article>
    `;
  }

  function printCurrentSchedule() {
    state.printAllWeeks = true;
    state.activeView = "schedule";
    renderAll();
    global.DgExporter.printSchedule();
    setTimeout(() => {
      state.printAllWeeks = false;
      renderAll();
    }, 700);
  }

  function printBatchSchedules(type) {
    refreshIssues();
    const issueIds = global.DgConstraints.lessonsWithIssues(state.schedule, state.issues);
    const items = type === "classes" ? state.data.classes || [] : state.data.teachers || [];
    if (!items.length) {
      toast(type === "classes" ? "尚未建立班級資料。" : "尚未建立教師資料。", "error");
      return;
    }

    state.printAllWeeks = true;
    state.activeView = "schedule";
    renderAll();
    els.scheduleContainer.innerHTML =
      type === "classes"
        ? items.map((classInfo) => renderBatchClassBlock(classInfo, issueIds)).join("")
        : items.map((teacher) => renderBatchTeacherBlock(teacher, issueIds)).join("");
    global.DgExporter.printSchedule();
    setTimeout(() => {
      state.printAllWeeks = false;
      renderAll();
    }, 700);
  }

  function handleExport(event) {
    const action = event.currentTarget.dataset.export;
    const className = global.DgConstraints.className(state.data, state.selectedClassId);
    const teacherName = global.DgConstraints.teacherName(state.data, state.selectedTeacherId);
    if (action === "classCsv") {
      global.DgExporter.downloadCsv(`${className}-暑期課表.csv`, global.DgExporter.classRows(state.schedule, state.data, state.selectedClassId));
    }
    if (action === "teacherCsv") {
      global.DgExporter.downloadCsv(`${teacherName}-暑期課表.csv`, global.DgExporter.teacherRows(state.schedule, state.data, state.selectedTeacherId));
    }
    if (action === "allCsv") {
      global.DgExporter.downloadCsv("大觀國中暑期總課表.csv", global.DgExporter.allRows(state.schedule, state.data));
    }
    if (action === "classPrint") {
      state.viewMode = "class";
      printCurrentSchedule();
    }
    if (action === "teacherPrint") {
      state.viewMode = "teacher";
      printCurrentSchedule();
    }
    if (action === "allClassesPrint") {
      printBatchSchedules("classes");
    }
    if (action === "allTeachersPrint") {
      printBatchSchedules("teachers");
    }
  }

  async function init() {
    bindElements();
    bindEvents();
    await loadData();
    state.currentUser = global.DgAuth.getSession();
    if (state.currentUser) {
      setupInitialState();
      showApp();
    } else {
      showLogin();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})(typeof window !== "undefined" ? window : globalThis);
