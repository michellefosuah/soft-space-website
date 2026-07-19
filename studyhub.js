/* =========================
   SOFT SPACE - STUDY HUB JS (CLEAN STABLE CORE)
========================= */

/* =========================
   DATA STORAGE
========================= */

let studyTasks = JSON.parse(localStorage.getItem("study-tasks")) || [];
let library = JSON.parse(localStorage.getItem("study-library")) || [];

/* =========================
   ACTIVE STUDY SESSION (CORE ENGINE)
========================= */

let activeSession = {
    subject: null,
    startTime: null,
    endTime: null
};

/* OPTIONAL: subject tracking (safe init) */
let subjectSessions = JSON.parse(localStorage.getItem("subjectSessions")) || [];

/* =========================
   DOM ELEMENTS - STUDY TASKS
========================= */

const studyInput = document.getElementById("studyInput");
const studyPriority = document.getElementById("studyPriority");
const addStudyBtn = document.getElementById("addStudyBtn");
const studyList = document.getElementById("studyList");

/* =========================
   DOM ELEMENTS - LIBRARY
========================= */

const librarySubject = document.getElementById("librarySubject");
const libraryFile = document.getElementById("libraryFile");
const libraryDescription = document.getElementById("libraryDescription");
const uploadLibraryBtn = document.getElementById("uploadLibraryBtn");
const libraryList = document.getElementById("libraryList");
const librarySearch = document.getElementById("librarySearch");

/* =========================
   STUDY TASK SYSTEM
========================= */

/* SAVE TASKS */
function saveStudy() {
    localStorage.setItem("study-tasks", JSON.stringify(studyTasks));
}

/* RENDER TASKS */
function renderStudy() {

    if (!studyList) return;

    studyList.innerHTML = "";

    studyTasks.forEach((task, index) => {

        const li = document.createElement("li");
        li.classList.add("task-item");

        li.innerHTML = `
            <button class="check">
                ${task.completed ? "✔" : ""}
            </button>

            <span class="task-text">
                [${task.priority}] ${task.text}
            </span>

            <div class="task-actions">
                <button class="edit-btn" title="Edit task">✏️</button>
                <button class="delete-btn" title="Delete task">🗑️</button>
            </div>
        `;

        /* DELETE TASK */
        li.querySelector(".delete-btn").addEventListener("click", () => {
            studyTasks.splice(index, 1);
            saveStudy();
            renderStudy();
        });

        studyList.appendChild(li);
    });
}

/* ADD TASK */
function addStudyTask() {

    const value = studyInput?.value.trim();
    if (!value) return;

    studyTasks.push({
        id: crypto.randomUUID(),
        text: value,
        priority: studyPriority?.value || "B",
        subject: activeSession.subject || "General"
    });

    studyInput.value = "";

    saveStudy();
    renderStudy();
}

/* EVENTS */
addStudyBtn?.addEventListener("click", addStudyTask);

studyInput?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") addStudyTask();
});
/* =========================
   ACTIVE SESSION CONTROLLER
========================= */

function setActiveSubject(subject) {

    activeSession.subject = subject;
    activeSession.startTime = new Date();

    updateUIForActiveSession();
}

/* =========================
   UI UPDATE FOR ACTIVE SESSION
========================= */

function updateUIForActiveSession() {

    const sessionEl = document.getElementById("sessionType");
    const titleEl = document.getElementById("activeSubjectTitle");

    if (sessionEl) {
        sessionEl.textContent = activeSession.subject
            ? `🍅 ${activeSession.subject} Session`
            : "🍅 Focus Session";
    }

    if (titleEl) {
        titleEl.textContent = activeSession.subject
            ? `Studying: ${activeSession.subject}`
            : "No Active Subject";
    }
}

/* =========================
   LIBRARY SYSTEM (FIXED STABLE VERSION)
========================= */

function saveLibrary() {
    localStorage.setItem("study-library", JSON.stringify(library));
}

