// ===== APPLICATION LOGIC =====

// ===== PAGE NAVIGATION =====

function goToDashboard() {
    showPage('dashboardPage');
    renderDashboard();
}

function goToCreateProperty() {
    showPage('createPropertyPage');
    clearCreatePropertyForm();
}

function goToRooms(propertyId = null) {
    if (propertyId) {
        currentPropertyId = propertyId;
    }
    if (!currentPropertyId) {
        alert('No property selected');
        return;
    }
    showPage('roomsPage');
    renderRoomsPage();
}

function goToInvoice() {
    if (!currentPropertyId) {
        alert('No property selected');
        return;
    }
    showPage('invoicePage');
    renderInvoicePage();
}

function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    window.scrollTo(0, 0);
}

// ===== DASHBOARD PAGE =====

function renderDashboard() {
    const propertiesList = document.getElementById('propertiesList');
    propertiesList.innerHTML = '';

    propertiesDatabase.forEach(property => {
        const totalCost = calculatePropertyTotal(property);
        const card = document.createElement('div');
        card.className = 'property-card';

     
        card.innerHTML = `
            
            <div class="property-card-info-section" onclick="goToRooms('${property.firebaseId}')">
                <div class="property-card-header">
                    <div class="property-card-title">${property.clientName}</div>
                    <div class="property-card-type">${property.propertyType.charAt(0).toUpperCase() + property.propertyType.slice(1)}</div>
                </div>
                <div class="property-card-info">📍 ${property.location}</div>
                <div class="property-card-info">📐 ${property.totalArea} m²</div>
                ${property.clientPhone ? `<div class="property-card-phone">📞 ${property.clientPhone}</div>` : ''}
                <div class="property-card-cost">Total: ${totalCost.toLocaleString()} EGP</div>
            </div>
            <div class="property-card-actions">
                <button class="btn btn-edit btn-small" onclick="event.stopPropagation(); openEditPropertyModal('${property.firebaseId}')">Edit</button>
                <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteProperty('${property.firebaseId}')">Delete</button>
            </div>
        `;
        propertiesList.appendChild(card);
    });
}

function clearCreatePropertyForm() {
    document.getElementById('clientName').value = '';
    document.getElementById('clientPhone').value = '';
    document.getElementById('propertyType').value = '';
    document.getElementById('propertyLocation').value = '';
    document.getElementById('propertyArea').value = '';
}

function saveProperty() {
    const clientName = document.getElementById('clientName').value.trim();
    const clientPhone = document.getElementById('clientPhone').value.trim();
    const propertyType = document.getElementById('propertyType').value;
    const location = document.getElementById('propertyLocation').value.trim();
    const totalArea = parseFloat(document.getElementById('propertyArea').value) || 0;

    if (!clientName || !propertyType) {
        alert('Please fill in all required fields (Client Name and Property Type)');
        return;
    }


        createNewProperty(clientName, clientPhone, propertyType, location, totalArea);
    
}

async function createNewProperty(clientName, clientPhone, propertyType, location, totalArea) {
    const { collection, addDoc } = window.fbMethods;
    
    const newProperty = {
        clientName: clientName,
        clientPhone: clientPhone,
        propertyType: propertyType,
        location: location,
        totalArea: totalArea,
        taxPercentage: DEFAULT_PROPERTY_TAX_PERCENTAGE,
        rooms: [],
        createdAt: new Date()
    };

    const roomTypes = ROOM_TYPES[propertyType] || [];
    roomTypes.forEach((roomType, index) => {
        newProperty.rooms.push({
            id: index + 1, 
            name: roomType,
            floor: 'Ground',
            type: roomType,
            devices: []
        });
    });

    try {
        const docRef = await addDoc(collection(window.db, "properties"), newProperty);
        currentPropertyId = docRef.id;
        goToRooms();
    } catch (e) {
        alert("Error saving to cloud: " + e.message);
    }
}

// ===== EDIT PROPERTY FUNCTIONALITY =====

let editingPropertyId = null;

function openEditPropertyModal(propertyId) {
    const property = getPropertyById(propertyId);
    if (!property) return;

    editingPropertyId = propertyId;
    document.getElementById('editPropertyClientName').value = property.clientName;
    document.getElementById('editPropertyClientPhone').value = property.clientPhone;
    document.getElementById('editPropertyType').value = property.propertyType;
    document.getElementById('editPropertyLocation').value = property.location;
    document.getElementById('editPropertyArea').value = property.totalArea;

    document.getElementById('editPropertyModal').classList.add('active');
}

function closeEditPropertyModal() {
    document.getElementById('editPropertyModal').classList.remove('active');
    editingPropertyId = null;
}

async function saveEditedProperty() {
    if (!editingPropertyId) return;
    const { doc, updateDoc } = window.fbMethods;

    const clientName = document.getElementById('editPropertyClientName').value.trim();
    const propertyType = document.getElementById('editPropertyType').value;
    const location = document.getElementById('editPropertyLocation').value.trim();
    const totalArea = parseFloat(document.getElementById('editPropertyArea').value) || 0;

    if (!clientName || !propertyType) {
        alert('Please fill in all required fields');
        return;
    }

    try {
        const propertyRef = doc(window.db, "properties", editingPropertyId);
        await updateDoc(propertyRef, {
            clientName,
            propertyType,
            location,
            totalArea,
            clientPhone: document.getElementById('editPropertyClientPhone').value.trim()
        });
        
        closeEditPropertyModal();
        alert('Property updated in Cloud!');
    } catch (e) {
        console.error("Error updating property:", e);
        alert("Failed to sync edit to cloud.");
    }
}

async function deleteProperty(propertyId) {
    if (confirm('Are you sure you want to delete this property and all its data?')) {
        const { doc, deleteDoc } = window.fbMethods;
        try {
            const propertyRef = doc(window.db, "properties", propertyId);
            await deleteDoc(propertyRef);
            // Dashboard will auto-update because of onSnapshot in data.js
            alert('Property deleted successfully!');
        } catch (e) {
            console.error("Delete failed:", e);
            alert("Failed to delete from Cloud.");
        }
    }
}

// ===== ROOMS PAGE =====

function renderRoomsPage() {
    const property = getPropertyById(currentPropertyId);
    if (!property) {
        alert('Property not found');
        goToDashboard();
        return;
    }

    // Set current room to first room if not set
    if (!currentRoomId && property.rooms.length > 0) {
        currentRoomId = property.rooms[0].id;
    }

    // Render room tabs
    renderRoomTabs(property);

    // Render current room details
    renderCurrentRoom(property);

    // Render device categories
    renderDeviceCategories(property);

    // Update property total cost
    const totalCost = calculatePropertyTotal(property);
    document.getElementById('propertyTotalCost').textContent = totalCost.toLocaleString() + ' EGP';

    const taxInput = document.getElementById('propertyTaxPercentage');
    if (taxInput) {
        const storedTaxPercentage = Number(property.taxPercentage);
        taxInput.value = Number.isFinite(storedTaxPercentage) ? storedTaxPercentage : DEFAULT_PROPERTY_TAX_PERCENTAGE;
    }
}

async function updatePropertyTaxPercentage(newPercentage) {
    const percentage = parseFloat(newPercentage);
    if (!Number.isFinite(percentage) || percentage < 0) {
        alert('Please enter a valid percentage (0 or greater).');
        renderRoomsPage();
        return;
    }

    const property = getPropertyById(currentPropertyId);
    if (!property) return;


    const { doc, updateDoc } = window.fbMethods;
    try {
        await updateDoc(doc(window.db, "properties", currentPropertyId), { taxPercentage: percentage });
        property.taxPercentage = percentage;
    } catch (error) {
        console.error('Error updating property tax percentage:', error);
        alert('Could not update the percentage in the cloud database.');
        renderRoomsPage();
    }
}

function renderRoomTabs(property) {
    const roomTabs = document.getElementById('roomTabs');
    roomTabs.innerHTML = '';

    property.rooms.forEach(room => {
        const tab = document.createElement('div');
        tab.className = 'room-tab' + (room.id === currentRoomId ? ' active' : '');
        tab.textContent = room.name;
        tab.onclick = () => switchRoom(tab, room.id);
        roomTabs.appendChild(tab);
    });
}

function switchRoom(element, roomId) {
    document.querySelectorAll('.room-tab').forEach(tab => tab.classList.remove('active'));
    element.classList.add('active');
    currentRoomId = roomId;
    renderRoomsPage();
}

function renderCurrentRoom(property) {
    const room = property.rooms.find(r => r.id === currentRoomId);
    if (!room) return;

    // Update room header
    document.getElementById('currentRoomTitle').textContent = room.name;
    document.getElementById('currentRoomInfo').textContent = `📍 ${room.floor} Floor - ${room.type}`;

    const roomTotal = calculateRoomTotal(room);
    document.getElementById('roomTotalCost').textContent = `Room Total: ${roomTotal.toLocaleString()} EGP`;
    
    // Update property total cost
    const totalCost = calculatePropertyTotal(property);
    document.getElementById('propertyTotalCost').textContent = totalCost.toLocaleString() + ' EGP';
}

function renderDeviceCategories(property) {
    const room = property.rooms.find(r => r.id === currentRoomId);
    if (!room) return;

    const container = document.getElementById('deviceCategoriesContainer');
    container.innerHTML = '';

    Object.keys(DEVICE_CATEGORIES).forEach(categoryKey => {
        const categoryInfo = DEVICE_CATEGORIES[categoryKey];
        const categoryDevices = devicesDatabase.filter(d => {
            const isActive = d.status === 'Active' || (d.status === undefined && d.active !== false);
            return d.category === categoryKey && isActive;
        });

        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'device-category';

        let categoryHtml = `
            <div class="device-category-title">
                <div class="device-category-icon">${categoryInfo.icon}</div>
                ${categoryInfo.name}
            </div>
        `;

        // Display existing devices in this room for this category
        room.devices.forEach(roomDevice => {
            const device = getDeviceById(roomDevice.deviceId);
            if (device && device.category === categoryKey) {
                const total = device.price * roomDevice.quantity;
                categoryHtml += `
                    <div class="device-item">
                        <div class="device-item-header">
                            <div class="device-item-name">${device.name}</div>
                            <div class="device-item-price">${device.price.toLocaleString()} EGP</div>
                        </div>
                        <div class="device-item-details">Brand: ${device.brand} | Protocol: ${device.protocol}</div>
                        <div class="device-item-quantity">
                            <label>Qty:</label>
                            <input type="number" value="${roomDevice.quantity}" min="1" 
                                onchange="updateDeviceQuantity(${currentRoomId}, ${roomDevice.deviceId}, this.value)">
                            <span class="device-item-total">Total: ${total.toLocaleString()} EGP</span>
                            <button class="btn btn-danger btn-small" onclick="removeDeviceFromRoom(${currentRoomId}, '${roomDevice.deviceId}')" style="margin-left: 0.5rem;">Remove</button>                        </div>
                    </div>
                `;
            }
        });

        // Add device form
        categoryHtml += `
            <div class="device-add-form">
                <div class="device-add-form-row full">
                    <select class="form-select" id="select-${categoryKey}" onchange="updateAddDeviceQuantity('${categoryKey}')">
                        <option value="">Select a ${categoryInfo.name.toLowerCase()} device...</option>
        `;

        categoryDevices.forEach(device => {
            categoryHtml += `<option value="${device.firebaseId}">${device.name} (${device.price.toLocaleString()} EGP)</option>`;   });

        categoryHtml += `
                    </select>
                </div>
                <div class="device-add-form-row">
                    <input type="number" id="qty-${categoryKey}" placeholder="Quantity" min="1" value="1">
                    <button class="btn btn-primary" style="margin-top: 0;" onclick="addDeviceToRoom('${categoryKey}')">Add Device</button>
                </div>
            </div>
        `;

        categoryDiv.innerHTML = categoryHtml;
        container.appendChild(categoryDiv);
    });
}

