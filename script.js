(() => {
  const STORAGE_KEY = "notes_app_notes_v1";

  const elNoteInput = document.getElementById("noteInput");
  const elSaveBtn = document.getElementById("saveBtn");
  const elClearBtn = document.getElementById("clearBtn");
  const elStatus = document.getElementById("status");
  const elNotesList = document.getElementById("notesList");
  const elEmptyState = document.getElementById("emptyState");
  const elClearAllBtn = document.getElementById("clearAllBtn");
  const elExportBtn = document.getElementById("exportBtn");
  const elImportInput = document.getElementById("importInput");

  let editId = null;

  function setStatus(msg, isError = false) {
    elStatus.textContent = msg;
    elStatus.style.color = isError ? "#ff8a97" : "var(--muted)";
  }

  function loadNotes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveNotes(notes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }

  function formatDate(ts) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "<")
      .replaceAll(">", ">")
      .replaceAll('"', """)
      .replaceAll("'", "&#039;");
  }

  function renderNotes() {
    const notes = loadNotes().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    elNotesList.innerHTML = "";

    if (notes.length === 0) {
      elEmptyState.style.display = "block";
      return;
    }

    elEmptyState.style.display = "none";

    for (const note of notes) {
      const { id, createdAt, text } = note;

      const item = document.createElement("article");
      item.className = "note";
      item.dataset.id = id;

      item.innerHTML = `
        <div class="note__top">
          <div>
            <div class="note__meta">Saved: ${escapeHtml(formatDate(createdAt))}</div>
            <div class="note__text"></div>
          </div>
          <div class="note__actions">
            <button class="btn btn--small" data-action="edit" type="button">Edit</button>
            <button class="btn btn--small btn--danger" data-action="delete" type="button">Delete</button>
          </div>
        </div>
      `;

      item.querySelector(".note__text").textContent = text;

      item.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;
        const action = btn.getAttribute("data-action");
        if (action === "edit") startEdit(id);
        if (action === "delete") deleteNote(id);
      });

      elNotesList.appendChild(item);
    }
  }

  function clearInputAndMode() {
    editId = null;
    elNoteInput.value = "";
    elSaveBtn.textContent = "Save";
  }

  function validateText(text) {
    const t = String(text ?? "").trim();
    if (!t) return { ok: false, reason: "Please write something." };
    if (t.length > 10000) return { ok: false, reason: "Note is too long (max 10,000 chars)." };
    return { ok: true, value: t };
  }

  function upsertNote({ id, text }) {
    const notes = loadNotes();
    const now = Date.now();

    if (id) {
      const idx = notes.findIndex((n) => n.id === id);
      if (idx !== -1) {
        notes[idx] = { ...notes[idx], text, updatedAt: now };
      }
    } else {
      notes.push({
        id: crypto.randomUUID ? crypto.randomUUID() : String(now) + "-" + Math.random().toString(16).slice(2),
        text,
        createdAt: now,
        updatedAt: now,
      });
    }

    saveNotes(notes);
    return notes;
  }

  function handleSave() {
    const check = validateText(elNoteInput.value);
    if (!check.ok) {
      setStatus(check.reason, true);
      return;
    }

    const text = check.value;
    upsertNote({ id: editId, text });

    setStatus(editId ? "Note updated." : "Note saved.");
    clearInputAndMode();
    renderNotes();
  }

  function startEdit(id) {
    const notes = loadNotes();
    const note = notes.find((n) => n.id === id);
    if (!note) return;

    editId = id;
    elNoteInput.value = note.text;
    elSaveBtn.textContent = "Update";
    setStatus("Editing mode: update the note and press Update.");
    elNoteInput.focus();
  }

  function deleteNote(id) {
    const notes = loadNotes();
    const next = notes.filter((n) => n.id !== id);
    saveNotes(next);

    if (editId === id) clearInputAndMode();
    setStatus("Note deleted.");
    renderNotes();
  }

  function setStatus(msg, isError = false) {
    elStatus.textContent = msg;
    elStatus.style.color = isError ? "#ff8a97" : "var(--muted)";
  }

  function clearInput() {
    if (!elNoteInput.value.trim() && !editId) return;
    elNoteInput.value = "";
    if (!editId) setStatus("Cleared.");
  }

  function clearAll() {
    if (!confirm("Delete all notes? This cannot be undone.")) return;
    saveNotes([]);
    clearInputAndMode();
    setStatus("All notes cleared.");
    renderNotes();
  }

  function exportNotes() {
    const notes = loadNotes();
    const blob = new Blob([JSON.stringify(notes, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
    a.download = `notes-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  function importNotes(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        if (!Array.isArray(parsed)) throw new Error("Invalid format");

        const cleaned = parsed
          .filter((n) => n && typeof n === "object")
          .map((n) => ({
            id: typeof n.id === "string" ? n.id : String(Date.now()) + "-" + Math.random().toString(16).slice(2),
            text: String(n.text ?? ""),
            createdAt: Number(n.createdAt || Date.now()),
            updatedAt: Number(n.updatedAt || n.createdAt || Date.now()),
          }))
          .map((n) => {
            const textCheck = validateText(n.text);
            if (!textCheck.ok) return null;
            return { ...n, text: textCheck.value };
          })
          .filter(Boolean);

        saveNotes(cleaned);
        clearInputAndMode();
        setStatus("Import successful.");
        renderNotes();
      } catch {
        setStatus("Import failed: invalid JSON.", true);
      }
    };
    reader.readAsText(file);
  }

  // Events
  elSaveBtn.addEventListener("click", handleSave);
  elClearBtn.addEventListener("click", clearInput);
  elClearAllBtn.addEventListener("click", clearAll);
  elExportBtn.addEventListener("click", exportNotes);
  elImportInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) importNotes(file);
    e.target.value = "";
  });

  elNoteInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "enter") {
      e.preventDefault();
      handleSave();
    }
  });

  // Init
  renderNotes();
})();

