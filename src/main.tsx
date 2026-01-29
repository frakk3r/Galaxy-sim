/**
 * =============================================================================
 * MAIN.TSX - Entry point principale del gioco
 * =============================================================================
 */

// React
import React from 'react';
import { createRoot } from 'react-dom/client';

// Engine
import { World } from './engine/ecs/World';
import { EventBus } from './engine/events/EventBus';
import GameLoop from './engine/loop/GameLoop';

import { 
    MovementSystem, 
    InputSystem, 
    InputAction,
    CollisionSystem, 
    PhysicsSystem,
    AISystem,
    CombatSystem,
    ParticleSystem,
    InventorySystem,
    StationSystem,
    ForceFieldSystem,
    TradeSystem
} from './engine/systems';

import { RenderSystem } from './rendering/RenderSystem';

// Components
import { 
    createTransform, 
    createVelocity, 
    createRenderable,
    createCollider,
    createPhysics,
    createHealth,
    createShipHull,
    createShipEngine,
    createShipReactor,
    createShipShield,
    createShipWeapon,
    createFaction,
    createCargo,
    createTradeShip,
    SHAPE_PRESETS,
    COLLIDER_PRESETS,
    PHYSICS_PRESETS,
    HEALTH_PRESETS,
    HULL_PRESETS,
    ENGINE_PRESETS,
    REACTOR_PRESETS,
    SHIELD_PRESETS,
    WEAPON_PRESETS,
    CARGO_PRESETS,
    CollisionLayer,
    createAIController,
    createStationComponent,
    createDocking,
    createForceField,
    AIState,
    AITargetType,
    DockStatus
} from './game/components';

// UI
import { App } from './ui/App';
import './ui/styles.css';
import { EntityId, IWorld } from './engine/ecs/types';
import { TransformComponent } from './game/components/Transform';
import { VelocityComponent } from './game/components/Velocity';
import { ShipEngineComponent } from './game/components/ShipEngine';
import { ShipReactorComponent } from './game/components/ShipReactor';

// ============================================================================
// INIZIALIZZAZIONE ENGINE
// ============================================================================

console.log('=== Space Sim 2D - Avvio ===');

// Crea l'Event Bus (sistema di comunicazione globale)
const eventBus = new EventBus();

// Crea il World (container ECS principale)
const world = new World(eventBus);

// Ottieni riferimento al canvas
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) {
    throw new Error('Canvas non trovato');
}

// ============================================================================
// REGISTRAZIONE SISTEMI
// ============================================================================

// InputSystem - gestisce input (priorità più alta)
const inputSystem = new InputSystem(document);
world.registerSystem(inputSystem);

// MovementSystem - gestisce movimento entità
world.registerSystem(new MovementSystem());

// CollisionSystem - rileva collisioni
world.registerSystem(new CollisionSystem());

// PhysicsSystem - risposta fisica alle collisioni
world.registerSystem(new PhysicsSystem());

// AISystem - comportamenti AI
world.registerSystem(new AISystem());

// CombatSystem - proiettili e danni
world.registerSystem(new CombatSystem());

// InventorySystem - loot e cargo
world.registerSystem(new InventorySystem());

// StationSystem - docking
world.registerSystem(new StationSystem());

// ForceFieldSystem - scudi stazionari
world.registerSystem(new ForceFieldSystem());

// TradeSystem - navi commerciali fazione rossa
world.registerSystem(new TradeSystem());

// RenderSystem - gestisce il disegno su canvas
const renderSystem = new RenderSystem(canvas);
world.registerSystem(renderSystem);

// Inizializza tutti i sistemi
world.init();

// ============================================================================
// CREAZIONE ENTITÀ DI TEST
// ============================================================================

const TRADER_STATION_POS = { x: 1700, y: 0, shieldRadius: 550 };
const PIRATE_STATION_POS = { x: -1700, y: 0, shieldRadius: 550 };
const MALAGASY_STATION_POS = { x: 0, y: 1700, shieldRadius: 550 };
const OKROPODS_STATION_POS = { x: 0, y: -1700, shieldRadius: 550 };
const SHIELD_SPAWN_MARGIN = 80;

function isInsideAnyShield(x: number, y: number): boolean {
    const stations = [
        { x: TRADER_STATION_POS.x, y: TRADER_STATION_POS.y, r: TRADER_STATION_POS.shieldRadius },
        { x: PIRATE_STATION_POS.x, y: PIRATE_STATION_POS.y, r: PIRATE_STATION_POS.shieldRadius },
        { x: MALAGASY_STATION_POS.x, y: MALAGASY_STATION_POS.y, r: MALAGASY_STATION_POS.shieldRadius },
        { x: OKROPODS_STATION_POS.x, y: OKROPODS_STATION_POS.y, r: OKROPODS_STATION_POS.shieldRadius }
    ];

    for (const station of stations) {
        const dx = x - station.x;
        const dy = y - station.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < station.r + SHIELD_SPAWN_MARGIN) {
            return true;
        }
    }
    return false;
}

function getSafeAsteroidSpawnPosition(): { x: number; y: number } | null {
    const maxAttempts = 100;
    const centerArea = 800;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * centerArea;

        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;

        if (!isInsideAnyShield(x, y)) {
            return { x, y };
        }
    }
    return null;
}

/**
 * Crea asteroidi centrali
 */