async function addDeviceToRoom(categoryKey) {
    const { doc, updateDoc } = window.fbMethods;
    const selectElement = document.getElementById(`select-${categoryKey}`);
    const qtyElement = document.getElementById(`qty-${categoryKey}`);
    
    const deviceId = selectElement.value;
    const quantity = parseInt(qtyElement.value) || 1;

    if (!deviceId) {
        alert('Please select a device');
        return;
    }

    const property = getPropertyById(currentPropertyId);
    if (!property) return; 

    const room = property.rooms.find(r => r.id == currentRoomId);
    if (!room) return; 

    const existingDevice = room.devices.find(d => d.deviceId == deviceId);
    
    if (existingDevice) {
        existingDevice.quantity += quantity;
    } else {
        room.devices.push({ deviceId: deviceId, quantity: quantity });
    }

    try {
        const propertyRef = doc(window.db, "properties", currentPropertyId);
        await updateDoc(propertyRef, {
            rooms: property.rooms
        });
        
        renderDeviceCategories(property);
        renderCurrentRoom(property);
    } catch (error) {
        console.error("Error updating room:", error);
        alert("Could not save to cloud.");
    }
}

function toggleRoomInput() {
    const container = document.getElementById('newRoomInputContainer');
    const input = document.getElementById('newRoomNameInput');
    
    if (container.style.display === 'none') {
        container.style.display = 'block';
        input.focus();
    } else {
        container.style.display = 'none';
        input.value = '';
    }
}

async function addNewRoomToProperty() {
    const { doc, updateDoc } = window.fbMethods;
    const roomNameInput = document.getElementById('newRoomNameInput');
    const roomName = roomNameInput.value.trim();

    if (!roomName) {
        alert("Please enter a room name");
        return;
    }

    const property = getPropertyById(currentPropertyId);
    if (!property) return;

    const newRoom = {
        id: Date.now(),
        name: roomName,
        floor: 'Ground',
        type: 'Custom',
        devices: [] 
    };

    property.rooms.push(newRoom);

    try {
        const propertyRef = doc(window.db, "properties", currentPropertyId);
        await updateDoc(propertyRef, {
            rooms: property.rooms
        });

        roomNameInput.value = '';
        toggleRoomInput();
        currentRoomId = newRoom.id;
        renderRoomsPage();
    } catch (error) {
        console.error("Error adding room:", error);
        alert("Failed to save room to Cloud.");
    }
}
async function updateDeviceQuantity(roomId, deviceId, newQuantity) {
    const { doc, updateDoc } = window.fbMethods;
    const property = getPropertyById(currentPropertyId);
    const room = property.rooms.find(r => r.id === roomId);
    const roomDevice = room.devices.find(d => d.deviceId === deviceId);

    if (roomDevice) {
        const qty = parseInt(newQuantity) || 1;
        if (qty <= 0) {
            room.devices = room.devices.filter(d => d.deviceId !== deviceId);
        } else {
            roomDevice.quantity = qty;
        }

        try {
            const propertyRef = doc(window.db, "properties", currentPropertyId);
            await updateDoc(propertyRef, {
                rooms: property.rooms
            });

            renderDeviceCategories(property);
            renderCurrentRoom(property);
            
            // Update property total
            const totalCost = calculatePropertyTotal(property);
            document.getElementById('propertyTotalCost').textContent = totalCost.toLocaleString() + ' EGP';
        } catch (e) {
            console.error("Update quantity failed:", e);
        }
    }
}
async function removeDeviceFromRoom(roomId, deviceId) {
    const { doc, updateDoc } = window.fbMethods;
    const property = getPropertyById(currentPropertyId);
    
    if (!property) return;

    const room = property.rooms.find(r => r.id === roomId);
    
    if (room) {
        // 1. Remove the device from the local array
        room.devices = room.devices.filter(d => d.deviceId !== deviceId);
        
        try {
            // 2. Sync the updated rooms array to Firebase
            const propertyRef = doc(window.db, "properties", currentPropertyId);
            await updateDoc(propertyRef, {
                rooms: property.rooms
            });
            
            // 3. Update the UI after successful cloud sync
            renderDeviceCategories(property);
            renderCurrentRoom(property);
            
            // 4. Update the total cost display
            const totalCost = calculatePropertyTotal(property);
            document.getElementById('propertyTotalCost').textContent = totalCost.toLocaleString() + ' EGP';
            
            console.log("Device removed and synced to cloud.");
        } catch (error) {
            console.error("Error removing device from cloud:", error);
            alert("Could not sync removal to the cloud database.");
        }
    }
}
function updateAddDeviceQuantity(categoryKey) {
    const selectElement = document.getElementById(`select-${categoryKey}`);
    const device = getDeviceById(parseInt(selectElement.value));
    if (device) {
        const qtyElement = document.getElementById(`qty-${categoryKey}`);
    }
}

// ===== INVOICE PAGE =====

function renderInvoicePage() {
    const property = getPropertyById(currentPropertyId);
    if (!property) {
        alert('Property not found');
        goToDashboard();
        return;
    }
    
    const invoiceSummary = document.getElementById('invoiceSummary');
    invoiceSummary.innerHTML = '';
    let totalAmount = 0;
    
    property.rooms.forEach(room => {
        const roomTotal = calculateRoomTotal(room);
        totalAmount += roomTotal;
        
        const roomDiv = document.createElement('div');
        roomDiv.className = 'invoice-room';
        
        let roomHtml = `<div class="invoice-room-title">${room.name}</div>`;
        
        room.devices.forEach(roomDevice => {
            const device = getDeviceById(roomDevice.deviceId);
            if (device) {
                const lineTotal = device.price * roomDevice.quantity;
                roomHtml += `
                    <div class="invoice-device-line">
                        <span>${device.name} (Qty: ${roomDevice.quantity})</span>
                        <span class="invoice-device-line-total">${lineTotal.toLocaleString()} EGP</span>
                        <button class="btn btn-danger btn-small" onclick="removeDeviceFromInvoice(${room.id}, '${roomDevice.deviceId}')" style="margin-left: 0.5rem;">Remove</button>                    </div>
                `;
            }
        });
        
        roomHtml += `
            <div class="invoice-device-line" style="font-weight: bold; border-top: 1px solid rgba(0, 212, 255, 0.2); padding-top: 0.5rem; margin-top: 0.5rem;">
                <span>Room Total:</span>
                <span>${roomTotal.toLocaleString()} EGP</span>
            </div>
        `;

        roomDiv.innerHTML = roomHtml;
        invoiceSummary.appendChild(roomDiv);
    });
    
    document.getElementById('invoiceTotalAmount').textContent = totalAmount.toLocaleString() + ' EGP';
}

async function removeDeviceFromInvoice(roomId, deviceId) {
    const { doc, updateDoc } = window.fbMethods;
    const property = getPropertyById(currentPropertyId);
    
    // Find the specific room
    const room = property.rooms.find(r => r.id === roomId);
    
    if (room) {
        // Filter out the device locally
        room.devices = room.devices.filter(d => d.deviceId !== deviceId);
        
        try {
            // Sync the change to the Cloud
            const propertyRef = doc(window.db, "properties", currentPropertyId);
            await updateDoc(propertyRef, {
                rooms: property.rooms
            });
            
            renderInvoicePage();
        } catch (error) {
            console.error("Error removing device from invoice:", error);
            alert("Could not update cloud database.");
        }
    }
}
function buildQuotationHierarchy(property) {
    const hierarchy = {};
    const configuredOtherParent = deviceParentGroupsDatabase.find(parentGroup =>
        String(parentGroup.name || '').trim().toLowerCase() === 'other'
    );

    (property.rooms || []).forEach(room => {
        (room.devices || []).forEach(roomDevice => {
            const device = getDeviceById(roomDevice.deviceId);
            if (!device) return;

            const subgroup = getDeviceSubgroupById(device.subgroupId);
            const categoryKey = String(device.category || '').trim();
            const categoryInfo = categoryKey ? DEVICE_CATEGORIES[categoryKey] : null;
            const fallbackCategoryName = categoryKey ? (categoryInfo?.name || categoryKey) : '';
            const quantity = Number(roomDevice.quantity) || 0;
            const weight = Number.isFinite(Number(device.weight)) ? Number(device.weight) : DEFAULT_DEVICE_WEIGHT;

            let parentKey;
            let parentName;
            let subgroupKey;
            let subgroupName;
            let measuringUnit;
            let isOther = false;

            if (subgroup) {
                const parentGroup = getDeviceParentGroupById(subgroup.parentGroupId) || configuredOtherParent || null;
                parentKey = parentGroup ? `parent-${parentGroup.firebaseId}` : '__other__';
                parentName = parentGroup?.name || 'Other';
                subgroupKey = `subgroup-${subgroup.firebaseId}`;
                subgroupName = subgroup.name || fallbackCategoryName || 'Other';
                measuringUnit = subgroup.measuringUnit || subgroupName;
                isOther = !parentGroup || String(parentName).trim().toLowerCase() === 'other';
            } else if (fallbackCategoryName) {
                // Preserve the previous fallback: an unassigned device uses its legacy category
                // as both the grouping label and measuring unit.
                const matchingParent = deviceParentGroupsDatabase.find(parentGroup =>
                    String(parentGroup.name || '').trim().toLowerCase() === fallbackCategoryName.toLowerCase()
                );
                parentKey = matchingParent ? `parent-${matchingParent.firebaseId}` : `legacy-${categoryKey}`;
                parentName = fallbackCategoryName;
                subgroupKey = `legacy-${categoryKey}`;
                subgroupName = fallbackCategoryName;
                measuringUnit = fallbackCategoryName;
            } else {
                parentKey = configuredOtherParent ? `parent-${configuredOtherParent.firebaseId}` : '__other__';
                parentName = configuredOtherParent?.name || 'Other';
                subgroupKey = '__other__';
                subgroupName = 'Other';
                measuringUnit = 'Other';
                isOther = true;
            }

            if (!hierarchy[parentKey]) {
                hierarchy[parentKey] = {
                    key: parentKey,
                    name: parentName,
                    isOther,
                    subgroups: {}
                };
            }

            if (!hierarchy[parentKey].subgroups[subgroupKey]) {
                hierarchy[parentKey].subgroups[subgroupKey] = {
                    key: subgroupKey,
                    name: subgroupName,
                    measuringUnit,
                    weightedCount: 0,
                    isOther: subgroupKey === '__other__'
                };
            }

            hierarchy[parentKey].subgroups[subgroupKey].weightedCount += quantity * weight;
        });
    });

    return Object.values(hierarchy)
        .map(parentGroup => ({
            ...parentGroup,
            subgroups: Object.values(parentGroup.subgroups).sort((a, b) => {
                if (a.isOther !== b.isOther) return Number(a.isOther) - Number(b.isOther);
                return String(a.name || '').localeCompare(String(b.name || ''));
            })
        }))
        .sort((a, b) => {
            if (a.isOther !== b.isOther) return Number(a.isOther) - Number(b.isOther);
            return String(a.name || '').localeCompare(String(b.name || ''));
        });
}

