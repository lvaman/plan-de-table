// Get Firebase services
const {
    db, doc, setDoc, onSnapshot, updateDoc
} = window.firebaseServices;

// --- DOM Elements ---
const groomListContainer = document.getElementById('groom-guests').querySelector('.guest-container');
const brideListContainer = document.getElementById('bride-guests').querySelector('.guest-container');
const tablesContainer = document.getElementById('tables-container');
const masterCounterEl = document.getElementById('master-counter');

// --- Global State ---
let allGuestsData = { groom: [], bride: [] };
let currentSeatingConfig = {};
let dataLoaded = { groom: false, bride: false, seating: false };

// --- Guest Management ---
document.getElementById('add-groom-guest-button').addEventListener('click', () => addGuest('groom'));
document.getElementById('add-bride-guest-button').addEventListener('click', () => addGuest('bride'));
document.getElementById('groom-guest-input').addEventListener('keyup', (e) => e.key === 'Enter' && addGuest('groom'));
document.getElementById('bride-guest-input').addEventListener('keyup', (e) => e.key === 'Enter' && addGuest('bride'));

async function addGuest(type) {
    const inputEl = document.getElementById(`${type}-guest-input`);
    const guestName = inputEl.value.trim();
    if (guestName) {
        const guestRef = doc(db, 'seatingPlans', `${type}-guests`);
        const namesArray = [...(allGuestsData[type] || []), guestName];
        await setDoc(guestRef, { names: namesArray });
        inputEl.value = '';
    }
}

async function deleteGuest(type, guestName) {
    if (!confirm(`Voulez-vous supprimer ${guestName} ?`)) return;

    // Remove from the guest list document
    const guestRef = doc(db, 'seatingPlans', `${type}-guests`);
    const namesArray = (allGuestsData[type] || []).filter(name => name !== guestName);
    await setDoc(guestRef, { names: namesArray });

    // Remove from the main seating configuration
    const updatedConfig = { ...currentSeatingConfig };
    Object.keys(updatedConfig).forEach(zoneId => {
        if (Array.isArray(updatedConfig[zoneId])) {
            updatedConfig[zoneId] = updatedConfig[zoneId].filter(name => name !== guestName);
        }
    });
    await saveSeatingConfig(updatedConfig);
}

// --- Main Application ---
function initializeBoard() {
    tablesContainer.innerHTML = '';
    const tableConfigs = [{ id: 'head', name: "d'honneur", capacity: 2 }, ...Array.from({ length: 19 }, (_, i) => ({ id: i + 1, name: i + 1, capacity: 10 }))];
    tableConfigs.forEach(config => {
        const tableDiv = document.createElement('div');
        tableDiv.className = 'table-drop-zone drop-zone';
        tableDiv.id = `table-${config.id}`;
        tableDiv.dataset.capacity = config.capacity;
        tableDiv.innerHTML = `<h3>Table ${config.name}</h3><span class="table-counter">0 / ${config.capacity}</span><div class="table-guests-container"></div>`;
        tablesContainer.appendChild(tableDiv);
    });
    initializeDragAndDrop();
}

function renderAllGuestsAndSeating() {
    document.querySelectorAll('.guest').forEach(guestElement => guestElement.remove());

    const allGuestsMap = new Map();
    (allGuestsData.groom || []).forEach(name => allGuestsMap.set(name, createGuestElement('groom', name)));
    (allGuestsData.bride || []).forEach(name => allGuestsMap.set(name, createGuestElement('bride', name)));

    const placedGuests = new Set();
    // Place seated guests first
    Object.keys(currentSeatingConfig).forEach(zoneId => {
        const zoneElement = document.getElementById(zoneId);
        if (zoneElement && currentSeatingConfig[zoneId]) {
            const container = zoneElement.querySelector('.table-guests-container');
            if (container) {
                currentSeatingConfig[zoneId].forEach(guestName => {
                    const guestElement = allGuestsMap.get(guestName);
                    if (guestElement) {
                        addReturnButton(guestElement);
                        container.appendChild(guestElement);
                        placedGuests.add(guestName);
                    }
                });
            }
        }
    });

    // Place unseated guests in their sidebars
    allGuestsMap.forEach((guestElement, guestName) => {
        if (!placedGuests.has(guestName)) {
            const guestType = guestElement.classList.contains('groom') ? 'groom' : 'bride';
            const targetContainer = guestType === 'groom' ? groomListContainer : brideListContainer;
            addDeleteButton(guestElement);
            targetContainer.appendChild(guestElement);
        }
    });

    sortGuestsInContainer(groomListContainer);
    sortGuestsInContainer(brideListContainer);
    updateAllCounters();
}

function customGuestSort(a, b) {
    const isVipA = a === 'Long Vân' || a === 'Manal';
    const isVipB = b === 'Long Vân' || b === 'Manal';
    if (isVipA && !isVipB) return -1;
    if (!isVipA && isVipB) return 1;
    return a.localeCompare(b);
}

function createGuestElement(type, name) {
    const guestDiv = document.createElement('div');
    guestDiv.className = `guest ${type}`;
    guestDiv.dataset.name = name;
    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;
    guestDiv.appendChild(nameSpan);

    if (name === 'Long Vân' || name === 'Manal') {
        guestDiv.classList.add('vip-guest');
    }
    return guestDiv;
}