function createAsteroids(count: number = 30): EntityId[] {
    const asteroids: EntityId[] = [];

    for (let i = 0; i < count; i++) {
        const asteroidId = world.createEntity('asteroid');

        const asteroidScale = 0.5 + Math.random() * 1.5;

        const safePos = getSafeAsteroidSpawnPosition();
        if (!safePos) {
            console.log('[Main] WARN: Impossibile trovare posizione sicura per asteroide');
            world.destroyEntity(asteroidId);
            continue;
        }

        world.addComponent(asteroidId, 'Transform', createTransform({
            x: safePos.x,
            y: safePos.y,
            rotation: Math.random() * Math.PI * 2,
            scale: asteroidScale
        }));

        world.addComponent(asteroidId, 'Velocity', createVelocity({
            vx: (Math.random() - 0.5) * 20,
            vy: (Math.random() - 0.5) * 20,
            angularVelocity: (Math.random() - 0.5) * 0.5
        }));

        world.addComponent(asteroidId, 'Renderable', createRenderable({
            ...SHAPE_PRESETS.ASTEROID
        }));

        world.addComponent(asteroidId, 'Collider', createCollider({
            type: 'circle',
            radius: 28 * asteroidScale,
            layer: CollisionLayer.ASTEROID,
            mask: CollisionLayer.ALL
        }));

        world.addComponent(asteroidId, 'Physics', createPhysics({
            ...PHYSICS_PRESETS.ASTEROID,
            mass: 500
        }));
        
        world.addComponent(asteroidId, 'Health', createHealth({
            ...HEALTH_PRESETS.ASTEROID_MEDIUM
        }));

        asteroids.push(asteroidId);
    }

    console.log(`[Main] Creati ${count} asteroidi centrali`);
    return asteroids;
}

/**
 * Crea asteroidi nella zona pirata
 */
function createPirateAsteroids(count: number = 15): EntityId[] {
    const asteroids: EntityId[] = [];

    for (let i = 0; i < count; i++) {
        const asteroidId = world.createEntity('asteroid');

        const asteroidScale = 0.5 + Math.random() * 1.5;

        const maxAttempts = 50;
        let spawnX = 0, spawnY = 0;
        let spawned = false;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 400 + Math.random() * 600;

            const candidateX = PIRATE_STATION_POS.x + Math.cos(angle) * distance;
            const candidateY = PIRATE_STATION_POS.y + Math.sin(angle) * distance;

            const dx = candidateX - PIRATE_STATION_POS.x;
            const dy = candidateY - PIRATE_STATION_POS.y;
            const distFromStation = Math.sqrt(dx * dx + dy * dy);

            if (distFromStation > PIRATE_STATION_POS.shieldRadius + SHIELD_SPAWN_MARGIN) {
                spawnX = candidateX;
                spawnY = candidateY;
                spawned = true;
                break;
            }
        }

        if (!spawned) {
            console.log('[Main] WARN: Impossibile trovare posizione sicura per asteroide pirata');
            world.destroyEntity(asteroidId);
            continue;
        }

        world.addComponent(asteroidId, 'Transform', createTransform({
            x: spawnX,
            y: spawnY,
            rotation: Math.random() * Math.PI * 2,
            scale: asteroidScale
        }));

        world.addComponent(asteroidId, 'Velocity', createVelocity({
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            angularVelocity: (Math.random() - 0.5) * 0.3
        }));

        world.addComponent(asteroidId, 'Renderable', createRenderable({
            ...SHAPE_PRESETS.ASTEROID
        }));

        world.addComponent(asteroidId, 'Collider', createCollider({
            type: 'circle',
            radius: 28 * asteroidScale,
            layer: CollisionLayer.ASTEROID,
            mask: CollisionLayer.ALL
        }));

        world.addComponent(asteroidId, 'Physics', createPhysics({
            ...PHYSICS_PRESETS.ASTEROID,
            mass: 500
        }));
        
        world.addComponent(asteroidId, 'Health', createHealth({
            ...HEALTH_PRESETS.ASTEROID_MEDIUM
        }));

        asteroids.push(asteroidId);
    }

    console.log(`[Main] Creati ${count} asteroidi nella zona pirata`);
    return asteroids;
}

/**
 * Crea una nave giocatore completa
 */
function createPlayerShip(): EntityId {
    const shipId = world.createEntity('player');

    // Transform
    world.addComponent(shipId, 'Transform', createTransform({
        x: TRADER_STATION_POS.x - 300,
        y: TRADER_STATION_POS.y + 100,
        rotation: Math.PI
    }));

    // Velocity
    world.addComponent(shipId, 'Velocity', createVelocity({
        vx: 0,
        vy: 0,
        drag: 0.3,
        angularDrag: 0.8,
        maxSpeed: 400
    }));

    // Renderable
    world.addComponent(shipId, 'Renderable', createRenderable({
        ...SHAPE_PRESETS.SHIP_BASIC,
        glowEnabled: true,
        glowColor: '#3498db',
        glowIntensity: 15
    }));

    // Collider
    world.addComponent(shipId, 'Collider', createCollider({
        type: 'circle',
        radius: 12,
        layer: CollisionLayer.PLAYER,
        mask: CollisionLayer.ALL & ~CollisionLayer.PLAYER
    }));

    // Physics
    world.addComponent(shipId, 'Physics', createPhysics({
        ...PHYSICS_PRESETS.SHIP,
        mass: 100
    }));

    // Ship Hull
    world.addComponent(shipId, 'ShipHull', createShipHull({
        ...HULL_PRESETS.HEAVY_FIGHTER
    }));

    // Ship Engine
    world.addComponent(shipId, 'ShipEngine', createShipEngine({
        ...ENGINE_PRESETS.FAST
    }));

    // Ship Reactor
    world.addComponent(shipId, 'ShipReactor', createShipReactor({
        ...REACTOR_PRESETS.FUSION
    }));

    // Ship Shield
    world.addComponent(shipId, 'ShipShield', createShipShield({
        maxShield: 50,
        regenRate: 0,
        regenDelay: 0,
        currentShield: 50
    }));

    // Ship Weapon - identico al giocatore
    world.addComponent(shipId, 'ShipWeapon', createShipWeapon({
        ...WEAPON_PRESETS.PLAYER_PRIMARY,
        secondaryWeapon: createShipWeapon(WEAPON_PRESETS.PLAYER_SECONDARY)
    }));

    // Faction
    world.addComponent(shipId, 'Faction', createFaction({
        factionId: 'Misiks'
    }));

    // Cargo
    world.addComponent(shipId, 'Cargo', createCargo({
        ...CARGO_PRESETS.FIGHTER
    }));

    console.log(`[Main] Creata nave giocatore: ID ${shipId}`);

    eventBus.emit('player:spawned', { entityId: shipId });

    return shipId;
}