/* UPLOAD RESOURCE */
function uploadResource() {

    if (!libraryFile?.files.length) return;

    const file = libraryFile.files[0];

    const resource = {
        id: crypto.randomUUID(),

        subject: librarySubject?.value || "General",
        description: libraryDescription?.value || "",

        fileName: file.name,
        fileType: file.type,
        fileData: URL.createObjectURL(file),

        size: (file.size / 1024).toFixed(1) + " KB",
        uploaded: new Date().toLocaleDateString()
    };

    library.push(resource);

    saveLibrary();
    renderLibrary();

    libraryDescription.value = "";
    libraryFile.value = "";
}

/* RENDER LIBRARY */
function renderLibrary() {

    if (!libraryList) return;

    libraryList.innerHTML = "";

    library.forEach(resource => {

        const card = document.createElement("div");
        card.className = "library-item";

        card.innerHTML = `
            <div class="library-left">
                <span class="library-subject">${resource.subject}</span>
                <span class="library-name">${resource.fileName}</span>
                <small>${resource.size} • ${resource.uploaded}</small>
            </div>

            <div class="library-actions">
                <button class="open-btn">📂</button>
                <button class="delete-btn">🗑</button>
            </div>
        `;

        /* OPEN FILE */
        card.querySelector(".open-btn").addEventListener("click", () => {
            openResource(resource);
        });

        /* DELETE FILE */
        card.querySelector(".delete-btn").addEventListener("click", () => {
            library = library.filter(item => item.id !== resource.id);
            saveLibrary();
            renderLibrary();
        });

        libraryList.appendChild(card);
    });
}

/* OPEN RESOURCE */
function openResource(resource) {

    if (resource.fileType?.includes("image")) {
        window.open(resource.fileData, "_blank");
        return;
    }

    if (resource.fileType?.includes("pdf")) {
        window.open(resource.fileData, "_blank");
        return;
    }

    const a = document.createElement("a");
    a.href = resource.fileData;
    a.download = resource.fileName;
    a.click();
}

/* SEARCH */
function searchLibrary(query) {

    const filtered = library.filter(item => {

        const text = `
            ${item.subject}
            ${item.fileName}
            ${item.description}
        `.toLowerCase();

        return text.includes(query.toLowerCase());
    });

    renderFilteredLibrary(filtered);
}

/* FILTER RENDER */
function renderFilteredLibrary(list) {

    if (!libraryList) return;

    libraryList.innerHTML = "";

    list.forEach(resource => {

        const card = document.createElement("div");
        card.className = "library-item";

        card.innerHTML = `
            <div class="library-left">
                <span class="library-subject">${resource.subject}</span>
                <span class="library-name">${resource.fileName}</span>
                <small>${resource.size} • ${resource.uploaded}</small>
            </div>

            <div class="library-actions">
                <button class="open-btn">📂</button>
                <button class="delete-btn">🗑</button>
            </div>
        `;

        card.querySelector(".open-btn").addEventListener("click", () => {
            openResource(resource);
        });

        card.querySelector(".delete-btn").addEventListener("click", () => {
            library = library.filter(item => item.id !== resource.id);
            saveLibrary();
            renderLibrary();
        });

        libraryList.appendChild(card);
    });
}

/* SEARCH EVENT */
librarySearch?.addEventListener("input", (e) => {

    const value = e.target.value;

    if (!value) renderLibrary();
    else searchLibrary(value);
});

/* UPLOAD BUTTON */
uploadLibraryBtn?.addEventListener("click", uploadResource);

/* =========================
   POMODORO TIMER (CLEAN + STABLE)
========================= */

const timerEl = document.getElementById("timer");
const sessionEl = document.getElementById("sessionType");

let time = 25 * 60;
let totalTime = 25 * 60;

let timer = null;
let running = false;

