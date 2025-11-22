/**
 * GAME CONFIGURATION
 * Centralized balance numbers for easy tuning.
 */
const CONFIG = {
    FPS: 60,
    // Canvas Layout
    LANE_COUNT: 3,
    LANE_WIDTH_RATIO: 0.333, // Each lane is 1/3 width
    
    // Economy
    INITIAL_GOLD: 10,
    INITIAL_HP: 10,
    KILLS_PER_GOLD: 2, // Every 2 kills = 1 gold
    
    // Units
    UNIT_RADIUS: 20, // Radius of the circular avatar in pixels
    BASE_SPEED: 60,  // Pixels per second (standard speed)
    
    UNITS: {
        ally_green: { 
            type: 'ally_green', cost: 1, hp: 2, atk: 1, speedMult: 1.0, 
            isAlly: true, color: '#00ff00', imgPath: 'img/ally_green.png' 
        },
        ally_blue:  { 
            type: 'ally_blue',  cost: 3, hp: 4, atk: 2, speedMult: 0.8, 
            isAlly: true, color: '#0088ff', imgPath: 'img/ally_blue.png' 
        },
        enemy_red:  { 
            type: 'enemy_red',  cost: 0, hp: 2, atk: 1, speedMult: 1.0, 
            isAlly: false, color: '#ff0000', imgPath: 'img/enemy_red.png' 
        },
        enemy_yellow: { 
            type: 'enemy_yellow', cost: 0, hp: 4, atk: 2, speedMult: 1.2, 
            isAlly: false, color: '#ffff00', imgPath: 'img/enemy_yellow.png' 
        }
    },

    // Combat
    ATTACK_COOLDOWN: 0.5, // Seconds between hits to prevent instant melting
    COMBAT_RANGE: 5,      // Extra pixels allowed for collision detection
    
    // Spawning
    WAVE_INTERVAL: 5,      // Seconds between regular waves
    HORDE_COOLDOWN: 30,    // Minimum seconds between "Hordes"
    ELITE_START_TIME: 60,  // Seconds before Yellow enemies appear
};

/**
 * GLOBAL STATE
 */
const state = {
    lastTime: 0,
    gameTime: 0,       // Total game time in seconds
    gameOver: false,
    
    gold: CONFIG.INITIAL_GOLD,
    baseHp: CONFIG.INITIAL_HP,
    kills: 0,
    killCounterForGold: 0, // Internal counter to track 1 gold per 2 kills
    
    selectedLane: 1,   // 0, 1, 2 (Start at middle)
    
    spawnTimer: 0,     // Timer for next wave
    hordeTimer: -999,  // Last time horde triggered
    
    units: [],         // Array to store all active Unit objects
    
    images: {}         // Store loaded Image objects
};

// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const ui = {
    time: document.getElementById('displayTime'),
    gold: document.getElementById('displayGold'),
    hp: document.getElementById('displayBaseHp'),
    kills: document.getElementById('displayKills'),
    btnLane: document.querySelectorAll('.btn-lane'),
    btnGreen: document.getElementById('btnSpawnGreen'),
    btnBlue: document.getElementById('btnSpawnBlue'),
    btnRestart: document.getElementById('btnRestartUI'),
    btnRestartOverlay: document.getElementById('btnRestartOverlay'),
    msgOverlay: document.getElementById('messageOverlay'),
    gameOverOverlay: document.getElementById('gameOverOverlay'),
    finalStats: document.getElementById('finalStats')
};

/**
 * ASSET LOADING
 * Preloads images. If image fails, sets a flag to use fallback colors.
 */
function loadAssets() {
    const keys = Object.keys(CONFIG.UNITS);
    let loadedCount = 0;

    keys.forEach(key => {
        const img = new Image();
        img.src = CONFIG.UNITS[key].imgPath;
        
        // On success
        img.onload = () => {
            state.images[key] = { img: img, ready: true };
            loadedCount++;
            if(loadedCount === keys.length) console.log("All assets loaded.");
        };
        
        // On error (fallback)
        img.onerror = () => {
            console.warn(`Failed to load ${key}, falling back to color.`);
            state.images[key] = { img: null, ready: false };
            loadedCount++;
        };
    });
}

