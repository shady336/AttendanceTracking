// Application State
let people = [];
let attendanceRecords = {};
let currentEditingId = null;
let toastTimeout = null;
let selectedAttendanceDate = null;

// DOM Elements
const navTabs = document.querySelectorAll('.nav-tab');
const views = document.querySelectorAll('.view');
const currentDateEl = document.getElementById('currentDate');
const personModal = document.getElementById('personModal');
const modalOverlay = document.getElementById('modalOverlay');
const personForm = document.getElementById('personForm');
const toast = document.getElementById('toast');

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    loadData();
    updateCurrentDate();
    renderAllViews();
    setupEventListeners();
    
    // Register service worker for offline functionality
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => console.log('SW registered'))
            .catch(error => console.log('SW registration failed'));
    }
});

// Initialize App
function initializeApp() {
    // Set current date
    updateCurrentDate();
    
    // Set history date to today
    const historyDateInput = document.getElementById('historyDate');
    historyDateInput.value = getCurrentDateString();
    
    // Set attendance date to today
    const attendanceDateInput = document.getElementById('attendanceDate');
    attendanceDateInput.value = getCurrentDateString();
    selectedAttendanceDate = getCurrentDateString();
}

// Data Management
function loadData() {
    try {
        const savedPeople = localStorage.getItem('attendancePeople');
        const savedRecords = localStorage.getItem('attendanceRecords');
        
        people = savedPeople ? JSON.parse(savedPeople) : [];
        attendanceRecords = savedRecords ? JSON.parse(savedRecords) : {};
        
        // Ensure today's records exist
        ensureTodayRecords();
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('Error loading data', 'error');
        people = [];
        attendanceRecords = {};
    }
}

function saveData() {
    try {
        localStorage.setItem('attendancePeople', JSON.stringify(people));
        localStorage.setItem('attendanceRecords', JSON.stringify(attendanceRecords));
    } catch (error) {
        console.error('Error saving data:', error);
        showToast('Error saving data', 'error');
    }
}

function ensureTodayRecords() {
    const today = getCurrentDateString();
    ensureDateRecords(today);
}

function ensureDateRecords(date) {
    if (!attendanceRecords[date]) {
        attendanceRecords[date] = {};
        people.forEach(person => {
            attendanceRecords[date][person.id] = 'pending';
        });
    } else {
        // Add any new people to the date's records
        people.forEach(person => {
            if (!(person.id in attendanceRecords[date])) {
                attendanceRecords[date][person.id] = 'pending';
            }
        });
    }
}

// Utility Functions
function getCurrentDateString() {
    return new Date().toISOString().split('T')[0];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
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
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => switchView(tab.dataset.view));
    });
    
    // Add Person Button
    document.getElementById('addPersonBtn').addEventListener('click', openAddPersonModal);
    
    // Mark All Present Button
    document.getElementById('markAllPresent').addEventListener('click', markAllPresent);
    
    // Modal Controls
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);
    
    // Person Form
    personForm.addEventListener('submit', savePerson);
    
    // History Date Controls
    document.getElementById('historyDate').addEventListener('change', renderHistoryView);
    document.getElementById('todayBtn').addEventListener('click', setHistoryToday);
    
    // Attendance Date Controls
    document.getElementById('attendanceDate').addEventListener('change', (e) => {
        selectedAttendanceDate = e.target.value;
        renderAttendanceView();
    });
    document.getElementById('attendanceTodayBtn').addEventListener('click', setAttendanceToday);
    
    // Toast Close
    document.getElementById('toastClose').addEventListener('click', hideToast);
    
    // Prevent form submission on Enter key in inputs (mobile keyboard)
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.type !== 'submit') {
                e.preventDefault();
            }
        });
    });
}

// View Management
function switchView(viewName) {
    // Update nav tabs
    navTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === viewName);
    });
    
    // Update views
    views.forEach(view => {
        view.classList.toggle('active', view.id === `${viewName}-view`);
    });
    
    // Render the active view
    switch (viewName) {
        case 'attendance':
            renderAttendanceView();
            break;
        case 'people':
            renderPeopleView();
            break;
        case 'history':
            renderHistoryView();
            break;
    }
}

