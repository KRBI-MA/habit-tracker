"use strict";

/* ---------- Konstanten ---------- */

const STORAGE_KEY = "habit-tracker-v1";
const EMOJIS = ["✅", "📖", "🏃", "💪", "🧘", "💧", "🥗", "😴", "🦷", "🎸", "🇬🇧", "💻", "🚭", "🧹", "☀️", "✍️"];
const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#ef4444", "#14b8a6", "#64748b"];
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]; // Index 0 = Montag

/* ---------- Zustand ---------- */

let state = load();
let selectedDate = todayKey();
let editingId = null; // id der Gewohnheit im Dialog, null = neu

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.habits) && typeof data.checks === "object") return migrate(data);
    }
  } catch (e) { /* beschädigte Daten ignorieren */ }
  return { habits: [], checks: {}, notified: {} };
}

// Ältere Datenstände um neue Felder ergänzen
function migrate(data) {
  data.notified = data.notified || {};
  for (const h of data.habits) {
    if (!h.type) h.type = "build";        // "build" = erlernen, "quit" = ablegen
    if (h.group === undefined) h.group = "";
    if (h.targetDays === undefined) h.targetDays = null;
    if (h.reminder === undefined) h.reminder = null;
    if (h.notes === undefined) h.notes = "";
  }
  return data;
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- Datums-Helfer ---------- */

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayKey() {
  return dateKey(new Date());
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// JS: getDay() 0 = Sonntag → umrechnen auf 0 = Montag
function weekdayIndex(d) {
  return (d.getDay() + 6) % 7;
}

function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/* ---------- Logik ---------- */

function isScheduled(habit, date) {
  if (!habit.days || habit.days.length === 7) return true;
  return habit.days.includes(weekdayIndex(date));
}

function isChecked(habitId, key) {
  return (state.checks[habitId] || []).includes(key);
}

function toggleCheck(habitId, key) {
  const list = state.checks[habitId] || (state.checks[habitId] = []);
  const idx = list.indexOf(key);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(key);
  save();
  render();
}

// Aktuelle Serie: aufeinanderfolgende geplante Tage bis heute.
// Ein noch nicht abgehakter heutiger Tag unterbricht die Serie nicht.
function currentStreak(habit) {
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const d = daysAgo(i);
    if (dateKey(d) < dateKey(parseKey(habit.createdAt)) && i > 0) break;
    if (!isScheduled(habit, d)) continue;
    if (isChecked(habit.id, dateKey(d))) {
      streak++;
    } else {
      if (i === 0) continue; // heute offen → weiterzählen ab gestern
      break;
    }
  }
  return streak;
}

function bestStreak(habit) {
  const checks = (state.checks[habit.id] || []).slice().sort();
  if (checks.length === 0) return 0;
  let best = 0, current = 0;
  const start = parseKey(checks[0]);
  const end = new Date();
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (!isScheduled(habit, d)) continue;
    if (isChecked(habit.id, dateKey(d))) {
      current++;
      best = Math.max(best, current);
    } else if (dateKey(d) !== todayKey()) {
      current = 0;
    }
  }
  return best;
}

// Erfüllungsquote der letzten 30 Tage (nur geplante Tage ab Erstellung)
function completionRate30(habit) {
  let scheduled = 0, done = 0;
  for (let i = 0; i < 30; i++) {
    const d = daysAgo(i);
    if (dateKey(d) < habit.createdAt) break;
    if (!isScheduled(habit, d)) continue;
    scheduled++;
    if (isChecked(habit.id, dateKey(d))) done++;
  }
  return scheduled === 0 ? null : Math.round((done / scheduled) * 100);
}

function habitsForDate(date) {
  return state.habits.filter(h => dateKey(date) >= h.createdAt);
}

function dayProgress(date) {
  const key = dateKey(date);
  const scheduled = habitsForDate(date).filter(h => isScheduled(h, date));
  if (scheduled.length === 0) return null;
  const done = scheduled.filter(h => isChecked(h.id, key)).length;
  return { done, total: scheduled.length };
}