/**
 * Crea una nave nemica IA (pirata minatore/combattente)
 */
function createEnemyShip(x?: number, y?: number, homeStationId?: EntityId): EntityId {
    const shipId = world.createEntity('enemy_pirate');

    const spawnX = x ?? (PIRATE_STATION_POS.x + (Math.random() - 0.5) * 500);
    const spawnY = y ?? (PIRATE_STATION_POS.y + (Math.random() - 0.5) * 500);

    world.addComponent(shipId, 'Transform', createTransform({
        x: spawnX,
        y: spawnY,
        rotation: Math.random() * Math.PI * 2,
        prevX: spawnX,
        prevY: spawnY
    }));

    world.addComponent(shipId, 'Velocity', createVelocity({
        vx: 0,
        vy: 0,
        angularVelocity: 0,
        maxSpeed: 400,
        drag: 0.3,
        angularDrag: 0.8
    }));

    world.addComponent(shipId, 'Renderable', createRenderable({
        ...SHAPE_PRESETS.SHIP_BASIC,
        fillColor: '#c0392b',
        strokeColor: '#922b21',
        glowEnabled: true,
        glowColor: '#c0392b',
        layer: 1
    }));

    world.addComponent(shipId, 'Collider', createCollider({
        type: 'circle',
        radius: 18,
        layer: CollisionLayer.ENEMY,
        mask: CollisionLayer.ALL
    }));

    world.addComponent(shipId, 'Physics', createPhysics({
        mass: 100,
        friction: 0.1,
        restitution: 0.3,
        isKinematic: false
    }));

    world.addComponent(shipId, 'ShipHull', createShipHull({
        hullType: 'heavy_fighter',
        hullClass: 'fighter',
        maxHull: 200,
        currentHull: 200,
        armor: 50,
        armorType: 'standard',
        slots: [],
        baseEnergyCapacity: 50,
        baseMass: 60,
        damageZones: { front: 1, rear: 1.2, left: 1, right: 1 },
        isRepairing: false,
        repairRate: 0.5
    }));

    world.addComponent(shipId, 'ShipEngine', createShipEngine({
        ...ENGINE_PRESETS.FAST
    }));

    world.addComponent(shipId, 'ShipReactor', createShipReactor({
        maxEnergy: 200,
        currentEnergy: 200,
        energyCapacity: 200,
        rechargeRate: 15,
        energyType: 'fusion'
    }));

    world.addComponent(shipId, 'ShipShield', createShipShield({
        maxShield: 50,
        currentShield: 50,
        regenRate: 5,
        regenDelay: 3
    }));

    world.addComponent(shipId, 'AIController', createAIController({
        state: AIState.EXPLORE,
        sightRange: 550,
        attackRange: 400,
        minCombatRange: 100,
        decisionInterval: 0.15,
        preferredDistance: 200,
        homeStationId: homeStationId ?? null
    }));

    world.addComponent(shipId, 'Faction', createFaction({
        factionId: 'Elarans'
    }));

    world.addComponent(shipId, 'Cargo', createCargo({
        ...CARGO_PRESETS.FIGHTER
    }));

    world.addComponent(shipId, 'ShipWeapon', createShipWeapon({
        ...WEAPON_PRESETS.PLAYER_PRIMARY,
        secondaryWeapon: createShipWeapon(WEAPON_PRESETS.PLAYER_SECONDARY)
    }));

    console.log(`[Main] Nave pirata IA spawnata: ID ${shipId}, homeStation: ${homeStationId}`);
    return shipId;
}

/**
 * Crea una nave commerciale della fazione rossa (identica al giocatore)
 */