/**
 * RESIZE HANDLING
 * Makes canvas fill its container (80vh usually) and fixes coordinate system.
 */
function resize() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}
window.addEventListener('resize', resize);
resize(); // Initial call

/**
 * UNIT CLASS
 */
class Unit {
    constructor(configKey, lane) {
        const conf = CONFIG.UNITS[configKey];
        
        this.type = configKey;
        this.lane = lane; // 0, 1, 2
        
        // X is center of the lane
        const laneWidth = canvas.width / CONFIG.LANE_COUNT;
        this.x = (lane * laneWidth) + (laneWidth / 2);
        
        // Y depends on faction
        this.isAlly = conf.isAlly;
        // Spawn with a little padding from edge
        this.y = this.isAlly ? canvas.height - 40 : 40; 
        
        // Stats
        this.hp = conf.hp;
        this.maxHp = conf.hp;
        this.atk = conf.atk;
        
        // Speed Logic: Enemies get faster over time (+10% every 60s)
        let timeMult = 1;
        if (!this.isAlly) {
            timeMult = 1 + (Math.floor(state.gameTime / 60) * 0.1);
        }
        this.speed = CONFIG.BASE_SPEED * conf.speedMult * timeMult;
        
        this.radius = CONFIG.UNIT_RADIUS;
        this.color = conf.color;
        
        this.attackTimer = 0; // Cooldown timer
        this.markedForDeletion = false;
    }

    update(dt) {
        if (this.hp <= 0) {
            this.markedForDeletion = true;
            return;
        }

        // Reduce attack cooldown
        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
        }

        // Movement (Only move if not colliding/fighting in this simple version? 
        // Actually prompt says: move until overlap, then fight)
        // We will handle stopping logic in the collision loop.
        // Default: assume moving
        let canMove = true;
        
        // Simple check: if fighting, don't move
        // But collision is handled in main loop. Let's move there.
    }

    takeDamage(amount) {
        this.hp -= amount;
        // Optional: Add hit effect visual here
    }

    draw(ctx) {
        // Save context for clipping
        ctx.save();
        
        // Define circular path
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.closePath();
        
        // Clip
        ctx.clip();
        
        const asset = state.images[this.type];
        
        // Draw Image if available
        if (asset && asset.ready) {
            // Draw image centered
            ctx.drawImage(asset.img, 
                this.x - this.radius, 
                this.y - this.radius, 
                this.radius * 2, 
                this.radius * 2
            );
        } else {
            // Fallback Color
            ctx.fillStyle = this.color;
            ctx.fill();
        }
        
        // Restore context (removes clip)
        ctx.restore();

        // Draw HP Ring or Bar (Simple border for now)
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = this.isAlly ? '#fff' : '#000';
        ctx.stroke();
        
        // HP Indicator (Text)
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(Math.ceil(this.hp), this.x, this.y + 4);
    }
}

/**
 * GAME LOGIC
 */

function spawnUnit(type, lane) {
    const u = new Unit(type, lane);
    // Add slight random offset to Y to prevent perfect stacking Z-fighting
    u.y += (Math.random() * 10 - 5); 
    state.units.push(u);
}

function checkWaveLogic(dt) {
    state.spawnTimer += dt;

    // 1. Regular Waves
    if (state.spawnTimer >= CONFIG.WAVE_INTERVAL) {
        state.spawnTimer = 0;
        
        // Formula: 2 + floor(time / 60)
        const count = 2 + Math.floor(state.gameTime / 60);
        
        for(let i=0; i<count; i++) {
            // Random Lane
            const lane = Math.floor(Math.random() * CONFIG.LANE_COUNT);
            
            // Type determination
            let type = 'enemy_red';
            // After 60s, 20% chance for yellow
            if (state.gameTime > CONFIG.ELITE_START_TIME && Math.random() < 0.2) {
                type = 'enemy_yellow';
            }
            
            spawnUnit(type, lane);
        }
    }

    // 2. Horde Logic ("Our Power is too high")
    // Calculate Ally Power
    let powerScore = 0;
    state.units.forEach(u => {
        if(u.isAlly) {
            powerScore += (u.type === 'ally_blue') ? 3 : 1;
        }
    });

    // Threshold: 8 + 3 * floor(time/60)
    const threshold = 8 + 3 * Math.floor(state.gameTime / 60);
    
    // Check trigger
    if (powerScore > threshold && (state.gameTime - state.hordeTimer) > CONFIG.HORDE_COOLDOWN) {
        triggerHorde();
    }
}

