// Application State
let people = [];
let attendanceRecords = {};
let currentEditingId = null;
let toastTimeout = null;
let selectedAttendanceDate = null;

// DOM Elements
const navTabs = document.querySelectorAll(".nav-tab");
const views = document.querySelectorAll(".view");
const currentDateEl = document.getElementById("currentDate");
const personModal = document.getElementById("personModal");
const modalOverlay = document.getElementById("modalOverlay");
const personForm = document.getElementById("personForm");
const toast = document.getElementById("toast");

// Initialize Application
document.addEventListener("DOMContentLoaded", async function () {
    initializeApp();
    // Load local cache first for instant UI
    loadLocalData();
    updateCurrentDate();
    renderAllViews();
    setupEventListeners();

    // Best-effort sync from SWA Data API (if configured)
    try {
        await syncPeopleFromDb();
        renderAllViews();
    } catch (e) {
        console.warn("Data API sync skipped:", e?.message || e);
    }

    // Register service worker for offline functionality
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker
            .register("service-worker.js")
            .then(() => console.log("SW registered"))
            .catch(() => console.log("SW registration failed"));
    }
});

// Initialize App
function initializeApp() {
    // Set current date
    updateCurrentDate();

    // Set history date to today
    const historyDateInput = document.getElementById("historyDate");
    historyDateInput.value = getCurrentDateString();

    // Set attendance date to today
    const attendanceDateInput = document.getElementById("attendanceDate");
    attendanceDateInput.value = getCurrentDateString();
    selectedAttendanceDate = getCurrentDateString();
}

// Data Management
function loadLocalData() {
    try {
        const savedPeople = localStorage.getItem("attendancePeople");
        const savedRecords = localStorage.getItem("attendanceRecords");

        people = savedPeople ? JSON.parse(savedPeople) : [];
    attendanceRecords = savedRecords ? JSON.parse(savedRecords) : {};

    // Migrate records to new structure with daily flags if needed
    migrateAttendanceRecords();

        // Ensure today's records exist
        ensureTodayRecords();
    } catch (error) {
        console.error("Error loading data:", error);
        showToast("خطأ في تحميل البيانات", "error");
        people = [];
        attendanceRecords = {};
    }
}

// -------- Azure Static Web Apps Data API integration (People) --------
const DATA_API_BASE = "/data-api/rest"; // SWA Data API REST base path
let dataApiAvailable = null; // cache endpoint availability

async function isDataApiAvailable() {
    if (dataApiAvailable !== null) return dataApiAvailable;
    try {
        const res = await fetch(`${DATA_API_BASE}/people`, { method: "GET" });
        // If endpoint exists, we may get 200/401/403 depending on auth; any is fine to mark available
        dataApiAvailable = res.ok || res.status === 401 || res.status === 403;
    } catch {
        dataApiAvailable = false;
    }
    return dataApiAvailable;
}

async function syncPeopleFromDb() {
    const available = await isDataApiAvailable();
    if (!available) return; // skip when Data API not configured
    const res = await fetch(`${DATA_API_BASE}/people`);
    if (!res.ok) throw new Error(`People fetch failed: ${res.status}`);
    const payload = await res.json();
    const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.value)
        ? payload.value
        : Array.isArray(payload?.items)
        ? payload.items
        : [];
    if (!Array.isArray(list)) return;
    people = list.map((p) => ({
        id: p.id ?? p.Id ?? p._id ?? generateId(),
        name: p.name ?? p.Name ?? "",
        phone: p.phone ?? p.Phone ?? "",
        service: p.service ?? p.Service ?? "",
        confessionDate: p.confessionDate ?? p.ConfessionDate ?? "",
    }));
    localStorage.setItem("attendancePeople", JSON.stringify(people));
    ensureTodayRecords();
}

async function createPersonInDb(person) {
    if (!(await isDataApiAvailable())) return false;
    const res = await fetch(`${DATA_API_BASE}/people`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            id: person.id,
            name: person.name,
            phone: person.phone,
            service: person.service,
            confessionDate: person.confessionDate,
        }),
    });
    return res.ok;
}

