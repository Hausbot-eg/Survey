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

function deleteProperty(propertyId) {
    if (confirm('Are you sure you want to delete this property and all its data?')) {
        propertiesDatabase = propertiesDatabase.filter(p => p.id !== propertyId);
        saveDataToLocalStorage();
        renderDashboard();
        alert('Property deleted successfully!');
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
        const categoryDevices = devicesDatabase.filter(d => d.category === categoryKey && d.active);

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
function updateDeviceQuantity(roomId, deviceId, newQuantity) {
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
        saveDataToLocalStorage();
        renderDeviceCategories(property);
        renderCurrentRoom(property);
        
        // Update property total
        const totalCost = calculatePropertyTotal(property);
        document.getElementById('propertyTotalCost').textContent = totalCost.toLocaleString() + ' EGP';
    }
}

function removeDeviceFromRoom(roomId, deviceId) {
    const property = getPropertyById(currentPropertyId);
    const room = property.rooms.find(r => r.id === roomId);
    
    if (room) {
        room.devices = room.devices.filter(d => d.deviceId !== deviceId);
        saveDataToLocalStorage();
        renderDeviceCategories(property);
        renderCurrentRoom(property);
        
        // Update property total
        const totalCost = calculatePropertyTotal(property);
        document.getElementById('propertyTotalCost').textContent = totalCost.toLocaleString() + ' EGP';
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
async function generatePDF() {
    if (typeof html2pdf === 'undefined') {
        alert("The PDF library is being blocked by your browser settings.");
        return;
    }
    const property = getPropertyById(currentPropertyId);
    if (!property) return;

    // --- FINANCIAL CALCULATIONS ---
    const hardwareSubtotal = calculatePropertyTotal(property);
    const serviceFees = hardwareSubtotal * 0.10; // 10% Services
    const taxAmount = hardwareSubtotal * 0.0;    // 4% Tax
    const finalProjectTotal = hardwareSubtotal + serviceFees + taxAmount;

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

    // --- PAGE 1: COVER ---
    let html = `
        <div style="${pageStyle} justify-content: center; align-items: center;">
            <div style="width: 85%; border: 1.5px solid #00d4ff; border-radius: 20px; padding: 40px; position: relative; background: radial-gradient(circle at center, #111827 0%, #0a0e14 100%);">
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="https://raw.githubusercontent.com/Farah-1/housbot/main/logo.png" style="max-width: 160px;">
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
    property.rooms.forEach(room => {
        if (room.devices && room.devices.length > 0) {
            let roomRows = '';
            let roomTotal = 0;
            room.devices.forEach(roomDevice => {
                const device = getDeviceById(roomDevice.deviceId);
                if (device) {
                    const subtotal = device.price * roomDevice.quantity;
                    roomTotal += subtotal;
                    roomRows += `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                            <td style="padding: 15px 10px; font-weight: 600;">${device.name}</td>
                            <td style="padding: 15px 10px; text-align: center;">${roomDevice.quantity}</td>
                            <td style="padding: 15px 10px; text-align: center;">${device.price.toLocaleString()}</td>
                            <td style="padding: 15px 10px; text-align: right; font-weight: bold; color: #00d4ff;">${subtotal.toLocaleString()} EGP</td>
                        </tr>
                    `;
                }
            });

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
                        <tbody>${roomRows}</tbody>
                    </table>
                    <div style=" text-align: right; padding-top: 20px;margin-top:auto;">
                        <span style="font-size: 1.2rem; margin-right: 20px; opacity: 0.8;">Room Total:</span>
                        <span style="font-size: 1.8rem; color: #00d4ff; font-weight: bold;">${roomTotal.toLocaleString()} EGP</span>
                    </div>
                </div>
                <div class="html2pdf__page-break"></div>
            `;
        }
    });

    // --- HARDWARE QUOTATION (TOTAL TABLE) ---
    html += `
        <div style="${pageStyle}">
            <h2 style="color: #00d4ff;  padding-bottom: 10px; font-size: 1.8rem;">Full Hardware Quotation</h2>
            <table style="width: 100%; margin-top: 20px;">
                <thead>
                    <tr style=" text-align: left;">
                        <th style="padding: 12px;  border-bottom: 1px solid #00d4fffont-size: 0.9rem;color: #00d4ff;">Item Description</th>
                        <th style="padding: 12px;  border-bottom: 1px solid #00d4fffont-size: 0.9rem;color: #00d4ff;">Qty</th>
                        <th style="padding: 12px; border-bottom: 1px solid #00d4ff font-size: 0.9rem;color: #00d4ff; text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody style="font-size: 0.85rem;">
    `;
    property.rooms.forEach(room => {
        room.devices.forEach(roomDevice => {
            const device = getDeviceById(roomDevice.deviceId);
            if (device) {
                html += `
                    <tr>
                        <td style="padding: 8px;border-bottom: 1px solid rgba(255,255,255,0.1); ">
                            <strong>${device.name}</strong><br><small style="opacity: 0.6;">${room.name}</small>
                        </td>
                        <td style="padding: 8px;  border-bottom: 1px solid rgba(255,255,255,0.1);  text-align: center;">${roomDevice.quantity}</td>
                        <td style="padding: 8px;  border-bottom: 1px solid rgba(255,255,255,0.1);  text-align: right;">${(device.price * roomDevice.quantity).toLocaleString()} EGP</td>
                    </tr>
                `;
            }
        });
    });

    html += `
                </tbody>
            </table>
            <div style=" text-align: right; background: rgba(0,212,255,0.1); padding: 15px; border-radius: 8px;margin-top:auto;">
                <h3 style="margin: 0; font-size: 1.2rem;">Hardware Subtotal: <span style="color: #00d4ff;">${hardwareSubtotal.toLocaleString()} EGP</span></h3>
            </div>
        </div>
        <div class="html2pdf__page-break"></div>

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
                        <small style="opacity: 0.6;">Professional integration and setup (10%)</small>
                    </div>
                    <span style="font-size: 1.2rem; font-weight: 600;">+ ${serviceFees.toLocaleString()} EGP</span>
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
        <div style="margin-top: 30px;">
            <img src="https://raw.githubusercontent.com/Farah-1/housbot/main/logo.png" style="max-width: 160px; opacity: 1;">
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
        filename: `${property.clientName}_Survey.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#0a0e14', scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
        pagebreak: { mode: ['css', 'legacy'] }
    };

    await html2pdf().set(opt).from(element).save();
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
    document.getElementById('newDeviceName').value = '';
    document.getElementById('newDeviceCategory').value = '';
    document.getElementById('newDeviceBrand').value = '';
    document.getElementById('newDeviceProtocol').value = '';
    document.getElementById('newDevicePrice').value = '';
    document.getElementById('newDeviceSupplier').value = '';
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

