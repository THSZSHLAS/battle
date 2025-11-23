/**
 * GAME CONFIGURATION
 */
const CONFIG = {
    // Single Lane Mode
    LANE_COUNT: 1, 
    
    // Economy & Stats
    INITIAL_GOLD: 10,
    INITIAL_HP: 20, 
    KILLS_PER_GOLD: 1,
    
    // Unit Basics
    UNIT_RADIUS: 22,
    BASE_SPEED: 60,
    
    // Unit Types
    UNITS: {
        ally_green: { 
            type: 'ally_green', cost: 1, hp: 3, atk: 1, speedMult: 1.0, 
            isAlly: true, color: '#00ff00', imgPath: 'img/ally_green.png' 
        },
        ally_blue:  { 
            type: 'ally_blue',  cost: 3, hp: 6, atk: 2, speedMult: 0.8, 
            isAlly: true, color: '#0088ff', imgPath: 'img/ally_blue.png' 
        },
        enemy_red:  { 
            type: 'enemy_red',  cost: 0, hp: 3, atk: 1, speedMult: 1.0, 
            isAlly: false, color: '#ff0000', imgPath: 'img/enemy_red.png' 
        },
        enemy_yellow: { 
            type: 'enemy_yellow', cost: 0, hp: 6, atk: 2, speedMult: 1.2, 
            isAlly: false, color: '#ffff00', imgPath: 'img/enemy_yellow.png' 
        },
        // Kamikaze Unit
        enemy_kamikaze: {
            type: 'enemy_kamikaze', cost: 0, hp: 2, atk: 0, speedMult: 3.0, // Very Fast
            isAlly: false, color: '#8800ff', imgPath: 'img/enemy_red.png', // Uses red image tint or fallback
            isKamikaze: true, explosionDmg: 5
        }
    },

    COMBAT_RANGE: 10,
    ATTACK_COOLDOWN: 0.6,
    
    // Spawning
    WAVE_INTERVAL: 4,      
    BOSS_INTERVAL: 180,    
};

/**
 * VISUAL EFFECTS CLASSES
 */
class FloatingText {
    constructor(text, x, y, color, size = 20) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.color = color || '#ff3333';
        this.size = size;
        this.life = 1.5; // Seconds
        this.vy = -30;   // Float up speed
    }
    update(dt) {
        this.y += this.vy * dt;
        this.life -= dt;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.font = `bold ${this.size}px Arial`;
        ctx.textAlign = "center"; // Center align text
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 100 + 50;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 0.5 + Math.random() * 0.3;
        this.size = 3 + Math.random() * 3;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        this.size *= 0.95; 
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }
}

/**
 * GLOBAL STATE
 */
const state = {
    lastTime: 0,
    gameTime: 0,
    gameOver: false,
    gold: CONFIG.INITIAL_GOLD,
    baseHp: CONFIG.INITIAL_HP,
    kills: 0,
    killCounterForGold: 0,
    
    units: [],
    effects: [], 
    images: {},
    
    spawnTimer: 0,
    nextBossTime: CONFIG.BOSS_INTERVAL,
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const ui = {
    time: document.getElementById('displayTime'),
    gold: document.getElementById('displayGold'),
    hp: document.getElementById('displayBaseHp'),
    kills: document.getElementById('displayKills'),
    btnGreen: document.getElementById('btnSpawnGreen'),
    btnBlue: document.getElementById('btnSpawnBlue'),
    btnRestart: document.getElementById('btnRestartUI'),
    btnRestartOverlay: document.getElementById('btnRestartOverlay'),
    msgOverlay: document.getElementById('messageOverlay'),
    bossOverlay: document.getElementById('bossOverlay'),
    gameOverOverlay: document.getElementById('gameOverOverlay'),
    finalStats: document.getElementById('finalStats')
};

/**
 * ASSET LOADING
 */
function loadAssets() {
    const keys = Object.keys(CONFIG.UNITS);
    keys.forEach(key => {
        const img = new Image();
        img.src = CONFIG.UNITS[key].imgPath;
        img.onload = () => { state.images[key] = { img: img, ready: true }; };
        img.onerror = () => { state.images[key] = { img: null, ready: false }; };
    });
}

function resize() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}
window.addEventListener('resize', resize);
resize();

/**
 * UNIT CLASS
 */
class Unit {
    constructor(configKey, isBoss = false) {
        const conf = CONFIG.UNITS[configKey];
        
        this.type = configKey;
        this.isAlly = conf.isAlly;
        this.isKamikaze = conf.isKamikaze || false;
        this.isBoss = isBoss;
        
        // Positioning
        const centerX = canvas.width / 2;
        this.x = centerX + (Math.random() * 160 - 80); 
        this.y = this.isAlly ? canvas.height - 50 : 50;
        
        // Stats
        this.hp = conf.hp;
        this.maxHp = conf.hp;
        this.atk = conf.atk;
        
        // Speed scaling
        let timeMult = 1;
        if (!this.isAlly) timeMult = 1 + (Math.floor(state.gameTime / 60) * 0.15);
        this.speed = CONFIG.BASE_SPEED * conf.speedMult * timeMult;
        
        this.radius = CONFIG.UNIT_RADIUS;
        this.color = conf.color;
        
        if (this.isBoss) {
            this.hp *= 20; 
            this.maxHp = this.hp;
            this.radius *= 3; 
            this.atk *= 2;
            this.speed *= 0.5; 
            this.x = centerX; 
        }
        
        this.attackTimer = 0;
        this.hitFlashTimer = 0; 
    }