function createRedTradeShip(x: number, y: number, rotation: number, homeStationId: EntityId): EntityId {
    const shipId = world.createEntity('red_trader');

    // Transform - identico al giocatore
    world.addComponent(shipId, 'Transform', createTransform({
        x: x,
        y: y,
        rotation: rotation
    }));

    // Velocity - identico al giocatore
    world.addComponent(shipId, 'Velocity', createVelocity({
        vx: 0,
        vy: 0,
        drag: 0.3,
        angularDrag: 0.8,
        maxSpeed: 400
    }));

    // Renderable - identico al giocatore ma rosso
    world.addComponent(shipId, 'Renderable', createRenderable({
        ...SHAPE_PRESETS.SHIP_BASIC,
        fillColor: '#e74c3c',
        strokeColor: '#c0392b',
        glowEnabled: true,
        glowColor: '#e74c3c',
        glowIntensity: 15
    }));

    // Collider - identico al giocatore
    world.addComponent(shipId, 'Collider', createCollider({
        type: 'circle',
        radius: 12,
        layer: CollisionLayer.ENEMY,
        mask: CollisionLayer.ALL
    }));

    // Physics - identico al giocatore
    world.addComponent(shipId, 'Physics', createPhysics({
        ...PHYSICS_PRESETS.SHIP,
        mass: 100
    }));

    // Ship Hull - identico al giocatore
    world.addComponent(shipId, 'ShipHull', createShipHull({
        ...HULL_PRESETS.HEAVY_FIGHTER
    }));

    // Ship Engine - identico al giocatore
    world.addComponent(shipId, 'ShipEngine', createShipEngine({
        ...ENGINE_PRESETS.FAST
    }));

    // Ship Reactor - identico al giocatore
    world.addComponent(shipId, 'ShipReactor', createShipReactor({
        ...REACTOR_PRESETS.FUSION
    }));

    // Ship Shield - identico al giocatore
    world.addComponent(shipId, 'ShipShield', createShipShield({
        maxShield: 50,
        regenRate: 0,
        regenDelay: 0,
        currentShield: 50
    }));

    // Ship Weapon - identico al giocatore (stesse armi primario e secondario)
    world.addComponent(shipId, 'ShipWeapon', createShipWeapon({
        ...WEAPON_PRESETS.PLAYER_PRIMARY,
        secondaryWeapon: createShipWeapon(WEAPON_PRESETS.PLAYER_SECONDARY)
    }));

    // Faction - Pirati
    world.addComponent(shipId, 'Faction', createFaction({
        factionId: 'Elarans'
    }));

    // Cargo - identico al giocatore
    world.addComponent(shipId, 'Cargo', createCargo({
        ...CARGO_PRESETS.FIGHTER
    }));

    // AI Controller - per comportamento FSM avanzato
    world.addComponent(shipId, 'AIController', createAIController({
        state: AIState.EXPLORE,
        sightRange: 1200,
        attackRange: 500,
        minCombatRange: 150,
        decisionInterval: 0.5,
        preferredDistance: 200,
        homeStationId: homeStationId,
        missileSlots: 4
    }));

    const ai = world.getComponent(shipId, 'AIController');
    if (ai && homeStationId) {
        const dx = TRADER_STATION_POS.x - x;
        const dy = TRADER_STATION_POS.y - y;
        const distToEnemyStation = Math.sqrt(dx * dx + dy * dy);
        const exploreDist = 600 + Math.random() * 400;

        ai.target = {
            id: 'exploration',
            type: AITargetType.ASTEROID,
            position: {
                x: x + (dx / distToEnemyStation) * exploreDist,
                y: y + (dy / distToEnemyStation) * exploreDist
            },
            priority: 10
        };
    }

    console.log(`[Main] Nave pirata IA creata: ID ${shipId}, pos: (${x.toFixed(0)}, ${y.toFixed(0)}) rot: ${rotation.toFixed(2)}`);
    return shipId;
}

/**
 * Crea una nave commerciale della fazione blu (alleata, identica al giocatore)
 */
function createBlueTradeShip(x: number, y: number, rotation: number, homeStationId: EntityId): EntityId {
    const shipId = world.createEntity('blue_trader');

    // Transform - identico al giocatore
    world.addComponent(shipId, 'Transform', createTransform({
        x: x,
        y: y,
        rotation: rotation
    }));

    // Velocity - identico al giocatore
    world.addComponent(shipId, 'Velocity', createVelocity({
        vx: 0,
        vy: 0,
        drag: 0.3,
        angularDrag: 0.8,
        maxSpeed: 400
    }));

    // Renderable - identico al giocatore
    world.addComponent(shipId, 'Renderable', createRenderable({
        ...SHAPE_PRESETS.SHIP_BASIC,
        fillColor: '#3498db',
        strokeColor: '#2980b9',
        glowEnabled: true,
        glowColor: '#3498db',
        glowIntensity: 15
    }));

    // Collider - identico al giocatore
    world.addComponent(shipId, 'Collider', createCollider({
        type: 'circle',
        radius: 12,
        layer: CollisionLayer.ENEMY,
        mask: CollisionLayer.ALL
    }));

    // Physics - identico al giocatore
    world.addComponent(shipId, 'Physics', createPhysics({
        ...PHYSICS_PRESETS.SHIP,
        mass: 100
    }));

    // Ship Hull - identico al giocatore
    world.addComponent(shipId, 'ShipHull', createShipHull({
        ...HULL_PRESETS.HEAVY_FIGHTER
    }));

    // Ship Engine - identico al giocatore
    world.addComponent(shipId, 'ShipEngine', createShipEngine({
        ...ENGINE_PRESETS.FAST
    }));

    // Ship Reactor - identico al giocatore
    world.addComponent(shipId, 'ShipReactor', createShipReactor({
        ...REACTOR_PRESETS.FUSION
    }));

    // Ship Shield - identico al giocatore
    world.addComponent(shipId, 'ShipShield', createShipShield({
        maxShield: 50,
        regenRate: 0,
        regenDelay: 0,
        currentShield: 50
    }));

    // Ship Weapon - identico al giocatore (stesse armi primario e secondario)
    world.addComponent(shipId, 'ShipWeapon', createShipWeapon({
        ...WEAPON_PRESETS.PLAYER_PRIMARY,
        secondaryWeapon: createShipWeapon(WEAPON_PRESETS.PLAYER_SECONDARY)
    }));

    // Faction - Traders (alleati con player)
    world.addComponent(shipId, 'Faction', createFaction({
        factionId: 'Misiks'
    }));

    // Cargo - identico al giocatore
    world.addComponent(shipId, 'Cargo', createCargo({
        ...CARGO_PRESETS.FIGHTER
    }));

    // AI Controller - per comportamento FSM avanzato
    world.addComponent(shipId, 'AIController', createAIController({
        state: AIState.EXPLORE,
        sightRange: 1200,
        attackRange: 500,
        minCombatRange: 150,
        decisionInterval: 0.5,
        preferredDistance: 200,
        homeStationId: homeStationId,
        missileSlots: 4
    }));

    const ai = world.getComponent(shipId, 'AIController');
    if (ai && homeStationId) {
        const dx = PIRATE_STATION_POS.x - x;
        const dy = PIRATE_STATION_POS.y - y;
        const distToEnemyStation = Math.sqrt(dx * dx + dy * dy);
        const exploreDist = 600 + Math.random() * 400;

        ai.target = {
            id: 'exploration',
            type: AITargetType.ASTEROID,
            position: {
                x: x + (dx / distToEnemyStation) * exploreDist,
                y: y + (dy / distToEnemyStation) * exploreDist
            },
            priority: 10
        };
    }

    console.log(`[Main] Nave trader IA creata: ID ${shipId}, pos: (${x.toFixed(0)}, ${y.toFixed(0)}) rot: ${rotation.toFixed(2)}`);
    return shipId;
}