// Attendance View
function renderAttendanceView() {
    const attendanceList = document.getElementById('attendanceList');
    const emptyState = document.getElementById('attendanceEmptyState');
    
    if (people.length === 0) {
        attendanceList.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    attendanceList.style.display = 'block';
    emptyState.style.display = 'none';
    
    const selectedDate = selectedAttendanceDate || getCurrentDateString();
    ensureDateRecords(selectedDate);
    
    attendanceList.innerHTML = people.map(person => {
        const status = attendanceRecords[selectedDate][person.id] || 'pending';
        return `
            <div class="attendance-item">
                <div class="attendance-info">
                    <div class="attendance-name">${escapeHtml(person.name)}</div>
                    <div class="attendance-service">${escapeHtml(person.service || 'No service specified')}</div>
                </div>
                <div class="attendance-status">
                    <button class="status-btn status-${status}" onclick="toggleAttendance('${person.id}')">
                        ${getStatusText(status)}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function getStatusText(status) {
    const statusMap = {
        'present': 'Present',
        'absent': 'Absent',
        'pending': 'Pending'
    };
    return statusMap[status] || 'Pending';
}

function toggleAttendance(personId) {
    const selectedDate = selectedAttendanceDate || getCurrentDateString();
    const currentStatus = attendanceRecords[selectedDate][personId];
    
    let newStatus;
    switch (currentStatus) {
        case 'pending':
            newStatus = 'present';
            break;
        case 'present':
            newStatus = 'absent';
            break;
        case 'absent':
            newStatus = 'pending';
            break;
        default:
            newStatus = 'present';
    }
    
    attendanceRecords[selectedDate][personId] = newStatus;
    saveData();
    renderAttendanceView();
    
    const person = people.find(p => p.id === personId);
    const dateText = selectedDate === getCurrentDateString() ? 'today' : formatDate(selectedDate);
    showToast(`${person.name} marked as ${newStatus} for ${dateText}`, 'success');
}

function markAllPresent() {
    const selectedDate = selectedAttendanceDate || getCurrentDateString();
    people.forEach(person => {
        attendanceRecords[selectedDate][person.id] = 'present';
    });
    saveData();
    renderAttendanceView();
    const dateText = selectedDate === getCurrentDateString() ? 'today' : formatDate(selectedDate);
    showToast(`All people marked as present for ${dateText}`, 'success');
}

// People Management View
function renderPeopleView() {
    const peopleList = document.getElementById('peopleList');
    const emptyState = document.getElementById('peopleEmptyState');
    
    if (people.length === 0) {
        peopleList.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    peopleList.style.display = 'block';
    emptyState.style.display = 'none';
    
    peopleList.innerHTML = people.map(person => `
        <div class="person-item">
            <div class="person-info">
                <div class="person-name">${escapeHtml(person.name)}</div>
                <div class="person-details">
                    ${person.phone ? `<div><i class="fas fa-phone"></i> ${escapeHtml(person.phone)}</div>` : ''}
                    ${person.service ? `<div><i class="fas fa-briefcase"></i> ${escapeHtml(person.service)}</div>` : ''}
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
    `).join('');
}

// Person Management
function openAddPersonModal() {
    currentEditingId = null;
    document.getElementById('modalTitle').textContent = 'Add Person';
    document.getElementById('saveBtn').textContent = 'Add Person';
    resetPersonForm();
    showModal();
}

function editPerson(personId) {
    const person = people.find(p => p.id === personId);
    if (!person) return;
    
    currentEditingId = personId;
    document.getElementById('modalTitle').textContent = 'Edit Person';
    document.getElementById('saveBtn').textContent = 'Update Person';
    
    document.getElementById('personName').value = person.name;
    document.getElementById('personPhone').value = person.phone || '';
    document.getElementById('personService').value = person.service || '';
    
    showModal();
}

function deletePerson(personId) {
    const person = people.find(p => p.id === personId);
    if (!person) return;
    
    if (confirm(`Are you sure you want to delete ${person.name}?`)) {
        // Remove from people array
        people = people.filter(p => p.id !== personId);
        
        // Remove from all attendance records
        Object.keys(attendanceRecords).forEach(date => {
            delete attendanceRecords[date][personId];
        });
        
        saveData();
        renderAllViews();
        showToast(`${person.name} deleted successfully`, 'success');
    }
}

function savePerson(e) {
    e.preventDefault();
    
    const name = document.getElementById('personName').value.trim();
    const phone = document.getElementById('personPhone').value.trim();
    const service = document.getElementById('personService').value.trim();
    
    if (!name) {
        showToast('Name is required', 'error');
        return;
    }
    
    if (currentEditingId) {
        // Update existing person
        const person = people.find(p => p.id === currentEditingId);
        if (person) {
            person.name = name;
            person.phone = phone;
            person.service = service;
            showToast('Person updated successfully', 'success');
        }
    } else {
        // Add new person
        const newPerson = {
            id: generateId(),
            name,
            phone,
            service
        };
        people.push(newPerson);
        
        // Add to today's attendance records
        const today = getCurrentDateString();
        if (!attendanceRecords[today]) {
            attendanceRecords[today] = {};
        }
        attendanceRecords[today][newPerson.id] = 'pending';
        
        showToast('Person added successfully', 'success');
    }
    
    saveData();
    closeModal();
    renderAllViews();
}

// History View
function renderHistoryView() {
    const historyList = document.getElementById('historyList');
    const emptyState = document.getElementById('historyEmptyState');
    const selectedDate = document.getElementById('historyDate').value;
    
    const records = attendanceRecords[selectedDate];
    
    if (!records || Object.keys(records).length === 0) {
        historyList.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    historyList.style.display = 'block';
    emptyState.style.display = 'none';
    
    const historyItems = people.map(person => {
        const status = records[person.id] || 'pending';
        return {
            person,
            status
        };
    }).filter(item => item.status !== undefined);
    
    historyList.innerHTML = historyItems.map(item => `
        <div class="attendance-item">
            <div class="attendance-info">
                <div class="attendance-name">${escapeHtml(item.person.name)}</div>
                <div class="attendance-service">${escapeHtml(item.person.service || 'No service specified')}</div>
            </div>
            <div class="attendance-status">
                <span class="status-btn status-${item.status}">
                    ${getStatusText(item.status)}
                </span>
            </div>
        </div>
    `).join('');
}

function setHistoryToday() {
    document.getElementById('historyDate').value = getCurrentDateString();
    renderHistoryView();
}

function setAttendanceToday() {
    const today = getCurrentDateString();
    document.getElementById('attendanceDate').value = today;
    selectedAttendanceDate = today;
    renderAttendanceView();
}

// Modal Management
function showModal() {
    modalOverlay.classList.add('active');
    personModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Focus on the name input
    setTimeout(() => {
        document.getElementById('personName').focus();
    }, 100);
}

function closeModal() {
    modalOverlay.classList.remove('active');
    personModal.classList.remove('active');
    document.body.style.overflow = '';
    resetPersonForm();
    currentEditingId = null;
}

function resetPersonForm() {
    document.getElementById('personName').value = '';
    document.getElementById('personPhone').value = '';
    document.getElementById('personService').value = '';
}

// Toast Notifications
function showToast(message, type = 'success') {
    const toastMessage = document.getElementById('toastMessage');
    toastMessage.textContent = message;
    
    // Clear any existing timeout
    if (toastTimeout) {
        clearTimeout(toastTimeout);
        toastTimeout = null;
    }
    
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
    toastTimeout = setTimeout(() => {
        hideToast();
    }, 3000);
}

function hideToast() {
    toast.classList.remove('show');
    // Clear any existing timeout
    if (toastTimeout) {
        clearTimeout(toastTimeout);
        toastTimeout = null;
    }
}

// Utility Functions
function escapeHtml(text) {
    const div = document.createElement('div');
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

// Prevent zoom on double tap (iOS Safari)
let lastTouchEnd = 0;
document.addEventListener('touchend', function (event) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);

// Handle orientation changes
window.addEventListener('orientationchange', function() {
    setTimeout(() => {
        window.scrollTo(0, 0);
    }, 100);
});
