// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDml7yKe_irqHKTeDzusrN8spLDXVO78p0",
    databaseURL: "https://iot1-4accc-default-rtdb.firebaseio.com/",
    projectId: "iot1-4accc",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// DOM elements
const darkModeToggle = document.getElementById('darkModeToggle');
const notificationContainer = document.getElementById('notificationContainer');
const allOnBtn = document.getElementById('allOnBtn');
const allOffBtn = document.getElementById('allOffBtn');
const voiceBtn = document.getElementById('voiceBtn');
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const mobileMenu = document.querySelector('.mobile-menu');
const mobileMenuClose = document.querySelector('.mobile-menu-close');
const lightCardsContainer = document.querySelector('.light-cards');

// Voice control state
let voiceRecognition = null;
let isVoiceActive = false;

// Light data
const lights = [
    { id: 1, name: "Living Room", description: "Main Ceiling Light" },
    { id: 2, name: "Bedroom", description: "Night Stand Lamp" },
    { id: 3, name: "Kitchen", description: "Under Cabinet" },
    { id: 4, name: "Bathroom", description: "Vanity Light" }
];

// Theme toggle
darkModeToggle.addEventListener('change', () => {
    document.body.setAttribute('data-theme', darkModeToggle.checked ? 'dark' : 'light');
    localStorage.setItem('theme', darkModeToggle.checked ? 'dark' : 'light');
});

// Check for saved theme preference
if (localStorage.getItem('theme') === 'dark') {
    darkModeToggle.checked = true;
    document.body.setAttribute('data-theme', 'dark');
}

// Generate light cards
function generateLightCards() {
    lightCardsContainer.innerHTML = lights.map(light => `
        <div class="light-card" data-led="${light.id}">
            <div class="light-icon">
                <div class="light-bulb">
                    <div class="filament"></div>
                    <div class="glow"></div>
                </div>
            </div>
            <h3>${light.name}</h3>
            <p>${light.description}</p>
            <label class="switch">
                <input type="checkbox" class="led-switch" data-led="${light.id}">
                <span class="slider round"></span>
            </label>
        </div>
    `).join('');
}

// Initialize LED states from Firebase
function initializeLEDStates() {
    lights.forEach(light => {
        const ledRef = database.ref(`led/led${light.id}`);
        ledRef.on('value', (snapshot) => {
            const state = snapshot.val();
            const switchElement = document.querySelector(`.led-switch[data-led="${light.id}"]`);
            const lightCard = document.querySelector(`.light-card[data-led="${light.id}"]`);
            
            if (switchElement) {
                switchElement.checked = state === 1;
            }
            
            if (lightCard) {
                lightCard.classList.toggle('active', state === 1);
            }
        });
    });
}

// Page glow effect functions
function addPageGlow() {
    const glow = document.getElementById('page-glow');
    glow.style.opacity = '0.3';
}

function removePageGlow() {
    const glow = document.getElementById('page-glow');
    glow.style.opacity = '0';
}

// Handle LED switch changes
function setupLightSwitches() {
    document.querySelectorAll('.led-switch').forEach(switchElement => {
        switchElement.addEventListener('change', function() {
            const ledNumber = this.getAttribute('data-led');
            const newState = this.checked ? 1 : 0;
            
            database.ref(`led/led${ledNumber}`).set(newState)
                .then(() => {
                    showNotification(`Light ${ledNumber} turned ${newState ? 'on' : 'off'}`, 'success');
                    
                    const lightCard = document.querySelector(`.light-card[data-led="${ledNumber}"]`);
                    if (lightCard) {
                        lightCard.classList.toggle('active', newState === 1);
                        if (newState) {
                            animateLightOn(lightCard);
                            if (ledNumber === "1") addPageGlow();
                        } else {
                            animateLightOff(lightCard);
                            if (ledNumber === "1") removePageGlow();
                        }
                    }
                })
                .catch(error => {
                    console.error("Error updating LED state:", error);
                    this.checked = !this.checked;
                    showNotification("Failed to update light", 'error');
                });
        });
    });
}

// Light animation functions
function animateLightOn(card) {
    const bulb = card.querySelector('.light-bulb');
    
    // Create a burst of light effect
    const burst = document.createElement('div');
    burst.className = 'light-burst';
    burst.style.position = 'absolute';
    burst.style.width = '0';
    burst.style.height = '0';
    burst.style.borderRadius = '50%';
    burst.style.backgroundColor = 'rgba(255, 235, 59, 0.5)';
    burst.style.transition = 'all 0.5s ease-out';
    burst.style.transform = 'translate(-50%, -50%)';
    bulb.appendChild(burst);
    
    // Trigger the animation
    setTimeout(() => {
        burst.style.width = '100px';
        burst.style.height = '100px';
        burst.style.opacity = '0';
    }, 10);
    
    // Remove the burst element after animation
    setTimeout(() => {
        burst.remove();
    }, 600);
}

function animateLightOff(card) {
    const bulb = card.querySelector('.light-bulb');
    
    // Create a fading glow effect
    const fadeOut = document.createElement('div');
    fadeOut.className = 'fade-out-glow';
    fadeOut.style.position = 'absolute';
    fadeOut.style.width = '100%';
    fadeOut.style.height = '100%';
    fadeOut.style.borderRadius = '50%';
    fadeOut.style.backgroundColor = 'rgba(255, 235, 59, 0.2)';
    fadeOut.style.opacity = '1';
    fadeOut.style.transition = 'opacity 0.5s ease-out';
    bulb.appendChild(fadeOut);
    
    // Trigger the fade out
    setTimeout(() => {
        fadeOut.style.opacity = '0';
    }, 10);
    
    // Remove the element after animation
    setTimeout(() => {
        fadeOut.remove();
    }, 600);
}

