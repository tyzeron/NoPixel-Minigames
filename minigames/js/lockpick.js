/**
 * Some constants to customize the minigame look
 */
const COLORS = ['', '#e62d63', '#ffba04', '#1d80de'];
const CIRCLE_GAP = 15;
const DOT_RADIUS = 8;
const ANIMATION_DURATION = 200;
const SEGMENT_WIDTH = 4.5;
const RADIUS_SIZE_RATE = 0.3;
const LOCK_SIZE = 150; // The size for each locks
const HIDE_PIN_RATE = 0.3;  // 30% for the pin hint not to be visible
const NO_COLOR_RATE = 0.25; // 25% chance for no color
const TIMER_BAR_UPDATE = 100; // Update timer bar every 100 milliseconds


/**
 * Global variables actively used during runtime
 */
let NUMBER_OF_LOCKS = 4; // Global variable indicating number of locks
let PIN_COUNT = 12; // Assuming each lock has 12 pins
const LOCKS = []; // global array holding all the locks


/**
 * Constants to elements on the webpage
 */
const TIMER_BAR_ELEM = document.getElementById('timerProgressBar');
const MODAL_ELEM = document.getElementById('modal');
const MODAL_TITLE_ELEM = document.getElementById('modal-title');
const MODAL_MESSAGE_ELEM = document.getElementById('modal-message');
const MINIGAME_ELEM = document.getElementById('minigame');
const SLIDERS_ELEMS = document.querySelectorAll('.slider');
const START_BUTTON_ELEM = document.getElementById('startButton');
const ROTATE_LEFT_BUTTON_ELEM = document.getElementById('rotateLeft');
const ROTATE_RIGHT_BUTTON_ELEM = document.getElementById('rotateRight');
const UNLOCK_BUTTON_ELEM = document.getElementById('unlock');
const LOCKS_SLIDER_ELEM = document.getElementById('numberOfLocks');
const LOCKS_VALUE_ELEM = document.getElementById('numberOfLocksValue');
const PIN_SLIDER_ELEM = document.getElementById('pinCount');
const PIN_VALUE_ELEM = document.getElementById('pinCountValue');
const TIMER_SLIDER_ELEM = document.getElementById('timerDuration');
const TIMER_VALUE_ELEM = document.getElementById('timerDurationValue');
const PRESET_BUTTON_ELEM = document.getElementById('presetButton');
const PRESET_DROPDOWN_ELEM = document.getElementById('presets');


/**
 * Beware, as the following is the very definition of a spaghetti code :P
 */
class Lock {

    constructor(pattern, size, canvasId) {
        this.pattern = pattern;
        this.pattern_hints = this.pattern.map(value => Math.random() < HIDE_PIN_RATE ? 0 : value);
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.center = size / 2;
        this.innerRadius = size * RADIUS_SIZE_RATE;
        this.outerRadius = this.innerRadius + CIRCLE_GAP;
        this.rotationAngle = 0;
        this.isAnimating = false;
        this.animationStartTime = null;
        this.startAngle = 0;
        this.targetAngle = 0;
        this.isActive = false;
        this.canvas.width = size;
        this.canvas.height = size;
        this.draw();
    }

    draw(isSolved = false) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.globalAlpha = isSolved ? 0.7 : 1; // Set the globalAlpha for translucency when the lock is solved

        // Draw border segments of the outer circle (pattern hints)
        for (let i = 0; i < PIN_COUNT; i++) {
            // Subtract half the segment angle width from starting and ending angles to make the dot appear centered within the arc.
            // Also subtract π/2 to align the segments starting from 0 degrees (right side)
            const startAngle = (Math.PI * 2 * i / PIN_COUNT) - Math.PI / PIN_COUNT - Math.PI / 2;
            const endAngle = (Math.PI * 2 * (i + 1) / PIN_COUNT) - Math.PI / PIN_COUNT - Math.PI / 2;
            this.ctx.beginPath();
            this.ctx.arc(this.center, this.center, this.outerRadius, startAngle, endAngle);
            this.ctx.strokeStyle = this.pattern_hints[i] === 0 ? 'transparent' : (isSolved ? '#11b7a3' : COLORS[this.pattern_hints[i]]);
            this.ctx.lineWidth = SEGMENT_WIDTH;
            this.ctx.stroke();
            this.ctx.closePath();
        }