/* TIMER DISPLAY */
function updateTimer() {

    if (!timerEl) return;

    const m = Math.floor(time / 60);
    const s = time % 60;

    timerEl.textContent = `${m}:${s < 10 ? "0" : ""}${s}`;
}

/* CIRCLE */
const progressCircle = document.getElementById("progressCircle");

const radius = 95;
const circumference = 2 * Math.PI * radius;

if (progressCircle) {
    progressCircle.style.strokeDasharray = circumference;
    progressCircle.style.strokeDashoffset = circumference;
}

function updateCircle(timeLeft) {

    if (!progressCircle) return;

    const percent = timeLeft / totalTime;

    progressCircle.style.strokeDashoffset =
        circumference - (percent * circumference);
}

/* START TIMER */
function startTimer() {

    if (running) return;

    running = true;

    timer = setInterval(() => {

        time--;

        updateTimer();
        updateCircle(time);

        if (time <= 0) {
            clearInterval(timer);
            running = false;
            switchSession();
        }

    }, 1000);
}

/* PAUSE */
function pauseTimer() {
    clearInterval(timer);
    running = false;
}

/* RESET */
function resetTimer() {

    clearInterval(timer);

    running = false;

    time = 25 * 60;
    totalTime = 25 * 60;

    sessionEl.textContent = "🍅 Focus Session";

    updateTimer();
    updateCircle(time);
}

/* SWITCH SESSION */
function switchSession() {

    if (sessionEl.textContent.includes("Focus")) {

        time = 5 * 60;
        totalTime = 5 * 60;
        sessionEl.textContent = activeSession.subject
            ? `☕ Break (${activeSession.subject})`
            : "☕ Break Time";

    } else {

        time = 25 * 60;
        totalTime = 25 * 60;

        sessionEl.textContent = activeSession.subject
            ? `🍅 ${activeSession.subject} Session`
            : "🍅 Focus Session";
    }

    updateTimer();
    updateCircle(time);

    startTimer();
}

/* TIMER BUTTONS */
document.getElementById("startBtn")?.addEventListener("click", startTimer);
document.getElementById("pauseBtn")?.addEventListener("click", pauseTimer);
document.getElementById("resetBtn")?.addEventListener("click", resetTimer);

/* =========================
   INIT SYSTEM
========================= */

renderStudy();
renderLibrary();
updateTimer();
updateCircle(time);
/* AUTO GENERATE AI PLAN ON LOAD */
showAIPlan();
/* =========================
   TIMETABLE SYSTEM (8AM - 7PM)
========================= */

/*
Each slot represents:
- subject
- start time
- end time
*/

let timetable = JSON.parse(localStorage.getItem("timetable")) || [];
/* =========================
   AI SCHEDULE ENGINE (SUGGESTION SYSTEM)
========================= */

function generateDailyPlan() {

    const plan = {
        focusTasks: [],
        lightTasks: [],
        recommendedSessions: 0,
        breaks: 0
    };

    /* 1. GET TODAY'S TIMETABLE */
    const todaySlots = timetable;

    /* 2. PRIORITIZE TASKS */
    const sortedTasks = [...studyTasks].sort((a, b) => {

        const priorityOrder = { "A": 1, "B": 2, "C": 3 };

        return (priorityOrder[a.priority] || 3) -
               (priorityOrder[b.priority] || 3);
    });

    /* 3. MAP TASKS TO PLAN */

    sortedTasks.forEach(task => {

        if (task.priority === "A") {
            plan.focusTasks.push(task);
        } else {
            plan.lightTasks.push(task);
        }
    });

    /* 4. CALCULATE SESSIONS */

    plan.recommendedSessions =
        plan.focusTasks.length * 2 + plan.lightTasks.length;

    plan.breaks = Math.floor(plan.recommendedSessions / 2);

    return plan;
}
/* =========================
   AI SUGGESTION DISPLAY
========================= */

