/* =========================
   SOFT SPACE - CLEAN SCRIPT V3 (FULL SYSTEM)
========================= */

document.addEventListener("DOMContentLoaded", () => {


    /* =========================
       1. DATE
    ========================= */

    function updateDate() {
        const dateEl = document.getElementById("date");
        if (!dateEl) return;

        const options = {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        };

        dateEl.textContent = new Date().toLocaleDateString("en-US", options);
    }

    /* =========================
       2. GREETING
    ========================= */

    function updateGreeting() {
        const greetingEl = document.getElementById("greeting");
        if (!greetingEl) return;

        const hour = new Date().getHours();

        if (hour < 12) {
            greetingEl.textContent = "Good Morning, Michelle 🌸";
        } else if (hour < 18) {
            greetingEl.textContent = "Good Afternoon, Michelle ☀️";
        } else {
            greetingEl.textContent = "Good Evening, Michelle 🌙";
        }
    }

    
    /* =========================
       3. QUOTES
    ========================= */

    const quotes = [
        "You don’t have to bloom overnight.",
        "Softness is still strength.",
        "One small step is still progress.",
        "Be proud of how far you’ve come.",
        "Discipline creates freedom.",
        "Your pace is still valid.",
        "Rest is part of growth.",
        "You are becoming everything you want."
    ];

    function loadQuote() {
        const quoteEl = document.getElementById("quote");
        if (!quoteEl) return;

        const dayIndex = new Date().getDate() % quotes.length;
        quoteEl.textContent = quotes[dayIndex];
    }

    /* =========================
       4. WEATHER (STATIC)
    ========================= */

    async function loadWeather() {
    const weatherEl = document.getElementById("weather");
    if (!weatherEl) return;

    try {
        // Kumasi coordinates (you can change anytime)
        const lat = 6.6885;
        const lon = -1.6244;

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;

        const res = await fetch(url);
        const data = await res.json();

        const temp = data.current_weather.temperature;
        const wind = data.current_weather.windspeed;
        const code = data.current_weather.weathercode;

        const condition = getWeatherText(code);

        weatherEl.textContent = `${temp}°C • ${condition} • Wind ${wind} km/h`;

    } catch (err) {
        weatherEl.textContent = "Weather unavailable";
        console.log(err);
    }
}

    /* =========================
       5. HABIT STREAK SYSTEM
    ========================= */

    function updateStreak() {
    const streakEl = document.getElementById("habitStreak");
    if (!streakEl) return;

    const today = new Date().toDateString();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);

    let streak = parseInt(localStorage.getItem("softspace-streak")) || 0;
    let lastDate = localStorage.getItem("softspace-lastDate");

    // FIRST EVER VISIT
    if (!lastDate) {
        streak = 1;
        localStorage.setItem("softspace-streak", streak);
        localStorage.setItem("softspace-lastDate", today);
    }

    // ALREADY VISITED TODAY → DO NOTHING
    else if (lastDate === today) {
        streakEl.textContent = `${streak} Days`;
        return;
    }

    // NEW DAY LOGIC
    else {
        if (lastDate === yesterdayDate.toDateString()) {
            streak += 1; // continues streak
        } else {
            streak = 1; // missed a day → reset
        }

        localStorage.setItem("softspace-streak", streak);
        localStorage.setItem("softspace-lastDate", today);
    }

    streakEl.textContent = `${streak} Days`;
}

    /* =========================
       6. JOURNAL SYSTEM
    ========================= */

    const journalBox = document.getElementById("journalBox");
    const journalDate = document.getElementById("journalDate");

    function getTodayKey() {
        return new Date().toDateString();
    }

    function loadJournal() {
        if (!journalBox) return;

        const key = getTodayKey();

        if (journalDate) {
            journalDate.textContent = `Entry for ${key}`;
        }

        journalBox.value = localStorage.getItem("journal-" + key) || "";
    }

    function setupJournal() {
        if (!journalBox) return;

        const key = getTodayKey();

        journalBox.addEventListener("input", () => {
            localStorage.setItem("journal-" + key, journalBox.value);
        });
    }

    function initJournal() {
        loadJournal();
        setupJournal();
    }

    /* =========================
       7. TODO SYSTEM
    ========================= */

    const taskInput = document.getElementById("taskInput");
    const addTaskBtn = document.getElementById("addTaskBtn");
    const taskList = document.getElementById("taskList");

    let tasks = JSON.parse(localStorage.getItem("softspace-tasks")) || [];

    function saveTasks() {
        localStorage.setItem("softspace-tasks", JSON.stringify(tasks));
    }

    function calculateProgress() {

        const total = tasks.length;
        const done = tasks.filter(t => t.done).length;

        const percent = total === 0 ? 0 : Math.round((done / total) * 100);

        const text = document.getElementById("progressText");
        const bar = document.getElementById("progressBar");

        if (text && bar) {
            text.textContent = `${done}/${total} tasks done • ${percent}% productivity`;
            bar.style.width = percent + "%";
        }
    }

    function renderTasks() {

        if (!taskList) return;

        taskList.innerHTML = "";

        tasks.forEach((task, index) => {

            const li = document.createElement("li");
            li.classList.add("task-item");

            if (task.done) li.classList.add("done");

            li.innerHTML = `
                <input type="checkbox" ${task.done ? "checked" : ""}>
                <span>${task.text}</span>
                <div class="delete">🗑</div>
            `;

            li.querySelector("input").addEventListener("change", (e) => {
                tasks[index].done = e.target.checked;
                saveTasks();
                renderTasks();
                calculateProgress();
            });

            li.querySelector(".delete").addEventListener("click", () => {
                tasks.splice(index, 1);
                saveTasks();
                renderTasks();
                calculateProgress();
            });

            taskList.appendChild(li);
        });
    }

    function addTask() {

        if (!taskInput) return;

        const value = taskInput.value.trim();
        if (!value) return;

        tasks.push({
            text: value,
            done: false
        });

        taskInput.value = "";

        saveTasks();
        renderTasks();
        calculateProgress();
    }

    const plannerInput = document.getElementById("plannerInput");
    const addPlannerBtn = document.getElementById("addPlannerBtn");
    const plannerList = document.getElementById("plannerList");
    const plannerSummaryList = document.getElementById("plannerSummaryList");
    const plannerEmpty = document.querySelector(".planner-empty");

    let plans = JSON.parse(localStorage.getItem("softspace-plans")) || [];

    function savePlans() {
        localStorage.setItem("softspace-plans", JSON.stringify(plans));
    }

    function renderPlannerSummary() {
        if (!plannerSummaryList) return;
        plannerSummaryList.innerHTML = "";

        if (plans.length === 0) {
            if (plannerEmpty) plannerEmpty.style.display = "block";
            return;
        }

        if (plannerEmpty) plannerEmpty.style.display = "none";

        const visiblePlans = plans.slice(0, 4);
        visiblePlans.forEach((plan) => {
            const li = document.createElement("li");
            li.textContent = plan.text;
            plannerSummaryList.appendChild(li);
        });

        if (plans.length > 4) {
            const more = document.createElement("li");
            more.className = "planner-more";
            more.textContent = `${plans.length - 4} more plan${plans.length - 4 === 1 ? "" : "s"}...`;
            plannerSummaryList.appendChild(more);
        }
    }

    function renderPlannerList() {
        if (!plannerList) return;
        plannerList.innerHTML = "";

        plans.forEach((plan, index) => {
            const li = document.createElement("li");
            li.className = "planner-item";
            li.innerHTML = `
                <span>${plan.text}</span>
                <button class="planner-delete" data-index="${index}" aria-label="Delete plan item">🗑</button>
            `;

            plannerList.appendChild(li);
        });

        plannerList.querySelectorAll(".planner-delete").forEach((button) => {
            button.addEventListener("click", () => {
                plans.splice(button.dataset.index, 1);
                savePlans();
                renderPlannerList();
                renderPlannerSummary();
            });
        });
    }

    function addPlanner() {
        if (!plannerInput) return;
        const value = plannerInput.value.trim();
        if (!value) return;

        plans.unshift({ text: value });
        plannerInput.value = "";

        savePlans();
        renderPlannerList();
        renderPlannerSummary();
    }

    function initPlanner() {
        if (addPlannerBtn) {
            addPlannerBtn.addEventListener("click", addPlanner);
        }

        if (plannerInput) {
            plannerInput.addEventListener("keypress", (e) => {
                if (e.key === "Enter") addPlanner();
            });
        }

        renderPlannerList();
        renderPlannerSummary();
    }

    function initTodo() {

        if (addTaskBtn) {
            addTaskBtn.addEventListener("click", addTask);
        }

        if (taskInput) {
            taskInput.addEventListener("keypress", (e) => {
                if (e.key === "Enter") addTask();
            });
        }

        renderTasks();
        calculateProgress();
    }

    /* =========================
       8. INIT APP
    ========================= */

    function init() {
        updateDate();
        updateGreeting();
        loadQuote();
        loadWeather();

        initJournal();
        initTodo();
        initPlanner();
        updateStreak();
    }

    init();

});
document.getElementById("openPlannerBtn")?.addEventListener("click", (e) => {
    e.preventDefault();

    // later we can:
    // 1. open a modal
    // 2. scroll to planner section
    // 3. or just load planner data dynamically
});
let studyTasks = JSON.parse(localStorage.getItem("study-tasks")) || [];