function triggerHorde() {
    state.hordeTimer = state.gameTime;
    
    // Show UI Text
    ui.msgOverlay.innerText = "Enemy Wave Incoming!";
    ui.msgOverlay.classList.remove('hidden');
    setTimeout(() => ui.msgOverlay.classList.add('hidden'), 3000);

    // Spawn Horde: 3 Red + 1 Yellow per lane
    for (let l = 0; l < CONFIG.LANE_COUNT; l++) {
        // Stagger spawn slightly so they aren't on top of each other
        setTimeout(() => spawnUnit('enemy_yellow', l), 100);
        setTimeout(() => spawnUnit('enemy_red', l), 400);
        setTimeout(() => spawnUnit('enemy_red', l), 700);
        setTimeout(() => spawnUnit('enemy_red', l), 1000);
    }
}

function update(dt) {
    if (state.gameOver) return;

    state.gameTime += dt;

    // 1. Spawning
    checkWaveLogic(dt);

    // 2. Collision & Combat
    // We check every unit against every other unit in the same lane
    // Note: In a large scale game, use spatial partitioning. For <100 units, O(N^2) is fine.
    
    for (let i = 0; i < state.units.length; i++) {
        let u1 = state.units[i];
        let isFighting = false;

        // Combat Check
        for (let j = 0; j < state.units.length; j++) {
            if (i === j) continue;
            let u2 = state.units[j];

            // Must be in same lane and different factions
            if (u1.lane === u2.lane && u1.isAlly !== u2.isAlly) {
                // Distance check
                const dy = Math.abs(u1.y - u2.y);
                const combinedRadius = u1.radius + u2.radius;
                
                // If touching
                if (dy < combinedRadius) {
                    isFighting = true;
                    
                    // Deal damage if cooldown ready
                    if (u1.attackTimer <= 0) {
                        u2.takeDamage(u1.atk);
                        u1.attackTimer = CONFIG.ATTACK_COOLDOWN;
                    }
                }
            }
        }

        // Movement
        // If not fighting, move forward
        // Direction: Ally moves Up (-y), Enemy moves Down (+y)
        if (!isFighting) {
            const moveDir = u1.isAlly ? -1 : 1;
            u1.y += u1.speed * moveDir * dt;
        }

        u1.update(dt);
    }

    // 3. Cleanup & Base Logic
    // Remove dead units
    // Check for kill rewards
    // Check for base damage
    
    // We filter the array in place or create new one.
    // Let's iterate backwards to remove safely
    for (let i = state.units.length - 1; i >= 0; i--) {
        let u = state.units[i];
        
        // A. Death check
        if (u.hp <= 0) {
            if (!u.isAlly) {
                // Enemy died
                handleEnemyKill();
            }
            state.units.splice(i, 1);
            continue;
        }

        // B. Base Hit Check (Enemy reached bottom)
        if (!u.isAlly && u.y > canvas.height + u.radius) {
            state.baseHp -= 1;
            state.units.splice(i, 1); // Remove unit
            if (state.baseHp <= 0) endGame();
            continue;
        }
        
        // C. Ally Hit Check (Ally reached top - just remove them or keep them? Prompt implies tower defense, usually they despawn or stay. Let's remove to save memory)
        if (u.isAlly && u.y < -u.radius) {
            state.units.splice(i, 1);
            continue;
        }
    }

    updateUI();
}