function showAIPlan() {

    const plan = generateDailyPlan();

    const aiBox = document.getElementById("aiSuggestion");

    if (!aiBox) return;

    aiBox.innerHTML = `
        <h3>🧠 Today's Study Plan</h3>

        <p><strong>Focus Tasks:</strong> ${plan.focusTasks.length}</p>
        <p><strong>Light Tasks:</strong> ${plan.lightTasks.length}</p>

        <p><strong>Recommended Pomodoro Sessions:</strong> ${plan.recommendedSessions}</p>
        <p><strong>Suggested Breaks:</strong> ${plan.breaks}</p>

        <button id="acceptPlan">✔ Accept Plan</button>
        <button id="rejectPlan">✖ Reject</button>
    `;

    /* ACCEPT */
    document.getElementById("acceptPlan")?.addEventListener("click", () => {
        applyAIPlan(plan);
    });

    /* REJECT */
    document.getElementById("rejectPlan")?.addEventListener("click", () => {
        aiBox.innerHTML = "Plan dismissed.";
    });
}
/* =========================
   APPLY AI PLAN
========================= */

function applyAIPlan(plan) {

    /* Reset timetable focus suggestion */
    plan.focusTasks.forEach(task => {
        console.log("Prioritized:", task.text);
    });

    alert("✔ Plan accepted! Your study flow has been optimized.");
}

/* =========================
   CREATE TIMETABLE SLOT
========================= */

function addTimetableSlot(subject, startHour, endHour) {

    timetable.push({
        id: crypto.randomUUID(),
        subject,
        startHour,
        endHour
    });

    saveTimetable();
}

/* SAVE TIMETABLE */
function saveTimetable() {
    localStorage.setItem("timetable", JSON.stringify(timetable));
}

/* =========================
   AUTO DETECT CURRENT SLOT
========================= */

function getCurrentTimeSlot() {

    const now = new Date();
    const hour = now.getHours();

    return timetable.find(slot =>
        hour >= slot.startHour && hour < slot.endHour
    );
}

/* =========================
   AUTO SESSION SWITCHER
========================= */

function autoUpdateSessionFromTime() {

    const currentSlot = getCurrentTimeSlot();

    if (!currentSlot) return;

    if (activeSession.subject !== currentSlot.subject) {

        activeSession.subject = currentSlot.subject;
        activeSession.startTime = new Date();

        updateUIForActiveSession();

        console.log("Auto switched to:", currentSlot.subject);
    }
}

/* =========================
   RUN AUTO CHECK EVERY MINUTE
========================= */

setInterval(() => {
    autoUpdateSessionFromTime();
}, 60000);
/* =========================
   TIMETABLE UI SYSTEM
========================= */

/*
This builds the visual timetable:
8AM → 7PM grid
*/

const timetableContainer = document.getElementById("timetable");

/* =========================
   RENDER TIMETABLE GRID
========================= */

function renderTimetableUI() {

    if (!timetableContainer) return;

    timetableContainer.innerHTML = "";

    for (let hour = 8; hour <= 19; hour++) {

        const slot = timetable.find(s =>
            hour >= s.startHour && hour < s.endHour
        );

        const div = document.createElement("div");
        div.classList.add("time-slot");

        /* Highlight current active slot */
        const isActive = slot && activeSession.subject === slot.subject;

        div.innerHTML = `
            <div class="time-label">
                ${hour}:00 - ${hour + 1}:00
            </div>

            <div class="slot-content ${isActive ? "active-slot" : ""}">
                ${slot ? slot.subject : "Free Slot"}
            </div>

            <button class="assign-btn">+</button>
        `;

        /* =========================
           CLICK TO ASSIGN SUBJECT
        ========================= */

        div.querySelector(".assign-btn").addEventListener("click", () => {

            const subject = prompt("Enter subject for this hour:");

            if (!subject) return;

            addTimetableSlot(subject, hour, hour + 1);

            saveTimetable();
            renderTimetableUI();
        });

        timetableContainer.appendChild(div);
    }
}