async function updatePersonInDb(person) {
    if (!(await isDataApiAvailable())) return false;
    const id = encodeURIComponent(person.id);
    const res = await fetch(`${DATA_API_BASE}/people/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            id: person.id,
            name: person.name,
            phone: person.phone,
            service: person.service,
            confessionDate: person.confessionDate,
        }),
    });
    return res.ok;
}

async function deletePersonInDb(personId) {
    if (!(await isDataApiAvailable())) return false;
    const id = encodeURIComponent(personId);
    const res = await fetch(`${DATA_API_BASE}/people/${id}`, { method: "DELETE" });
    return res.ok || res.status === 204;
}

function saveData() {
    try {
        localStorage.setItem("attendancePeople", JSON.stringify(people));
        localStorage.setItem(
            "attendanceRecords",
            JSON.stringify(attendanceRecords),
        );
    } catch (error) {
        console.error("Error saving data:", error);
        showToast("خطأ في حفظ البيانات", "error");
    }
}

function ensureTodayRecords() {
    const today = getCurrentDateString();
    ensureDateRecords(today);
}

function ensureDateRecords(date) {
    if (!attendanceRecords[date]) {
        attendanceRecords[date] = {};
    }
    // Ensure each person has an entry object for the date
    people.forEach((person) => {
        const rec = attendanceRecords[date][person.id];
        if (!rec || typeof rec === "string") {
            attendanceRecords[date][person.id] =
                typeof rec === "string"
                    ? {
                          status: rec,
                          liturgy: false,
                          bible: false,
                          serviceMeeting: false,
                      }
                    : {
                          status: "pending",
                          liturgy: false,
                          bible: false,
                          serviceMeeting: false,
                      };
        } else {
            // Fill missing fields if any
            rec.status = rec.status || "pending";
            rec.liturgy = !!rec.liturgy;
            rec.bible = !!rec.bible;
            rec.serviceMeeting = !!rec.serviceMeeting;
        }
    });
}

// Utility Functions
function getCurrentDateString() {
    return new Date().toISOString().split("T")[0];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const options = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    };
    return date.toLocaleDateString("ar-eg", options);
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function updateCurrentDate() {
    currentDateEl.textContent = formatDate(getCurrentDateString());
}

// Event Listeners
function setupEventListeners() {
    // Navigation
    navTabs.forEach((tab) => {
        tab.addEventListener("click", () => switchView(tab.dataset.view));
    });

    // Add Person Button
    document
        .getElementById("addPersonBtn")
        .addEventListener("click", openAddPersonModal);

    // Mark All Present Button
    document
        .getElementById("markAllPresent")
        .addEventListener("click", markAllPresent);

    // Modal Controls
    document.getElementById("closeModal").addEventListener("click", closeModal);
    document.getElementById("cancelBtn").addEventListener("click", closeModal);
    modalOverlay.addEventListener("click", closeModal);

    // Person Form
    personForm.addEventListener("submit", savePerson);

    // History Date Controls
    document
        .getElementById("historyDate")
        .addEventListener("change", renderHistoryView);
    document
        .getElementById("todayBtn")
        .addEventListener("click", setHistoryToday);

    // Attendance Date Controls
    document
        .getElementById("attendanceDate")
        .addEventListener("change", (e) => {
            selectedAttendanceDate = e.target.value;
            renderAttendanceView();
        });
    document
        .getElementById("attendanceTodayBtn")
        .addEventListener("click", setAttendanceToday);

    // Toast Close
    document.getElementById("toastClose").addEventListener("click", hideToast);

    // Prevent form submission on Enter key in inputs (mobile keyboard)
    document.querySelectorAll("input").forEach((input) => {
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && e.target.type !== "submit") {
                e.preventDefault();
            }
        });
    });
}

// View Management
function switchView(viewName) {
    // Update nav tabs
    navTabs.forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.view === viewName);
    });

    // Update views
    views.forEach((view) => {
        view.classList.toggle("active", view.id === `${viewName}-view`);
    });

    // Render the active view
    switch (viewName) {
        case "attendance":
            renderAttendanceView();
            break;
        case "people":
            renderPeopleView();
            break;
        case "history":
            renderHistoryView();
            break;
    }
}

// Attendance View
function renderAttendanceView() {
    const attendanceList = document.getElementById("attendanceList");
    const emptyState = document.getElementById("attendanceEmptyState");

    if (people.length === 0) {
        attendanceList.style.display = "none";
        emptyState.style.display = "block";
        return;
    }

    attendanceList.style.display = "block";
    emptyState.style.display = "none";

    const selectedDate = selectedAttendanceDate || getCurrentDateString();
    ensureDateRecords(selectedDate);

    attendanceList.innerHTML = people
        .map((person) => {
            const rec = attendanceRecords[selectedDate][person.id] || {
                status: "pending",
                liturgy: false,
                bible: false,
                serviceMeeting: false,
            };
            return `
            <div class="attendance-item">
                <div class="attendance-info">
                    <div class="attendance-name">${escapeHtml(person.name)}</div>
                    <div class="attendance-service">${escapeHtml(person.service || "لم يتم تحديد خدمة")}</div>
                    <div class="daily-flags" style="margin-top: 0.4rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <label class="checkbox-label" style="padding-right: 1.6rem;">
                            <input type="checkbox" ${rec.liturgy ? "checked" : ""} onchange="setDailyFlag('${person.id}','liturgy', this.checked)" />
                            <span class="checkmark"></span>
                            حضور القداس
                        </label>
                        <label class="checkbox-label" style="padding-right: 1.6rem;">
                            <input type="checkbox" ${rec.bible ? "checked" : ""} onchange="setDailyFlag('${person.id}','bible', this.checked)" />
                            <span class="checkmark"></span>
                            إحضار الكتاب المقدس
                        </label>
                        <label class="checkbox-label" style="padding-right: 1.6rem;">
                            <input type="checkbox" ${rec.serviceMeeting ? "checked" : ""} onchange="setDailyFlag('${person.id}','serviceMeeting', this.checked)" />
                            <span class="checkmark"></span>
                            حضور اجتماع الخدمة
                        </label>
                    </div>
                </div>
                <div class="attendance-status">
                    <button class="status-btn status-${rec.status}" onclick="toggleAttendance('${person.id}')">
                        ${getStatusText(rec.status)}
                    </button>
                </div>
            </div>
        `;
        })
        .join("");
}

function getStatusText(status) {
    const statusMap = {
        present: "حاضر",
        absent: "غائب",
        pending: "معلق",
    };
    return statusMap[status] || "معلق";
}

function toggleAttendance(personId) {
    const selectedDate = selectedAttendanceDate || getCurrentDateString();
    ensureDateRecords(selectedDate);
    const rec = attendanceRecords[selectedDate][personId];
    const currentStatus = rec && typeof rec === "object" ? rec.status : rec;

    let newStatus;
    switch (currentStatus) {
        case "pending":
            newStatus = "present";
            break;
        case "present":
            newStatus = "absent";
            break;
        case "absent":
            newStatus = "pending";
            break;
        default:
            newStatus = "present";
    }

    if (!attendanceRecords[selectedDate][personId] || typeof attendanceRecords[selectedDate][personId] === "string") {
        attendanceRecords[selectedDate][personId] = {
            status: newStatus,
            liturgy: false,
            bible: false,
            serviceMeeting: false,
        };
    } else {
        attendanceRecords[selectedDate][personId].status = newStatus;
    }
    saveData();
    renderAttendanceView();

    const person = people.find((p) => p.id === personId);
    const dateText = formatDate(selectedDate);
    const statusText = getStatusText(newStatus);
    showToast(
        `تم تسجيل ${person.name} ك${statusText} ليوم ${dateText}`,
        "success",
    );
}

function markAllPresent() {
    const selectedDate = selectedAttendanceDate || getCurrentDateString();
    ensureDateRecords(selectedDate);
    people.forEach((person) => {
        const rec = attendanceRecords[selectedDate][person.id];
        if (!rec || typeof rec === "string") {
            attendanceRecords[selectedDate][person.id] = {
                status: "present",
                liturgy: false,
                bible: false,
                serviceMeeting: false,
            };
        } else {
            rec.status = "present";
        }
    });
    saveData();
    renderAttendanceView();
    const dateText = formatDate(selectedDate);
    showToast(`تم تسجيل جميع الأشخاص كحاضرين ليوم ${dateText}`, "success");
}

// People Management View
function renderPeopleView() {
    const peopleList = document.getElementById("peopleList");
    const emptyState = document.getElementById("peopleEmptyState");

    if (people.length === 0) {
        peopleList.style.display = "none";
        emptyState.style.display = "block";
        return;
    }

    peopleList.style.display = "block";
    emptyState.style.display = "none";

    peopleList.innerHTML = people
        .map(
            (person) => `
        <div class="person-item">
            <div class="person-info">
                <div class="person-name">${escapeHtml(person.name)}</div>
                <div class="person-details">
                    ${person.phone ? `<div><i class="fas fa-phone"></i> ${escapeHtml(person.phone)}</div>` : ""}
                    ${person.service ? `<div><i class="fas fa-briefcase"></i> ${escapeHtml(person.service)}</div>` : ""}
                    ${
                        person.confessionDate
                            ? `<div><i class="fas fa-calendar"></i> آخر اعتراف: ${formatDate(person.confessionDate)}</div>`
                            : `<div><i class="fas fa-calendar-times"></i> لم يتم تحديد تاريخ الاعتراف</div>`
                    }
                </div>
            </div>
            <div class="person-actions">
                <button class="action-btn edit-btn" onclick="editPerson('${person.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete-btn" onclick="deletePerson('${person.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `,
        )
        .join("");
}