/* ---------- Rendering ---------- */

const $ = (sel) => document.querySelector(sel);

function render() {
  renderHeader();
  renderProgress();
  renderDayStrip();
  renderHabits();
}

function renderHeader() {
  const h = new Date().getHours();
  $("#greeting").textContent = h < 5 ? "Gute Nacht!" : h < 11 ? "Guten Morgen!" : h < 18 ? "Hallo!" : "Guten Abend!";
  $("#today-date").textContent = new Date().toLocaleDateString("de-DE", {
    weekday: "long", day: "numeric", month: "long"
  });
}

function renderProgress() {
  const date = parseKey(selectedDate);
  const prog = dayProgress(date);
  const isToday = selectedDate === todayKey();
  $("#progress-title").textContent = isToday
    ? "Heute"
    : date.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "short" });

  const ring = $("#ring-fill");
  const circumference = 213.6;
  if (!prog) {
    $("#progress-pct").textContent = "–";
    $("#progress-detail").textContent = state.habits.length === 0
      ? "Noch keine Gewohnheiten"
      : "Nichts geplant an diesem Tag";
    ring.style.strokeDashoffset = circumference;
    return;
  }
  const pct = Math.round((prog.done / prog.total) * 100);
  $("#progress-pct").textContent = `${pct}%`;
  $("#progress-detail").textContent = prog.done === prog.total
    ? `Alle ${prog.total} geschafft! 🎉`
    : `${prog.done} von ${prog.total} erledigt`;
  ring.style.strokeDashoffset = circumference * (1 - prog.done / prog.total);
}

function renderDayStrip() {
  const strip = $("#day-strip");
  strip.innerHTML = "";
  for (let i = 6; i >= 0; i--) {
    const d = daysAgo(i);
    const key = dateKey(d);
    const btn = document.createElement("button");
    btn.className = "day-cell";
    if (key === selectedDate) btn.classList.add("selected");
    if (key === todayKey()) btn.classList.add("today");

    const prog = dayProgress(d);
    let dotClass = "dot";
    if (prog && prog.done === prog.total) dotClass += " full";
    else if (prog && prog.done > 0) dotClass += " partial";

    btn.innerHTML = `
      <span class="dow">${WEEKDAYS[weekdayIndex(d)]}</span>
      <span class="dom">${d.getDate()}</span>
      <span class="${dotClass}"></span>`;
    btn.addEventListener("click", () => {
      selectedDate = key;
      render();
    });
    strip.appendChild(btn);
  }
}

