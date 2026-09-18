import { getAnimation } from './animations.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
export class TamagotchiManager {
    dataDir;
    tamagotchi = null;
    constructor() {
        this.dataDir = process.env.TAMAGOTCHI_DATA_DIR || join(homedir(), '.tamagotchi');
        this.ensureDataDir();
    }
    ensureDataDir() {
        try {
            if (!existsSync(this.dataDir)) {
                const fs = require('fs');
                fs.mkdirSync(this.dataDir, { recursive: true });
            }
        }
        catch (error) {
            console.warn('Could not create data directory, using memory-only mode');
        }
    }
    getDataPath() {
        return join(this.dataDir, 'tamagotchi.json');
    }
    saveState() {
        if (!this.tamagotchi)
            return;
        try {
            writeFileSync(this.getDataPath(), JSON.stringify(this.tamagotchi, null, 2));
        }
        catch (error) {
            console.warn('Could not save tamagotchi state:', error);
        }
    }
    loadState() {
        try {
            if (existsSync(this.getDataPath())) {
                const data = readFileSync(this.getDataPath(), 'utf8');
                return JSON.parse(data);
            }
        }
        catch (error) {
            console.warn('Could not load tamagotchi state:', error);
        }
        return null;
    }
    createTamagotchi(name, species) {
        const newTamagotchi = {
            id: Math.random().toString(36).substring(7),
            name,
            species: species || 'mametchi',
            age: 0,
            stage: 'egg',
            stats: {
                hunger: 50,
                happiness: 50,
                health: 100,
                energy: 50,
                cleanliness: 100,
                discipline: 0
            },
            lastInteraction: Date.now(),
            birthTime: Date.now(),
            isSick: false,
            isSleeping: false,
            mood: 'happy',
            evolutionPoints: 0
        };
        this.tamagotchi = newTamagotchi;
        this.saveState();
        return {
            success: true,
            message: `🥚 ${name} has been created! Your Tamagotchi is still an egg. Take good care of it!`,
            animation: getAnimation('egg'),
            mood: 'happy'
        };
    }
    getTamagotchi() {
        if (!this.tamagotchi) {
            this.tamagotchi = this.loadState();
        }
        if (this.tamagotchi) {
            this.updateTamagotchi();
        }
        return this.tamagotchi;
    }
    updateTamagotchi() {
        if (!this.tamagotchi)
            return;
        const now = Date.now();
        const timePassed = now - this.tamagotchi.lastInteraction;
        const hoursPass = Math.floor(timePassed / (1000 * 60 * 60));
        if (hoursPass > 0) {
            this.tamagotchi.stats.hunger = Math.max(0, this.tamagotchi.stats.hunger - hoursPass * 2);
            this.tamagotchi.stats.happiness = Math.max(0, this.tamagotchi.stats.happiness - hoursPass);
            this.tamagotchi.stats.energy = Math.max(0, this.tamagotchi.stats.energy - hoursPass);
            this.tamagotchi.stats.cleanliness = Math.max(0, this.tamagotchi.stats.cleanliness - hoursPass);
            this.updateMood();
            this.checkEvolution();
            this.checkHealth();
        }
        this.tamagotchi.age = Math.floor((now - this.tamagotchi.birthTime) / (1000 * 60 * 60 * 24));
        this.tamagotchi.lastInteraction = now;
        this.saveState();
    }
    updateMood() {
        if (!this.tamagotchi)
            return;
        const stats = this.tamagotchi.stats;
        if (this.tamagotchi.isSick) {
            this.tamagotchi.mood = 'sick';
        }
        else if (this.tamagotchi.isSleeping) {
            this.tamagotchi.mood = 'tired';
        }
        else if (stats.happiness > 80 && stats.hunger > 70) {
            this.tamagotchi.mood = 'excited';
        }
        else if (stats.happiness > 60) {
            this.tamagotchi.mood = 'happy';
        }
        else if (stats.happiness < 30 || stats.hunger < 30) {
            this.tamagotchi.mood = 'sad';
        }
        else if (stats.energy < 30) {
            this.tamagotchi.mood = 'tired';
        }
        else {
            this.tamagotchi.mood = 'happy';
        }
    }
    checkEvolution() {
        if (!this.tamagotchi)
            return;
        const age = this.tamagotchi.age;
        const avgStats = Object.values(this.tamagotchi.stats).reduce((a, b) => a + b) / 6;
        if (this.tamagotchi.stage === 'egg' && age >= 1) {
            this.tamagotchi.stage = 'baby';
            this.tamagotchi.evolutionPoints += 10;
        }
        else if (this.tamagotchi.stage === 'baby' && age >= 3) {
            this.tamagotchi.stage = 'child';
            this.tamagotchi.evolutionPoints += 15;
        }
        else if (this.tamagotchi.stage === 'child' && age >= 7) {
            this.tamagotchi.stage = 'teen';
            this.tamagotchi.evolutionPoints += 20;
        }
        else if (this.tamagotchi.stage === 'teen' && age >= 14) {
            this.tamagotchi.stage = 'adult';
            this.tamagotchi.evolutionPoints += 25;
        }
        else if (this.tamagotchi.stage === 'adult' && age >= 30) {
            this.tamagotchi.stage = 'elder';
            this.tamagotchi.evolutionPoints += 30;
        }
    }
    checkHealth() {
        if (!this.tamagotchi)
            return;
        const stats = this.tamagotchi.stats;
        if (stats.hunger < 20 || stats.happiness < 20 || stats.cleanliness < 20) {
            if (Math.random() < 0.3) {
                this.tamagotchi.isSick = true;
                stats.health = Math.max(0, stats.health - 10);
            }
        }
        if (stats.health < 50 && !this.tamagotchi.isSick) {
            this.tamagotchi.isSick = true;
        }
    }
    feed(foodType = 'meal') {
        if (!this.tamagotchi) {
            return { success: false, message: 'No Tamagotchi found! Create one first.' };
        }
        if (this.tamagotchi.isSleeping) {
            return { success: false, message: `${this.tamagotchi.name} is sleeping! Wake them up first.` };
        }
        const effects = {
            meal: { hunger: 25, happiness: 5 },
            snack: { hunger: 10, happiness: 15 },
            treat: { hunger: 5, happiness: 25 },
            medicine: { hunger: -5, happiness: -10, health: 30 }
        };
        const effect = effects[foodType];
        this.tamagotchi.stats.hunger = Math.min(100, this.tamagotchi.stats.hunger + effect.hunger);
        this.tamagotchi.stats.happiness = Math.min(100, this.tamagotchi.stats.happiness + effect.happiness);
        if (effect.health) {
            this.tamagotchi.stats.health = Math.min(100, this.tamagotchi.stats.health + effect.health);
            if (foodType === 'medicine') {
                this.tamagotchi.isSick = false;
            }
        }
        this.updateMood();
        this.saveState();
        const messages = {
            meal: `${this.tamagotchi.name} enjoyed their meal! 🍽️`,
            snack: `${this.tamagotchi.name} loved the snack! 🍪`,
            treat: `${this.tamagotchi.name} is delighted with the treat! 🍭`,
            medicine: `${this.tamagotchi.name} feels much better after the medicine! 💊`
        };
        return {
            success: true,
            message: messages[foodType],
            newStats: this.tamagotchi.stats,
            animation: getAnimation(this.tamagotchi.stage, 'eating'),
            mood: this.tamagotchi.mood
        };
    }
    play(playType = 'ball') {
        if (!this.tamagotchi) {
            return { success: false, message: 'No Tamagotchi found! Create one first.' };
        }
        if (this.tamagotchi.isSleeping) {
            return { success: false, message: `${this.tamagotchi.name} is sleeping! Wake them up first.` };
        }
        if (this.tamagotchi.stats.energy < 20) {
            return { success: false, message: `${this.tamagotchi.name} is too tired to play! Let them rest.` };
        }
        const effects = {
            ball: { happiness: 20, energy: -15 },
            music: { happiness: 25, energy: -10 },
            dance: { happiness: 30, energy: -20, discipline: 5 },
            puzzle: { happiness: 15, energy: -5, discipline: 10 }
        };
        const effect = effects[playType];
        this.tamagotchi.stats.happiness = Math.min(100, this.tamagotchi.stats.happiness + effect.happiness);
        this.tamagotchi.stats.energy = Math.max(0, this.tamagotchi.stats.energy + effect.energy);
        if (effect.discipline) {
            this.tamagotchi.stats.discipline = Math.min(100, this.tamagotchi.stats.discipline + effect.discipline);
        }
        this.tamagotchi.evolutionPoints += 2;
        this.updateMood();
        this.saveState();
        const messages = {
            ball: `${this.tamagotchi.name} had fun playing ball! ⚽`,
            music: `${this.tamagotchi.name} danced to the music! 🎵`,
            dance: `${this.tamagotchi.name} loved dancing with you! 💃`,
            puzzle: `${this.tamagotchi.name} solved the puzzle! 🧩`
        };
        return {
            success: true,
            message: messages[playType],
            newStats: this.tamagotchi.stats,
            animation: getAnimation(this.tamagotchi.stage, 'playing'),
            mood: this.tamagotchi.mood
        };
    }
    clean() {
        if (!this.tamagotchi) {
            return { success: false, message: 'No Tamagotchi found! Create one first.' };
        }
        if (this.tamagotchi.stats.cleanliness > 80) {
            return { success: false, message: `${this.tamagotchi.name} is already clean!` };
        }
        this.tamagotchi.stats.cleanliness = 100;
        this.tamagotchi.stats.happiness = Math.min(100, this.tamagotchi.stats.happiness + 10);
        this.tamagotchi.stats.health = Math.min(100, this.tamagotchi.stats.health + 5);
        this.updateMood();
        this.saveState();
        return {
            success: true,
            message: `${this.tamagotchi.name} is now sparkling clean! ✨`,
            newStats: this.tamagotchi.stats,
            animation: getAnimation(this.tamagotchi.stage, 'happy'),
            mood: this.tamagotchi.mood
        };
    }
    sleep() {
        if (!this.tamagotchi) {
            return { success: false, message: 'No Tamagotchi found! Create one first.' };
        }
        if (this.tamagotchi.isSleeping) {
            return { success: false, message: `${this.tamagotchi.name} is already sleeping! 💤` };
        }
        this.tamagotchi.isSleeping = true;
        this.tamagotchi.stats.energy = Math.min(100, this.tamagotchi.stats.energy + 50);
        this.updateMood();
        this.saveState();
        return {
            success: true,
            message: `${this.tamagotchi.name} is now sleeping peacefully! 💤`,
            newStats: this.tamagotchi.stats,
            animation: getAnimation(this.tamagotchi.stage, 'sleeping'),
            mood: 'tired'
        };
    }
    wake() {
        if (!this.tamagotchi) {
            return { success: false, message: 'No Tamagotchi found! Create one first.' };
        }
        if (!this.tamagotchi.isSleeping) {
            return { success: false, message: `${this.tamagotchi.name} is already awake!` };
        }
        this.tamagotchi.isSleeping = false;
        this.tamagotchi.stats.energy = 100;
        this.updateMood();
        this.saveState();
        return {
            success: true,
            message: `${this.tamagotchi.name} is now awake and refreshed! ☀️`,
            newStats: this.tamagotchi.stats,
            animation: getAnimation(this.tamagotchi.stage, this.tamagotchi.mood),
            mood: this.tamagotchi.mood
        };
    }
    getStatus() {
        if (!this.tamagotchi) {
            return 'No Tamagotchi found! Create one first with the create_tamagotchi tool.';
        }
        this.updateTamagotchi();
        const stats = this.tamagotchi.stats;
        const animation = getAnimation(this.tamagotchi.stage, this.tamagotchi.mood);
        const statusBars = {
            hunger: '🍽️ ' + '█'.repeat(Math.floor(stats.hunger / 10)) + '░'.repeat(10 - Math.floor(stats.hunger / 10)),
            happiness: '😊 ' + '█'.repeat(Math.floor(stats.happiness / 10)) + '░'.repeat(10 - Math.floor(stats.happiness / 10)),
            health: '❤️ ' + '█'.repeat(Math.floor(stats.health / 10)) + '░'.repeat(10 - Math.floor(stats.health / 10)),
            energy: '⚡ ' + '█'.repeat(Math.floor(stats.energy / 10)) + '░'.repeat(10 - Math.floor(stats.energy / 10)),
            cleanliness: '✨ ' + '█'.repeat(Math.floor(stats.cleanliness / 10)) + '░'.repeat(10 - Math.floor(stats.cleanliness / 10)),
            discipline: '🎯 ' + '█'.repeat(Math.floor(stats.discipline / 10)) + '░'.repeat(10 - Math.floor(stats.discipline / 10))
        };
        const statusIcon = this.tamagotchi.isSick ? '🤒' :
            this.tamagotchi.isSleeping ? '💤' :
                this.tamagotchi.mood === 'happy' ? '😊' :
                    this.tamagotchi.mood === 'sad' ? '😢' :
                        this.tamagotchi.mood === 'excited' ? '🤩' :
                            this.tamagotchi.mood === 'tired' ? '😴' : '😐';
        return `
${animation}

🐣 Name: ${this.tamagotchi.name} ${statusIcon}
🧬 Species: ${this.tamagotchi.species}
📅 Age: ${this.tamagotchi.age} days
🌱 Stage: ${this.tamagotchi.stage}
😊 Mood: ${this.tamagotchi.mood}
🏆 Evolution Points: ${this.tamagotchi.evolutionPoints}

Stats:
${statusBars.hunger} (${stats.hunger}/100)
${statusBars.happiness} (${stats.happiness}/100)  
${statusBars.health} (${stats.health}/100)
${statusBars.energy} (${stats.energy}/100)
${statusBars.cleanliness} (${stats.cleanliness}/100)
${statusBars.discipline} (${stats.discipline}/100)

Status: ${this.tamagotchi.isSick ? 'Sick 🤒' : this.tamagotchi.isSleeping ? 'Sleeping 💤' : 'Awake ☀️'}
    `.trim();
    }
}