// Person Management
function openAddPersonModal() {
    currentEditingId = null;
    document.getElementById("modalTitle").textContent = "إضافة شخص";
    document.getElementById("saveBtn").textContent = "إضافة شخص";
    resetPersonForm();
    showModal();
}

function editPerson(personId) {
    const person = people.find((p) => p.id === personId);
    if (!person) return;

    currentEditingId = personId;
    document.getElementById("modalTitle").textContent = "تعديل شخص";
    document.getElementById("saveBtn").textContent = "تحديث شخص";

    document.getElementById("personName").value = person.name;
    document.getElementById("personPhone").value = person.phone || "";
    document.getElementById("personService").value = person.service || "";
    document.getElementById("confessionDate").value =
        person.confessionDate || "";

    showModal();
}

function deletePerson(personId) {
    const person = people.find((p) => p.id === personId);
    if (!person) return;

    if (confirm(`هل أنت متأكد من حذف ${person.name}؟`)) {
        // Remove from people array
        people = people.filter((p) => p.id !== personId);

        // Remove from all attendance records
        Object.keys(attendanceRecords).forEach((date) => {
            delete attendanceRecords[date][personId];
        });

        // Best-effort delete from DB
        deletePersonInDb(personId).then((ok) => {
            if (!ok) console.warn("Delete person not synced to DB (offline/not configured)");
        });

        saveData();
        renderAllViews();
        showToast(`تم حذف ${person.name} بنجاح`, "success");
    }
}