/**
 * Crea una nave della fazione Malagasy (verde)
 */
function createMalagasyShip(x: number, y: number, rotation: number, homeStationId: EntityId): EntityId {
    const shipId = world.createEntity('malagasy_ship');

    world.addComponent(shipId, 'Transform', createTransform({
        x, y, rotation
    }));

    world.addComponent(shipId, 'Velocity', createVelocity({
        vx: 0, vy: 0, drag: 0.3, angularDrag: 0.8, maxSpeed: 400
    }));

    world.addComponent(shipId, 'Renderable', createRenderable({
        ...SHAPE_PRESETS.SHIP_BASIC,
        fillColor: '#27ae60',
        strokeColor: '#2ecc71',
        glowEnabled: true,
        glowColor: '#27ae60',
        layer: 1
    }));

    world.addComponent(shipId, 'Collider', createCollider({
        type: 'circle', radius: 12, layer: CollisionLayer.ENEMY, mask: CollisionLayer.ALL
    }));

    world.addComponent(shipId, 'Physics', createPhysics({ ...PHYSICS_PRESETS.SHIP, mass: 100 }));

    world.addComponent(shipId, 'ShipHull', createShipHull({
        ...HULL_PRESETS.HEAVY_FIGHTER
    }));

    world.addComponent(shipId, 'ShipEngine', createShipEngine({ ...ENGINE_PRESETS.FAST }));
    world.addComponent(shipId, 'ShipReactor', createShipReactor({ ...REACTOR_PRESETS.FUSION }));
    world.addComponent(shipId, 'ShipShield', createShipShield({ maxShield: 50, currentShield: 50, regenRate: 5, regenDelay: 3 }));

    world.addComponent(shipId, 'Faction', createFaction({ factionId: 'Malagasy' }));
    world.addComponent(shipId, 'Cargo', createCargo({ ...CARGO_PRESETS.FIGHTER }));

    world.addComponent(shipId, 'ShipWeapon', createShipWeapon({
        ...WEAPON_PRESETS.PLAYER_PRIMARY,
        secondaryWeapon: createShipWeapon(WEAPON_PRESETS.PLAYER_SECONDARY)
    }));

    world.addComponent(shipId, 'AIController', createAIController({
        state: AIState.EXPLORE,
        sightRange: 1200, attackRange: 500, minCombatRange: 150,
        decisionInterval: 0.5, preferredDistance: 200,
        homeStationId, missileSlots: 4
    }));

    console.log(`[Main] Nave Malagasy creata: ID ${shipId}, pos: (${x.toFixed(0)}, ${y.toFixed(0)})`);
    return shipId;
}

/**
 * Crea una nave della fazione Okropoyds (arancione)
 */
