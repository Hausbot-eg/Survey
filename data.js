// ===== DATA MANAGEMENT =====
// This file contains all the data structures and default data for the application

// Device Categories
const DEVICE_CATEGORIES = {
    switch: { name: 'Smart Switches', icon: '⚡' },
    sensor: { name: 'Sensors', icon: '📡' },
    camera: { name: 'Cameras', icon: '📹' },
    curtain: { name: 'Smart Curtains', icon: '🪟' },
    lock: { name: 'Smart Locks', icon: '🔐' },
    ir: { name: 'IR Controllers', icon: '📺' },
    plug: { name: 'Smart Plugs', icon: '🔌' }
};

// Room Types
const ROOM_TYPES = {
    apartment: ['Reception', 'Master Bedroom', 'Kids Bedroom', 'Kitchen', 'Bathroom', 'Balcony'],
    duplex: ['Reception', 'Kitchen', 'Bathroom', 'Master Bedroom', 'Kids Bedroom', 'Balcony'],
    villa: ['Reception', 'Kitchen', 'Office', 'Bathroom', 'Master Bedroom', 'Kids Bedroom', 'Balcony', 'Storage', 'Server Room'],
    office: ['Workspace', 'Manager Room', 'Meeting Room', 'Server Room'],
    shop: ['Main Area', 'Storage', 'Office', 'Bathroom']
};

// Default Devices Database
const DEFAULT_DEVICES_LIST = [
    {
        id: 1,
        name: 'Zigbee Smart Switch',
        category: 'switch',
        brand: 'Philips Hue',
        protocol: 'Zigbee',
        price: 850,
        supplier: 'Local Distributor',
        active: true
    },
    {
        id: 2,
        name: 'Wi-Fi Smart Switch',
        category: 'switch',
        brand: 'TP-Link',
        protocol: 'Wi-Fi',
        price: 650,
        supplier: 'Local Distributor',
        active: true
    },
    {
        id: 3,
        name: 'Motion Sensor',
        category: 'sensor',
        brand: 'Aqara',
        protocol: 'Zigbee',
        price: 450,
        supplier: 'Local Distributor',
        active: true
    },
    {
        id: 4,
        name: 'Temperature Sensor',
        category: 'sensor',
        brand: 'Aqara',
        protocol: 'Zigbee',
        price: 500,
        supplier: 'Local Distributor',
        active: true
    },
    {
        id: 5,
        name: 'HD Smart Camera',
        category: 'camera',
        brand: 'Hikvision',
        protocol: 'Wi-Fi',
        price: 2500,
        supplier: 'Local Distributor',
        active: true
    },
    {
        id: 6,
        name: '4K Smart Camera',
        category: 'camera',
        brand: 'Hikvision',
        protocol: 'Wi-Fi',
        price: 3500,
        supplier: 'Local Distributor',
        active: true
    },
    {
        id: 7,
        name: 'Motorized Curtain',
        category: 'curtain',
        brand: 'Dooya',
        protocol: 'Zigbee',
        price: 1500,
        supplier: 'Local Distributor',
        active: true
    },
    {
        id: 8,
        name: 'Smart Lock',
        category: 'lock',
        brand: 'Yale',
        protocol: 'Zigbee',
        price: 2000,
        supplier: 'Local Distributor',
        active: true
    },
    {
        id: 9,
        name: 'IR Controller',
        category: 'ir',
        brand: 'Broadlink',
        protocol: 'Wi-Fi',
        price: 800,
        supplier: 'Local Distributor',
        active: true
    },
    {
        id: 10,
        name: 'Smart Plug',
        category: 'plug',
        brand: 'Sonoff',
        protocol: 'Wi-Fi',
        price: 300,
        supplier: 'Local Distributor',
        active: true
    }
];
let devicesDatabase = [];
// Properties Database
let propertiesDatabase = [];
async function seedDevicesOnce() {
    const checkFirebase = setInterval(async () => {
        if (window.fbMethods && window.fbMethods.addDoc) {
            clearInterval(checkFirebase);
            const { collection, addDoc } = window.fbMethods;
            
            console.log("FORCE SEEDING: Starting upload of 10 devices...");
            
            try {
                const devicesRef = collection(window.db, "devices");

                for (const device of DEFAULT_DEVICES_LIST) {
                    const deviceToUpload = {
                        name: device.name,
                        category: device.category,
                        brand: device.brand,
                        protocol: device.protocol,
                        price: device.price,
                        supplier: device.supplier,
                        active: true
                    };

                    await addDoc(devicesRef, deviceToUpload);
                    console.log(`✅ Uploaded: ${deviceToUpload.name}`);
                }
                
                console.log("🏁 ALL DEVICES UPLOADED. Check your Firebase Console!");
            } catch (e) {
                console.error("❌ FORCE SEED ERROR:", e);
            }
        }
    }, 1000);
}
// Current State
let currentPropertyId = null;
let currentRoomId = null;
let backgroundImageUrl = 'hausbot_background.jpg';
let editingDeviceId = null;

// ===== HELPER FUNCTIONS =====

function getDeviceById(deviceId) {
    return devicesDatabase.find(d => (d.firebaseId && d.firebaseId == deviceId) || d.id == deviceId);
}

function getPropertyById(propertyId) {
    return propertiesDatabase.find(p => p.firebaseId === propertyId || p.id == propertyId);
}

function getRoomById(roomId) {
    for (let property of propertiesDatabase) {
        const room = property.rooms.find(r => r.id == roomId);
        if (room) return room;
    }
    return null;
}

function calculateRoomTotal(room) {
    let total = 0;
    room.devices.forEach(roomDevice => {
        const device = getDeviceById(roomDevice.deviceId);
        if (device) {
            total += device.price * roomDevice.quantity;
        }
    });
    return total;
}

function calculatePropertyTotal(property) {
    let total = 0;
    property.rooms.forEach(room => {
        total += calculateRoomTotal(room);
    });
    return total;
}

function getNextDeviceId() {
    const maxId = Math.max(...devicesDatabase.map(d => d.id), 0);
    return maxId + 1;
}

function getNextPropertyId() {
    const maxId = Math.max(...propertiesDatabase.map(p => p.id), 0);
    return maxId + 1;
}

function getNextRoomId() {
    let maxId = 0;
    propertiesDatabase.forEach(p => {
        p.rooms.forEach(r => {
            if (r.id > maxId) maxId = r.id;
        });
    });
    return maxId + 1;
}

// ===== LOCAL STORAGE FUNCTIONS =====

// Function to start syncing with Firebase
function initFirebaseSync() {
    const { collection, onSnapshot } = window.fbMethods;

    // Listen for Devices changes
    onSnapshot(collection(window.db, "devices"), (snapshot) => {
        devicesDatabase = snapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
        if (typeof renderDevicesList === 'function') renderDevicesList();
    });

    // Listen for Properties changes
    onSnapshot(collection(window.db, "properties"), (snapshot) => {
        propertiesDatabase = snapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
        if (typeof renderDashboard === 'function') renderDashboard();
    });
}

function saveDataToLocalStorage() {
    console.log("Data is now handled by Firebase automatically.");
}