function renderHabits() {
  const list = $("#habit-list");
  const date = parseKey(selectedDate);
  list.innerHTML = "";

  const habits = habitsForDate(date);
  $("#empty-state").hidden = state.habits.length > 0;

  if (state.habits.length > 0 && habits.length === 0) {
    const note = document.createElement("li");
    note.className = "empty-state";
    note.style.marginTop = "24px";
    note.textContent = "An diesem Tag gab es noch keine Gewohnheiten.";
    list.appendChild(note);
    return;
  }

  const sorted = habits.slice().sort((a, b) => {
    const sa = isScheduled(a, date) ? 0 : 1;
    const sb = isScheduled(b, date) ? 0 : 1;
    return sa - sb || a.createdAt.localeCompare(b.createdAt);
  });

  // Nach Gruppen bündeln; Gewohnheiten ohne Gruppe zuerst
  const groups = new Map();
  for (const h of sorted) {
    const g = h.group || "";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(h);
  }
  const groupNames = [...groups.keys()].sort((a, b) => {
    if (a === "") return -1;
    if (b === "") return 1;
    return a.localeCompare(b, "de");
  });

  const flat = [];
  for (const g of groupNames) {
    if (g) flat.push({ header: g });
    for (const h of groups.get(g)) flat.push({ habit: h });
  }

  for (const entry of flat) {
    if (entry.header) {
      const li = document.createElement("li");
      li.className = "group-header";
      li.textContent = entry.header;
      list.appendChild(li);
      continue;
    }
    const habit = entry.habit;
    const scheduled = isScheduled(habit, date);
    const checked = isChecked(habit.id, selectedDate);
    const streak = currentStreak(habit);

    const li = document.createElement("li");
    li.className = "habit-item" + (scheduled ? "" : " not-scheduled");

    const daysLabel = (!habit.days || habit.days.length === 7)
      ? "Täglich"
      : habit.days.map(i => WEEKDAYS[i]).join(", ");

    const parts = [daysLabel];
    if (habit.type === "quit") parts.push("🚫 Ablegen");
    if (streak > 0) {
      const unit = streak === 1 ? "Tag" : "Tage";
      parts.push(habit.type === "quit" ? `🔥 ${streak} ${unit} ohne` : `🔥 ${streak} ${unit}`);
    }
    if (habit.targetDays) {
      const done = (state.checks[habit.id] || []).length;
      parts.push(done >= habit.targetDays ? `🏆 ${habit.targetDays} Tage geschafft!` : `🎯 ${done}/${habit.targetDays}`);
    }
    if (habit.reminder) parts.push(`⏰ ${habit.reminder}`);
    if (habit.notes) parts.push("📝");

    li.innerHTML = `
      <div class="habit-icon" style="background:${habit.color}22">${habit.icon}</div>
      <div class="habit-info">
        <div class="name">${escapeHtml(habit.name)}</div>
        <div class="meta">${escapeHtml(parts.join(" · "))}</div>
      </div>
      <button class="check-btn${checked ? " checked" : ""}" aria-label="Abhaken">✓</button>`;

    li.querySelector(".habit-info").addEventListener("click", () => openHabitDialog(habit.id));
    li.querySelector(".check-btn").addEventListener("click", () => toggleCheck(habit.id, selectedDate));
    list.appendChild(li);
  }
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

/* ---------- Dialog: Gewohnheit ---------- */

let dlgEmoji = EMOJIS[0];
let dlgColor = COLORS[0];
let dlgDays = new Set([0, 1, 2, 3, 4, 5, 6]);
let dlgType = "build";

function buildPickers() {
  document.querySelectorAll(".type-option").forEach(b =>
    b.addEventListener("click", () => { dlgType = b.dataset.type; updatePickers(); }));
  const ep = $("#emoji-picker");
  ep.innerHTML = "";
  for (const e of EMOJIS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "emoji-option";
    b.textContent = e;
    b.addEventListener("click", () => { dlgEmoji = e; updatePickers(); });
    ep.appendChild(b);
  }
  const cp = $("#color-picker");
  cp.innerHTML = "";
  for (const c of COLORS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "color-option";
    b.style.background = c;
    b.dataset.color = c;
    b.addEventListener("click", () => { dlgColor = c; updatePickers(); });
    cp.appendChild(b);
  }
  const wp = $("#weekday-picker");
  wp.innerHTML = "";
  WEEKDAYS.forEach((label, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "weekday-option";
    b.textContent = label;
    b.addEventListener("click", () => {
      if (dlgDays.has(i)) { if (dlgDays.size > 1) dlgDays.delete(i); }
      else dlgDays.add(i);
      updatePickers();
    });
    wp.appendChild(b);
  });
}

function updatePickers() {
  document.querySelectorAll(".type-option").forEach(b =>
    b.classList.toggle("selected", b.dataset.type === dlgType));
  document.querySelectorAll(".emoji-option").forEach(b =>
    b.classList.toggle("selected", b.textContent === dlgEmoji));
  document.querySelectorAll(".color-option").forEach(b =>
    b.classList.toggle("selected", b.dataset.color === dlgColor));
  document.querySelectorAll(".weekday-option").forEach((b, i) =>
    b.classList.toggle("selected", dlgDays.has(i)));
}

function openHabitDialog(id = null) {
  editingId = id;
  const habit = id ? state.habits.find(h => h.id === id) : null;
  $("#dialog-title").textContent = habit ? "Gewohnheit bearbeiten" : "Neue Gewohnheit";
  $("#habit-name").value = habit ? habit.name : "";
  dlgEmoji = habit ? habit.icon : EMOJIS[0];
  dlgColor = habit ? habit.color : COLORS[Math.floor(Math.random() * COLORS.length)];
  dlgDays = new Set(habit && habit.days ? habit.days : [0, 1, 2, 3, 4, 5, 6]);
  dlgType = habit ? habit.type : "build";
  $("#habit-group").value = habit ? habit.group : "";
  $("#habit-duration").value = habit && habit.targetDays ? habit.targetDays : "";
  $("#habit-reminder").value = habit && habit.reminder ? habit.reminder : "";
  $("#habit-notes").value = habit ? habit.notes : "";

  // Vorhandene Gruppen als Vorschläge anbieten
  const dl = $("#group-list");
  dl.innerHTML = "";
  for (const g of [...new Set(state.habits.map(h => h.group).filter(Boolean))].sort()) {
    const opt = document.createElement("option");
    opt.value = g;
    dl.appendChild(opt);
  }

  $("#delete-habit-btn").hidden = !habit;
  $("#shortcut-help-btn").hidden = !(habit && habit.reminder);
  updatePickers();
  $("#habit-dialog").showModal();
}

function submitHabit(e) {
  e.preventDefault();
  const name = $("#habit-name").value.trim();
  if (!name) return;
  const days = dlgDays.size === 7 ? null : [...dlgDays].sort((a, b) => a - b);
  const duration = parseInt($("#habit-duration").value, 10);
  const fields = {
    name,
    icon: dlgEmoji,
    color: dlgColor,
    days,
    type: dlgType,
    group: $("#habit-group").value.trim(),
    targetDays: duration > 0 ? duration : null,
    reminder: $("#habit-reminder").value || null,
    notes: $("#habit-notes").value.trim(),
  };

  if (editingId) {
    Object.assign(state.habits.find(h => h.id === editingId), fields);
  } else {
    state.habits.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      createdAt: todayKey(),
      ...fields,
    });
  }
  save();
  $("#habit-dialog").close();
  render();

  // Für Erinnerungen einmalig um Benachrichtigungs-Erlaubnis bitten
  if (fields.reminder && "Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function deleteHabit() {
  const habit = state.habits.find(h => h.id === editingId);
  if (!habit) return;
  if (!confirm(`„${habit.name}" wirklich löschen? Alle Einträge gehen verloren.`)) return;
  state.habits = state.habits.filter(h => h.id !== editingId);
  delete state.checks[editingId];
  save();
  $("#habit-dialog").close();
  render();
}