function createOkropoydsShip(x: number, y: number, rotation: number, homeStationId: EntityId): EntityId {
    const shipId = world.createEntity('okropods_ship');

    world.addComponent(shipId, 'Transform', createTransform({
        x, y, rotation
    }));

    world.addComponent(shipId, 'Velocity', createVelocity({
        vx: 0, vy: 0, drag: 0.3, angularDrag: 0.8, maxSpeed: 400
    }));

    world.addComponent(shipId, 'Renderable', createRenderable({
        ...SHAPE_PRESETS.SHIP_BASIC,
        fillColor: '#d35400',
        strokeColor: '#e67e22',
        glowEnabled: true,
        glowColor: '#d35400',
        layer: 1
    }));

    world.addComponent(shipId, 'Collider', createCollider({
        type: 'circle', radius: 12, layer: CollisionLayer.ENEMY, mask: CollisionLayer.ALL
    }));

    world.addComponent(shipId, 'Physics', createPhysics({ ...PHYSICS_PRESETS.SHIP, mass: 100 }));

    world.addComponent(shipId, 'ShipHull', createShipHull({
        ...HULL_PRESETS.HEAVY_FIGHTER
    }));

    world.addComponent(shipId, 'ShipEngine', createShipEngine({ ...ENGINE_PRESETS.FAST }));
    world.addComponent(shipId, 'ShipReactor', createShipReactor({ ...REACTOR_PRESETS.FUSION }));
    world.addComponent(shipId, 'ShipShield', createShipShield({ maxShield: 50, currentShield: 50, regenRate: 5, regenDelay: 3 }));

    world.addComponent(shipId, 'Faction', createFaction({ factionId: 'Okropoyds' }));
    world.addComponent(shipId, 'Cargo', createCargo({ ...CARGO_PRESETS.FIGHTER }));

    world.addComponent(shipId, 'ShipWeapon', createShipWeapon({
        ...WEAPON_PRESETS.PLAYER_PRIMARY,
        secondaryWeapon: createShipWeapon(WEAPON_PRESETS.PLAYER_SECONDARY)
    }));

    world.addComponent(shipId, 'AIController', createAIController({
        state: AIState.EXPLORE,
        sightRange: 1200, attackRange: 500, minCombatRange: 150,
        decisionInterval: 0.5, preferredDistance: 200,
        homeStationId, missileSlots: 4
    }));

    console.log(`[Main] Nave Okropoyds creata: ID ${shipId}, pos: (${x.toFixed(0)}, ${y.toFixed(0)})`);
    return shipId;
}

/**
 * Calcola posizione di spawn sicura dentro lo scudo della stazione
 */
function getSafeSpawnPosition(
    stationPos: { x: number; y: number },
    stationRadius: number,
    existingPositions: Array<{ x: number; y: number }>,
    minDistanceFromStation: number,
    minDistanceFromOther: number
): { x: number; y: number } | null {
    const maxAttempts = 50;
    const shieldRadius = stationRadius + 150;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = minDistanceFromStation + Math.random() * (shieldRadius - minDistanceFromStation);
        const x = stationPos.x + Math.cos(angle) * distance;
        const y = stationPos.y + Math.sin(angle) * distance;

        let tooClose = false;
        for (const pos of existingPositions) {
            const dx = x - pos.x;
            const dy = y - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDistanceFromOther) {
                tooClose = true;
                break;
            }
        }

        if (!tooClose) {
            return { x, y };
        }
    }

    return null;
}

/**
 * Crea una stazione spaziale
 */
function createStation(factionId: string, pos: { x: number, y: number }): EntityId {
    const stationId = world.createEntity('station');
    const isElarans = factionId === 'Elarans';
    const isMisiks = factionId === 'Misiks';
    const isMalagasy = factionId === 'Malagasy';
    const isOkropoyds = factionId === 'Okropoyds';

    const fillColor = isElarans ? '#c0392b' : isMalagasy ? '#27ae60' : isOkropoyds ? '#e67e22' : '#2c3e50';
    const strokeColor = isElarans ? '#e74c3c' : isMalagasy ? '#2ecc71' : isOkropoyds ? '#f39c12' : '#3498db';
    const shieldColor = isElarans ? '#ff0000' : isMalagasy ? '#00ff00' : isOkropoyds ? '#ff8800' : '#3498db';
    
    world.addComponent(stationId, 'Transform', createTransform({
        x: pos.x,
        y: pos.y,
        rotation: 0,
        scale: 1.5
    }));

    world.addComponent(stationId, 'Velocity', createVelocity({
        angularVelocity: 0.05
    }));

    world.addComponent(stationId, 'Renderable', createRenderable({
        ...SHAPE_PRESETS.STATION,
        fillColor: fillColor,
        strokeColor: strokeColor,
        glowColor: strokeColor,
        layer: -1
    }));

    world.addComponent(stationId, 'Collider', createCollider({
        type: 'polygon',
        vertices: SHAPE_PRESETS.STATION.vertices,
        layer: CollisionLayer.STATION,
        isStatic: true
    }));

    world.addComponent(stationId, 'Physics', createPhysics({
        ...PHYSICS_PRESETS.STATION
    }));

    world.addComponent(stationId, 'Faction', createFaction({
        factionId: factionId
    }));
    
    world.addComponent(stationId, 'Station', createStationComponent({
        dockingPort: { x: 0, y: 90, angle: -Math.PI / 2 },
        dockingRadius: 500
    }));

    // Scudo Visivo (SOLO grafica, nessuna collisione o forza)
    const shieldId = world.createEntity('station_shield');
    
    world.addComponent(shieldId, 'Transform', createTransform({
        x: pos.x,
        y: pos.y,
        scale: 1
    }));

    world.addComponent(shieldId, 'Renderable', createRenderable({
        type: 'circle',
        radius: 550,
        fillColor: `rgba(${isElarans ? '255, 0, 0' : isMalagasy ? '0, 255, 0' : isOkropoyds ? '255, 136, 0' : '52, 152, 219'}, 0.05)`,
        strokeColor: shieldColor,
        strokeWidth: 4,
        alpha: 1.0,
        glowEnabled: true,
        glowColor: shieldColor,
        glowIntensity: 30,
        layer: 5
    }));

    // Testo nome fazione che ruota intorno allo scudo
    const shieldTextId = world.createEntity('station_shield_text');
    world.addComponent(shieldTextId, 'Transform', createTransform({
        x: pos.x,
        y: pos.y,
        scale: 1
    }));
    world.addComponent(shieldTextId, 'Renderable', createRenderable({
        type: 'rotatingText',
        text: factionId,
        textColor: shieldColor,
        textSize: 32,
        textFont: 'Arial',
        textOffsetRadius: 500,
        textRotationSpeed: 1.2,
        radius: 550,
        layer: 6
    }));

    console.log(`[Main] Creata stazione ${factionId}: ID ${stationId}`);
    return stationId;
}