function openEditDeviceModal(deviceId) {
    const device = getDeviceById(deviceId);
    if (!device) return;

    editingDeviceId = deviceId;
    document.getElementById('editDeviceName').value = device.name;
    document.getElementById('editDevicePrice').value = device.price;
    document.getElementById('editDeviceBrand').value = device.brand;
    document.getElementById('editDeviceProtocol').value = device.protocol;
    document.getElementById('editDeviceSupplier').value = device.supplier;

    document.getElementById('editDeviceModal').classList.add('active');
}

function closeEditDeviceModal() {
    document.getElementById('editDeviceModal').classList.remove('active');
    editingDeviceId = null;
}

async function saveEditedDevice() {
    if (!editingDeviceId) return;
    const { doc, updateDoc } = window.fbMethods;

    const name = document.getElementById('editDeviceName').value.trim();
    const price = parseFloat(document.getElementById('editDevicePrice').value) || 0;

    try {
        const deviceRef = doc(window.db, "devices", editingDeviceId);
        await updateDoc(deviceRef, {
            name: name,
            price: price,
            brand: document.getElementById('editDeviceBrand').value.trim(),
            protocol: document.getElementById('editDeviceProtocol').value.trim(),
            supplier: document.getElementById('editDeviceSupplier').value.trim()
        });

        closeEditDeviceModal();
        alert('Device updated in Cloud!');
    } catch (e) {
        console.error("Error updating device:", e);
    }
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
    document.body.style.backgroundImage = `url('${backgroundImageUrl}')`;
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
   document.body.style.backgroundImage = `url('${backgroundImageUrl}')`;
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