function paginateQuotationHierarchy(parentGroups, maxRowsPerPage = 5) {
    if (!parentGroups.length) return [[]];

    const pages = [];
    let currentPage = [];
    let usedRows = 0;

    const pushPage = () => {
        if (currentPage.length) pages.push(currentPage);
        currentPage = [];
        usedRows = 0;
    };

    parentGroups.forEach(parentGroup => {
        const subgroups = parentGroup.subgroups.length ? parentGroup.subgroups : [{
            name: 'No items', measuringUnit: '—', weightedCount: 0
        }];
        let index = 0;

        while (index < subgroups.length) {
            if (usedRows >= maxRowsPerPage) pushPage();

            const availableRows = Math.max(1, maxRowsPerPage - usedRows);
            const slice = subgroups.slice(index, index + availableRows);

            currentPage.push({
                ...parentGroup,
                continuation: index > 0,
                subgroups: slice
            });
            usedRows += slice.length;
            index += slice.length;

            if (index < subgroups.length) pushPage();
        }
    });

    pushPage();
    return pages.length ? pages : [[]];
}

function formatWeightedQuantity(value) {
    const numericValue = Number(value) || 0;
    return Number.isInteger(numericValue)
        ? numericValue.toLocaleString()
        : numericValue.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const PDF_LOGO_SRC = (window.HAUSBOT_EMBEDDED_ASSETS && window.HAUSBOT_EMBEDDED_ASSETS.logo) || 'logo.png';
const PDF_SUMMARY_BACKGROUND_SRC = (window.HAUSBOT_EMBEDDED_ASSETS && window.HAUSBOT_EMBEDDED_ASSETS.quotationSummaryBackground) || 'quotation_summary_background.jpg';

async function generatePDF(groupByCategory = false) {
    if (typeof html2pdf === 'undefined') {
        alert("The PDF library is being blocked by your browser settings.");
        return;
    }
    const property = getPropertyById(currentPropertyId);
    if (!property) return;

    if (groupByCategory) {
        await new Promise(resolve => {
            const background = new Image();
            let settled = false;
            const finish = () => {
                if (!settled) {
                    settled = true;
                    resolve();
                }
            };
            background.onload = finish;
            background.onerror = finish;
            background.src = PDF_SUMMARY_BACKGROUND_SRC;
            if (background.complete) finish();
            setTimeout(finish, 2000);
        });
    }

    // --- FINANCIAL CALCULATIONS ---
    const hardwareSubtotal = calculatePropertyTotal(property);
    const storedTaxPercentage = Number(property.taxPercentage);
    const taxPercentage = Number.isFinite(storedTaxPercentage) ? storedTaxPercentage : DEFAULT_PROPERTY_TAX_PERCENTAGE;
    const serviceFees = hardwareSubtotal * (taxPercentage / 100);
    const fees = serviceFees < 3000 ? 3000 : serviceFees;
    const taxAmount = hardwareSubtotal * 0.0;
    const finalProjectTotal = hardwareSubtotal + fees + taxAmount;

    const element = document.createElement('div');
    element.style.cssText = `background: #0a0e14; width: 297mm; margin: 0; padding: 0;`;

    const generationDate = new Date().toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    const pageStyle = `
        height: 209mm; 
        width: 297mm; 
        box-sizing: border-box; 
        padding: 40px; 
        position: relative; 
        display: flex;
        flex-direction: column;
        background: #0a0e14;
        color: white;
        font-family: 'Segoe UI', sans-serif;
    `;

    const cardStyle = `
        background: rgba(255, 255, 255, 0.05);
        color: white;
        border: 1px solid rgba(0, 212, 255, 0.2);
        border-radius: 12px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        height: 100%;
    `;
       
    // --- PAGE 1: COVER ---https://github.com/Hausbot-eg/Survey/blob/main/logo.png
    let html = `
        <div style="${pageStyle} justify-content: center; align-items: center;">
            <div style="width: 85%; border: 1.5px solid #00d4ff; border-radius: 20px; padding: 40px; position: relative; background: radial-gradient(circle at center, #111827 0%, #0a0e14 100%);">
            <div style="text-align: center; margin-bottom: 20px;">
<div style="text-align: center; margin-bottom: 20px;">
    <div style="display: inline-block; padding: 10px; border-radius: 8px;">
            <img src="${PDF_LOGO_SRC}" style="max-width: 150px; margin-top: 60px; opacity: 0.5;">
            
    </div>
</div>
</div>
                <h1 style="color: #00d4ff; font-size: 3.2rem; text-align: center; text-transform: uppercase; letter-spacing: 12px; margin: 0; font-weight: 700;">SMART HOME SURVEY</h1>
                <p style="text-align: center; font-size: 1.1rem; opacity: 0.6; margin-bottom: 40px; letter-spacing: 2px;">Generated on ${generationDate}</p>
                <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(0,212,255,0.5), transparent); margin-bottom: 30px;"></div>
                <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 0 20px;">
                    <div style="text-align: left;">
                        <h3 style="color: #00d4ff; font-size: 1.2rem; margin-bottom: 10px; text-transform: uppercase;">Client Information</h3>
                        <p style="font-size: 1.1rem; margin: 4px 0;"><strong>Name:</strong> ${property.clientName}</p>
                        <p style="font-size: 1.1rem; margin: 4px 0;"><strong>Location:</strong> ${property.location || 'N/A'}</p>
                        <p style="font-size: 1.1rem; margin: 4px 0;"><strong>Unit:</strong> ${property.propertyType || 'N/A'}</p>
                    </div>
                    <div style="text-align: right;">
                        <h3 style="color: #00d4ff; font-size: 1.2rem; margin-bottom: 5px; text-transform: uppercase;">Investment Estimate</h3>
                        <h2 style="color: #00d4ff; font-size: 2.8rem; margin: 0; font-weight: 600;">${finalProjectTotal.toLocaleString()} EGP</h2>
                    </div>
                </div>
            </div>
        </div>
        <div class="html2pdf__page-break"></div>

        <div style="${pageStyle}">
            <h2 style="color: #00d4ff; border-bottom: 1px solid #00d4ff; padding-bottom: 10px; margin-bottom: 25px; font-size: 1.8rem;">About HAUSBOT</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
                <div style="${cardStyle} border-left: 4px solid #00d4ff;">
                    <h3 style="color: #00d4ff; margin-top: 0; font-size: 1.2rem;">Who We Are</h3>
                    <p style="line-height: 1.5; font-size: 0.95rem; opacity: 0.9; margin: 0;">HAUSBOT is a premier provider of cutting-edge smart home solutions. We specialize in transforming living spaces into intelligent environments.</p>
                </div>
                <div style="${cardStyle} border-left: 4px solid #00d4ff;">
                    <h3 style="color: #00d4ff; margin-top: 0; font-size: 1.2rem;">Our Mission</h3>
                    <p style="line-height: 1.5; font-size: 0.95rem; opacity: 0.9; margin: 0;">To achieve your dreams and provide the better life you deserve through seamless technology integration.</p>
                </div>
            </div>
            <h2 style="color: #00d4ff; font-size: 1.5rem; margin-bottom: 15px; margin-top: 30px">Our Core Services</h2>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                <div style="${cardStyle} flex-direction: row; align-items: center; gap: 15px; padding: 15px;">
                    <div style="font-size: 1.8rem;color: #00d4ff;">•</div>
                    <div><strong style="color: #00d4ff; display: block;">Integration</strong><span style="font-size: 0.85rem; opacity: 0.8;">Custom integration and smart device management.</span></div>
                </div>
                <div style="${cardStyle} flex-direction: row; align-items: center; gap: 15px; padding: 15px;">
                    <div style="font-size: 1.8rem;color: #00d4ff;">•</div>
                    <div><strong style="color: #00d4ff; display: block;">Automation</strong><span style="font-size: 0.85rem; opacity: 0.8;">Full home automation and lighting control.</span></div>
                </div>
                <div style="${cardStyle} flex-direction: row; align-items: center; gap: 15px; padding: 15px;">
                    <div style="font-size: 1.8rem;color: #00d4ff;">•</div>
                    <div><strong style="color: #00d4ff; display: block;">Security</strong><span style="font-size: 0.85rem; opacity: 0.8;">Advanced intrusion alarms and security systems.</span></div>
                </div>
                <div style="${cardStyle} flex-direction: row; align-items: center; gap: 15px; padding: 15px;">
                    <div style="font-size: 1.8rem;color: #00d4ff;">•</div>
                    <div><strong style="color: #00d4ff; display: block;">Audio & Video</strong><span style="font-size: 0.85rem; opacity: 0.8;">High-quality sound and home theater setups.</span></div>
                </div>
            </div>
        </div>
        <div class="html2pdf__page-break"></div>
    `;

    // --- ROOM-BY-ROOM BREAKDOWN ---
    // property.rooms.forEach(room => {
    //     if (room.devices && room.devices.length > 0) {
    //         let roomRows = '';
    //         let roomTotal = 0;
    //         room.devices.forEach(roomDevice => {
    //             const device = getDeviceById(roomDevice.deviceId);
    //             if (device) {
    //                 const subtotal = device.price * roomDevice.quantity;
    //                 roomTotal += subtotal;
    //                 roomRows += `
    //                     <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
    //                         <td style="padding: 15px 10px; font-weight: 600;">${device.name}</td>
    //                         <td style="padding: 15px 10px; text-align: center;">${roomDevice.quantity}</td>
    //                         <td style="padding: 15px 10px; text-align: center;">${device.price.toLocaleString()}</td>
    //                         <td style="padding: 15px 10px; text-align: right; font-weight: bold; color: #00d4ff;">${subtotal.toLocaleString()} EGP</td>
    //                     </tr>
    //                 `;
    //             }
    //         });

    //         html += `
    //             <div style="${pageStyle}">
    //                 <div style="background: rgba(0, 212, 255, 0.1); border-left: 5px solid #00d4ff; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
    //                     <h2 style="color: #00d4ff; font-size: 2.2rem; margin: 0; text-transform: capitalize;">${room.name}</h2>
    //                     <p style="margin: 5px 0 0 0; opacity: 0.7; font-size: 1.1rem;">Floor: ${room.floor || 'N/A'}</p>
    //                 </div>
    //                 <table style="width: 100%; border-collapse: collapse;">
    //                     <thead>
    //                         <tr style="border-bottom: 2px solid #00d4ff; text-transform: uppercase; font-size: 0.9rem; color: #00d4ff;">
    //                             <th style="text-align: left; padding: 10px;">Device Description</th>
    //                             <th style="text-align: center; padding: 10px;">Qty</th>
    //                             <th style="text-align: center; padding: 10px;">Unit Price</th>
    //                             <th style="text-align: right; padding: 10px;">Subtotal</th>
    //                         </tr>
    //                     </thead>
    //                     <tbody>${roomRows}</tbody>
    //                 </table>
    //                 <div style=" text-align: right; padding-top: 20px;margin-top:auto;">
    //                     <span style="font-size: 1.2rem; margin-right: 20px; opacity: 0.8;">Room Total:</span>
    //                     <span style="font-size: 1.8rem; color: #00d4ff; font-weight: bold;">${roomTotal.toLocaleString()} EGP</span>
    //                 </div>
    //             </div>
    //             <div class="html2pdf__page-break"></div>
    //         `;
    //     }
    // });
if (!groupByCategory) {
const maxRowsPerroomPage = 10; // Adjust based on styling

property.rooms.forEach(room => {
    if (room.devices && room.devices.length > 0) {
        let roomTotal = 0;
        let roomRowCount = 0;

        // Start the first page for this room
        html += `
            <div style="${pageStyle}">
                <div style="background: rgba(0, 212, 255, 0.1); border-left: 5px solid #00d4ff; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                    <h2 style="color: #00d4ff; font-size: 2.2rem; margin: 0; text-transform: capitalize;">${room.name}</h2>
                    <p style="margin: 5px 0 0 0; opacity: 0.7; font-size: 1.1rem;">Floor: ${room.floor || 'N/A'}</p>
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 2px solid #00d4ff; text-transform: uppercase; font-size: 0.9rem; color: #00d4ff;">
                            <th style="text-align: left; padding: 10px;">Device Description</th>
                            <th style="text-align: center; padding: 10px;">Qty</th>
                            <th style="text-align: center; padding: 10px;">Unit Price</th>
                            <th style="text-align: right; padding: 10px;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Filter valid devices to correctly track indices
        const validDevices = room.devices.filter(d => getDeviceById(d.deviceId));

        validDevices.forEach((roomDevice, index) => {
            const device = getDeviceById(roomDevice.deviceId);
            const subtotal = device.price * roomDevice.quantity;
            roomTotal += subtotal;

            // Check if we need to split onto a new page before rendering this row
            if (roomRowCount > 0 && roomRowCount % maxRowsPerroomPage === 0) {
                html += `
                        </tbody>
                    </table>
                </div>
                <div class="html2pdf__page-break"></div>
                <div style="${pageStyle}">
                    <div style="background: rgba(0, 212, 255, 0.05); border-left: 5px solid rgba(0, 212, 255, 0.5); border-radius: 8px; padding: 15px; margin-bottom: 30px;">
                        <h2 style="color: #00d4ff; font-size: 1.8rem; margin: 0; opacity: 0.7; text-transform: capitalize;">${room.name} (Cont.)</h2>
                    </div>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid #00d4ff; text-transform: uppercase; font-size: 0.9rem; color: #00d4ff;">
                                <th style="text-align: left; padding: 10px;">Device Description</th>
                                <th style="text-align: center; padding: 10px;">Qty</th>
                                <th style="text-align: center; padding: 10px;">Unit Price</th>
                                <th style="text-align: right; padding: 10px;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
            }

            // Append the row HTML
            html += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <td style="padding: 15px 10px; font-weight: 600;">${device.name}</td>
                    <td style="padding: 15px 10px; text-align: center;">${roomDevice.quantity}</td>
                    <td style="padding: 15px 10px; text-align: center;">${device.price.toLocaleString()}</td>
                    <td style="padding: 15px 10px; text-align: right; font-weight: bold; color: #00d4ff;">${subtotal.toLocaleString()} EGP</td>
                </tr>
            `;

            roomRowCount++;
        });

        // Close out the final page container for the room and attach the Room Total block
        html += `
                    </tbody>
                </table>
                <div style="text-align: right; padding-top: 20px; margin-top: auto;">
                    <span style="font-size: 1.2rem; margin-right: 20px; opacity: 0.8;">Room Total:</span>
                    <span style="font-size: 1.8rem; color: #00d4ff; font-weight: bold;">${roomTotal.toLocaleString()} EGP</span>
                </div>
            </div>
            <div class="html2pdf__page-break"></div>
        `;
    }
});
}

 // Configuration
const maxRowsPerPage = 15; // Adjust this number based on your styling
let rowCount = 0;

// --- HARDWARE QUOTATION (TOTAL TABLE) ---
if (groupByCategory) {
    const parentGroups = buildQuotationHierarchy(property);
    const hierarchyPages = paginateQuotationHierarchy(parentGroups, 6);
    const parentOrder = new Map(parentGroups.map((parentGroup, index) => [parentGroup.key, index + 1]));

    hierarchyPages.forEach((pageGroups, pageIndex) => {
        const isLastHierarchyPage = pageIndex === hierarchyPages.length - 1;
        const parentCards = pageGroups.length ? pageGroups.map((parentGroup, parentIndex) => {
            const rows = parentGroup.subgroups.map(subgroup => `
                <div style="display:grid; grid-template-columns:minmax(0,1fr) 58px 88px; align-items:center; min-height:30px; padding:7px 12px; border-top:1px solid rgba(255,255,255,0.075); gap:8px;">
                    <div style="font-size:0.78rem; font-weight:600; color:#f4f8fb; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeAdminHtml(subgroup.name)}</div>
                    <div style="text-align:center; font-size:0.82rem; font-weight:800; color:#ffffff;">${formatWeightedQuantity(subgroup.weightedCount)}</div>
                    <div style="text-align:right; font-size:0.71rem; color:#a8c7d5; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeAdminHtml(subgroup.measuringUnit || 'Unit')}</div>
                </div>
            `).join('');

            return `
                <div style="margin-bottom:9px; border:1px solid rgba(0,212,255,0.20); border-radius:14px; overflow:hidden; background:rgba(3,13,25,0.76); box-shadow:0 12px 30px rgba(0,0,0,0.18);">
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:linear-gradient(90deg, rgba(0,212,255,0.13), rgba(0,212,255,0.025)); gap:10px;">
                        <div style="display:flex; align-items:center; min-width:0;">
                            <span style="width:4px; height:22px; border-radius:6px; background:#00d4ff; display:inline-block; margin-right:10px;"></span>
                            <div style="font-size:0.84rem; font-weight:800; letter-spacing:0.55px; color:#ffffff; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeAdminHtml(parentGroup.name)}${parentGroup.continuation ? ' · CONT.' : ''}</div>
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:minmax(0,1fr) 58px 88px; padding:5px 12px 4px; gap:8px; font-size:0.53rem; letter-spacing:1.05px; color:#6392a5; text-transform:uppercase; font-weight:800;">
                       
                    </div>
                    ${rows}
                </div>
            `;
        }).join('') : `
            <div style="padding:24px; border:1px solid rgba(0,212,255,0.18); border-radius:14px; background:rgba(3,13,25,0.72); color:#b9cad3; font-size:0.9rem;">
                No grouped devices have been added to this property yet.
            </div>
        `;

        html += `
            <div style="${pageStyle} padding:0; overflow:hidden; background-image:linear-gradient(90deg, rgba(3,10,21,0.985) 0%, rgba(3,11,23,0.95) 32%, rgba(3,11,23,0.72) 42%, rgba(3,11,23,0.28) 49%, rgba(3,11,23,0.07) 57%, rgba(3,11,23,0.00) 64%), url('${PDF_SUMMARY_BACKGROUND_SRC}'); background-size:cover; background-position:center;">
                <div style="position:absolute; inset:0; border:1px solid rgba(0,212,255,0.12); box-sizing:border-box; pointer-events:none;"></div>
                <div style="position:relative; z-index:2; width:48%; height:100%; padding:26px 18px 22px 38px; display:flex; flex-direction:column;">
                    <div style="margin-bottom:12px;">
                        <h2 style="color:#00d4ff; border-bottom:1px solid #00d4ff; padding-bottom:10px; margin:0 0 8px 0; font-size:1.8rem; font-weight:700;">System Quotation</h2>
                    </div>

                    <div style="min-height:0;">
                        ${parentCards}
                    </div>

               ${isLastHierarchyPage ? `
    <div style="display:flex; justify-content:center; margin-top:14px;">
        <div style="
            text-align:center;
            padding:10px 18px;
            border-radius:10px;
            background:rgba(0,212,255,0.09);
            border:1px solid rgba(0,212,255,0.18);
            min-width:210px;
        ">
            <div style="
                font-size:0.8rem;
                letter-spacing:1.05px;
                color:#00d4ff;
                text-transform:uppercase;
                font-weight:700;
            ">
                Hardware Subtotal
            </div>

            <div style="
                font-size:1.15rem;
                font-weight:800;
                color:#ffffff;
                margin-top:4px;
            ">
                ${hardwareSubtotal.toLocaleString()}
                <span style="font-size:0.68rem; color:#00d4ff;">EGP</span>
            </div>
        </div>
    </div>
` : ''}
                </div>
            </div>
            <div class="html2pdf__page-break"></div>
        `;
    });
} else {
    // Existing device-by-device hardware quotation remains unchanged.
    html += `
        <div style="${pageStyle}">
            <h2 style="color: #00d4ff; padding-bottom: 10px; font-size: 1.8rem;">Full Hardware Quotation</h2>
            <table style="width: 100%; margin-top: 20px; border-collapse: collapse;">
                <thead>
                    <tr style="text-align: left;">
                        <th style="padding: 12px; border-bottom: 1px solid #00d4ff; font-size: 0.9rem; color: #00d4ff;">Item Description</th>
                        <th style="padding: 12px; border-bottom: 1px solid #00d4ff; font-size: 0.9rem; color: #00d4ff; text-align: center;">Qty</th>
                        <th style="padding: 12px; border-bottom: 1px solid #00d4ff; font-size: 0.9rem; color: #00d4ff; text-align: center;">UNIT PRICE</th>
                        <th style="padding: 12px; border-bottom: 1px solid #00d4ff; font-size: 0.9rem; color: #00d4ff; text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody style="font-size: 0.85rem;">
    `;

    const aggregatedDevices = {};

    property.rooms.forEach(room => {
        room.devices.forEach(roomDevice => {
            const deviceId = roomDevice.deviceId;

            if (aggregatedDevices[deviceId]) {
                aggregatedDevices[deviceId].quantity += roomDevice.quantity;
            } else {
                const deviceDetails = getDeviceById(deviceId);
                if (deviceDetails) {
                    aggregatedDevices[deviceId] = {
                        ...deviceDetails,
                        quantity: roomDevice.quantity
                    };
                }
            }
        });
    });

    Object.values(aggregatedDevices).forEach(device => {
        if (rowCount > 0 && rowCount % maxRowsPerPage === 0) {
            html += `
                    </tbody>
                </table>
            </div>
            <div style="${pageStyle} page-break-before: always;">
                <h2 style="color: #00d4ff; padding-bottom: 10px; font-size: 1.8rem; opacity: 0.5;">Full Hardware Quotation (Cont.)</h2>
                <table style="width: 100%; margin-top: 20px; border-collapse: collapse;">
                    <thead>
                        <tr style="text-align: left;">
                            <th style="padding: 12px; border-bottom: 1px solid #00d4ff; font-size: 0.9rem; color: #00d4ff;">Item Description</th>
                            <th style="padding: 12px; border-bottom: 1px solid #00d4ff; font-size: 0.9rem; color: #00d4ff; text-align: center;">Qty</th>
                            <th style="padding: 12px; border-bottom: 1px solid #00d4ff; font-size: 0.9rem; color: #00d4ff; text-align: center;">UNIT PRICE</th>
                            <th style="padding: 12px; border-bottom: 1px solid #00d4ff; font-size: 0.9rem; color: #00d4ff; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody style="font-size: 0.85rem;">
            `;
        }

        html += `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);"><strong>${device.name}</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: center;">${device.quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: center;">${device.price}</td>
                <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: right;">${(device.price * device.quantity).toLocaleString()} EGP</td>
            </tr>
        `;

        rowCount++;
    });

    html += `
                </tbody>
            </table>
            <div style="text-align: right; background: rgba(0,212,255,0.1); padding: 15px; border-radius: 8px; margin-top:auto;">
                <h3 style="margin: 0; font-size: 1.2rem;">Hardware Subtotal: <span style="color: #00d4ff;">${hardwareSubtotal.toLocaleString()} EGP</span></h3>
            </div>
        </div>
        <div class="html2pdf__page-break"></div>
    `;
}

    html += `
        <div style="${pageStyle}">
            <h2 style="color: #00d4ff; border-bottom: 1px solid #00d4ff; padding-bottom: 10px; margin-bottom: 30px; font-size: 1.8rem;">Project Summary</h2>
            <div style="display: flex; flex-direction: column; gap: 15px; max-width: 800px; margin: 0 auto; width: 100%;">
                <div style="${cardStyle} flex-direction: row; justify-content: space-between; align-items: center;">
                    <span style="font-size: 1.1rem;">Hardware Subtotal</span>
                    <span style="font-size: 1.2rem; font-weight: 600;">${hardwareSubtotal.toLocaleString()} EGP</span>
                </div>
                <div style="${cardStyle} flex-direction: row; justify-content: space-between; align-items: center; border-left: 5px solid #00d4ff;">
                    <div>
                        <span style="font-size: 1.1rem; display: block;">Technical Services & Installation</span>
                        <small style="opacity: 0.6;">Professional integration and setup (${taxPercentage}%)</small>
                    </div>
                    
                    <span style="font-size: 1.2rem; font-weight: 600;">+ ${fees} EGP</span>
                </div>
                <div style="${cardStyle} flex-direction: row; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="font-size: 1.1rem; display: block;">Applicable Taxes</span>
                        <small style="opacity: 0.6;">Standard processing tax </small>
                    </div>
                    <span style="font-size: 1.2rem; font-weight: 600; color: #00d4ff;">Included</span>
                </div>
                <div style="background: #00d4ff; color: #0a0e14; padding: 25px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-top: 20px;">
                    <h2 style="margin: 0; text-transform: uppercase; letter-spacing: 1px;">Total Project Investment</h2>
                    <h2 style="margin: 0; font-size: 2.2rem;">${finalProjectTotal.toLocaleString()} EGP</h2>
                </div>
            </div>
        </div>
        <div class="html2pdf__page-break"></div>

        <div style="${pageStyle}">
            <h2 style="color: #00d4ff; border-bottom: 1px solid #00d4ff; padding-bottom: 10px; margin-bottom: 30px; font-size: 1.8rem;">Payment Schedule</h2>
            <table style="width: 100%; border-collapse: collapse; background: rgba(255, 255, 255, 0.03); border-radius: 12px; overflow: hidden;">
                <thead>
                    <tr style="background: rgba(0, 212, 255, 0.15); color: #00d4ff; text-transform: uppercase; font-size: 0.85rem;">
                        <th style="padding: 20px; text-align: left; border-bottom: 2px solid #00d4ff;">Phase</th>
                        <th style="padding: 20px; text-align: left; border-bottom: 2px solid #00d4ff;">Milestone</th>
                        <th style="padding: 20px; text-align: center; border-bottom: 2px solid #00d4ff;">%</th>
                        <th style="padding: 20px; text-align: right; border-bottom: 2px solid #00d4ff;">Amount (EGP)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom: 1px solid rgba(0, 212, 255, 0.1);">
                        <td style="padding: 20px; font-weight: bold; color: #00d4ff;">1. Down Payment</td>
                        <td style="padding: 20px; opacity: 0.8;">Required upon signing to initiate the project</td>
                        <td style="padding: 20px; text-align: center; font-weight: bold;">50%</td>
                        <td style="padding: 20px; text-align: right; font-weight: bold;">${(finalProjectTotal * 0.5).toLocaleString()}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid rgba(0, 212, 255, 0.1);">
                        <td style="padding: 20px; font-weight: bold; color: #00d4ff;">2. Hardware Delivery</td>
                        <td style="padding: 20px; opacity: 0.8;">Due upon arrival of hardware at site</td>
                        <td style="padding: 20px; text-align: center; font-weight: bold;">40%</td>
                        <td style="padding: 20px; text-align: right; font-weight: bold;">${(finalProjectTotal * 0.4).toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td style="padding: 20px; font-weight: bold; color: #00d4ff;">3. Final Handover</td>
                        <td style="padding: 20px; opacity: 0.8;">Payable after testing & client handover</td>
                        <td style="padding: 20px; text-align: center; font-weight: bold;">10%</td>
                        <td style="padding: 20px; text-align: right; font-weight: bold;">${(finalProjectTotal * 0.1).toLocaleString()}</td>
                    </tr>
                </tbody>
            </table>
            <div style="margin-top: 40px; padding: 20px; border-left: 4px solid #00d4ff; background: rgba(255,255,255,0.05);">
                 <p style="margin: 0; font-size: 0.95rem; line-height: 1.6;">
                    <strong>Total Investment:</strong> ${finalProjectTotal.toLocaleString()} EGP<br>
                    <span style="opacity: 0.7;">Delivery & Installation: Estimated 30 days from down payment.</span>
                 </p>
            </div>
        </div>
        <div class="html2pdf__page-break"></div>

    <div style="${pageStyle}">
        <h2 style="color: #00d4ff; border-bottom: 1px solid #00d4ff; padding-bottom: 10px; margin-bottom: 30px; font-size: 1.8rem;">Project Standards</h2>
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; flex-grow: 1;">
            
            <div style="${cardStyle} border-top: 4px solid #00d4ff;">
                <div style="font-size: 2rem; margin-bottom: 10px;">📅</div>
                <h3 style="color: #00d4ff; margin: 0 0 10px 0; font-size: 1.1rem; text-transform: uppercase;">Validity</h3>
                <p style="font-size: 0.95rem; opacity: 0.8; line-height: 1.5; margin: 0;">This quotation is valid for 30 days from the date of issuance due to market fluctuations.</p>
            </div>

            <div style="${cardStyle} border-top: 4px solid #00d4ff;">
                <div style="font-size: 2rem; margin-bottom: 10px;">🛡️</div>
                <h3 style="color: #00d4ff; margin: 0 0 10px 0; font-size: 1.1rem; text-transform: uppercase;">Warranty</h3>
                <p style="font-size: 0.95rem; opacity: 0.8; line-height: 1.5; margin: 0;">1-year comprehensive warranty on any industrial defects .</p>
            </div>

            <div style="${cardStyle} border-top: 4px solid #00d4ff;">
                <div style="font-size: 2rem; margin-bottom: 10px;">⚡</div>
                <h3 style="color: #00d4ff; margin: 0 0 10px 0; font-size: 1.1rem; text-transform: uppercase;">Support</h3>
                <p style="font-size: 0.95rem; opacity: 0.8; line-height: 1.5; margin: 0;">24/7 Remote technical assistance for the first 3 months following project handover.</p>
            </div>

            <div style="${cardStyle} border-top: 4px solid #00d4ff;">
                <div style="font-size: 2rem; margin-bottom: 10px;">📦</div>
                <h3 style="color: #00d4ff; margin: 0 0 10px 0; font-size: 1.1rem; text-transform: uppercase;">Delivery</h3>
                <p style="font-size: 0.95rem; opacity: 0.8; line-height: 1.5; margin: 0;">Hardware delivery is expected within 22 business days from the initial down payment.</p>
            </div>

        </div>
        
        <div style="margin-top: 30px; background: rgba(0, 212, 255, 0.05); padding: 15px; border-radius: 8px; text-align: center; border: 1px dashed rgba(0, 212, 255, 0.3);">
            <span style="font-size: 0.85rem; opacity: 0.6;">All systems are integrated according to international smart home security protocols.</span>
        </div>
    </div>
        <div class="html2pdf__page-break"></div>

        <div style="${pageStyle} justify-content: center; align-items: center; text-align: center;">
<div style="margin-top: 30px; text-align: center;">
    <div style="display: inline-block;padding: 12px; ">
            <img src="${PDF_LOGO_SRC}" style="max-width: 150px; margin-top: 60px; opacity: 0.5;">
            

    </div>
      
</div>
            <div style="max-width: 600px;">
                <h2 style="color: #00d4ff; font-size: 2.5rem; margin-bottom: 10px;">We're always here for you </h2>
                <p style="font-size: 1.2rem; opacity: 0.8; margin-bottom: 40px;">Our team is ready to answer any technical or financial questions you may have.</p>
                <div style="display: flex; justify-content: center; gap: 30px;">
                    <div style="${cardStyle} padding: 30px; min-width: 200px;">
                        <div style="font-size: 2rem; margin-bottom: 10px;">📞</div>
                        <strong style="color: #00d4ff;">Call Us</strong>
                        <p style="margin: 5px 0 0 0;">+20 104 074 3437</p>
                    </div>
                    <div style="${cardStyle} padding: 30px; min-width: 200px;">
                        <div style="font-size: 2rem; margin-bottom: 10px;">📧</div>
                        <strong style="color: #00d4ff;">Email Us</strong>
                        <p style="margin: 5px 0 0 0;">thesmarthome404@gmail.com</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    element.innerHTML = html;

    const opt = {
        margin: 0,
        filename: groupByCategory ? `${property.clientName}_Quotation_Summary.pdf` : `${property.clientName}_Detailed_Quotation.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#0a0e14',
            scrollY: 0,
            onclone: (clonedDocument) => {
                // file:// pages are opaque origins in Chromium. The website background
                // must never be part of the canvas used for PDF export.
                clonedDocument.documentElement.style.setProperty('background-image', 'none', 'important');
                clonedDocument.body.style.setProperty('background-image', 'none', 'important');
            }
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
        pagebreak: { mode: ['css', 'legacy'] }
    };

    await html2pdf().set(opt).from(element).save();
}

function generateGroupedPDF() {
    return generatePDF(true);
}


// ===== SETTINGS MODAL =====

function openSettingsModal() {
    document.getElementById('settingsModal').classList.add('active');
    renderDevicesList();
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('active');
}

function renderDevicesList() {
    const devicesList = document.getElementById('devicesList');
    devicesList.innerHTML = '';

    devicesDatabase.forEach(device => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'device-list-item';

itemDiv.innerHTML = `
    ...
<button class="btn btn-danger btn-small" onclick="deleteDevice('${device.firebaseId || device.id}')">Delete</button>    ...
`;

        devicesList.appendChild(itemDiv);
    });
}

function openAddDeviceModal() {
    document.getElementById('addDeviceModal').classList.add('active');
    clearAddDeviceForm();
}

function closeAddDeviceModal() {
    document.getElementById('addDeviceModal').classList.remove('active');
}

function clearAddDeviceForm() {
    const fields = [
        'newDeviceName', 'newDeviceCategory', 'newDeviceBrand', 'newDeviceProtocol', 'newDevicePrice', 'newDeviceSupplier',
        'addDeviceName', 'addDeviceBrand', 'addDeviceCategory', 'addDeviceSupplier', 'addDeviceProtocol', 'addDevicePrice', 'addDeviceGroup', 'addDeviceCoverage'
    ];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    ['addDeviceWeight', 'newDeviceWeight'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = DEFAULT_DEVICE_WEIGHT;
    });
}


async function addNewDevice() {
    const { collection, addDoc } = window.fbMethods;
    const name = document.getElementById('newDeviceName').value.trim();
    const category = document.getElementById('newDeviceCategory').value;
    const price = parseFloat(document.getElementById('newDevicePrice').value) || 0;

    if (!name || !category || !price) {
        alert('Please fill in all required fields');
        return;
    }

    const newDevice = {
        name: name,
        category: category,
        brand: document.getElementById('newDeviceBrand').value.trim(),
        protocol: document.getElementById('newDeviceProtocol').value.trim(),
        price: price,
        supplier: document.getElementById('newDeviceSupplier').value.trim(),
        weight: Number.isFinite(parseFloat(document.getElementById('newDeviceWeight')?.value)) ? parseFloat(document.getElementById('newDeviceWeight').value) : DEFAULT_DEVICE_WEIGHT,
        active: true,
        createdAt: new Date()
    };

    try {
        await addDoc(collection(window.db, "devices"), newDevice);
        closeAddDeviceModal();
        alert('Device added to Cloud Database!');
    } catch (e) {
        console.error("Error adding device: ", e);
    }
}


function closeEditDeviceModal() {
    document.getElementById('editDeviceModal').classList.remove('active');
    editingDeviceId = null;
}



function deleteDevice(deviceId) {
    if (confirm('Are you sure you want to delete this device?')) {
        devicesDatabase = devicesDatabase.filter(d => d.id !== deviceId);
        saveDataToLocalStorage();
        renderDevicesList();
        alert('Device deleted successfully!');
    }
}
// ===== BACKGROUND IMAGE =====

function updateBackgroundImage() {
    const url = document.getElementById('backgroundImageUrl').value.trim();
    if (!url) {
        alert('Please enter a valid image URL');
        return;
    }

    backgroundImageUrl = url;
    document.body.style.backgroundImage = `url('${url}')`;
    saveDataToLocalStorage();
    alert('Background image updated successfully!');
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', function() {
    // Set initial background image
    // Keep the default background in CSS (embedded as a data URL) so file:// mode stays safe.
    document.body.style.backgroundImage = backgroundImageUrl && backgroundImageUrl !== 'hausbot_background.jpg'
        ? `url('${backgroundImageUrl}')`
        : '';
    document.getElementById('backgroundImageUrl').value = backgroundImageUrl;
    // Close modals when clicking outside
    window.onclick = function(event) {
        const settingsModal = document.getElementById('settingsModal');
        const addDeviceModal = document.getElementById('addDeviceModal');
        const editDeviceModal = document.getElementById('editDeviceModal');
        const editPropertyModal = document.getElementById('editPropertyModal');

        if (event.target === settingsModal) {
            settingsModal.classList.remove('active');
        }
        if (event.target === addDeviceModal) {
            addDeviceModal.classList.remove('active');
        }
        if (event.target === editDeviceModal) {
            editDeviceModal.classList.remove('active');
        }
        if (event.target === editPropertyModal) {
            editPropertyModal.classList.remove('active');
        }
    };

    console.log('Smart Home Survey App Initialized');
});
// ===== INITIALIZATION =====



document.addEventListener('DOMContentLoaded', async function() {
   document.body.style.backgroundImage = backgroundImageUrl && backgroundImageUrl !== 'hausbot_background.jpg'
        ? `url('${backgroundImageUrl}')`
        : '';
    if (document.getElementById('backgroundImageUrl')) {
        document.getElementById('backgroundImageUrl').value = backgroundImageUrl;
    }
    if (typeof initFirebaseSync === 'function') {
        initFirebaseSync();
    }



    // 3. Close modals when clicking outside the content box
    window.onclick = function(event) {
        const settingsModal = document.getElementById('settingsModal');
        const addDeviceModal = document.getElementById('addDeviceModal');
        const editDeviceModal = document.getElementById('editDeviceModal');
        const editPropertyModal = document.getElementById('editPropertyModal');

        if (event.target === settingsModal) {
            settingsModal.classList.remove('active');
        }
        if (event.target === addDeviceModal) {
            addDeviceModal.classList.remove('active');
        }
        if (event.target === editDeviceModal) {
            editDeviceModal.classList.remove('active');
        }
        if (event.target === editPropertyModal) {
            editPropertyModal.classList.remove('active');
        }
    };

    console.log('Smart Home Survey App Initialized with Central DB');
});
function goToAdmin() {
    showPage('adminPage');
    renderAdminDevices();
    renderParentGroupsAdmin();
    renderSubgroupsAdmin();
    renderGroupColorSettings();
}

function renderGroupColorSettings() {
    const container = document.getElementById('groupColorsContainer');
    if (!container) return;
    container.innerHTML = '';

    for (let i = 1; i <= 10; i++) {
        const color = groupColors[i] || '#ffffff';
        const card = document.createElement('div');
        card.className = 'group-color-card';
        card.innerHTML = `
            <div class="group-label">Group ${i}</div>
            <div class="color-preview-circle" style="background-color: ${color}">
                <input type="color" id="groupColorInput-${i}" value="${color}" onchange="this.parentElement.style.backgroundColor = this.value; this.parentElement.nextElementSibling.innerText = this.value.toUpperCase()">
            </div>
            <div class="hex-label">${color.toUpperCase()}</div>
        `;
        container.appendChild(card);
    }
}

async function saveGroupColors() {
    const newColors = {};
    for (let i = 1; i <= 10; i++) {
        newColors[i] = document.getElementById(`groupColorInput-${i}`).value;
    }

    const { doc, setDoc } = window.fbMethods;
    try {
        await setDoc(doc(window.db, "settings", "groupColors"), newColors);
        alert("Group colors saved to Firebase!");
    } catch (e) {
        console.error("Error saving group colors:", e);
        alert("Failed to save group colors.");
    }
}






function escapeAdminHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getParentGroupOptions(selectedId = '', placeholder = 'Select parent group') {
    const options = [`<option value="">${escapeAdminHtml(placeholder)}</option>`];
    deviceParentGroupsDatabase.forEach(parentGroup => {
        const selected = parentGroup.firebaseId === selectedId ? ' selected' : '';
        options.push(`<option value="${escapeAdminHtml(parentGroup.firebaseId)}"${selected}>${escapeAdminHtml(parentGroup.name)}</option>`);
    });
    return options.join('');
}

function refreshNewSubgroupParentOptions() {
    const select = document.getElementById('newSubgroupParentGroup');
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = getParentGroupOptions(currentValue, 'Select parent group');
    if (currentValue && deviceParentGroupsDatabase.some(group => group.firebaseId === currentValue)) {
        select.value = currentValue;
    }
}

function getSubgroupOptions(selectedId = '') {
    const options = ['<option value="">Not assigned</option>'];
    const assignedIds = new Set();

    deviceParentGroupsDatabase.forEach(parentGroup => {
        const subgroups = deviceSubgroupsDatabase.filter(subgroup => subgroup.parentGroupId === parentGroup.firebaseId);
        if (!subgroups.length) return;

        options.push(`<optgroup label="${escapeAdminHtml(parentGroup.name)}">`);
        subgroups.forEach(subgroup => {
            assignedIds.add(subgroup.firebaseId);
            const selected = subgroup.firebaseId === selectedId ? ' selected' : '';
            options.push(`<option value="${escapeAdminHtml(subgroup.firebaseId)}"${selected}>${escapeAdminHtml(subgroup.name)}</option>`);
        });
        options.push('</optgroup>');
    });

    const unassignedSubgroups = deviceSubgroupsDatabase.filter(subgroup => !assignedIds.has(subgroup.firebaseId));
    if (unassignedSubgroups.length) {
        options.push('<optgroup label="Unassigned parent group">');
        unassignedSubgroups.forEach(subgroup => {
            const selected = subgroup.firebaseId === selectedId ? ' selected' : '';
            options.push(`<option value="${escapeAdminHtml(subgroup.firebaseId)}"${selected}>${escapeAdminHtml(subgroup.name)}</option>`);
        });
        options.push('</optgroup>');
    }

    return options.join('');
}

function renderParentGroupsAdmin() {
    const list = document.getElementById('deviceParentGroupsList');
    if (!list) return;

    refreshNewSubgroupParentOptions();

    if (!deviceParentGroupsDatabase.length) {
        list.innerHTML = `<tr><td colspan="3" style="padding:18px; text-align:center; opacity:0.65;">No parent groups yet. Create the first solution group above.</td></tr>`;
        return;
    }

    list.innerHTML = deviceParentGroupsDatabase.map(parentGroup => {
        const subgroupCount = deviceSubgroupsDatabase.filter(subgroup => subgroup.parentGroupId === parentGroup.firebaseId).length;
        return `
            <tr>
                <td>
                    <input type="text" class="form-input" value="${escapeAdminHtml(parentGroup.name)}"
                        onchange="updateDeviceParentGroupDefinition('${parentGroup.firebaseId}', this.value)"
                        style="margin:0; min-width:260px;">
                </td>
                <td style="text-align:center; font-weight:700; color:#8beaff;">${subgroupCount}</td>
                <td style="text-align:center;">
                    <button class="btn-settings" style="background:rgba(255,71,87,0.16);" onclick="deleteDeviceParentGroup('${parentGroup.firebaseId}')">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function addDeviceParentGroup() {
    const nameInput = document.getElementById('newParentGroupName');
    const name = nameInput?.value.trim();

    if (!name) {
        alert('Please enter a parent group name.');
        return;
    }

    const duplicate = deviceParentGroupsDatabase.some(group => String(group.name || '').trim().toLowerCase() === name.toLowerCase());
    if (duplicate) {
        alert('A parent group with this name already exists.');
        return;
    }

    const { collection, addDoc } = window.fbMethods;
    try {
        await addDoc(collection(window.db, 'deviceParentGroups'), {
            name,
            createdAt: new Date().toISOString()
        });
        nameInput.value = '';
    } catch (error) {
        console.error('Error adding parent group:', error);
        alert('Could not add parent group.');
    }
}

async function updateDeviceParentGroupDefinition(firebaseId, newValue) {
    const value = String(newValue || '').trim();
    if (!value) {
        alert('Parent group name cannot be empty.');
        renderParentGroupsAdmin();
        return;
    }

    const duplicate = deviceParentGroupsDatabase.some(group => group.firebaseId !== firebaseId && String(group.name || '').trim().toLowerCase() === value.toLowerCase());
    if (duplicate) {
        alert('A parent group with this name already exists.');
        renderParentGroupsAdmin();
        return;
    }

    const { doc, updateDoc } = window.fbMethods;
    try {
        await updateDoc(doc(window.db, 'deviceParentGroups', firebaseId), { name: value });
    } catch (error) {
        console.error('Error updating parent group:', error);
        alert('Could not update parent group.');
        renderParentGroupsAdmin();
    }
}

async function deleteDeviceParentGroup(firebaseId) {
    const parentGroup = getDeviceParentGroupById(firebaseId);
    if (!parentGroup) return;

    const subgroupCount = deviceSubgroupsDatabase.filter(subgroup => subgroup.parentGroupId === firebaseId).length;
    if (subgroupCount > 0) {
        alert(`This parent group contains ${subgroupCount} subgroup(s). Move or delete those subgroups first.`);
        return;
    }

    if (!confirm(`Delete parent group "${parentGroup.name}"?`)) return;

    const { doc, deleteDoc } = window.fbMethods;
    try {
        await deleteDoc(doc(window.db, 'deviceParentGroups', firebaseId));
    } catch (error) {
        console.error('Error deleting parent group:', error);
        alert('Could not delete parent group.');
    }
}

function renderSubgroupsAdmin() {
    const list = document.getElementById('deviceSubgroupsList');
    if (!list) return;

    refreshNewSubgroupParentOptions();

    if (!deviceSubgroupsDatabase.length) {
        list.innerHTML = `<tr><td colspan="5" style="padding:18px; text-align:center; opacity:0.65;">No subgroups yet. Add the first one above.</td></tr>`;
        return;
    }

    list.innerHTML = deviceSubgroupsDatabase.map(subgroup => {
        const assignedCount = devicesDatabase.filter(device => device.subgroupId === subgroup.firebaseId).length;
        return `
            <tr>
                <td style="min-width:220px;">
                    <select class="form-select" onchange="updateDeviceSubgroupDefinition('${subgroup.firebaseId}', 'parentGroupId', this.value)" style="margin:0; min-width:205px;">
                        ${getParentGroupOptions(subgroup.parentGroupId || '', 'Select parent group')}
                    </select>
                </td>
                <td>
                    <input type="text" class="form-input" value="${escapeAdminHtml(subgroup.name)}"
                        onchange="updateDeviceSubgroupDefinition('${subgroup.firebaseId}', 'name', this.value)"
                        style="margin:0; min-width:210px;">
                </td>
                <td>
                    <input type="text" class="form-input" value="${escapeAdminHtml(subgroup.measuringUnit || '')}"
                        onchange="updateDeviceSubgroupDefinition('${subgroup.firebaseId}', 'measuringUnit', this.value)"
                        style="margin:0; min-width:160px;">
                </td>
                <td style="text-align:center; font-weight:700;">${assignedCount}</td>
                <td style="text-align:center;">
                    <button class="btn-settings" style="background:rgba(255,71,87,0.16);" onclick="deleteDeviceSubgroup('${subgroup.firebaseId}')">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function addDeviceSubgroup() {
    const parentInput = document.getElementById('newSubgroupParentGroup');
    const nameInput = document.getElementById('newSubgroupName');
    const unitInput = document.getElementById('newSubgroupUnit');
    const parentGroupId = parentInput?.value || '';
    const name = nameInput?.value.trim();
    const measuringUnit = unitInput?.value.trim();

    if (!parentGroupId) {
        alert('Please select a parent group first.');
        return;
    }
    if (!name || !measuringUnit) {
        alert('Please enter both subgroup name and measuring unit.');
        return;
    }

    const duplicate = deviceSubgroupsDatabase.some(subgroup =>
        subgroup.parentGroupId === parentGroupId && String(subgroup.name || '').trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
        alert('A subgroup with this name already exists inside the selected parent group.');
        return;
    }

    const { collection, addDoc } = window.fbMethods;
    try {
        await addDoc(collection(window.db, 'deviceSubgroups'), {
            parentGroupId,
            name,
            measuringUnit,
            createdAt: new Date().toISOString()
        });
        nameInput.value = '';
        unitInput.value = '';
    } catch (error) {
        console.error('Error adding subgroup:', error);
        alert('Could not add subgroup.');
    }
}

async function updateDeviceSubgroupDefinition(firebaseId, field, newValue) {
    if (!['name', 'measuringUnit', 'parentGroupId'].includes(field)) return;
    const value = String(newValue || '').trim();

    if (!value) {
        const labels = {
            name: 'Subgroup name cannot be empty.',
            measuringUnit: 'Measuring unit cannot be empty.',
            parentGroupId: 'Every subgroup must belong to a parent group.'
        };
        alert(labels[field]);
        renderSubgroupsAdmin();
        return;
    }

    const currentSubgroup = getDeviceSubgroupById(firebaseId);
    if (!currentSubgroup) return;
    const prospectiveParentId = field === 'parentGroupId' ? value : (currentSubgroup.parentGroupId || '');
    const prospectiveName = field === 'name' ? value : String(currentSubgroup.name || '').trim();

    if (field === 'name' || field === 'parentGroupId') {
        const duplicate = deviceSubgroupsDatabase.some(subgroup =>
            subgroup.firebaseId !== firebaseId &&
            subgroup.parentGroupId === prospectiveParentId &&
            String(subgroup.name || '').trim().toLowerCase() === prospectiveName.toLowerCase()
        );
        if (duplicate) {
            alert('A subgroup with this name already exists inside the selected parent group.');
            renderSubgroupsAdmin();
            return;
        }
    }

    const { doc, updateDoc } = window.fbMethods;
    try {
        await updateDoc(doc(window.db, 'deviceSubgroups', firebaseId), { [field]: value });
    } catch (error) {
        console.error('Error updating subgroup:', error);
        alert('Could not update subgroup.');
        renderSubgroupsAdmin();
    }
}

async function deleteDeviceSubgroup(firebaseId) {
    const subgroup = getDeviceSubgroupById(firebaseId);
    if (!subgroup) return;

    const assignedCount = devicesDatabase.filter(device => device.subgroupId === firebaseId).length;
    if (assignedCount > 0) {
        alert(`This subgroup is assigned to ${assignedCount} device(s). Reassign those devices first.`);
        return;
    }

    if (!confirm(`Delete subgroup "${subgroup.name}"?`)) return;

    const { doc, deleteDoc } = window.fbMethods;
    try {
        await deleteDoc(doc(window.db, 'deviceSubgroups', firebaseId));
    } catch (error) {
        console.error('Error deleting subgroup:', error);
        alert('Could not delete subgroup.');
    }
}

async function updateDeviceSubgroup(firebaseId, subgroupId) {
    if (!firebaseId) return;
    const { doc, updateDoc } = window.fbMethods;
    try {
        await updateDoc(doc(window.db, 'devices', firebaseId), { subgroupId: subgroupId || null });
    } catch (error) {
        console.error('Error updating device subgroup:', error);
        alert('Could not update device subgroup.');
        renderAdminDevices();
    }
}

// --- 1. RENDER TABLE WITH ALL DATA ---
function renderAdminDevices() {
    const list = document.getElementById('adminDevicesList');
    if (!list) return;
    list.innerHTML = '';

    devicesDatabase.forEach(device => {
        let dateDisplay = 'New';
        const rawDate = device.createdDate || device.createdAt || device.date;

        if (rawDate) {
            let d;

            // 1. Handle Firebase Timestamp Object {seconds, nanoseconds}
            if (rawDate && typeof rawDate === 'object' && typeof rawDate.toDate === 'function') {
                d = rawDate.toDate();
            } 
            // 2. Handle JS Date Object or ISO String
            else if (rawDate instanceof Date || !isNaN(Date.parse(rawDate))) {
                d = new Date(rawDate);
            }
            // 3. Handle the "Legacy" String Format: "February 24, 2026 at..."
            else {
                let cleaned = String(rawDate)
                    .replace(' at ', ' ')
                    .split(' UTC')[0]
                    .replace(/\u202F/g, ' '); 
                d = new Date(cleaned);
            }

            // Final check to see if we got a valid date
            dateDisplay = (d && !isNaN(d.getTime())) ? d.toLocaleDateString() : 'Legacy';
        }

        const status = device.status || 'Active';
        const statusClass = status === 'Active' ? 'status-active' : 'status-inactive';

        const row = document.createElement('tr');
        row.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
        row.innerHTML = `
            <td style="padding: 15px 10px;">
                <strong style="color:var(--primary-color)">${device.name || 'Unnamed'}</strong><br>
                <small style="opacity:0.7">${device.brand || '—'} | ${device.supplier || '—'}</small>
            </td>
            <td>${device.category || 'switch'}</td>
            <td style="text-align: center;">
                <span style="background: ${groupColors[device.group] || '#555'}; color: #000; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">
                    G${device.group || 1}
                </span>
            </td>
            <td>${device.protocol || '—'}</td>
            <td style="color: #4cd137; font-weight: bold;">${device.price || 0} EGP</td>
            <td style="text-align: center;">
                <input type="text" inputmode="decimal" value="${Number.isFinite(Number(device.weight)) ? Number(device.weight) : DEFAULT_DEVICE_WEIGHT}"
                    onchange="updateDeviceWeight('${device.firebaseId}', this.value)"
                    style="width: 72px; padding: 6px; text-align: center; background: rgba(255,255,255,0.08); color: white; border: 1px solid rgba(0,212,255,0.3); border-radius: 6px;">
            </td>
            <td style="min-width:210px;">
                <select class="form-input" onchange="updateDeviceSubgroup('${device.firebaseId}', this.value)" style="margin:0; min-width:200px; padding:6px;">
                    ${getSubgroupOptions(device.subgroupId || '')}
                </select>
            </td>
            <td><span class="status-pill ${statusClass}">${status}</span></td>
            <td>${device.coverage || 0}m</td>
            <td style="font-size: 0.8rem; opacity: 0.6;">${dateDisplay}</td>
            <td style="text-align: center;">
                <button class="btn-settings" onclick="openEditDeviceModal('${device.firebaseId}')">✏️</button>
                <button class="btn-settings" style="background: rgba(255, 71, 87, 0.2);" onclick="deleteDeviceFromAdmin('${device.firebaseId}')">🗑️</button>
            </td>
        `;
        list.appendChild(row);
    });
}

// --- 2. SAVE NEW DEVICE (Capturing Date & Status) ---
async function saveNewDevice() {
    const data = {
        name: document.getElementById('addDeviceName').value,
        brand: document.getElementById('addDeviceBrand').value,
        category: document.getElementById('addDeviceCategory').value,
        supplier: document.getElementById('addDeviceSupplier').value,
        protocol: document.getElementById('addDeviceProtocol').value,
        price: parseFloat(document.getElementById('addDevicePrice').value) || 0,
        weight: Number.isFinite(parseFloat(document.getElementById('addDeviceWeight').value)) ? parseFloat(document.getElementById('addDeviceWeight').value) : DEFAULT_DEVICE_WEIGHT,
        group: parseInt(document.getElementById('addDeviceGroup').value) || 1,
        coverage: parseFloat(document.getElementById('addDeviceCoverage').value) || 0,
        status: document.getElementById('addDeviceStatus').value,
        active: document.getElementById('addDeviceStatus').value === 'Active',
        createdDate: new Date().toISOString() // This ensures the date is valid
    };

    if (!data.name) return alert("Name is required");

    const { collection, addDoc } = window.fbMethods;
    try {
        await addDoc(collection(window.db, "devices"), data);
        closeAddDeviceModal();
    } catch (e) { console.error(e); }
}
// --- 3. FETCH DATA (Including Status) ---
// Ensure this is NOT inside another function or DOMContentLoaded
function openEditDeviceModal(firebaseId) {
    const device = devicesDatabase.find(d => d.firebaseId === firebaseId);
    if (!device) return;

    currentEditingDeviceId = firebaseId;

    // Helper function to prevent "Cannot set properties of null" errors
    const safeSet = (id, value) => {
        const element = document.getElementById(id);
        if (element) {
            element.value = value ?? '';
        } else {
            console.warn(`Element with ID ${id} was not found in HTML.`);
        }
    };

    // Now we set all fields safely
    safeSet('editDeviceName', device.name);
    safeSet('editDeviceBrand', device.brand);
    safeSet('editDeviceCategory', device.category);
    safeSet('editDeviceSupplier', device.supplier);
    safeSet('editDeviceProtocol', device.protocol);
    safeSet('editDevicePrice', device.price);
    safeSet('editDeviceWeight', Number.isFinite(Number(device.weight)) ? Number(device.weight) : DEFAULT_DEVICE_WEIGHT);
    safeSet('editDeviceGroup', device.group);
    safeSet('editDeviceCoverage', device.coverage);
    safeSet('editDeviceStatus', device.status || 'Active');

    document.getElementById('editDeviceModal').classList.add('active');
}
// --- SAVE EDITED ---
async function saveEditedDevice() {
    const { doc, updateDoc } = window.fbMethods;
    const updatedData = {
        name: document.getElementById('editDeviceName').value,
        brand: document.getElementById('editDeviceBrand').value,
        category: document.getElementById('editDeviceCategory').value,
        supplier: document.getElementById('editDeviceSupplier').value,
        protocol: document.getElementById('editDeviceProtocol').value,
        price: parseFloat(document.getElementById('editDevicePrice').value) || 0,
        weight: Number.isFinite(parseFloat(document.getElementById('editDeviceWeight').value)) ? parseFloat(document.getElementById('editDeviceWeight').value) : DEFAULT_DEVICE_WEIGHT,
        group: parseInt(document.getElementById('editDeviceGroup').value) || 1,
        coverage: parseFloat(document.getElementById('editDeviceCoverage').value) || 0,
        status: document.getElementById('editDeviceStatus').value,
        active: document.getElementById('editDeviceStatus').value === 'Active'
    };
    await updateDoc(doc(window.db, "devices", currentEditingDeviceId), updatedData);
    document.getElementById('editDeviceModal').classList.remove('active');
}
async function updateDeviceWeight(firebaseId, newWeight) {
    const weight = parseFloat(newWeight);
    if (!firebaseId || !Number.isFinite(weight) || weight < 0) {
        alert('Please enter a valid weight (0 or greater).');
        renderAdminDevices();
        return;
    }

    const { doc, updateDoc } = window.fbMethods;
    try {
        await updateDoc(doc(window.db, "devices", firebaseId), { weight });
    } catch (error) {
        console.error('Error updating device weight:', error);
        alert('Could not update device weight.');
        renderAdminDevices();
    }
}

async function deleteDeviceFromAdmin(firebaseId) {
    if (!firebaseId) return;
    
    if (confirm("Delete this device from the central database?")) {
        const { doc, deleteDoc } = window.fbMethods;
        try {
            await deleteDoc(doc(window.db, "devices", firebaseId));
            // renderAdminDevices will auto-fire due to onSnapshot in data.js
        } catch (e) {
            console.error("Delete failed:", e);
        }
    }
}
// Global Send Data function to handle child window requests
async function fetchAndSendArchitectureData(targetId, targetWindow = null) {
    if (!window.fbMethods || !window.db) {
        console.warn("[PARENT] Firebase not ready. Retrying...");
        setTimeout(() => fetchAndSendArchitectureData(targetId, targetWindow), 1000);
        return;
    }

    const { doc, getDoc } = window.fbMethods;
    let savedLayout = null;
    
    console.log(`[PARENT] Fetching architecture for property: ${targetId}`);

    try {
        // 1. Force fetch from architectures collection
        const archRef = doc(window.db, "architectures", targetId);
        const archSnap = await getDoc(archRef);
        
        if (archSnap.exists()) {
            savedLayout = archSnap.data();
        } else {
            const propRef = doc(window.db, "properties", targetId);
            const propSnap = await getDoc(propRef);
            if (propSnap.exists()) {
                const propData = propSnap.data();
                savedLayout = propData.architectLayout || propData.architectureLayout;
            }
        }
    } catch (e) {
        console.error("Firebase fetch failed:", e);
    }

    // If no layout was found, ONLY create a "Full Structure" if we are CERTAIN it's new
    if (!savedLayout) {
        savedLayout = {
            allArchitectures: [],
            vertices: [],
            placedDevices: [],
            textLabels: [],
            isClosed: false,
            lastUpdated: new Date().toISOString()
        };
    } else {
        // Ensure all arrays exist even if we loaded a partial layout
        if (!savedLayout.allArchitectures) savedLayout.allArchitectures = [];
        if (!savedLayout.vertices) savedLayout.vertices = [];
        if (!savedLayout.placedDevices) savedLayout.placedDevices = [];
        if (!savedLayout.textLabels) savedLayout.textLabels = [];
    }

    // Get property details
    let selectedProperty = propertiesDatabase.find(p => p.firebaseId === targetId);
    
    // Fallback: Fetch devices if database is empty (e.g. on fresh reload)
    if (!devicesDatabase || devicesDatabase.length === 0) {
        console.log("[PARENT] Devices database empty, fetching from Firebase...");
        try {
            const { collection, getDocs } = window.fbMethods;
            const devSnap = await getDocs(collection(window.db, "devices"));
            devicesDatabase = devSnap.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
        } catch (e) {
            console.error("[PARENT] Failed to fetch devices fallback:", e);
        }
    }

    // Fallback: Fetch group colors if empty
    if (!groupColors || Object.keys(groupColors).length === 0) {
        try {
            const colorSnap = await getDoc(doc(window.db, "settings", "groupColors"));
            if (colorSnap.exists()) groupColors = colorSnap.data();
        } catch (e) {}
    }

    try {
        const propRef = doc(window.db, "properties", targetId);
        const propSnap = await getDoc(propRef);
        if (propSnap.exists()) {
            selectedProperty = { firebaseId: propSnap.id, ...propSnap.data() };
        }
    } catch (e) {}

    const payload = {
        type: 'INIT_DATA',
        devices: devicesDatabase,    
        property: selectedProperty,  
        propertyId: targetId,
        groupColors: groupColors,
        savedLayout: savedLayout 
    };

    if (targetWindow && !targetWindow.closed) {
        console.log("[PARENT] postMessage to requester window.");
        targetWindow.postMessage(payload, '*');
    } else if (window.currentArchitectWindow && !window.currentArchitectWindow.closed) {
        console.log("[PARENT] postMessage to tracked architect window.");
        window.currentArchitectWindow.postMessage(payload, '*');
    }
}

// Inside app.js
function openArchitectTool() {
    if (!currentPropertyId) {
        alert("Please select a property first.");
        return;
    }

    // CRITICAL: Open window immediately to avoid popup blockers
    const architectWindow = window.open(`coverage.html?propertyId=${currentPropertyId}`, '_blank');
    if (!architectWindow) {
        alert("Popup blocked! Please allow popups for this site.");
        return;
    }

    window.currentArchitectWindow = architectWindow;
    window.currentArchitectSendData = fetchAndSendArchitectureData;

    // Trigger initial data send
    setTimeout(() => {
        if (architectWindow && !architectWindow.closed) {
            console.log("[PARENT] Initial fetch for architect window...");
            fetchAndSendArchitectureData(currentPropertyId, architectWindow);
        }
    }, 2500); // Increased timeout to ensure Firestore has time to return data
}

// Global Message Listener (Moved outside openArchitectTool)
window.addEventListener('message', async (event) => {
    const isReadyRequest = event.data === 'READY_FOR_DATA' || (event.data && event.data.type === 'READY_FOR_DATA');
    
    if (isReadyRequest) {
        const requestedId = event.data.propertyId || currentPropertyId;
        console.log(`[PARENT] READY_FOR_DATA received for ID: ${requestedId}`);
        
        // Use global function to send data to the requester
        fetchAndSendArchitectureData(requestedId, event.source);
    } else if (event.data.type === 'SAVE_LAYOUT') {
        const { doc, setDoc } = window.fbMethods;
        const targetId = event.data.propertyId || currentPropertyId;
        
        if (!targetId) {
            console.error("[PARENT] No property ID provided for save!");
            return;
        }

        try {
            console.log(`[PARENT] Saving layout to architectures/${targetId}...`);
            const archRef = doc(window.db, "architectures", targetId);
            const layoutToSave = {
                ...event.data.layout,
                lastUpdated: new Date().toISOString()
            };
            
            await setDoc(archRef, layoutToSave);
            console.log("[PARENT] Layout saved successfully to Firebase architectures collection!");
            
            // CRITICAL: Update the global propertiesDatabase in memory as well
            const prop = propertiesDatabase.find(p => p.firebaseId === targetId);
            if (prop) {
                prop.architectLayout = layoutToSave;
                console.log("[PARENT] Local propertiesDatabase updated for ID:", targetId);
            }

        } catch (e) {
            console.error("[PARENT] Save to Firebase failed:", e);
            alert("Failed to save architecture to cloud. Check console for details.");
        }
    }
});
/**
 * Cross-references property device data with master device data
 * @param {string} deviceId - The ID stored in the property
 * @returns {object} - The full device details including coverage
 */
function getFullDeviceDetails(deviceId) {
    // Look through the master devices list we fetched from Firebase
    const masterDevice = devicesDatabase.find(d => d.firebaseId === deviceId);
    
    if (masterDevice) {
        return {
            name: masterDevice.deviceName,
            coverage: masterDevice.deviceCoverage || masterDevice.coverage || 0,
            category: masterDevice.category
        };
    }
    return { name: "Unknown", coverage: 0 };
}