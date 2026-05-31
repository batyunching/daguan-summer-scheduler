(function (global) {
  function bind(options) {
    const container = options.container;
    if (!container) return;

    container.addEventListener("dragstart", (event) => {
      const card = event.target.closest(".course-card");
      if (event.target.closest("[data-adjust-lesson]")) return;
      if (!card || card.getAttribute("draggable") !== "true") return;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.dataset.lessonId);
      card.classList.add("dragging");
    });

    container.addEventListener("dragend", (event) => {
      const card = event.target.closest(".course-card");
      if (card) card.classList.remove("dragging");
      container.querySelectorAll(".drop-slot.drag-over").forEach((slot) => slot.classList.remove("drag-over"));
    });

    container.addEventListener("dragover", (event) => {
      const slot = event.target.closest(".drop-slot");
      if (!slot || slot.classList.contains("readonly")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      slot.classList.add("drag-over");
    });

    container.addEventListener("dragleave", (event) => {
      const slot = event.target.closest(".drop-slot");
      if (slot) slot.classList.remove("drag-over");
    });

    container.addEventListener("drop", (event) => {
      const slot = event.target.closest(".drop-slot");
      if (!slot || slot.classList.contains("readonly")) return;
      event.preventDefault();
      slot.classList.remove("drag-over");

      const lessonId = event.dataTransfer.getData("text/plain");
      if (!lessonId) return;
      const target = {
        classId: slot.dataset.classId,
        week: Number(slot.dataset.week),
        day: Number(slot.dataset.day),
        blockStart: Number(slot.dataset.blockStart),
      };
      options.onMove(lessonId, target);
    });
  }

  global.DgDragDrop = { bind };
})(typeof window !== "undefined" ? window : globalThis);