function addDeleteButton(guestElement) {
    const guestName = guestElement.dataset.name;
    const guestType = guestElement.classList.contains('groom') ? 'groom' : 'bride';
    if (guestName === 'Long Vân' || guestName === 'Manal') return;

    guestElement.querySelector('.return-guest-button')?.remove();
    if (guestElement.querySelector('.delete-guest-button')) return;

    const deleteBtn = document.createElement('span');
    deleteBtn.className = 'delete-guest-button';
    deleteBtn.textContent = '−';
    deleteBtn.onclick = () => deleteGuest(guestType, guestName);
    guestElement.appendChild(deleteBtn);
}

function addReturnButton(guestElement) {
    guestElement.querySelector('.delete-guest-button')?.remove();
    if (guestElement.querySelector('.return-guest-button')) return;

    const returnBtn = document.createElement('span');
    returnBtn.className = 'return-guest-button';
    returnBtn.textContent = '×';
    returnBtn.onclick = () => returnGuestToList(guestElement);
    guestElement.appendChild(returnBtn);
}

async function returnGuestToList(guestElement) {
    const guestName = guestElement.dataset.name;
    const updatedConfig = { ...currentSeatingConfig };

    for (const zoneId in updatedConfig) {
        if (Array.isArray(updatedConfig[zoneId])) {
            updatedConfig[zoneId] = updatedConfig[zoneId].filter(name => name !== guestName);
        }
    }
    await saveSeatingConfig(updatedConfig);
}

function initializeDragAndDrop() {
    const allDropZones = document.querySelectorAll('.guest-container, .table-guests-container');
    allDropZones.forEach(zone => {
        new Sortable(zone, {
            group: 'shared',
            animation: 150,
            forceFallback: true,
            delay: 150,
            delayOnTouchOnly: true,
            touchStartThreshold: 5,
            scroll: true,
            scrollSensitivity: 100,
            scrollSpeed: 20,
            onEnd: async function () {
                const newSeatingConfig = buildSeagittingConfigFromDOM();
                await saveSeatingConfig(newSeatingConfig);
            },
            onMove: function (evt) {
                const dragged = evt.dragged;
                const targetZone = evt.to.closest('.drop-zone');
                if (!targetZone) return false;
                const isGroomGuest = dragged.classList.contains('groom');
                const isBrideGuest = dragged.classList.contains('bride');
                if ((targetZone.id === 'groom-guests' && isBrideGuest) || (targetZone.id === 'bride-guests' && isGroomGuest)) {
                    return false;
                }
                if (targetZone.classList.contains('table-drop-zone')) {
                    if (evt.from !== evt.to) {
                        const capacity = parseInt(targetZone.dataset.capacity, 10);
                        const currentGuests = targetZone.querySelectorAll('.guest').length;
                        if (currentGuests >= capacity) {
                            return false;
                        }
                    }
                }
                return true;
            }
        });
    });
}

function buildSeatingConfigFromDOM() {
    const seating = {};
    document.querySelectorAll('.table-drop-zone').forEach(zone => {
        const guestNames = [...zone.querySelectorAll('.guest')].map(g => g.dataset.name);
        if (guestNames.length > 0) {
            seating[zone.id] = guestNames;
        }
    });
    return seating;
}

async function saveSeatingConfig(seatingConfig) {
    await setDoc(doc(db, "seatingPlans", "currentPlan"), seatingConfig);
}

function sortGuestsInContainer(container) {
    const guests = Array.from(container.querySelectorAll('.guest'));
    guests.sort((a, b) => customGuestSort(a.dataset.name, b.dataset.name));
    guests.forEach(guest => container.appendChild(guest));
}

function updateAllCounters() {
    let placedGuestsCount = 0;
    document.querySelectorAll('.table-drop-zone').forEach(table => {
        const guestsInTable = table.querySelector('.table-guests-container').children.length;
        placedGuestsCount += guestsInTable;
        table.querySelector('.table-counter').textContent = `${guestsInTable} / ${table.dataset.capacity}`;
    });
    const totalGuests = (allGuestsData.groom.length || 0) + (allGuestsData.bride.length || 0);
    masterCounterEl.textContent = `${placedGuestsCount} / ${totalGuests}`;
    document.getElementById('groom-list-counter').textContent = `(${groomListContainer.children.length} / ${allGuestsData.groom.length})`;
    document.getElementById('bride-list-counter').textContent = `(${brideListContainer.children.length} / ${allGuestsData.bride.length})`;
}

function checkAndRender() {
    if (dataLoaded.groom && dataLoaded.bride && dataLoaded.seating) {
        renderAllGuestsAndSeating();
    }
}

// --- App Initialization ---
initializeBoard();

onSnapshot(doc(db, "seatingPlans", "currentPlan"), (docSnap) => {
    currentSeatingConfig = docSnap.exists() ? docSnap.data() : {};
    dataLoaded.seating = true;
    checkAndRender();
});

onSnapshot(doc(db, "seatingPlans", "groom-guests"), (docSnap) => {
    allGuestsData.groom = docSnap.exists() ? docSnap.data().names : [];
    dataLoaded.groom = true;
    checkAndRender();
});

onSnapshot(doc(db, "seatingPlans", "bride-guests"), (docSnap) => {
    allGuestsData.bride = docSnap.exists() ? docSnap.data().names : [];
    dataLoaded.bride = true;
    checkAndRender();
});