/* ---------- Statistik ---------- */

function openStats() {
  const body = $("#stats-body");
  if (state.habits.length === 0) {
    body.innerHTML = `<p style="color:var(--text-dim)">Noch keine Daten – leg zuerst eine Gewohnheit an.</p>`;
  } else {
    const totalChecks = Object.values(state.checks).reduce((n, arr) => n + arr.length, 0);
    const maxStreak = Math.max(0, ...state.habits.map(bestStreak));
    let html = `
      <div class="stats-summary">
        <div class="tile"><strong>${totalChecks}</strong><span>Häkchen gesamt</span></div>
        <div class="tile"><strong>🔥 ${maxStreak}</strong><span>Längste Serie</span></div>
      </div>`;
    for (const h of state.habits) {
      const rate = completionRate30(h);
      html += `
        <div class="stat-row">
          <div class="habit-icon" style="background:${h.color}22">${h.icon}</div>
          <div class="stat-name">${escapeHtml(h.name)}</div>
          <div class="stat-values">
            <strong>${rate === null ? "–" : rate + "%"}</strong> letzte 30 Tage<br>
            🔥 ${currentStreak(h)} aktuell · Rekord ${bestStreak(h)}
          </div>
        </div>`;
    }
    body.innerHTML = html;
  }
  $("#stats-dialog").showModal();
}

