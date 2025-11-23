/**
 * GAME CONFIGURATION
 */
const CONFIG = {
    INITIAL_GOLD: 10,
    INITIAL_HP: 30, // 我方血量 30
    KILLS_PER_GOLD: 1,
    
    UNIT_RADIUS: 22,
    BASE_SPEED: 60,
    
    UNITS: {
        ally_green: { 
            type: 'ally_green', cost: 1, hp: 3, atk: 1, speedMult: 1.0, 
            isAlly: true, color: '#00ff00', imgPath: 'img/ally_green.png' 
        },
        ally_blue:  { 
            type: 'ally_blue',  cost: 3, hp: 8, atk: 2, speedMult: 1.5, 
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
        enemy_kamikaze: {
            type: 'enemy_kamikaze', cost: 0, hp: 2, atk: 0, speedMult: 3.5, 
            isAlly: false, color: '#8800ff', imgPath: 'img/enemy_red.png', 
            isKamikaze: true, explosionDmg: 5
        }
    },

    COMBAT_RANGE: 10,
    ATTACK_COOLDOWN: 0.6,
    
    WAVE_INTERVAL: 4,      
    BOSS_APPEAR_TIME: 180, 
};

class FloatingText {
    constructor(text, x, y, color, size = 24, duration = 2.0) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.color = color || '#ff3333';
        this.size = size;
        this.life = duration;
        this.maxLife = duration;
        this.vy = -30; 
    }
    update(dt) {
        this.y += this.vy * dt;
        this.life -= dt;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife); 
        ctx.fillStyle = this.color;
        ctx.font = `bold ${this.size}px "Microsoft YaHei", Arial`;
        ctx.textAlign = "center";
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
        const speed = Math.random() * 120 + 50;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 0.6 + Math.random() * 0.4;
        this.size = 4 + Math.random() * 4;
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

const state = {
    lastTime: 0,
    gameTime: 0,
    isRunning: true,
    gold: CONFIG.INITIAL_GOLD,
    baseHp: CONFIG.INITIAL_HP,
    kills: 0,
    killCounterForGold: 0,
    
    units: [],
    effects: [], 
    images: {},
    
    spawnTimer: 0,
    bossSpawned: false,
    
    bossOverlayTimer: 0,
    msgOverlayTimer: 0,
    
    flags: {
        bossPhase1: false, 
        bossPhase2: false, 
        allyCrisis: false 
    }
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const ui = {
    time: document.getElementById('displayTime'),
    gold: document.getElementById('displayGold'),
    hp: document.getElementById('displayBaseHp'),
    bossHp: document.getElementById('displayBossHp'), 
    kills: document.getElementById('displayKills'),
    btnGreen: document.getElementById('btnSpawnGreen'),
    btnBlue: document.getElementById('btnSpawnBlue'),
    btnRestart: document.getElementById('btnRestartUI'),
    btnRestartOverlay: document.getElementById('btnRestartOverlay'),
    msgOverlay: document.getElementById('messageOverlay'),
    bossOverlay: document.getElementById('bossOverlay'),
    gameOverOverlay: document.getElementById('gameOverOverlay'),
    endTitle: document.getElementById('endTitle'),
    endSubtitle: document.getElementById('endSubtitle'),
    finalStats: document.getElementById('finalStats')
};

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

class Unit {
    constructor(configKey, isBoss = false) {
        const conf = CONFIG.UNITS[configKey];
        
        this.type = configKey;
        this.isAlly = conf.isAlly;
        this.isKamikaze = conf.isKamikaze || false;
        this.isBoss = isBoss;
        
        const centerX = canvas.width / 2;
        this.x = centerX + (Math.random() * 160 - 80); 
        this.y = this.isAlly ? canvas.height - 60 : 60;
        
        this.hp = conf.hp;
        this.maxHp = conf.hp;
        this.atk = conf.atk;
        this.radius = CONFIG.UNIT_RADIUS;
        this.speedMult = conf.speedMult;
        this.color = conf.color;

        if (this.isBoss) {
            this.hp = 20; 
            this.maxHp = 20;
            this.radius = CONFIG.UNIT_RADIUS * 3; 
            this.atk = 2;
            this.speedMult = 0.4; 
            this.x = centerX; 
        }

        let timeMult = 1;
        if (!this.isAlly) timeMult = 1 + (Math.floor(state.gameTime / 60) * 0.1);
        this.speed = CONFIG.BASE_SPEED * this.speedMult * timeMult;
        
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
        state.effects.push(new FloatingText(`-${amount}`, this.x, this.y - this.radius - 10, '#fff', 16, 0.5));
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

        if (!this.isBoss) { 
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 16px Arial'; 
            
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#000'; 
            ctx.strokeText(Math.ceil(this.hp), this.x, this.y);
            
            ctx.fillStyle = '#fff';
            ctx.fillText(Math.ceil(this.hp), this.x, this.y);

            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.lineWidth = 2;
            ctx.strokeStyle = this.isAlly ? '#44ff44' : '#ff4444'; 
            ctx.stroke();
        }
    }
}

function spawnUnit(type, isBoss = false) {
    const u = new Unit(type, isBoss);
    state.units.push(u);
    return u;
}

function spawnExplosion(x, y, color) {
    for(let i=0; i<8; i++) {
        state.effects.push(new Particle(x, y, color));
    }
}

function showBigText(text, color) {
    if(ui.msgOverlay) {
        ui.msgOverlay.innerText = text;
        ui.msgOverlay.style.color = color;
        ui.msgOverlay.classList.remove('hidden');
        state.msgOverlayTimer = 3.5; 
    }
}

function checkSpawns(dt) {
    if (!state.bossSpawned && state.gameTime > CONFIG.BOSS_APPEAR_TIME) {
        state.bossSpawned = true;
        if(ui.bossOverlay) {
            ui.bossOverlay.classList.remove('hidden');
            state.bossOverlayTimer = 4.0; 
        }
        spawnUnit('enemy_red', true); 
        return; 
    }

    state.spawnTimer += dt;
    if (state.spawnTimer >= CONFIG.WAVE_INTERVAL) {
        state.spawnTimer = 0;
        
        const count = 1 + Math.floor(state.gameTime / 60);
        for(let i=0; i<count; i++) {
            const type = (Math.random() < 0.2) ? 'enemy_yellow' : 'enemy_red';
            setTimeout(() => spawnUnit(type), i * 500); 
        }
    }
}

function updateScriptEvents() {
    if (!state.flags.allyCrisis && state.baseHp < 15 && state.baseHp > 0) {
        state.flags.allyCrisis = true;
        showBigText("蓝山心法- 第8式 变身 --- 特斯拉喷气机", "#00ccff");
        setTimeout(() => spawnUnit('ally_blue'), 100);
        setTimeout(() => spawnUnit('ally_blue'), 300);
        setTimeout(() => spawnUnit('ally_blue'), 500);
    }

    const boss = state.units.find(u => u.isBoss && u.hp > 0);
    if (boss) {
        if (!state.flags.bossPhase1 && boss.hp < 15) { 
            state.flags.bossPhase1 = true;
            showBigText("西之呼吸 - 第三式 恶魔微笑", "#ffff00");
            spawnUnit('enemy_yellow');
            setTimeout(() => spawnUnit('enemy_yellow'), 500);
        }

        if (!state.flags.bossPhase2 && boss.hp < 5) {
            state.flags.bossPhase2 = true;
            showBigText("雍之呼吸 - 第一式 百雍夜行", "#aa00ff");
            
            for(let i=0; i<5; i++) spawnUnit('enemy_red');

            const spawnWave = () => {
                for(let i=0; i<10; i++) {
                    setTimeout(() => {
                        const u = spawnUnit('enemy_kamikaze');
                        u.y = boss.y; 
                    }, i * 150);
                }
            };
            spawnWave(); 
            setTimeout(() => { if(state.isRunning) spawnWave(); }, 3000);
        }
    }
}

function update(dt) {
    if (!state.isRunning) return;
    state.gameTime += dt;
    
    if (state.bossOverlayTimer > 0) {
        state.bossOverlayTimer -= dt;
        if (state.bossOverlayTimer <= 0 && ui.bossOverlay) ui.bossOverlay.classList.add('hidden');
    }
    if (state.msgOverlayTimer > 0) {
        state.msgOverlayTimer -= dt;
        if (state.msgOverlayTimer <= 0 && ui.msgOverlay) ui.msgOverlay.classList.add('hidden');
    }

    checkSpawns(dt);
    updateScriptEvents();

    const units = state.units;
    for (let i = 0; i < units.length; i++) {
        let u1 = units[i];
        if (!u1 || u1.hp <= 0) continue;

        let hasTarget = false;

        for (let j = 0; j < units.length; j++) {
            if (i === j) continue;
            let u2 = units[j];
            if (!u2 || u2.hp <= 0) continue;

            if (u1.isAlly !== u2.isAlly) {
                const dist = Math.hypot(u1.x - u2.x, u1.y - u2.y);

                if (u1.isKamikaze && dist < (u1.radius + u2.radius + 15)) {
                    spawnExplosion(u1.x, u1.y, '#aa00ff');
                    u2.takeDamage(u1.explosionDmg);
                    u1.hp = 0; 
                    break; 
                }

                if (dist < (u1.radius + u2.radius + CONFIG.COMBAT_RANGE)) {
                    hasTarget = true;
                    if (u1.attackTimer <= 0) {
                        u2.takeDamage(u1.atk);
                        u1.attackTimer = CONFIG.ATTACK_COOLDOWN;
                    }
                }
            }
        }

        if ((u1.isKamikaze || !hasTarget) && u1.hp > 0) {
            const moveDir = u1.isAlly ? -1 : 1;
            u1.y += u1.speed * moveDir * dt;
            const cx = canvas.width / 2;
            u1.x += (cx - u1.x) * 0.1 * dt; 
        }

        u1.update(dt);
    }

    for (let i = state.effects.length - 1; i >= 0; i--) {
        state.effects[i].update(dt);
        if (state.effects[i].life <= 0) state.effects.splice(i, 1);
    }

    for (let i = units.length - 1; i >= 0; i--) {
        let u = units[i];
        
        if (u.hp <= 0) {
            spawnExplosion(u.x, u.y, u.color);
            if (!u.isAlly) {
                handleEnemyKill();
                if (u.isBoss) {
                    endGame(true); 
                    return;
                }
            }
            units.splice(i, 1);
            continue;
        }

        if (!u.isAlly && u.y > canvas.height + u.radius) {
            state.baseHp -= u.isBoss ? 999 : 1; 
            state.effects.push(new FloatingText(u.isBoss ? "CRITICAL" : "-1 HP", canvas.width/2, canvas.height - 80, '#ff0000', 30));
            units.splice(i, 1);
            if (state.baseHp <= 0) {
                endGame(false); 
                return;
            }
            continue;
        }
        
        if (u.isAlly && u.y < -u.radius) {
            units.splice(i, 1);
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

// 【终极修复】防止任何 UI 缺失导致的崩溃
function updateUI() {
    const m = Math.floor(state.gameTime / 60).toString().padStart(2, '0');
    const s = Math.floor(state.gameTime % 60).toString().padStart(2, '0');
    if(ui.time) ui.time.innerText = `Time ${m}:${s}`;
    if(ui.gold) ui.gold.innerText = `Gold: ${state.gold}`;
    if(ui.hp) ui.hp.innerText = `我方: ${state.baseHp}`;

    if (ui.bossHp) {
        const boss = state.units.find(u => u.isBoss && u.hp > 0);
        if (boss) {
            ui.bossHp.innerText = `BOSS: ${Math.ceil(boss.hp)}/20`;
        } else if (state.bossSpawned) {
            ui.bossHp.innerText = `BOSS: 已击杀`;
        } else {
            ui.bossHp.innerText = `BOSS: 潜伏中...`;
        }
    }

    if(ui.kills) ui.kills.innerText = `Kills: ${state.kills}`;

    if(ui.btnGreen) ui.btnGreen.disabled = state.gold < CONFIG.UNITS.ally_green.cost;
    if(ui.btnBlue) ui.btnBlue.disabled = state.gold < CONFIG.UNITS.ally_blue.cost;
}

function endGame(victory) {
    state.isRunning = false;
    if(ui.gameOverOverlay) ui.gameOverOverlay.classList.remove('hidden');
    
    if (victory) {
        if(ui.endTitle) {
            ui.endTitle.innerText = "独尊蓝山心法";
            ui.endTitle.style.color = "#0088ff";
        }
        if(ui.endSubtitle) ui.endSubtitle.innerText = "BOSS 已被讨伐，天下太平。";
    } else {
        if(ui.endTitle) {
            ui.endTitle.innerText = "菜 就来";
            ui.endTitle.style.color = "#ff4444";
        }
        if(ui.endSubtitle) ui.endSubtitle.innerText = "畅想机器人入学！";
    }
    
    if(ui.finalStats) ui.finalStats.innerText = `Survival: ${Math.floor(state.gameTime)}s | Kills: ${state.kills}`;
}

function restartGame() {
    state.gameTime = 0;
    state.gold = CONFIG.INITIAL_GOLD;
    state.baseHp = CONFIG.INITIAL_HP;
    state.kills = 0;
    state.killCounterForGold = 0;
    state.units = [];
    state.effects = [];
    state.isRunning = true;
    state.spawnTimer = 0;
    state.bossSpawned = false;
    
    state.bossOverlayTimer = 0;
    state.msgOverlayTimer = 0;
    if(ui.bossOverlay) ui.bossOverlay.classList.add('hidden');
    if(ui.msgOverlay) ui.msgOverlay.classList.add('hidden');
    
    state.flags.bossPhase1 = false;
    state.flags.bossPhase2 = false;
    state.flags.allyCrisis = false;

    if(ui.gameOverOverlay) ui.gameOverOverlay.classList.add('hidden');
    state.lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function spawnAlly(type, cost) {
    if (state.gold >= cost) {
        state.gold -= cost;

        if (Math.random() < 0.05) {
            const u = spawnUnit('ally_blue'); 
            u.hp = 10;
            u.maxHp = 10;
            u.radius *= 1.2; 
            u.color = '#ffd700'; 
            
            state.effects.push(new FloatingText("SSR! 超级战士!", u.x, u.y - 30, "#ffd700", 24));
            showBigText("SSR! 欧气爆发!", "#ffd700");
        } else {
            spawnUnit(type);
            if (type === 'ally_blue') {
                 state.effects.push(new FloatingText("蓝山冲撞", canvas.width / 2, canvas.height - 100, "#0088ff", 40));
            }
        }
    }
}

window.addEventListener('keydown', (e) => {
    if(e.key === '1' && ui.btnGreen) ui.btnGreen.click();
    if(e.key === '2' && ui.btnBlue) ui.btnBlue.click();
});

if(ui.btnGreen) {
    ui.btnGreen.addEventListener('click', () => {
        spawnAlly('ally_green', CONFIG.UNITS.ally_green.cost);
    });
}

if(ui.btnBlue) {
    ui.btnBlue.addEventListener('click', () => {
        spawnAlly('ally_blue', CONFIG.UNITS.ally_blue.cost);
    });
}

if(ui.btnRestart) ui.btnRestart.addEventListener('click', restartGame);
if(ui.btnRestartOverlay) ui.btnRestartOverlay.addEventListener('click', restartGame);

function gameLoop(timestamp) {
    // 【修复】处理初始时间差
    if (state.lastTime === 0) state.lastTime = timestamp;
    
    const dt = (timestamp - state.lastTime) / 1000; 
    state.lastTime = timestamp;

    if (dt < 0.1) {
        update(dt);
        draw();
    }
    
    if (state.isRunning) requestAnimationFrame(gameLoop);
}

function draw() {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const roadW = 320;
    const cx = canvas.width / 2;
    ctx.fillStyle = '#111';
    ctx.fillRect(cx - roadW/2, 0, roadW, canvas.height);
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(cx - roadW/2, 0); ctx.lineTo(cx - roadW/2, canvas.height);
    ctx.moveTo(cx + roadW/2, 0); ctx.lineTo(cx + roadW/2, canvas.height);
    ctx.stroke();

    const renderList = [...state.units].sort((a, b) => a.y - b.y);
    renderList.forEach(u => u.draw(ctx));

    state.effects.forEach(e => e.draw(ctx));

    const boss = state.units.find(u => u.isBoss && u.hp > 0);
    if (boss) {
        const barW = canvas.width * 0.6; 
        const barH = 20;
        const startX = (canvas.width - barW) / 2;
        const startY = 20;

        ctx.fillStyle = '#330000';
        ctx.fillRect(startX, startY, barW, barH);
        
        const pct = Math.max(0, boss.hp / boss.maxHp);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(startX, startY, barW * pct, barH);
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, barW, barH);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`BOSS HP: ${Math.ceil(boss.hp)} / ${boss.maxHp}`, canvas.width / 2, startY + 16);
    }
}

loadAssets();
// 不再立即调用 loop，而是等第一帧请求
state.lastTime = 0; 
requestAnimationFrame(gameLoop);