    update(dt) {
        if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
        if (this.attackTimer > 0) this.attackTimer -= dt;
    }

    takeDamage(amount) {
        this.hp -= amount;
        this.hitFlashTimer = 0.1; 
        state.effects.push(new FloatingText(`-${amount}`, this.x, this.y - this.radius - 10));
    }

    draw(ctx) {
        ctx.save();
        
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.closePath();
        
        if (this.hitFlashTimer > 0) {
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        } else {
            ctx.clip();
            const asset = state.images[this.type];
            if (asset && asset.ready) {
                ctx.drawImage(asset.img, 
                    this.x - this.radius, this.y - this.radius, 
                    this.radius * 2, this.radius * 2
                );
            } else {
                ctx.fillStyle = this.isKamikaze ? '#8800ff' : this.color;
                ctx.fill();
            }
        }
        ctx.restore();

        // HP Bar/Ring
        if (this.isBoss) {
            const barW = 100;
            const barH = 10;
            const pct = Math.max(0, this.hp / this.maxHp);
            ctx.fillStyle = '#330000';
            ctx.fillRect(this.x - barW/2, this.y - this.radius - 20, barW, barH);
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(this.x - barW/2, this.y - this.radius - 20, barW * pct, barH);
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(this.x - barW/2, this.y - this.radius - 20, barW, barH);
        } else {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.lineWidth = 2;
            ctx.strokeStyle = this.isAlly ? '#fff' : '#000';
            ctx.stroke();
        }
    }
}

/**
 * GAME LOGIC
 */

function spawnUnit(type, isBoss = false) {
    const u = new Unit(type, isBoss);
    state.units.push(u);

    // 【新增特效文字逻辑】
    if (type === 'enemy_kamikaze') {
        state.effects.push(new FloatingText("道士下山！", canvas.width / 2, canvas.height / 2, "#d400ff", 40));
    }
    // 注意：蓝山冲撞的逻辑在按钮点击事件里，因为那里才确认是玩家生成的
}

function spawnExplosion(x, y, color) {
    for(let i=0; i<8; i++) {
        state.effects.push(new Particle(x, y, color));
    }
}

function checkSpawns(dt) {
    if (state.gameTime > state.nextBossTime) {
        state.nextBossTime += CONFIG.BOSS_INTERVAL;
        ui.bossOverlay.classList.remove('hidden');
        setTimeout(() => ui.bossOverlay.classList.add('hidden'), 4000);
        
        const bossType = Math.random() < 0.5 ? 'enemy_red' : 'enemy_yellow';
        spawnUnit(bossType, true);
        return; 
    }

    state.spawnTimer += dt;
    if (state.spawnTimer >= CONFIG.WAVE_INTERVAL) {
        state.spawnTimer = 0;
        
        const baseCount = 2 + Math.floor(state.gameTime / 45);
        
        for(let i=0; i<baseCount; i++) {
            const r = Math.random();
            let type = 'enemy_red';
            
            if (state.gameTime > 60 && r < 0.2) type = 'enemy_yellow';
            // 20% 概率刷出道士（自爆兵），前提是游戏时间超过 30秒
            if (state.gameTime > 30 && r > 0.8) type = 'enemy_kamikaze'; 
            
            setTimeout(() => spawnUnit(type), i * 300); 
        }
    }
}