        // Draw inner circle with green border if it's an old lock
        this.ctx.beginPath();
        this.ctx.arc(this.center, this.center, this.innerRadius, 0, Math.PI * 2);
        this.ctx.strokeStyle = this.isActive && !isSolved ? 'yellow' : 'white';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.closePath();

        // Draw dots on the inner circle
        for (let i = 0; i < PIN_COUNT; i++) {
            // Subtract Math.PI / 2 to start from the right-hand side (0 degrees)
            const angle = (Math.PI * 2 * i / PIN_COUNT) + this.rotationAngle - Math.PI / 2;
            const x = this.center + this.innerRadius * Math.cos(angle);
            const y = this.center + this.innerRadius * Math.sin(angle);
            this.ctx.beginPath();
            this.ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
            this.ctx.fillStyle = this.pattern[i] === 0 ? 'transparent' : (isSolved ? '#11b7a3' : COLORS[this.pattern[i]]);
            this.ctx.fill();
            this.ctx.closePath();
        }

        this.ctx.globalAlpha = 1; // Reset globalAlpha to full opacity after drawing the lock
    }

    updateAnimation(timestamp) {
        if (!this.isAnimating) {
            this.isAnimating = true;
            this.animationStartTime = timestamp;
        }

        const elapsedTime = timestamp - this.animationStartTime;
        const progress = elapsedTime / ANIMATION_DURATION;
        if (progress < 1) {
            this.rotationAngle = this.startAngle + (this.targetAngle - this.startAngle) * progress;
            this.draw();
            requestAnimationFrame((timestamp) => this.updateAnimation(timestamp));
        } else {
            this.rotationAngle = this.targetAngle;
            this.draw();
            this.isAnimating = false;
        }
    }

    rotateCircle(direction) {
        if (!this.isAnimating) {
            this.startAngle = this.rotationAngle;
            this.targetAngle += direction * Math.PI * 2 / PIN_COUNT;
            requestAnimationFrame((timestamp) => this.updateAnimation(timestamp));
        }
    }
}


// Function to rotate the pattern array to the right by a given number of steps
function rotatePattern(pattern, steps) {
    const rotatedPattern = [...pattern];
    for (let i = 0; i < steps; i++) {
        rotatedPattern.unshift(rotatedPattern.pop());
    }
    return rotatedPattern;
}


// Controller that binds to the keyboard and button events
class GameController {

    constructor() {
        this.currentLock = null;
        this.timerDuration = 20; // Default 20 seconds
        this.timer = null;
    }

    setTimerDuration(duration) {
        this.timerDuration = duration;
    }

    startTimer() {
        this.stopTimer(); // Clear existing timer if any
        this.startTime = Date.now(); // Record the start time in milliseconds
        this.endTime = this.startTime + this.timerDuration * 1000; // Calculate the end time

        this.updateTimerProgress(100); // Start with 100% width

        this.timer = setInterval(() => {
            const currentTime = Date.now(); // Get the current time
            const timeRemaining = this.endTime - currentTime; // Calculate the remaining time

            const progressPercentage = (timeRemaining / (this.timerDuration * 1000)) * 100;
            this.updateTimerProgress(progressPercentage);

            if (currentTime >= this.endTime) {
                this.runOutOfTime();
            }
        }, TIMER_BAR_UPDATE);
    }

    updateTimerProgress(percentage) {
        TIMER_BAR_ELEM.style.width = `${Math.max(percentage, 0)}%`; // Ensure width is not less than 0%
    }

    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    runOutOfTime() {
        this.stopTimer();
        MODAL_TITLE_ELEM.textContent = 'Timeout';
        MODAL_MESSAGE_ELEM.textContent = 'You ran out of time.';
        MODAL_ELEM.style.display = 'block';
        setButtonsDisabled(true);
    }