// Crea le entità
const playerId = createPlayerShip();
const asteroids = createAsteroids(40);
createPirateAsteroids(15);

// Create all 4 stations
const traderStationId = createStation('Misiks', TRADER_STATION_POS);
const pirateStationId = createStation('Elarans', PIRATE_STATION_POS);
const malagasyStationId = createStation('Malagasy', MALAGASY_STATION_POS);
const okropodsStationId = createStation('Okropoyds', OKROPODS_STATION_POS);

// Create map boundary (square 200px outside shield edges at ±550px from ±1700 = ±2450)
// Create map boundary (square 200px outside shield edges at ±550px from ±1700)
const BOUNDARY = 2450;
const VISUAL_OFFSET = 2; // Offset lines inside physics barriers

// Create 4 invisible boundary walls (physics only, like station collision)
const boundaryWalls = [
    { x: 0, y: -BOUNDARY, width: BOUNDARY * 2, height: 20 }, // Top - increased height
    { x: 0, y: BOUNDARY, width: BOUNDARY * 2, height: 20 },  // Bottom - increased height
    { x: -BOUNDARY, y: 0, width: 20, height: BOUNDARY * 2 },  // Left - increased width
    { x: BOUNDARY, y: 0, width: 20, height: BOUNDARY * 2 }   // Right - increased width
];

for (const wall of boundaryWalls) {
    const wallId = world.createEntity('boundary_physics');
    world.addComponent(wallId, 'Transform', createTransform({
        x: wall.x,
        y: wall.y,
        rotation: 0,
        scale: 1
    }));
    world.addComponent(wallId, 'Collider', createCollider({
        type: 'aabb',
        width: wall.width,
        height: wall.height,
        layer: CollisionLayer.BOUNDARY,
        mask: CollisionLayer.PLAYER | CollisionLayer.ENEMY | CollisionLayer.ASTEROID,
        isStatic: true,
        isTrigger: false
    }));
    world.addComponent(wallId, 'Physics', createPhysics({
        mass: 10000,
        isKinematic: true,
        friction: 0,
        restitution: 0.1
    }));
    // No Renderable - invisible physics barrier like station collision
}

// Create visual boundary lines (like station shields - graphics only, offset inside)
const boundaryLines = [
    { x: 0, y: -BOUNDARY + VISUAL_OFFSET, width: BOUNDARY * 2, height: 4 }, // Top line - offset inside
    { x: 0, y: BOUNDARY - VISUAL_OFFSET, width: BOUNDARY * 2, height: 4 },  // Bottom line - offset inside
    { x: -BOUNDARY + VISUAL_OFFSET, y: 0, width: 4, height: BOUNDARY * 2 },  // Left line - offset inside
    { x: BOUNDARY - VISUAL_OFFSET, y: 0, width: 4, height: BOUNDARY * 2 }   // Right line - offset inside
];

for (const line of boundaryLines) {
    const lineId = world.createEntity('boundary_visual');
    world.addComponent(lineId, 'Transform', createTransform({
        x: line.x,
        y: line.y,
        rotation: 0,
        scale: 1
    }));
    world.addComponent(lineId, 'Renderable', createRenderable({
        type: 'rect',
        width: line.width,
        height: line.height,
        fillColor: '#ffff00',
        strokeColor: '#cc9900',
        strokeWidth: 4,
        glowEnabled: true,
        glowColor: '#ffcc00',
        glowIntensity: 30,
        layer: 5,
        alpha: 1.0
    }));
    // No Physics/Collider - visual only like station shields
}
console.log(`[Main] Created boundary physics barriers and visual lines at ±${BOUNDARY}px`);

// Spawn Elarans ships (at x=-1200, facing right toward center)
createRedTradeShip(-1200, 100, 0, pirateStationId);
console.log(`[Main] Nave Elarans 1 spawnata a (-1200, 100)`);

createRedTradeShip(-1200, -100, 0, pirateStationId);
console.log(`[Main] Nave Elarans 2 spawnata a (-1200, -100)`);

// Spawn Misiks ships (at x=1200, facing left toward center)
createBlueTradeShip(1200, -100, Math.PI, traderStationId);
console.log(`[Main] Nave Misiks spawnata a (1200, -100)`);

// Spawn Malagasy ships (at y=1200, facing down toward center)
createMalagasyShip(100, 1200, -Math.PI / 2, malagasyStationId);
console.log(`[Main] Nave Malagasy 1 spawnata a (100, 1200)`);

createMalagasyShip(-100, 1200, -Math.PI / 2, malagasyStationId);
console.log(`[Main] Nave Malagasy 2 spawnata a (-100, 1200)`);

// Spawn Okropoyds ships (at y=-1200, facing up toward center)
createOkropoydsShip(-100, -1200, Math.PI / 2, okropodsStationId);
console.log(`[Main] Nave Okropoyds 1 spawnata a (-100, -1200)`);