function savePerson(e) {
    e.preventDefault();

    const name = document.getElementById("personName").value.trim();
    const phone = document.getElementById("personPhone").value.trim();
    const service = document.getElementById("personService").value.trim();
    const confessionDate = document.getElementById("confessionDate").value;

    if (!name) {
        showToast("الاسم مطلوب", "error");
        return;
    }

    if (currentEditingId) {
        // Update existing person
        const person = people.find((p) => p.id === currentEditingId);
        if (person) {
            person.name = name;
            person.phone = phone;
            person.service = service;
            person.confessionDate = confessionDate;
            showToast("تم تحديث الشخص بنجاح", "success");
            // Best-effort sync with DB
            updatePersonInDb(person).then((ok) => {
                if (!ok) console.warn("Update person not synced to DB (offline/not configured)");
                saveData();
            });
        }
    } else {
        // Add new person
        const newPerson = {
            id: generateId(),
            name,
            phone,
            service,
            confessionDate,
        };
        people.push(newPerson);

        // Add to today's attendance records
        const today = getCurrentDateString();
        if (!attendanceRecords[today]) {
            attendanceRecords[today] = {};
        }
        attendanceRecords[today][newPerson.id] = {
            status: "pending",
            liturgy: false,
            bible: false,
            serviceMeeting: false,
        };

        showToast("تم إضافة الشخص بنجاح", "success");
        // Best-effort persist to DB
        createPersonInDb(newPerson).then((ok) => {
            if (!ok) console.warn("Create person not synced to DB (offline/not configured)");
            saveData();
        });
    }

    saveData();
    closeModal();
    renderAllViews();
}