    setCurrentLock(lock) {
        if (this.currentLock) {
            this.currentLock.isActive = false; // Deactivate the old lock
            this.currentLock.draw(true); // Redraw the old lock as a solved one
        }
        this.currentLock = lock;
        if (this.currentLock) {
            this.currentLock.isActive = true; // Activate the new lock
            this.currentLock.draw(); // Redraw the new lock with yellow border
        }
    }

    bindControls() {
        window.addEventListener('keydown', (event) => {
            if (this.currentLock) {
                if (MODAL_ELEM.style.display === 'none' && event.key === 'ArrowLeft') {
                    this.currentLock.rotateCircle(-1);
                } else if (MODAL_ELEM.style.display === 'none' && event.key === 'ArrowRight') {
                    this.currentLock.rotateCircle(1);
                } else if (event.key === ' ' || event.code === 'Space') { // Checking for spacebar press
                    if (MODAL_ELEM.style.display === 'block') {
                        START_BUTTON_ELEM.click();
                    } else {
                        event.preventDefault(); // Prevent the default action (scrolling) when pressing space
                        this.nextLock(); // Switch to the next lock
                    }
                }
            }
        });

        ROTATE_LEFT_BUTTON_ELEM.addEventListener('click', () => {
            if (this.currentLock) {
                this.currentLock.rotateCircle(-1);
            }
        });

        ROTATE_RIGHT_BUTTON_ELEM.addEventListener('click', () => {
            if (this.currentLock) {
                this.currentLock.rotateCircle(1);
            }
        });
    }

    nextLock() {
        if (this.currentLock) {
            // Convert the rotation angle to the number of steps
            let steps = Math.round(this.currentLock.rotationAngle / ((Math.PI * 2) / PIN_COUNT)) % PIN_COUNT;
            if (steps < 0) {
                steps += PIN_COUNT; // Correct negative steps to positive steps by wrapping around
            }

            // Rotate the current pattern by the calculated number of steps
            const rotatedPattern = rotatePattern(this.currentLock.pattern, steps);

            // Compare the rotated pattern with the pattern hints
            const isCorrectlyAligned = rotatedPattern.every((color, index) => {
                const hint = this.currentLock.pattern_hints[index];
                return hint === 0 || color === hint;
            });

            if (isCorrectlyAligned) {
                const currentLockIndex = LOCKS.indexOf(this.currentLock);
                const nextLockIndex = (currentLockIndex + 1) % LOCKS.length;

                // If it's the last lock
                if (nextLockIndex === 0) {  // Checking if it's wrapping around to the first lock again
                    this.stopTimer();
                    const timeElapsed = (Date.now() - this.startTime) / 1000;
                    this.currentLock.draw(true); // Redraw the old lock as a solved one

                    // Show the modal with the Congratulations message
                    MODAL_TITLE_ELEM.textContent = 'Lockpick Success';
                    MODAL_MESSAGE_ELEM.innerHTML  = `You have lockpicked the lock in <strong>${timeElapsed.toFixed(2)} seconds</strong>.`;
                    MODAL_ELEM.style.display = 'block';
                    setButtonsDisabled(true);
                } else {
                    this.setCurrentLock(null); // Deactivate all locks before switching
                    this.setCurrentLock(LOCKS[nextLockIndex]);
                }
            } else {
                this.stopTimer();
                // Show the modal with the Game Over message
                MODAL_TITLE_ELEM.textContent = 'You Failed';
                MODAL_MESSAGE_ELEM.textContent = 'The colors did not align correctly.';
                MODAL_ELEM.style.display = 'block';
                setButtonsDisabled(true);
            }
        }
    }
}