/* ---------- Export / Import ---------- */

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `habits-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.habits) || typeof data.checks !== "object") throw new Error();
      if (!confirm("Vorhandene Daten werden ersetzt. Fortfahren?")) return;
      state = migrate(data);
      save();
      $("#stats-dialog").close();
      render();
    } catch {
      alert("Ungültige Datei – Import abgebrochen.");
    }
  };
  reader.readAsText(file);
}

/* ---------- Kurzbefehle-Anleitung ---------- */

function reminderText(name, icon, type) {
  return type === "quit"
    ? `${icon} ${name} – bleib stark, heute wieder ohne! Kurz in der Habit-App abhaken.`
    : `${icon} ${name} – jetzt ist ein guter Moment! Danach in der Habit-App abhaken.`;
}

function openShortcutDialog() {
  const time = $("#habit-reminder").value || "20:00";
  const name = $("#habit-name").value.trim() || "Meine Gewohnheit";
  $("#sc-time").textContent = time;
  $("#sc-text").textContent = reminderText(name, dlgEmoji, dlgType);
  $("#shortcut-dialog").showModal();
}

async function copyShortcutText() {
  const btn = $("#sc-copy-btn");
  try {
    await navigator.clipboard.writeText($("#sc-text").textContent);
    btn.textContent = "Kopiert ✓";
  } catch {
    btn.textContent = "Bitte manuell kopieren";
  }
  setTimeout(() => { btn.textContent = "Kopieren"; }, 2000);
}

/* ---------- Erinnerungen ---------- */

// Prüft minütlich, ob eine Erinnerung fällig ist. Benachrichtigt nur,
// solange die App (auch im Hintergrund-Tab) geöffnet ist – eine PWA ohne
// Push-Server kann keine Benachrichtigungen bei geschlossener App senden.
function checkReminders() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const today = todayKey();
  let changed = false;

  for (const habit of state.habits) {
    if (!habit.reminder || habit.reminder > hhmm) continue;
    if (!isScheduled(habit, now)) continue;
    if (isChecked(habit.id, today)) continue;
    if (state.notified[habit.id] === today) continue;

    new Notification(`${habit.icon} ${habit.name}`, {
      body: habit.type === "quit"
        ? "Heute schon durchgehalten? Jetzt abhaken!"
        : "Noch nicht erledigt – jetzt ist ein guter Moment!",
      tag: `habit-${habit.id}`,
    });
    state.notified[habit.id] = today;
    changed = true;
  }
  if (changed) save();
}

setInterval(checkReminders, 60 * 1000);

/* ---------- Initialisierung ---------- */

buildPickers();

$("#add-btn").addEventListener("click", () => openHabitDialog());
$("#habit-form").addEventListener("submit", submitHabit);
$("#cancel-btn").addEventListener("click", () => $("#habit-dialog").close());
$("#delete-habit-btn").addEventListener("click", deleteHabit);

$("#habit-reminder").addEventListener("input", (e) => {
  $("#shortcut-help-btn").hidden = !e.target.value;
});
$("#shortcut-help-btn").addEventListener("click", openShortcutDialog);
$("#sc-copy-btn").addEventListener("click", copyShortcutText);
$("#sc-close-btn").addEventListener("click", () => $("#shortcut-dialog").close());

$("#stats-btn").addEventListener("click", openStats);
$("#stats-close-btn").addEventListener("click", () => $("#stats-dialog").close());
$("#export-btn").addEventListener("click", exportData);
$("#import-btn").addEventListener("click", () => $("#import-file").click());
$("#import-file").addEventListener("change", (e) => {
  if (e.target.files[0]) importData(e.target.files[0]);
  e.target.value = "";
});

// Beim Zurückkehren zur App (z. B. am nächsten Morgen) neu rendern;
// liegt der gewählte Tag nicht mehr in der 7-Tage-Leiste, auf heute springen
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  if (dateKey(parseKey(selectedDate)) < dateKey(daysAgo(6))) selectedDate = todayKey();
  render();
  checkReminders();
});

render();

// Service Worker für Offline-Betrieb
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