// History View
function renderHistoryView() {
    const historyList = document.getElementById("historyList");
    const emptyState = document.getElementById("historyEmptyState");
    const selectedDate = document.getElementById("historyDate").value;

    const records = attendanceRecords[selectedDate];

    if (!records || Object.keys(records).length === 0) {
        historyList.style.display = "none";
        emptyState.style.display = "block";
        return;
    }

    historyList.style.display = "block";
    emptyState.style.display = "none";

    const historyItems = people
        .map((person) => {
            const rec = records[person.id];
            if (rec === undefined) return undefined;
            if (typeof rec === "string") {
                return { person, status: rec, liturgy: false, bible: false, serviceMeeting: false };
            }
            return {
                person,
                status: rec.status || "pending",
                liturgy: !!rec.liturgy,
                bible: !!rec.bible,
                serviceMeeting: !!rec.serviceMeeting,
            };
        })
        .filter((item) => item !== undefined);

    historyList.innerHTML = historyItems
        .map(
            (item) => `
        <div class="attendance-item">
            <div class="attendance-info">
                <div class="attendance-name">${escapeHtml(item.person.name)}</div>
                <div class="attendance-service">${escapeHtml(item.person.service || "لم يتم تحديد خدمة")}</div>
                <div class="attendance-quick-status" style="margin-top: 0.25rem;">
                    <span class="quick-status ${item.liturgy ? "status-yes" : "status-no"}">
                        <i class="fas ${item.liturgy ? "fa-check" : "fa-times"}"></i>
                        القداس
                    </span>
                    <span class="quick-status ${item.bible ? "status-yes" : "status-no"}">
                        <i class="fas ${item.bible ? "fa-check" : "fa-times"}"></i>
                        الكتاب المقدس
                    </span>
                    <span class="quick-status ${item.serviceMeeting ? "status-yes" : "status-no"}">
                        <i class="fas ${item.serviceMeeting ? "fa-check" : "fa-times"}"></i>
                        اجتماع الخدمة
                    </span>
                    <span class="quick-status">
                        <i class="fas fa-calendar"></i>
                        ${item.person.confessionDate ? `آخر اعتراف: ${formatDate(item.person.confessionDate)}` : "لم يتم تحديد تاريخ الاعتراف"}
                    </span>
                </div>
            </div>
            <div class="attendance-status">
                <span class="status-btn status-${item.status}">
                    ${getStatusText(item.status)}
                </span>
            </div>
        </div>
    `,
        )
        .join("");
}

function setHistoryToday() {
    document.getElementById("historyDate").value = getCurrentDateString();
    renderHistoryView();
}