// Function to draw intersecting lines for all locks
function drawBackgroundLines(container, outermostLockRadius, pinCount) {
    const canvas = document.createElement('canvas');
    canvas.id = 'backgroundLinesCanvas';
    const ctx = canvas.getContext('2d');

    // Set the size of the background canvas to be large enough for the outermost lock
    canvas.width = canvas.height = outermostLockRadius * 2;

    // Center the canvas in the container
    canvas.style.position = 'absolute';
    canvas.style.left = `50%`;
    canvas.style.top = `50%`;
    canvas.style.transform = 'translate(-50%, -50%)';

    // Draw lines
    for (let i = 0; i < pinCount; i++) {
        // Subtract Math.PI / 2 to align the lines starting from 0 degrees (right side)
        // The lines should point to where the dots would be, so no half-segment adjustment needed
        const angle = (Math.PI * 2 * i / pinCount) - Math.PI / 2;
        const x = outermostLockRadius * Math.cos(angle) + outermostLockRadius;
        const y = outermostLockRadius * Math.sin(angle) + outermostLockRadius;
        ctx.beginPath();
        ctx.moveTo(outermostLockRadius, outermostLockRadius); // Move to the center
        ctx.lineTo(x, y);
        ctx.strokeStyle = 'rgba(117, 129, 139, 1)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Insert the background canvas beneath the other canvases in the container
    container.insertBefore(canvas, container.firstChild);
}

// Function to generate an array with random numbers between 0 and 3
// noColorRate should be a value between 0 and 1, representing the percentage for no color
function generateLockPattern(pinCount, noColorRate) {
    const pattern = [];
    for (let i = 0; i < pinCount; i++) {
        // Generate a random number between 0 and 1
        const randomValue = Math.random();
        // If the random value is lower than the noColorRate, no color will be assigned (0)
        // Otherwise, a random color index between 1 and 3 will be assigned.
        pattern.push(randomValue < noColorRate ? 0 : Math.floor(Math.random() * 3) + 1);
    }
    return pattern;
}

// Function to create a canvas element and append it to a container element
function createCanvasAndLock(index, pattern, container) {
    const canvasId = 'circleCanvas' + index;
    const canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.style.pointerEvents = 'none'; // Allows click events to pass through the canvas
    const lockSize = LOCK_SIZE + LOCK_SIZE * index;

    // Set the position and size of the canvas to center it
    canvas.style.position = 'absolute';
    canvas.style.left = `calc(50% - ${lockSize / 2}px)`;
    canvas.style.top = `calc(50% - ${lockSize / 2}px)`;

    // Append canvas to the container
    container.appendChild(canvas);

    // Create a new Lock for the canvas
    return new Lock(pattern, lockSize, canvasId);
}

// Function to create and render a new lockpick challenge
function startChallenge(noTimer) {
    // Remove all existing canvases
    while (MINIGAME_ELEM.firstChild) {
        MINIGAME_ELEM.removeChild(MINIGAME_ELEM.firstChild);
    }

    // Create all new locks
    LOCKS.length = 0; // Clear the existing locks array
    for (let i = 0; i < NUMBER_OF_LOCKS; i++) {
        let lockPattern = generateLockPattern(PIN_COUNT, NO_COLOR_RATE);
        let lock = createCanvasAndLock(i, lockPattern, MINIGAME_ELEM);
        LOCKS.push(lock);

        // Randomly rotate lock
        const randomRotations = Math.floor(Math.random() * (PIN_COUNT - 1)) + 1;
        const anglePerSegment = (Math.PI * 2) / PIN_COUNT; // Angle of one segment in radians
        lock.rotationAngle = randomRotations * anglePerSegment; // Set the rotation angle directly
        lock.startAngle = lock.targetAngle = lock.rotationAngle;
        lock.draw(); // Redraw the lock with the updated rotation angle
    }

    // Calculate the outermost circle's radius
    let lastLockSize = LOCK_SIZE + LOCK_SIZE * (NUMBER_OF_LOCKS - 1);
    let innerRadius = lastLockSize * RADIUS_SIZE_RATE;
    let outermostCircleDiameter = innerRadius + CIRCLE_GAP;

    // Draw the background lines after creating all locks
    drawBackgroundLines(MINIGAME_ELEM, outermostCircleDiameter, PIN_COUNT);

    // Resize the container height based on the outermost circle's radius
    MINIGAME_ELEM.style.height = `${outermostCircleDiameter * 2}px`;

    // Start the timer
    if (!noTimer) {
        gameController.startTimer();
    }
}

startChallenge(true);

// You still control the first lock by default or choose to control another
let gameController = new GameController();
gameController.bindControls();
gameController.setCurrentLock(LOCKS[0]);

// Bind the "Unlock" button to switch control to the next ring
UNLOCK_BUTTON_ELEM.addEventListener('click', () => {
    gameController.nextLock();
});

// Show the modal when the game loads
MODAL_ELEM.style.display = 'block';
setButtonsDisabled(true);

START_BUTTON_ELEM.addEventListener('click', () => {
    // Hide the modal
    MODAL_ELEM.style.display = 'none';
    setButtonsDisabled(false);

    // Regenerate all the locks with new random pattern
    startChallenge();

    // Set the first lock as the current lock
    gameController.setCurrentLock(LOCKS[0]);
});

LOCKS_SLIDER_ELEM.addEventListener('input', function(event) {
    const value = event.target.value;
    LOCKS_VALUE_ELEM.textContent = value;
    NUMBER_OF_LOCKS = parseInt(value, 10); // Make sure to parse the value as a number
});

PIN_SLIDER_ELEM.addEventListener('input', function(event) {
    const value = event.target.value;
    PIN_VALUE_ELEM.textContent = value;
    PIN_COUNT = parseInt(value, 10); // Make sure to parse the value as a number
});

TIMER_SLIDER_ELEM.addEventListener('input', function(event) {
    const value = event.target.value;
    TIMER_VALUE_ELEM.textContent = value;
    // Set the timer duration based on the slider value
    gameController.setTimerDuration(parseInt(value, 10));
});

// Dropdown functionality
PRESET_BUTTON_ELEM.addEventListener('click', function() {
    this.classList.toggle('inverse-icon');
    PRESET_DROPDOWN_ELEM.classList.toggle("show");
});

// Handle preset selection
PRESET_DROPDOWN_ELEM.addEventListener('click', function(event) {
    event.preventDefault();

    const preset = event.target.dataset.preset;
    if (preset === 'vehicleLockpick') {
        setSliderValues(4, 12, 20);
    } else if (preset === 'laundromatSafe') {
        setSliderValues(5, 12, 10);
    }

    // Update the button label
    PRESET_BUTTON_ELEM.textContent = event.target.textContent;
});

// Close the dropdown if the user clicks outside of the dropdown
window.addEventListener('click', function(event) {
    if (!event.target.matches('.dropdown-btn')) {
        const dropdowns = document.getElementsByClassName("dropdown-content");
        for (let i = 0; i < dropdowns.length; i++) {
            const openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('show')) {
                openDropdown.classList.remove('show');
            }
        }
        const inverseIcons = document.getElementsByClassName("inverse-icon");
        for (let i = 0; i < inverseIcons.length; i++) {
            const inverseIcon = inverseIcons[i];
            if (inverseIcon.classList.contains('inverse-icon')) {
                inverseIcon.classList.remove('inverse-icon');
            }
        }
    }
});

// Function to set slider values and update their display text
function setSliderValues(locks, pins, timer) {
    LOCKS_SLIDER_ELEM.value = locks;
    LOCKS_VALUE_ELEM.textContent = locks.toString();
    PIN_SLIDER_ELEM.value = pins;
    PIN_VALUE_ELEM.textContent = pins.toString();
    TIMER_SLIDER_ELEM.value = timer;
    TIMER_VALUE_ELEM.textContent = timer.toString();
    NUMBER_OF_LOCKS = locks;
    PIN_COUNT = pins;
    gameController.setTimerDuration(timer);
}

// Function to enable or disable the rotateLeft, rotateRight, and unlock buttons
function setButtonsDisabled(disabled) {
    ROTATE_LEFT_BUTTON_ELEM.disabled = disabled;
    ROTATE_RIGHT_BUTTON_ELEM.disabled = disabled;
    UNLOCK_BUTTON_ELEM.disabled = disabled;
}

// Add event listeners to the sliders to set the preset dropdown to "Custom"
SLIDERS_ELEMS.forEach(function(slider) {
    slider.addEventListener('input', function() {
        PRESET_BUTTON_ELEM.textContent = 'Custom';
    });
});