function handleEnemyKill() {
    state.kills++;
    state.killCounterForGold++;
    
    if (state.killCounterForGold >= CONFIG.KILLS_PER_GOLD) {
        state.gold++;
        state.killCounterForGold = 0; // Reset counter
    }
}

function draw() {
    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Grid
    drawGrid();

    // 2. Draw Units
    state.units.forEach(u => u.draw(ctx));
}

function drawGrid() {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    // Vertical Lane dividers
    const laneWidth = canvas.width / CONFIG.LANE_COUNT;
    
    for (let i = 1; i < CONFIG.LANE_COUNT; i++) {
        ctx.beginPath();
        ctx.moveTo(i * laneWidth, 0);
        ctx.lineTo(i * laneWidth, canvas.height);
        ctx.strokeStyle = '#444'; // Slightly lighter for lanes
        ctx.stroke();
    }

    // Horizontal grid lines (just for visual effect)
    ctx.strokeStyle = '#222';
    const gridSize = 50;
    // Offset grid by time to create a scrolling effect (optional cool factor)
    // Simple static grid:
    for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function updateUI() {
    // Format Time mm:ss
    const m = Math.floor(state.gameTime / 60).toString().padStart(2, '0');
    const s = Math.floor(state.gameTime % 60).toString().padStart(2, '0');
    
    ui.time.innerText = `Time ${m}:${s}`;
    ui.gold.innerText = `Gold: ${state.gold}`;
    ui.hp.innerText = `Base HP: ${state.baseHp}`;
    ui.kills.innerText = `Kills: ${state.kills}`;

    // Button States (Disable if not enough gold)
    ui.btnGreen.disabled = state.gold < CONFIG.UNITS.ally_green.cost;
    ui.btnBlue.disabled = state.gold < CONFIG.UNITS.ally_blue.cost;
}

function endGame() {
    state.gameOver = true;
    ui.gameOverOverlay.classList.remove('hidden');
    ui.finalStats.innerText = `You survived for ${Math.floor(state.gameTime)}s and defeated ${state.kills} enemies.`;
}

function restartGame() {
    state.gameTime = 0;
    state.gold = CONFIG.INITIAL_GOLD;
    state.baseHp = CONFIG.INITIAL_HP;
    state.kills = 0;
    state.killCounterForGold = 0;
    state.units = [];
    state.gameOver = false;
    state.spawnTimer = 0;
    state.hordeTimer = -999;

    ui.gameOverOverlay.classList.add('hidden');
    ui.msgOverlay.classList.add('hidden');
    
    // Reset Loop
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

/**
 * INPUT HANDLING
 */

// Lane Selectors
ui.btnLane.forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Remove active class from all
        ui.btnLane.forEach(b => b.classList.remove('active'));
        // Add to clicked
        e.target.classList.add('active');
        // Update state
        state.selectedLane = parseInt(e.target.getAttribute('data-lane'));
    });
});

// Spawn Buttons
ui.btnGreen.addEventListener('click', () => {
    const cost = CONFIG.UNITS.ally_green.cost;
    if (state.gold >= cost) {
        state.gold -= cost;
        spawnUnit('ally_green', state.selectedLane);
    }
});

ui.btnBlue.addEventListener('click', () => {
    const cost = CONFIG.UNITS.ally_blue.cost;
    if (state.gold >= cost) {
        state.gold -= cost;
        spawnUnit('ally_blue', state.selectedLane);
    }
});

// Restart Buttons
ui.btnRestart.addEventListener('click', restartGame);
ui.btnRestartOverlay.addEventListener('click', restartGame);

/**
 * MAIN LOOP
 */
function gameLoop(timestamp) {
    const dt = (timestamp - state.lastTime) / 1000; // Delta time in seconds
    state.lastTime = timestamp;

    // Cap dt to prevent huge jumps if tab is inactive
    if (dt < 0.1) {
        update(dt);
    }
    
    draw();

    if (!state.gameOver) {
        requestAnimationFrame(gameLoop);
    }
}

// Start
loadAssets();
state.lastTime = performance.now();
requestAnimationFrame(gameLoop);