function update(dt) {
    if (state.gameOver) return;
    state.gameTime += dt;
    checkSpawns(dt);

    // 修复 Bug 的关键：在循环中做安全检查，防止 undefined
    for (let i = 0; i < state.units.length; i++) {
        let u1 = state.units[i];
        if (!u1 || u1.hp <= 0) continue; // Skip dead/invalid

        let hasTarget = false;

        // Find nearest enemy
        for (let j = 0; j < state.units.length; j++) {
            if (i === j) continue;
            let u2 = state.units[j];
            if (!u2 || u2.hp <= 0) continue; // Safety Check

            if (u1.isAlly !== u2.isAlly) {
                const dx = u1.x - u2.x;
                const dy = u1.y - u2.y;
                const dist = Math.sqrt(dx*dx + dy*dy);

                // Kamikaze Logic
                if (u1.isKamikaze && dist < (u1.radius + u2.radius + 10)) {
                    spawnExplosion(u1.x, u1.y, '#aa00ff');
                    u2.takeDamage(u1.explosionDmg);
                    u1.hp = 0; 
                    break; 
                }

                // Normal Combat
                if (dist < (u1.radius + u2.radius + CONFIG.COMBAT_RANGE)) {
                    hasTarget = true;
                    if (u1.attackTimer <= 0) {
                        u2.takeDamage(u1.atk);
                        u1.attackTimer = CONFIG.ATTACK_COOLDOWN;
                    }
                }
            }
        }

        // Movement
        if ((u1.isKamikaze || !hasTarget) && u1.hp > 0) {
            const moveDir = u1.isAlly ? -1 : 1;
            u1.y += u1.speed * moveDir * dt;
            const centerX = canvas.width / 2;
            u1.x += (centerX - u1.x) * 0.1 * dt; 
        }

        u1.update(dt);
    }

    // Effects Update
    for (let i = state.effects.length - 1; i >= 0; i--) {
        state.effects[i].update(dt);
        if (state.effects[i].life <= 0) {
            state.effects.splice(i, 1);
        }
    }

    // Cleanup Dead Units
    for (let i = state.units.length - 1; i >= 0; i--) {
        let u = state.units[i];
        
        if (u.hp <= 0) {
            spawnExplosion(u.x, u.y, u.color);
            if (!u.isAlly) handleEnemyKill();
            state.units.splice(i, 1);
            continue;
        }

        // Base Hit
        if (!u.isAlly && u.y > canvas.height + u.radius) {
            state.baseHp -= u.isBoss ? 10 : 1;
            state.effects.push(new FloatingText(u.isBoss ? "-10 HP" : "-1 HP", canvas.width/2, canvas.height - 100, '#ff0000', 30));
            state.units.splice(i, 1);
            if (state.baseHp <= 0) endGame();
            continue;
        }
        // Ally Exit
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
        state.killCounterForGold = 0;
    }
}

function updateUI() {
    const m = Math.floor(state.gameTime / 60).toString().padStart(2, '0');
    const s = Math.floor(state.gameTime % 60).toString().padStart(2, '0');
    ui.time.innerText = `Time ${m}:${s}`;
    ui.gold.innerText = `Gold: ${state.gold}`;
    ui.hp.innerText = `Base HP: ${state.baseHp}`;
    ui.kills.innerText = `Kills: ${state.kills}`;

    ui.btnGreen.disabled = state.gold < CONFIG.UNITS.ally_green.cost;
    ui.btnBlue.disabled = state.gold < CONFIG.UNITS.ally_blue.cost;
}

function draw() {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Road
    const roadW = 300;
    const cx = canvas.width / 2;
    ctx.fillStyle = '#111';
    ctx.fillRect(cx - roadW/2, 0, roadW, canvas.height);
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(cx - roadW/2, 0); ctx.lineTo(cx - roadW/2, canvas.height);
    ctx.moveTo(cx + roadW/2, 0); ctx.lineTo(cx + roadW/2, canvas.height);
    ctx.stroke();

    // 【关键修复】：这里使用 [...state.units] 创建副本再排序
    // 之前直接 sort 会打乱 state.units 的原始顺序，导致 update 循环中索引错乱产生 undefined
    const renderList = [...state.units].sort((a, b) => a.y - b.y);
    renderList.forEach(u => u.draw(ctx));

    state.effects.forEach(e => e.draw(ctx));
}

function endGame() {
    state.gameOver = true;
    ui.gameOverOverlay.classList.remove('hidden');
    ui.finalStats.innerText = `Survived: ${Math.floor(state.gameTime)}s | Kills: ${state.kills}`;
}

function restartGame() {
    state.gameTime = 0;
    state.gold = CONFIG.INITIAL_GOLD;
    state.baseHp = CONFIG.INITIAL_HP;
    state.kills = 0;
    state.killCounterForGold = 0;
    state.units = [];
    state.effects = [];
    state.gameOver = false;
    state.spawnTimer = 0;
    state.nextBossTime = CONFIG.BOSS_INTERVAL;

    ui.gameOverOverlay.classList.add('hidden');
    ui.bossOverlay.classList.add('hidden');
    ui.msgOverlay.classList.add('hidden');
    
    state.lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// Controls
window.addEventListener('keydown', (e) => {
    if(e.key === '1') ui.btnGreen.click();
    if(e.key === '2') ui.btnBlue.click();
});

ui.btnGreen.addEventListener('click', () => {
    if (state.gold >= CONFIG.UNITS.ally_green.cost) {
        state.gold -= CONFIG.UNITS.ally_green.cost;
        spawnUnit('ally_green');
    }
});

ui.btnBlue.addEventListener('click', () => {
    if (state.gold >= CONFIG.UNITS.ally_blue.cost) {
        state.gold -= CONFIG.UNITS.ally_blue.cost;
        spawnUnit('ally_blue');
        // 【新增特效文字】蓝山冲撞
        state.effects.push(new FloatingText("蓝山冲撞", canvas.width / 2, canvas.height / 2, "#0088ff", 40));
    }
});

ui.btnRestart.addEventListener('click', restartGame);
ui.btnRestartOverlay.addEventListener('click', restartGame);

// Main Loop
function gameLoop(timestamp) {
    const dt = (timestamp - state.lastTime) / 1000; 
    state.lastTime = timestamp;

    if (dt < 0.1) {
        update(dt);
        draw();
    }
    
    if (!state.gameOver) requestAnimationFrame(gameLoop);
}

loadAssets();
state.lastTime = performance.now();
requestAnimationFrame(gameLoop);