function setAttendanceToday() {
    const today = getCurrentDateString();
    document.getElementById("attendanceDate").value = today;
    selectedAttendanceDate = today;
    renderAttendanceView();
}

// Modal Management
function showModal() {
    modalOverlay.classList.add("active");
    personModal.classList.add("active");
    document.body.style.overflow = "hidden";

    // Focus on the name input
    setTimeout(() => {
        document.getElementById("personName").focus();
    }, 100);
}

function closeModal() {
    modalOverlay.classList.remove("active");
    personModal.classList.remove("active");
    document.body.style.overflow = "";
    resetPersonForm();
    currentEditingId = null;
}

function resetPersonForm() {
    document.getElementById("personName").value = "";
    document.getElementById("personPhone").value = "";
    document.getElementById("personService").value = "";
    document.getElementById("confessionDate").value = "";
}

// Toast Notifications
function showToast(message, type = "success") {
    const toastMessage = document.getElementById("toastMessage");
    toastMessage.textContent = message;

    // Clear any existing timeout
    if (toastTimeout) {
        clearTimeout(toastTimeout);
        toastTimeout = null;
    }

    toast.className = `toast ${type}`;
    toast.classList.add("show");

    toastTimeout = setTimeout(() => {
        hideToast();
    }, 3000);
}

function hideToast() {
    toast.classList.remove("show");
    // Clear any existing timeout
    if (toastTimeout) {
        clearTimeout(toastTimeout);
        toastTimeout = null;
    }
}

// Utility Functions
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function renderAllViews() {
    renderAttendanceView();
    renderPeopleView();
    renderHistoryView();
}

// Make functions globally available for onclick handlers
window.toggleAttendance = toggleAttendance;
window.editPerson = editPerson;
window.deletePerson = deletePerson;

// Set a daily flag value for the selected date
function setDailyFlag(personId, key, value) {
    const selectedDate = selectedAttendanceDate || getCurrentDateString();
    ensureDateRecords(selectedDate);
    const rec = attendanceRecords[selectedDate][personId];
    if (!rec || typeof rec === "string") {
        attendanceRecords[selectedDate][personId] = {
            status: typeof rec === "string" ? rec : "pending",
            liturgy: false,
            bible: false,
            serviceMeeting: false,
        };
    }
    attendanceRecords[selectedDate][personId][key] = !!value;
    saveData();
    renderAttendanceView();
}
window.setDailyFlag = setDailyFlag;

// Migration: convert old string records to object with flags; seed today's flags from person properties if present
function migrateAttendanceRecords() {
    if (!attendanceRecords || typeof attendanceRecords !== "object") return;
    const today = getCurrentDateString();
    Object.keys(attendanceRecords).forEach((date) => {
        const day = attendanceRecords[date];
        if (!day || typeof day !== "object") return;
        Object.keys(day).forEach((pid) => {
            const val = day[pid];
            if (typeof val === "string") {
                day[pid] = {
                    status: val,
                    liturgy: false,
                    bible: false,
                    serviceMeeting: false,
                };
                // If migrating today's records, optionally seed from person static fields
                if (date === today) {
                    const person = people.find((p) => p.id === pid);
                    if (person) {
                        day[pid].liturgy = !!person.liturgyAttendance;
                        day[pid].bible = !!person.holyBible;
                        day[pid].serviceMeeting = !!person.serviceMeeting;
                    }
                }
            } else if (typeof val === "object") {
                val.status = val.status || "pending";
                val.liturgy = !!val.liturgy;
                val.bible = !!val.bible;
                val.serviceMeeting = !!val.serviceMeeting;
            }
        });
    });
}

// Prevent zoom on double tap (iOS Safari)
let lastTouchEnd = 0;
document.addEventListener(
    "touchend",
    function (event) {
        const now = new Date().getTime();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    },
    false,
);

// Handle orientation changes
window.addEventListener("orientationchange", function () {
    setTimeout(() => {
        window.scrollTo(0, 0);
    }, 100);
});