createOkropoydsShip(100, -1200, Math.PI / 2, okropodsStationId);
console.log(`[Main] Nave Okropoyds 2 spawnata a (100, -1200)`);

const stationId = traderStationId; // Per UI riferimento

// ============================================================================
// INPUT HANDLING
// ============================================================================

// Costanti controllo nave
const SHIP_THRUST = 250;
const SHIP_ROTATION_SPEED = 3.5;

function processInput(deltaTime: number): void {
    const velocity = world.getComponent<VelocityComponent>(playerId, 'Velocity');
    const transform = world.getComponent<TransformComponent>(playerId, 'Transform');
    const engine = world.getComponent<ShipEngineComponent>(playerId, 'ShipEngine');
    const reactor = world.getComponent<ShipReactorComponent>(playerId, 'ShipReactor');

    if (!velocity || !transform) return;

    const thrust = engine?.thrustForward ?? SHIP_THRUST;
    const rotSpeed = engine?.rotationSpeed ?? SHIP_ROTATION_SPEED;

    // Rotazione
    const rotAxis = inputSystem.getHorizontalAxis();
    velocity.angularVelocity = rotAxis * rotSpeed;

    // Thrust
    const thrustAxis = inputSystem.getVerticalAxis();
    if (thrustAxis !== 0) {
        // Consumo energia: 2 al secondo per thrust massimo (ridotto drasticamente)
        const energyCost = 2 * deltaTime;
        const hasEnergy = reactor && reactor.currentEnergy > energyCost;

        if (hasEnergy) {
            // Consuma energia
            if (reactor) reactor.currentEnergy -= energyCost;

            const thrustPower = thrustAxis > 0 ? thrust : thrust * 0.5;
            velocity.vx += Math.cos(transform.rotation) * thrustPower * thrustAxis * deltaTime;
            velocity.vy += Math.sin(transform.rotation) * thrustPower * thrustAxis * deltaTime;
        } else {
            // Senza energia: spinta ridotta (20%)
            const lowPowerThrust = (thrustAxis > 0 ? thrust : thrust * 0.5) * 0.2;
            velocity.vx += Math.cos(transform.rotation) * lowPowerThrust * thrustAxis * deltaTime;
            velocity.vy += Math.sin(transform.rotation) * lowPowerThrust * thrustAxis * deltaTime;
        }
    }

    // Brake (spazio)
    if (inputSystem.isActionPressed(InputAction.BRAKE)) {
        velocity.vx *= 0.95;
        velocity.vy *= 0.95;
    }

    // Debug toggle
    if (inputSystem.isActionJustPressed(InputAction.DEBUG_TOGGLE)) {
        renderSystem.toggleDebugMode();
    }

    // Speed controls
    if (inputSystem.isActionJustPressed(InputAction.SPEED_1)) gameLoop.setSpeed(1);
    if (inputSystem.isActionJustPressed(InputAction.SPEED_2)) gameLoop.setSpeed(2);
    if (inputSystem.isActionJustPressed(InputAction.SPEED_3)) gameLoop.setSpeed(3);
    if (inputSystem.isActionJustPressed(InputAction.SPEED_5)) gameLoop.setSpeed(5);

    // Step
    if (inputSystem.isActionJustPressed(InputAction.STEP) && gameLoop.isPaused) {
        gameLoop.step();
    }
}

// ============================================================================
// GAME LOOP
// ============================================================================

const gameLoop = new GameLoop({
    targetFPS: 60,
    maxUpdatesPerFrame: 5,

    update: (deltaTime) => {
        // Processa input
        processInput(deltaTime);

        // Aggiorna mondo
        world.update(deltaTime);

        // Camera segue il giocatore
        const playerTransform = world.getComponent<TransformComponent>(playerId, 'Transform');
        if (playerTransform) {
            renderSystem.setCameraPosition(playerTransform.x, playerTransform.y);
        }
    },

    render: (interpolation) => {
        world.render(interpolation);
    }
});

// ============================================================================
// REACT UI
// ============================================================================

// Riferimento globale al gioco per React
const gameRef = {
    world,
    eventBus,
    gameLoop,
    renderSystem,
    inputSystem,
    playerId,
    asteroids,
    stationId,
    spawnEnemyShip: (x?: number, y?: number, homeStationId?: EntityId) => createEnemyShip(x, y, homeStationId),
    spawnBlueTradeShip: (x: number, y: number, rotation: number, homeStationId: EntityId) => createBlueTradeShip(x, y, rotation, homeStationId)
};

// Monta React UI
const uiRoot = document.getElementById('ui-root');
if (uiRoot) {
    // Rimuovi debug overlay HTML statico
    const debugOverlay = document.getElementById('debug-overlay');
    if (debugOverlay) {
        debugOverlay.remove();
    }

    const root = createRoot(uiRoot);
    root.render(<App gameRef={gameRef} />);
}

// ============================================================================
// AVVIO
// ============================================================================

gameLoop.start();

console.log('=== Space Sim 2D - Pronto ===');
console.log('Controlli:');
console.log('  WASD: Muovi nave');
console.log('  SPAZIO: Frena');
console.log('  LMB: Spara');
console.log('  ESC: Pausa');
console.log('  F3: Debug panel');
console.log('  G: Griglia debug');
console.log('  1-5: Velocità simulazione');

// ============================================================================
// ESPOSIZIONE GLOBALE PER DEBUG
// ============================================================================

(window as any).game = gameRef;
console.log('Debug: oggetti esposti in window.game');