// All lights control
function turnAllLights(state) {
    const updates = {};
    lights.forEach(light => {
        updates[`led/led${light.id}`] = state;
    });
    
    database.ref().update(updates)
        .then(() => {
            showNotification(`All lights turned ${state ? 'on' : 'off'}`, 'success');
            if (state) {
                addPageGlow();
            } else {
                removePageGlow();
            }
        })
        .catch(error => {
            console.error("Error updating all lights:", error);
            showNotification("Failed to update lights", 'error');
        });
}

// Voice control functions
function setupVoiceControl() {
    if (isVoiceActive) {
        stopVoiceControl();
        return;
    }

    if (!('webkitSpeechRecognition' in window)) {
        showNotification("Voice control not supported in your browser", 'error');
        return;
    }

    // Request microphone permission
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
            startVoiceRecognition();
        })
        .catch(err => {
            console.error("Microphone access denied:", err);
            showNotification("Please allow microphone access for voice control", 'error');
            voiceBtn.classList.remove('active');
        });
}

function startVoiceRecognition() {
    voiceRecognition = new webkitSpeechRecognition();
    voiceRecognition.continuous = true;
    voiceRecognition.interimResults = false;
    voiceRecognition.lang = 'en-US';

    voiceRecognition.onstart = function() {
        isVoiceActive = true;
        voiceBtn.classList.add('active');
        showNotification("Listening... Try saying 'turn on living room light'", 'info');
    };

    voiceRecognition.onresult = function(event) {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
        processVoiceCommand(transcript);
    };

    voiceRecognition.onerror = function(event) {
        console.error("Voice recognition error:", event.error);
        
        let errorMsg = "Voice error occurred";
        if (event.error === 'no-speech') {
            errorMsg = "No speech detected";
        } else if (event.error === 'audio-capture') {
            errorMsg = "Microphone not available";
        } else if (event.error === 'not-allowed') {
            errorMsg = "Microphone access denied";
        }
        
        showNotification(errorMsg, 'error');
        stopVoiceControl();
    };

    voiceRecognition.onend = function() {
        if (isVoiceActive) {
            setTimeout(() => voiceRecognition.start(), 500);
        }
    };

    voiceRecognition.start();
}

function stopVoiceControl() {
    if (voiceRecognition) {
        voiceRecognition.stop();
    }
    isVoiceActive = false;
    voiceRecognition = null;
    voiceBtn.classList.remove('active');
    showNotification("Voice control turned off", 'info');
}

function processVoiceCommand(command) {
    console.log("Voice command:", command);
    
    if (command.includes('turn on') || command.includes('switch on')) {
        if (command.includes('all') || command.includes('every')) {
            turnAllLights(1);
        } else if (command.includes('living room') || command.includes('one') || command.includes('1')) {
            toggleLight(1, true);
        } else if (command.includes('bedroom') || command.includes('two') || command.includes('2')) {
            toggleLight(2, true);
        } else if (command.includes('kitchen') || command.includes('three') || command.includes('3')) {
            toggleLight(3, true);
        } else if (command.includes('bathroom') || command.includes('four') || command.includes('4')) {
            toggleLight(4, true);
        }
    } else if (command.includes('turn off') || command.includes('switch off')) {
        if (command.includes('all') || command.includes('every')) {
            turnAllLights(0);
        } else if (command.includes('living room') || command.includes('one') || command.includes('1')) {
            toggleLight(1, false);
        } else if (command.includes('bedroom') || command.includes('two') || command.includes('2')) {
            toggleLight(2, false);
        } else if (command.includes('kitchen') || command.includes('three') || command.includes('3')) {
            toggleLight(3, false);
        } else if (command.includes('bathroom') || command.includes('four') || command.includes('4')) {
            toggleLight(4, false);
        }
    } else if (command.includes('dark mode')) {
        darkModeToggle.checked = true;
        darkModeToggle.dispatchEvent(new Event('change'));
    } else if (command.includes('light mode')) {
        darkModeToggle.checked = false;
        darkModeToggle.dispatchEvent(new Event('change'));
    }
}

function toggleLight(ledNumber, state) {
    const switchElement = document.querySelector(`.led-switch[data-led="${ledNumber}"]`);
    if (switchElement) {
        switchElement.checked = state;
        switchElement.dispatchEvent(new Event('change'));
    }
}

// Notification function
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    let icon = 'fa-lightbulb';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'info') icon = 'fa-info-circle';
    
    notification.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    notificationContainer.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Mobile menu functionality
mobileMenuBtn.addEventListener('click', () => {
    mobileMenu.classList.add('active');
});

mobileMenuClose.addEventListener('click', () => {
    mobileMenu.classList.remove('active');
});

// Touch event improvements
document.addEventListener('touchstart', function() {}, true);

// Initialize the app
function initApp() {
    generateLightCards();
    initializeLEDStates();
    setupLightSwitches();
    
    // Setup event listeners
    allOnBtn.addEventListener('click', () => turnAllLights(1));
    allOffBtn.addEventListener('click', () => turnAllLights(0));
    voiceBtn.addEventListener('click', setupVoiceControl);
    
    // Setup light card click events
    document.querySelectorAll('.light-card').forEach(card => {
        card.addEventListener('click', function() {
            const ledNumber = this.getAttribute('data-led');
            const switchElement = document.querySelector(`.led-switch[data-led="${ledNumber}"]`);
            if (switchElement) {
                switchElement.checked = !switchElement.checked;
                switchElement.dispatchEvent(new Event('change'));
            }
        });
    });
}

// Start the app
document.addEventListener('DOMContentLoaded', initApp);