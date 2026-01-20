/**
 * =============================================================================
 * AI-SYSTEM.TS - Sistema IA avanzato con FSM
 * =============================================================================
 * Implementa Finite State Machine con stati: IDLE, EXPLORE, MINING, COLLECTING, COMBAT, RETREAT
 */

import System from '../ecs/System';
import { IWorld, EntityId } from '../ecs/types';
import { TransformComponent } from '../../game/components/Transform';
import { VelocityComponent } from '../../game/components/Velocity';
import { AIControllerComponent, AIState, AITargetType, createAIController } from '../../game/components/AIController';
import { ShipEngineComponent } from '../../game/components/ShipEngine';
import { ShipWeaponComponent } from '../../game/components/ShipWeapon';
import { ShipReactorComponent } from '../../game/components/ShipReactor';
import { ShipShieldComponent } from '../../game/components/ShipShield';
import { FactionComponent } from '../../game/components/Faction';
import { HealthComponent } from '../../game/components/Health';
import { CargoComponent } from '../../game/components/Cargo';
import { ColliderComponent, CollisionLayer } from '../../game/components/Collider';
import { SteeringOutput, SteeringBehaviors } from './SteeringBehaviors';
import { ShipHullComponent } from '../../game/components/ShipHull';
import { DockingComponent, createDocking, DockStatus } from '../../game/components/Docking';
import { StationComponent } from '../../game/components/Station';

const RETREAT_HEALTH_THRESHOLD = 0.25;
const RETREAT_EXIT_HEALTH = 0.6;
const RETREAT_WAIT_TIME = 15;
const RETREAT_FARM_TIME = 30;
const MINING_RANGE = 250;
const MINING_STOP_DISTANCE = 140;
const MINING_MIN_DISTANCE = 80;
const LOOT_COLLECTION_RANGE = 100;
const STATION_DOCKING_RANGE = 200;
const STATION_SAFE_RANGE = 400;

const TRADER_STATION_POS = { x: 1500, y: 0 };
const PIRATE_STATION_POS = { x: -1500, y: 0 };

export class AISystem extends System {
    private _steering!: SteeringBehaviors;
    private _traderStationPos: { x: number; y: number } | null;

    constructor() {
        super('AISystem', 45);
        this._traderStationPos = { x: 1500, y: 0 };
    }

    init(world: IWorld): void {
        super.init(world);
        this._steering = new SteeringBehaviors(world, {
            rayAngleSpread: Math.PI * 2,
            rayCount: 12,
            rayLength: 400
        });

        // Listen for asteroid destruction events for immediate fragment targeting
        this.on('asteroid:destroyed', (data: { x: number; y: number; scale: number }) => {
            this._handleAsteroidDestroyed(data.x, data.y, data.scale);
        });

        console.log('[AISystem] Inizializzato con FSM avanzata');
    }

    update(deltaTime: number): void {
        const entities = this.queryEntities(['AIController', 'Transform', 'Velocity']);

        for (const entityId of entities) {
            this._updateEntity(entityId, deltaTime);
        }
    }

    private _updateEntity(entityId: EntityId, deltaTime: number): void {
        const ai = this.getComponent<AIControllerComponent>(entityId, 'AIController');
        const transform = this.getComponent<TransformComponent>(entityId, 'Transform');
        let velocity = this.getComponent<VelocityComponent>(entityId, 'Velocity');
        const collider = this.getComponent<ColliderComponent>(entityId, 'Collider');
        const faction = this.getComponent<FactionComponent>(entityId, 'Faction');
        const health = this.getComponent<HealthComponent>(entityId, 'Health');
        const engine = this.getComponent<ShipEngineComponent>(entityId, 'ShipEngine');

        if (!ai || !transform) return;

        const localVelocity = velocity ?? { vx: 0, vy: 0, angularVelocity: 0, maxSpeed: 400, maxAngularSpeed: Math.PI * 2, drag: 2, angularDrag: 2 };

        // Update sensors less frequently (every 0.15s) instead of every frame
        ai.decisionTimer -= deltaTime;
        const shouldUpdateSensors = ai.decisionTimer <= 0;
        if (shouldUpdateSensors) {
            ai.decisionTimer = ai.decisionInterval * (2 - ai.personality.reactionSpeed);
            this._updateSensors(entityId, transform, collider ?? null, faction ?? null);
        }

        // Update emergency retreat cooldown
        if (ai.emergencyRetreatCooldown > 0) {
            ai.emergencyRetreatCooldown -= deltaTime;
        }

        // Update target switch cooldown (prevents firing at old target position)
        if (ai.targetSwitchCooldown > 0) {
            ai.targetSwitchCooldown -= deltaTime;
        }

        const myFaction = faction?.factionId ?? 'neutral';

        const isDocked = this._checkDockingStatus(entityId, ai, transform);

        if (isDocked) {
            this._handleDockingState(entityId, ai, health ?? null);
        }

        // Check retreat first - absolute priority (use both Health and ShipHull)
        const shipHull = this.getComponent<ShipHullComponent>(entityId, 'ShipHull');
        const healthPercent = health ? health.current / health.max : (shipHull ? shipHull.currentHull / shipHull.maxHull : 1);
        
        if (healthPercent < RETREAT_HEALTH_THRESHOLD && ai.state !== AIState.REPLY) {
            ai.state = AIState.RETREAT;
        }

        if (shouldUpdateSensors) {
            if (ai.state !== AIState.RETREAT) {
                this._makeDecision(entityId, ai, transform, faction ?? null);
            }
        }

        this._executeState(entityId, ai, transform, localVelocity, engine ?? null, deltaTime, shouldUpdateSensors);

        // If docked in RETREAT, force state back to RETREAT to prevent other states from taking over
        const dockingAfter = this.getComponent<DockingComponent>(entityId, 'Docking');
        if (dockingAfter && ai.state !== AIState.RETREAT && ai.personality.caution >= 1) {
            ai.state = AIState.RETREAT;
        }

        if (velocity) {
            velocity.vx = localVelocity.vx;
            velocity.vy = localVelocity.vy;
            velocity.angularVelocity = localVelocity.angularVelocity;
        }
    }

    private _updateSensors(
        entityId: EntityId,
        transform: TransformComponent,
        collider: ColliderComponent | null,
        faction: FactionComponent | null
    ): void {
        const ai = this.getComponent<AIControllerComponent>(entityId, 'AIController');
        if (!ai) return;

        ai.sensors.obstacles = this._steering.castRays(transform, collider, () => true);

        const allEntities = (this.world as any).queryEntities(['Transform', 'Collider']) as EntityId[];
        const pickupEntities = (this.world as any).queryEntities(['Pickup', 'Transform']) as EntityId[];

        ai.sensors.enemies = [];
        ai.sensors.asteroids = [];
        ai.sensors.loot = [];

        const myFaction = faction?.factionId ?? 'neutral';
        const lootSightRange = ai.state === AIState.COLLECTING ? 800 : 600;

        for (const otherId of allEntities) {
            if (otherId === entityId) continue;

            const otherTransform = this.getComponent<TransformComponent>(otherId, 'Transform');
            const otherCollider = this.getComponent<ColliderComponent>(otherId, 'Collider');
            const otherFaction = this.getComponent<FactionComponent>(otherId, 'Faction');

            if (!otherTransform) continue;

            const dx = otherTransform.x - transform.x;
            const dy = otherTransform.y - transform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > ai.sightRange) continue;

            const angle = Math.atan2(dy, dx) - transform.rotation;
            let normalizedAngle = angle;
            while (normalizedAngle > Math.PI) normalizedAngle -= Math.PI * 2;
            while (normalizedAngle < -Math.PI) normalizedAngle += Math.PI * 2;

            if (otherFaction) {
                // Enemy if from different faction (not neutral, not same as us)
                const isEnemy = otherFaction.factionId !== 'neutral' && 
                               otherFaction.factionId !== myFaction;

                if (isEnemy && otherCollider) {
                    const threat = this._calculateThreat(entityId, otherId, otherFaction);
                    ai.sensors.enemies.push({
                        entityId: otherId,
                        distance: dist,
                        angle: normalizedAngle,
                        threat
                    });
                }
            }

            const otherTag = (this.world as any).getEntity(otherId)?.tag || '';

            if (otherTag === 'asteroid' && otherCollider) {
                ai.sensors.asteroids.push({
                    entityId: otherId,
                    distance: dist,
                    angle: normalizedAngle,
                    size: otherCollider.radius
                });
            }
        }

        for (const pickupId of pickupEntities) {
            if (pickupId === entityId) continue;

            const pTransform = this.getComponent<TransformComponent>(pickupId, 'Pickup') ? null : this.getComponent<TransformComponent>(pickupId, 'Transform');
            if (!pTransform) continue;

            const dx = pTransform.x - transform.x;
            const dy = pTransform.y - transform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > lootSightRange) continue;

            const angle = Math.atan2(dy, dx) - transform.rotation;
            let normalizedAngle = angle;
            while (normalizedAngle > Math.PI) normalizedAngle -= Math.PI * 2;
            while (normalizedAngle < -Math.PI) normalizedAngle += Math.PI * 2;

            ai.sensors.loot.push({
                entityId: pickupId,
                distance: dist,
                angle: normalizedAngle,
                value: 1
            });
        }

        ai.sensors.enemies.sort((a, b) => b.threat - a.threat);
    }

    private _calculateThreat(entityId: EntityId, targetId: EntityId, targetFaction: FactionComponent): number {
        const targetHealth = this.getComponent<HealthComponent>(targetId, 'Health');
        const targetWeapon = this.getComponent<ShipWeaponComponent>(targetId, 'ShipWeapon');

        let threat = 50;

        // All hostile factions have same threat
        const myFaction = this.getComponent<FactionComponent>(entityId, 'Faction');
        if (myFaction && targetFaction.factionId !== myFaction.factionId && targetFaction.factionId !== 'neutral') {
            threat += 30;
        }

        if (targetHealth) {
            const healthPercent = targetHealth.current / targetHealth.max;
            if (healthPercent < 0.3) threat -= 20;
            else if (healthPercent > 0.8) threat += 20;
        }

        if (targetWeapon) {
            threat += 20;
        }

        const targetDist = this._getTargetDistance(entityId, targetId);
        if (targetDist < 300) threat += 15;

        return Math.max(0, Math.min(100, threat));
    }

    private _getTargetDistance(entityId: EntityId, targetId: EntityId): number {
        const transform = this.getComponent<TransformComponent>(entityId, 'Transform');
        const targetTransform = this.getComponent<TransformComponent>(targetId, 'Transform');

        if (!transform || !targetTransform) return 1000;

        const dx = targetTransform.x - transform.x;
        const dy = targetTransform.y - transform.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private _checkDockingStatus(entityId: EntityId, ai: AIControllerComponent, transform: TransformComponent): boolean {
        const stationId = ai.homeStationId;
        if (!stationId) return false;

        const stationTransform = this.getComponent<TransformComponent>(stationId, 'Transform');
        if (!stationTransform) return false;

        const dx = stationTransform.x - transform.x;
        const dy = stationTransform.y - transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        return dist < STATION_DOCKING_RANGE;
    }

    private _handleDockingState(entityId: EntityId, ai: AIControllerComponent, health: HealthComponent | null): void {
        if (health && health.current / health.max < 1.0) {
            health.current = health.max;
            console.log(`[AISystem] Nave IA ${entityId} riparata alla stazione`);
        }
    }

    private _isInsideOwnShield(entityId: EntityId, transform: TransformComponent, faction: FactionComponent | null): { inside: boolean; exitDir: { x: number; y: number } } {
        if (!faction) return { inside: false, exitDir: { x: 0, y: 0 } };

        const isTrader = faction.factionId === 'Misiks';
        const stationX = isTrader ? TRADER_STATION_POS.x : PIRATE_STATION_POS.x;
        const stationY = isTrader ? TRADER_STATION_POS.y : PIRATE_STATION_POS.y;
        const shieldRadius = 550;

        const dx = transform.x - stationX;
        const dy = transform.y - stationY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < shieldRadius) {
            // Inside shield - set target toward center where asteroids are
            return {
                inside: true,
                exitDir: { x: 0, y: 0 }
            };
        }

        return { inside: false, exitDir: { x: 0, y: 0 } };
    }

    private _makeDecision(
        entityId: EntityId,
        ai: AIControllerComponent,
        transform: TransformComponent,
        faction: FactionComponent | null
    ): void {
        const ENEMY_SIGHT_RANGE = 300;
        const currentState = ai.state;

        // Check if inside own shield - prioritize exiting first
        if (currentState !== AIState.RETREAT && currentState !== AIState.DOCKING) {
            const shieldStatus = this._isInsideOwnShield(entityId, transform, faction);
        if (shieldStatus.inside) {
            // Must exit shield first toward center
            ai.state = AIState.EXIT_SHIELD;
            ai.target = {
                id: -1,
                type: AITargetType.ASTEROID,
                position: { x: 0, y: 0 },
                priority: 200
            };
            return;
        }
        }

        // RETREAT is absolute priority - never override it in decision making
        if (currentState === AIState.RETREAT && ai.homeStationId) {
            const health = this.getComponent<HealthComponent>(entityId, 'Health');
            // Only exit retreat if health is recovered to 60%+
            if (health && health.current / health.max > 0.6) {
                ai.state = AIState.EXPLORE;
            }
            return;
        }

        // If we were exiting shield, check if we're now outside
        if (currentState === AIState.EXIT_SHIELD) {
            const shieldStatus = this._isInsideOwnShield(entityId, transform, faction);
            if (!shieldStatus.inside) {
                // Successfully exited shield - resume normal behavior
                ai.state = AIState.EXPLORE;
                ai.target = null;
            }
            return;
        }

        if (currentState === AIState.COMBAT) {
            const enemy = ai.target;
            if (enemy && typeof enemy.id === 'number') {
                const enemyTransform = this.getComponent<TransformComponent>(enemy.id, 'Transform');
                if (enemyTransform) {
                    const dist = Math.sqrt(
                        Math.pow(enemyTransform.x - transform.x, 2) +
                        Math.pow(enemyTransform.y - transform.y, 2)
                    );
                    if (dist > ENEMY_SIGHT_RANGE * 1.5) {
                        ai.target = null;
                        ai.state = AIState.EXPLORE;
                    }
                } else {
                    ai.target = null;
                    ai.state = AIState.EXPLORE;
                }
            } else {
                ai.state = AIState.EXPLORE;
            }
        }

        if (ai.sensors.enemies.length > 0) {
            const nearestEnemy = ai.sensors.enemies.reduce((nearest, e) =>
                e.distance < nearest.distance ? e : nearest
            );

            if (nearestEnemy.distance < ENEMY_SIGHT_RANGE) {
                ai.state = AIState.COMBAT;
                ai.target = {
                    id: nearestEnemy.entityId,
                    type: AITargetType.ENEMY,
                    position: { x: 0, y: 0 },
                    priority: nearestEnemy.threat
                };
                return;
            }
        }

        const cargo = this.getComponent<CargoComponent>(entityId, 'Cargo');
        // Check if cargo is 80% full by volume (15 slots * 50 = 750 total capacity)
        const cargoPercent = cargo && cargo.capacity > 0 ? cargo.currentVolume / cargo.capacity : 0;
        if (cargo && cargoPercent >= 0.8) {
            if (entityId <= 10) {
                console.log(`[AISystem] AI ${entityId} cargo full: ${cargo.currentVolume}/${cargo.capacity} = ${Math.round(cargoPercent * 100)}%`);
            }
            if (ai.homeStationId) {
                ai.state = AIState.RETREAT;
                const stationTransform = this.getComponent<TransformComponent>(ai.homeStationId, 'Transform');
                if (stationTransform) {
                    ai.target = {
                        id: ai.homeStationId,
                        type: AITargetType.STATION,
                        position: { x: stationTransform.x, y: stationTransform.y },
                        priority: 100
                    };
                }
            }
            return;
        }

        if (ai.sensors.loot.length > 0 && cargo && cargo.currentVolume < cargo.capacity) {
            const nearestLoot = ai.sensors.loot.reduce((nearest, loot) =>
                loot.distance < nearest.distance ? loot : nearest
            );

            ai.state = AIState.COLLECTING;
            ai.target = {
                id: nearestLoot.entityId,
                type: AITargetType.LOOT,
                position: { x: 0, y: 0 },
                priority: 80
            };
            return;
        }

        if (ai.state === AIState.MINING && ai.target) {
            const targetTags = (this.world as any).getEntity(ai.target.id)?.tag || '';
            if (targetTags === 'asteroid' && typeof ai.target.id === 'number') {
                const health = this.getComponent<HealthComponent>(ai.target.id, 'Health');
                if (!health || health.current <= 0) {
                    const cargo = this.getComponent<CargoComponent>(entityId, 'Cargo');
                    
                    // Directly query for nearby pickups instead of relying on cached sensors
                    const pickupEntities = (this.world as any).queryEntities(['Pickup', 'Transform']) as EntityId[];
                    let nearestLoot: { entityId: EntityId; distance: number } | null = null;
                    
                    for (const pickupId of pickupEntities) {
                        const pTransform = this.getComponent<TransformComponent>(pickupId, 'Transform');
                        if (!pTransform) continue;
                        
                        const pdx = pTransform.x - transform.x;
                        const pdy = pTransform.y - transform.y;
                        const pDist = Math.sqrt(pdx*pdx + pdy*pdy);
                        
                        if (pDist < 600 && (!nearestLoot || pDist < nearestLoot.distance)) {
                            nearestLoot = { entityId: pickupId, distance: pDist };
                        }
                    }
                    
                    if (nearestLoot && cargo && cargo.currentVolume < cargo.capacity) {
                        ai.state = AIState.COLLECTING;
                        ai.target = {
                            id: nearestLoot.entityId,
                            type: AITargetType.LOOT,
                            position: { x: 0, y: 0 },
                            priority: 95
                        };
                        return;
                    }

                    if (!nearestLoot && cargo && cargo.currentVolume < cargo.capacity) {
                        // Look for loot in a wider area
                        for (const pickupId of pickupEntities) {
                            const pTransform = this.getComponent<TransformComponent>(pickupId, 'Transform');
                            if (!pTransform) continue;
                            
                            const pdx = pTransform.x - transform.x;
                            const pdy = pTransform.y - transform.y;
                            const pDist = Math.sqrt(pdx*pdx + pdy*pdy);
                            
                            if (pDist < 1000 && (!nearestLoot || pDist < nearestLoot.distance)) {
                                nearestLoot = { entityId: pickupId, distance: pDist };
                            }
                        }
                        
                        if (nearestLoot) {
                            ai.state = AIState.COLLECTING;
                            ai.target = {
                                id: nearestLoot.entityId,
                                type: AITargetType.LOOT,
                                position: { x: 0, y: 0 },
                                priority: 95
                            };
                            return;
                        }
                    }

                    ai.target = null;
                    const asteroid = this._findBestAsteroid(transform, ai, entityId);
                    if (asteroid) {
                        ai.state = AIState.MINING;
                        ai.target = {
                            id: asteroid.id,
                            type: AITargetType.ASTEROID,
                            position: { x: asteroid.x, y: asteroid.y },
                            priority: 30
                        };
                    } else {
                        ai.state = AIState.EXPLORE;
                    }
                }
            }
        }

        if (!ai.target || ai.state !== AIState.MINING) {
            const asteroid = this._findBestAsteroid(transform, ai, entityId);
            if (asteroid) {
                ai.state = AIState.MINING;
                ai.target = {
                    id: asteroid.id,
                    type: AITargetType.ASTEROID,
                    position: { x: asteroid.x, y: asteroid.y },
                    priority: 30
                };
            } else {
                if (ai.state !== AIState.EXPLORE) {
                    ai.state = AIState.EXPLORE;
                }
                this._setRandomExplorationTarget(ai, transform, entityId);
            }
        }
    }

    private _findBestAsteroid(
        transform: TransformComponent,
        ai: AIControllerComponent,
        entityId: EntityId
    ): { id: EntityId; x: number; y: number } | null {
        const asteroids = (this.world as any).getEntitiesByTag('asteroid') as any[];
        if (asteroids.length === 0) return null;

        const candidates = asteroids
            .map(ast => {
                const t = this.getComponent<TransformComponent>(ast.id, 'Transform');
                if (!t) return null;
                const dist = Math.sqrt(
                    Math.pow(t.x - transform.x, 2) +
                    Math.pow(t.y - transform.y, 2)
                );
                return { id: ast.id, x: t.x, y: t.y, dist };
            })
            .filter(a => a !== null)
            .sort((a, b) => a!.dist - b!.dist);

        if (candidates.length === 0) return null;

        return candidates[0];
    }

    private _setRandomExplorationTarget(ai: AIControllerComponent, transform: TransformComponent, entityId: EntityId): void {
        const seed = entityId * 7919 + 104729;
        const seededRandom = (): number => {
            const x = Math.sin(seed + transform.x + transform.y) * 10000;
            return x - Math.floor(x);
        };

        const angle = seededRandom() * Math.PI * 2;
        const distance = 400 + seededRandom() * 600;

        const baseDirection = this._traderStationPos
            ? Math.atan2(this._traderStationPos.y - transform.y, this._traderStationPos.x - transform.x)
            : 0;

        const explorationAngle = baseDirection + (seededRandom() - 0.5) * Math.PI;

        const targetX = transform.x + Math.cos(explorationAngle) * distance;
        const targetY = transform.y + Math.sin(explorationAngle) * distance;

        ai.target = {
            id: 'exploration',
            type: AITargetType.ASTEROID,
            position: { x: targetX, y: targetY },
            priority: 10
        };
    }

    private _executeExitShieldBehavior(
        entityId: EntityId,
        ai: AIControllerComponent,
        transform: TransformComponent,
        velocity: VelocityComponent,
        engine: ShipEngineComponent | null,
        maxSpeed: number,
        deltaTime: number
    ): void {
        if (!ai.target) {
            ai.target = {
                id: -1,
                type: AITargetType.ASTEROID,
                position: { x: 0, y: 0 },
                priority: 200
            };
        }

        if (transform.x * transform.x + transform.y * transform.y < 600 * 600) {
            ai.state = AIState.EXPLORE;
            ai.target = null;
            return;
        }

        this._applyThrustMovement(transform, velocity, engine, 0, 0, maxSpeed, deltaTime, 1.0, 1.0);
        
        // Apply obstacle avoidance
        const avoidance = this._steering.obstacleAvoidance(transform, velocity, ai.sensors.obstacles, 400);
        velocity.vx += avoidance.linear.x * deltaTime;
        velocity.vy += avoidance.linear.y * deltaTime;
    }

    private _executeState(
        entityId: EntityId,
        ai: AIControllerComponent,
        transform: TransformComponent,
        velocity: VelocityComponent,
        engine: ShipEngineComponent | null,
        deltaTime: number,
        shouldUpdateSensors: boolean = true
    ): void {
        const reactor = this.getComponent<ShipReactorComponent>(entityId, 'ShipReactor');
        const maxSpeed = engine?.maxSpeed || 400;
        const thrust = engine?.thrustForward || 250;
        const rotationSpeed = engine?.rotationSpeed || 3;

        const hasEnergy = reactor && reactor.currentEnergy > 2 * deltaTime;
        const energyMultiplier = hasEnergy ? 1.0 : 0.2;
        const actualThrust = thrust * energyMultiplier;

        if (hasEnergy && reactor) {
            reactor.currentEnergy -= 2 * deltaTime;
        }

        const docking = this.getComponent<DockingComponent>(entityId, 'Docking');
        const isDockedRetreat = docking && docking.status === DockStatus.DOCKED && ai.state === AIState.RETREAT;

        switch (ai.state) {
            case AIState.IDLE:
                velocity.vx *= 0.95;
                velocity.vy *= 0.95;
                velocity.angularVelocity *= 0.9;
                break;

            case AIState.EXIT_SHIELD:
                this._executeExitShieldBehavior(entityId, ai, transform, velocity, engine, maxSpeed, deltaTime);
                break;

            case AIState.EXPLORE:
            case AIState.MINING:
                this._executeMiningBehavior(entityId, ai, transform, velocity, engine, maxSpeed, deltaTime, energyMultiplier);
                break;

            case AIState.COLLECTING:
                this._executeCollectionBehavior(entityId, ai, transform, velocity, engine, maxSpeed, deltaTime);
                break;

            case AIState.COMBAT:
                this._executeCombatBehavior(entityId, ai, transform, velocity, engine, maxSpeed, deltaTime);
                break;

            case AIState.RETREAT:
                this._executeRetreatBehavior(entityId, ai, transform, velocity, engine, maxSpeed, deltaTime);
                break;
        }

        if (isDockedRetreat) {
            velocity.vx = 0;
            velocity.vy = 0;
            velocity.angularVelocity = 0;
        } else if (docking && docking.status === DockStatus.UNDOCKING) {
            // Apply minimal drag during undocking
            velocity.vx *= 0.99;
            velocity.vy *= 0.99;
        }
    }

    private _applyThrustMovement(
        transform: TransformComponent,
        velocity: VelocityComponent,
        engine: ShipEngineComponent | null,
        targetX: number,
        targetY: number,
        maxSpeed: number,
        deltaTime: number,
        thrustMultiplier: number = 1.0,
        rotationMultiplier: number = 1.0
    ): void {
        const thrust = (engine?.thrustForward || 250) * thrustMultiplier;
        const rotSpeed = (engine?.rotationSpeed || 3) * rotationMultiplier;

        const dx = targetX - transform.x;
        const dy = targetY - transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const desiredAngle = Math.atan2(dy, dx);
        let angleDiff = desiredAngle - transform.rotation;

        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        velocity.angularVelocity = angleDiff * rotSpeed;

        // Gradual slowing instead of automatic brake
        const stoppingDistance = 80;
        let thrustPower = thrust * 0.5;
        
        if (dist < stoppingDistance && dist > 0) {
            // Slow down gradually as we approach target
            thrustPower = thrust * 0.5 * (dist / stoppingDistance);
        }

        if (dist > 10) {
            velocity.vx += Math.cos(transform.rotation) * thrustPower * deltaTime;
            velocity.vy += Math.sin(transform.rotation) * thrustPower * deltaTime;
        } else if (dist <= 10 && dist > 0) {
            // Very close - minimal thrust just to maintain position
            velocity.vx *= 0.98;
            velocity.vy *= 0.98;
        }

        const currentSpeed = Math.sqrt(velocity.vx * velocity.vx + velocity.vy * velocity.vy);
        if (currentSpeed > maxSpeed) {
            const scale = maxSpeed / currentSpeed;
            velocity.vx *= scale;
            velocity.vy *= scale;
        }
    }

    private _getSafeRetreatDirection(
        transform: TransformComponent,
        ai: AIControllerComponent,
        desiredDirX: number,
        desiredDirY: number,
        safetyRadius: number
    ): { x: number; y: number } {
        if (ai.sensors.obstacles.length === 0) {
            const dist = Math.sqrt(desiredDirX * desiredDirX + desiredDirY * desiredDirY);
            if (dist < 0.01) return { x: 1, y: 0 };
            return { x: desiredDirX / dist, y: desiredDirY / dist };
        }

        const desiredDist = Math.sqrt(desiredDirX * desiredDirX + desiredDirY * desiredDirY);
        const desiredDirNormX = desiredDirX / desiredDist;
        const desiredDirNormY = desiredDirY / desiredDist;
        const desiredAngle = Math.atan2(desiredDirNormY, desiredDirNormX);

        // Find best angle by checking directions around the desired one
        const numAngles = 8;
        const angleStep = Math.PI / numAngles;
        let bestAngle = desiredAngle;
        let bestClearance = -1;

        for (let i = -numAngles; i <= numAngles; i++) {
            const testAngle = desiredAngle + i * angleStep;
            const testDirX = Math.cos(testAngle);
            const testDirY = Math.sin(testAngle);

            // Calculate minimum distance to any obstacle in this direction
            let minObsDist = Number.MAX_VALUE;
            for (const obstacle of ai.sensors.obstacles) {
                const obsX = Math.cos(obstacle.angle) * obstacle.distance;
                const obsY = Math.sin(obstacle.angle) * obstacle.distance;
                const toObsX = obsX - transform.x;
                const toObsY = obsY - transform.y;
                
                // Project obstacle position onto test direction
                const projDist = toObsX * testDirX + toObsY * testDirY;
                const perpDist = Math.sqrt(toObsX * toObsX + toObsY * toObsY - projDist * projDist);
                
                if (projDist > 0 && perpDist < safetyRadius) {
                    const clearance = projDist;
                    if (clearance < minObsDist) {
                        minObsDist = clearance;
                    }
                }
            }

            if (minObsDist > bestClearance) {
                bestClearance = minObsDist;
                bestAngle = testAngle;
            }
        }

        return {
            x: Math.cos(bestAngle),
            y: Math.sin(bestAngle)
        };
    }

    private _executeMiningBehavior(
        entityId: EntityId,
        ai: AIControllerComponent,
        transform: TransformComponent,
        velocity: VelocityComponent,
        engine: ShipEngineComponent | null,
        maxSpeed: number,
        deltaTime: number,
        energyMultiplier: number = 1.0
    ): void {
        if (!ai.target || typeof ai.target.id !== 'number') {
            ai.state = AIState.EXPLORE;
            return;
        }

        const targetId = ai.target.id as EntityId;
        const targetTransform = this.getComponent<TransformComponent>(targetId, 'Transform');
        if (!targetTransform) {
            ai.target = null;
            ai.state = AIState.EXPLORE;
            return;
        }

        const targetTags = (this.world as any).getEntity(targetId)?.tag || '';
        const isAsteroid = targetTags === 'asteroid';

        // Note: Target validity check is handled in _makeDecision via asteroid:destroyed event
        // This prevents duplicate checks and ensures immediate target updates

        const dx = targetTransform.x - transform.x;
        const dy = targetTransform.y - transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const targetRadius = this._getAsteroidSize(targetId);
        const RETREAT_DISTANCE = targetRadius + 40;    // Emergency retreat threshold
        const NEUTRAL_ZONE_MIN = targetRadius + 50;    // Neutral zone start
        const NEUTRAL_ZONE_MAX = targetRadius + 120;   // Neutral zone end (optimal firing range)
        const APPROACH_THRESHOLD = targetRadius + 200; // Start approaching

        // Check for nearby obstacles (different from target) - emergency retreat
        let nearbyObstacleDistance = Number.MAX_VALUE;
        for (const obs of ai.sensors.obstacles) {
            if (obs.entityId !== targetId && obs.distance < nearbyObstacleDistance) {
                nearbyObstacleDistance = obs.distance;
            }
        }

        const EMERGENCY_OBSTACLE_THRESHOLD = 80;

        // Check if initial approach is complete
        if (!ai.initialApproachComplete && dist >= NEUTRAL_ZONE_MIN && dist <= NEUTRAL_ZONE_MAX) {
            ai.initialApproachComplete = true;
        }

        // Check if we should use emergency retreat
        const canUseEmergencyRetreat = ai.initialApproachComplete && ai.emergencyRetreatCooldown <= 0;

        // Priority 1: Emergency retreat from nearby obstacles (only after initial approach)
        if (canUseEmergencyRetreat && nearbyObstacleDistance < EMERGENCY_OBSTACLE_THRESHOLD) {
            // Emergency retreat - fast backward movement
            const retreatDirX = -dx;
            const retreatDirY = -dy;
            const retreatDist = Math.sqrt(retreatDirX * retreatDirX + retreatDirY * retreatDirY);
            
            if (retreatDist > 0.01) {
                const retreatDirNormX = retreatDirX / retreatDist;
                const retreatDirNormY = retreatDirY / retreatDist;
                
                const retreatThrust = (engine?.thrustForward || 250) * 2.0;
                velocity.vx += retreatDirNormX * retreatThrust * deltaTime;
                velocity.vy += retreatDirNormY * retreatThrust * deltaTime;
            }
            // Set cooldown to prevent immediate re-entry
            ai.emergencyRetreatCooldown = 0.5;
            return;
        }

        // Priority 2: Emergency retreat if target asteroid gets too close (only after initial approach)
        if (canUseEmergencyRetreat && dist < RETREAT_DISTANCE) {
            const retreatDirX = -dx;
            const retreatDirY = -dy;
            const retreatDist = Math.sqrt(retreatDirX * retreatDirX + retreatDirY * retreatDirY);
            
            if (retreatDist > 0.01) {
                const retreatDirNormX = retreatDirX / retreatDist;
                const retreatDirNormY = retreatDirY / retreatDist;
                
                const retreatThrust = (engine?.thrustForward || 250) * 2.0;
                velocity.vx += retreatDirNormX * retreatThrust * deltaTime;
                velocity.vy += retreatDirNormY * retreatThrust * deltaTime;
            }
            // Set cooldown to prevent immediate re-entry
            ai.emergencyRetreatCooldown = 0.5;
            return;
        }

        // Priority 3: Neutral zone - maintain position and fire continuously
        if (dist >= NEUTRAL_ZONE_MIN && dist <= NEUTRAL_ZONE_MAX) {
            // Maintain position - slight damping, no thrust
            velocity.vx *= 0.98;
            velocity.vy *= 0.98;
            
            // Calculate angle to target
            const targetAngle = Math.atan2(dy, dx);
            let angleDiff = Math.abs(targetAngle - transform.rotation);
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            // Fire if within cone (144 degrees)
            if (Math.abs(angleDiff) < Math.PI * 0.8) {
                this._tryFire(entityId, transform, ai, true);
            }
            return;
        }

        // Priority 4: Too far - approach
        if (dist > APPROACH_THRESHOLD) {
            const thrustMult = maxSpeed * 0.6 * ai.personality.miningEfficiency * energyMultiplier / maxSpeed;
            this._applyThrustMovement(transform, velocity, engine, targetTransform.x, targetTransform.y, maxSpeed, deltaTime, thrustMult, 1.0);
            
            // Subtle obstacle avoidance during approach
            for (const obs of ai.sensors.obstacles) {
                if (obs.distance < 120 && obs.distance > 40 && obs.entityId !== targetId) {
                    const pushStrength = (1 - obs.distance / 120) * 60;
                    velocity.vx += Math.cos(obs.angle) * pushStrength * deltaTime;
                    velocity.vy += Math.sin(obs.angle) * pushStrength * deltaTime;
                }
            }
        }

        // Priority 5: Between neutral zone and approach threshold - fire while moving toward zone
        if (dist > NEUTRAL_ZONE_MAX && dist <= APPROACH_THRESHOLD) {
            // Move slowly toward neutral zone
            const approachThrust = maxSpeed * 0.3 * energyMultiplier / maxSpeed;
            this._applyThrustMovement(transform, velocity, engine, targetTransform.x, targetTransform.y, maxSpeed, deltaTime, approachThrust, 1.0);
            
            // Subtle obstacle avoidance
            for (const obs of ai.sensors.obstacles) {
                if (obs.distance < 120 && obs.distance > 40 && obs.entityId !== targetId) {
                    const pushStrength = (1 - obs.distance / 120) * 40;
                    velocity.vx += Math.cos(obs.angle) * pushStrength * deltaTime;
                    velocity.vy += Math.sin(obs.angle) * pushStrength * deltaTime;
                }
            }
        }

        // Face target for firing
        this._faceTarget(entityId, transform, targetTransform, deltaTime, velocity);

        // Fire if in range
        if (dist < ai.attackRange) {
            this._tryFire(entityId, transform, ai, true);
        }
    }

    private _executeCollectionBehavior(
        entityId: EntityId,
        ai: AIControllerComponent,
        transform: TransformComponent,
        velocity: VelocityComponent,
        engine: ShipEngineComponent | null,
        maxSpeed: number,
        deltaTime: number,
        energyMultiplier: number = 1.0
    ): void {
        if (!ai.target || typeof ai.target.id !== 'number') {
            ai.state = AIState.EXPLORE;
            return;
        }

        const targetId = ai.target.id as EntityId;
        const targetTransform = this.getComponent<TransformComponent>(targetId, 'Transform');
        if (!targetTransform) {
            ai.target = null;
            ai.state = AIState.EXPLORE;
            return;
        }

        const targetTag = (this.world as any).getEntity(targetId)?.tag || '';
        if (targetTag !== 'pickup') {
            ai.target = null;
            ai.state = AIState.EXPLORE;
            return;
        }

        const dx = targetTransform.x - transform.x;
        const dy = targetTransform.y - transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < LOOT_COLLECTION_RANGE) {
            ai.target = null;

            const cargo = this.getComponent<CargoComponent>(entityId, 'Cargo');
            const cargoPercent = cargo && cargo.capacity > 0 ? cargo.currentVolume / cargo.capacity : 0;
            if (cargo && cargoPercent >= 0.8 && ai.homeStationId) {
                ai.state = AIState.RETREAT;
                const stationTransform = this.getComponent<TransformComponent>(ai.homeStationId, 'Transform');
                if (stationTransform) {
                    ai.target = {
                        id: ai.homeStationId,
                        type: AITargetType.STATION,
                        position: { x: stationTransform.x, y: stationTransform.y },
                        priority: 100
                    };
                }
            } else {
                const nearbyLoot = ai.sensors.loot.filter(l => {
                    const lTransform = this.getComponent<TransformComponent>(l.entityId, 'Transform');
                    if (!lTransform) return false;
                    const ldx = lTransform.x - transform.x;
                    const ldy = lTransform.y - transform.y;
                    return Math.sqrt(ldx*ldx + ldy*ldy) < 600;
                });

                if (nearbyLoot.length > 0) {
                    const nearestLoot = nearbyLoot.reduce((nearest, loot) =>
                        loot.distance < nearest.distance ? loot : nearest
                    );
                    ai.state = AIState.COLLECTING;
                    ai.target = {
                        id: nearestLoot.entityId,
                        type: AITargetType.LOOT,
                        position: { x: 0, y: 0 },
                        priority: 80
                    };
                } else {
                    const asteroid = this._findBestAsteroid(transform, ai, entityId);
                    if (asteroid) {
                        ai.state = AIState.MINING;
                        ai.target = {
                            id: asteroid.id,
                            type: AITargetType.ASTEROID,
                            position: { x: asteroid.x, y: asteroid.y },
                            priority: 30
                        };
                    } else {
                        ai.state = AIState.EXPLORE;
                    }
                }
            }
            return;
        }

        const thrustMult = maxSpeed * 1.0 * energyMultiplier / maxSpeed;
        this._applyThrustMovement(transform, velocity, engine, targetTransform.x, targetTransform.y, maxSpeed, deltaTime, thrustMult, 1.0);

        // Apply obstacle avoidance
        const avoidance = this._steering.obstacleAvoidance(transform, velocity, ai.sensors.obstacles, 400);
        velocity.vx += avoidance.linear.x * deltaTime;
        velocity.vy += avoidance.linear.y * deltaTime;

        this._faceTarget(entityId, transform, targetTransform, deltaTime, velocity);
    }

    private _executeCombatBehavior(
        entityId: EntityId,
        ai: AIControllerComponent,
        transform: TransformComponent,
        velocity: VelocityComponent,
        engine: ShipEngineComponent | null,
        maxSpeed: number,
        deltaTime: number,
        energyMultiplier: number = 1.0
    ): void {
        if (!ai.target) {
            ai.state = AIState.EXPLORE;
            return;
        }

        const targetId = typeof ai.target.id === 'number' ? ai.target.id : null;
        const targetTransform = targetId ? this.getComponent<TransformComponent>(targetId, 'Transform') : null;

        if (!targetTransform) {
            ai.target = null;
            ai.state = AIState.EXPLORE;
            return;
        }

        const dx = targetTransform.x - transform.x;
        const dy = targetTransform.y - transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > ai.sightRange * 1.5) {
            ai.target = null;
            ai.state = AIState.EXPLORE;
            return;
        }

        const combatDistance = 200;
        const targetX = targetTransform.x - (dx / dist) * combatDistance;
        const targetY = targetTransform.y - (dy / dist) * combatDistance;

        const thrustMult = maxSpeed * 0.5 * energyMultiplier / maxSpeed;
        this._applyThrustMovement(transform, velocity, engine, targetX, targetY, maxSpeed, deltaTime, thrustMult, 1.0);

        // Apply obstacle avoidance during combat
        const avoidance = this._steering.obstacleAvoidance(transform, velocity, ai.sensors.obstacles, 400);
        velocity.vx += avoidance.linear.x * deltaTime;
        velocity.vy += avoidance.linear.y * deltaTime;

        this._faceTarget(entityId, transform, targetTransform, deltaTime, velocity);

        if (dist < ai.attackRange) {
            this._tryFire(entityId, transform, ai, false);
        }
    }

    private _executeRetreatBehavior(
        entityId: EntityId,
        ai: AIControllerComponent,
        transform: TransformComponent,
        velocity: VelocityComponent,
        engine: ShipEngineComponent | null,
        maxSpeed: number,
        deltaTime: number
    ): void {
        if (!ai.homeStationId) {
            ai.state = AIState.EXPLORE;
            return;
        }

        const stationTransform = this.getComponent<TransformComponent>(ai.homeStationId, 'Transform');
        if (!stationTransform) {
            ai.state = AIState.EXPLORE;
            return;
        }

        const docking = this.getComponent(entityId, 'Docking') as DockingComponent | null;

        let stationDockX = stationTransform.x;
        let stationDockY = stationTransform.y;
        if (ai.homeStationId) {
            const dockingPoint = this._getDockingPointGlobal(ai.homeStationId);
            if (dockingPoint) {
                stationDockX = dockingPoint.x;
                stationDockY = dockingPoint.y;
            }
        }

        const dxStation = stationDockX - transform.x;
        const dyStation = stationDockY - transform.y;
        const distToStation = Math.sqrt(dxStation * dxStation + dyStation * dyStation);

        const retreatPhase = Math.floor(ai.personality.caution);

        if (retreatPhase === 0) {
            if (distToStation > 150) {
                this._applyThrustMovement(transform, velocity, engine, stationDockX, stationDockY, maxSpeed, deltaTime, 0.8, 2.0);
                // Apply obstacle avoidance during retreat
                const avoidance = this._steering.obstacleAvoidance(transform, velocity, ai.sensors.obstacles, 400);
                velocity.vx += avoidance.linear.x * deltaTime;
                velocity.vy += avoidance.linear.y * deltaTime;
                return;
            }

            this._tryDockAtStation(entityId, ai.homeStationId, transform);
            ai.personality.caution = 1;
            return;
        }

        if (retreatPhase === 1) {
            const health = this.getComponent<HealthComponent>(entityId, 'Health');
            const shipHull = this.getComponent<ShipHullComponent>(entityId, 'ShipHull');
            const shield = this.getComponent<ShipShieldComponent>(entityId, 'ShipShield');
            const cargo = this.getComponent<CargoComponent>(entityId, 'Cargo');

            if (!docking) {
                this._tryDockAtStation(entityId, ai.homeStationId, transform);
                return;
            }

            if (docking.status === DockStatus.APPROACHING) {
                const dx = docking.targetX - transform.x;
                const dy = docking.targetY - transform.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 15) {
                    this._applyThrustMovement(transform, velocity, engine, docking.targetX, docking.targetY, maxSpeed, deltaTime, 0.5, 1.0);
                }
                return;
            }

            if (docking.status === DockStatus.DOCKED) {
                this._sellAndRepair(entityId);

                const healthPercent = health ? health.current / health.max : (shipHull ? shipHull.currentHull / shipHull.maxHull : 1);

                if (healthPercent >= RETREAT_EXIT_HEALTH) {
                    docking.status = DockStatus.UNDOCKING;
                    ai.personality.caution = 0;
                    ai.state = AIState.EXPLORE;
                    return;
                }

                const totalRepairCost = this._calculateRepairCost(entityId);

                if (totalRepairCost > 0 && (!cargo || cargo.credits < totalRepairCost)) {
                    if (ai.repairTimer === 0) {
                        ai.repairTimer = 15;
                    }

                    if (ai.repairTimer > 0) {
                        ai.repairTimer -= deltaTime;
                        return;
                    }

                    docking.status = DockStatus.UNDOCKING;
                    ai.personality.caution = 2;
                    ai.repairTimer = 0;
                    return;
                }

                return;
            }

            if (docking.status === DockStatus.UNDOCKING) {
                const dx = docking.targetX - transform.x;
                const dy = docking.targetY - transform.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 300) {
                    const exitAngle = Math.atan2(-dy, -dx);
                    const thrust = (engine?.thrustForward || 250) * 0.5;
                    velocity.vx += Math.cos(exitAngle) * thrust * deltaTime;
                    velocity.vy += Math.sin(exitAngle) * thrust * deltaTime;
                }
                return;
            }

            return;
        }

        if (retreatPhase === 2) {
            if (docking && docking.status !== DockStatus.UNDOCKING) {
                return;
            }

            ai.decisionTimer = ai.decisionInterval;

            const angleAway = Math.atan2(dyStation, dxStation) + Math.PI;
            const farmDist = 500;
            const farmX = stationDockX + Math.cos(angleAway) * farmDist + (Math.random() - 0.5) * 400;
            const farmY = stationDockY + Math.sin(angleAway) * farmDist + (Math.random() - 0.5) * 400;

            this._applyThrustMovement(transform, velocity, engine, farmX, farmY, maxSpeed, deltaTime, 0.8, 2.0);

            const dxFarm = farmX - transform.x;
            const dyFarm = farmY - transform.y;
            const distToFarm = Math.sqrt(dxFarm * dxFarm + dyFarm * dyFarm);

            if (distToFarm < 200) {
                const asteroid = this._findBestAsteroid(transform, ai, entityId);
                if (asteroid) {
                    ai.state = AIState.MINING;
                    ai.target = {
                        id: asteroid.id,
                        type: AITargetType.ASTEROID,
                        position: { x: asteroid.x, y: asteroid.y },
                        priority: 30
                    };
                    ai.personality.caution = 3;
                    return;
                }
            }

            return;
        }

        if (retreatPhase === 3) {
            const cargo = this.getComponent<CargoComponent>(entityId, 'Cargo');
            const health = this.getComponent<HealthComponent>(entityId, 'Health');

            if (health && cargo) {
                const repairCost = Math.max(0, Math.round((health.max - health.current) * 2));
                if (repairCost <= cargo.credits && health.current / health.max < RETREAT_EXIT_HEALTH) {
                    ai.personality.caution = 4;
                    return;
                }
            }

            if (ai.state !== AIState.MINING) {
                const asteroid = this._findBestAsteroid(transform, ai, entityId);
                if (asteroid) {
                    ai.state = AIState.MINING;
                    ai.target = {
                        id: asteroid.id,
                        type: AITargetType.ASTEROID,
                        position: { x: asteroid.x, y: asteroid.y },
                        priority: 30
                    };
                }
            }
            return;
        }

        if (retreatPhase === 4) {
            if (distToStation > STATION_DOCKING_RANGE) {
                this._applyThrustMovement(transform, velocity, engine, stationTransform.x, stationTransform.y, maxSpeed, deltaTime, 1.0, 1.0);
                return;
            }

            this._tryDockAtStation(entityId, ai.homeStationId, transform);
            ai.personality.caution = 1;
        }
    }

    private _tryDockAtStation(entityId: EntityId, stationId: EntityId, transform: TransformComponent): void {
        if (this.getComponent(entityId, 'Docking')) return;

        const station = this.getComponent(stationId, 'Station');
        const stationTransform = this.getComponent<TransformComponent>(stationId, 'Transform');
        if (!station || !stationTransform) return;

        const dx = stationTransform.x - transform.x;
        const dy = stationTransform.y - transform.y;
        const distSq = dx*dx + dy*dy;

        const activationRadius = station.dockingRadius * 1.5;
        if (distSq < activationRadius * activationRadius) {
            const dockingPoint = this._getDockingPointGlobal(stationId);
            
            if (dockingPoint) {
                const collider = this.getComponent<ColliderComponent>(entityId, 'Collider');
                if (collider) {
                    collider.mask = collider.mask & ~CollisionLayer.STATION;
                }

                this.world!.addComponent(entityId, 'Docking', createDocking({
                    stationId: stationId,
                    status: DockStatus.APPROACHING,
                    targetX: dockingPoint.x,
                    targetY: dockingPoint.y,
                    targetRotation: dockingPoint.rotation
                }));
            }
        }
    }

    private _getDockingPointGlobal(stationId: EntityId): { x: number, y: number, rotation: number } | null {
        const sTransform = this.getComponent<TransformComponent>(stationId, 'Transform');
        const station = this.getComponent<StationComponent>(stationId, 'Station');
        
        if (!sTransform || !station) return null;

        const cos = Math.cos(sTransform.rotation);
        const sin = Math.sin(sTransform.rotation);

        const globalX = sTransform.x + (station.dockingPort.x * cos - station.dockingPort.y * sin);
        const globalY = sTransform.y + (station.dockingPort.x * sin + station.dockingPort.y * cos);
        const globalAngle = sTransform.rotation + station.dockingPort.angle;

        return { x: globalX, y: globalY, rotation: globalAngle };
    }

    private _getDockingPoint(stationId: EntityId): { x: number; y: number } | null {
        const station = this.getComponent(stationId, 'Station');
        if (!station) return null;
        return station.dockingPort;
    }

    private _sellAndRepair(entityId: EntityId): void {
        const health = this.getComponent<HealthComponent>(entityId, 'Health');
        const shipHull = this.getComponent<ShipHullComponent>(entityId, 'ShipHull');
        const shield = this.getComponent<ShipShieldComponent>(entityId, 'ShipShield');
        const cargo = this.getComponent<CargoComponent>(entityId, 'Cargo');
        const weapon = this.getComponent<ShipWeaponComponent>(entityId, 'ShipWeapon');

        if (!cargo) return;

        // Sell cargo first to get credits
        if (cargo.items.length > 0) {
            let totalValue = 0;
            cargo.items.forEach(item => {
                totalValue += item.value * item.quantity;
            });
            cargo.items = [];
            cargo.currentVolume = 0;
            cargo.credits += totalValue;
            console.log(`[AISystem] AI ${entityId} sold cargo for ${totalValue} CR`);
        }

        // Priority 1: Repair Health component (if exists)
        if (health && health.current < health.max) {
            const repairCost = Math.max(0, Math.round((health.max - health.current) * 2));
            if (repairCost > 0 && cargo.credits >= repairCost) {
                cargo.credits -= repairCost;
                health.current = health.max;
            }
        }

        // Priority 2: Repair ShipHull
        if (shipHull && shipHull.currentHull < shipHull.maxHull) {
            const hullRepairCost = Math.max(0, Math.round((shipHull.maxHull - shipHull.currentHull) * 2));
            if (hullRepairCost > 0 && cargo.credits >= hullRepairCost) {
                cargo.credits -= hullRepairCost;
                shipHull.currentHull = shipHull.maxHull;
            }
        }

        // Priority 3: Repair Shield
        if (shield && shield.currentShield < shield.maxShield) {
            const shieldRepairCost = Math.max(0, Math.round((shield.maxShield - shield.currentShield) * 3));
            if (shieldRepairCost > 0 && cargo.credits >= shieldRepairCost) {
                cargo.credits -= shieldRepairCost;
                shield.currentShield = shield.maxShield;
            }
        }

        // Priority 4: Buy missiles
        if (weapon && weapon.secondaryWeapon) {
            const missileCost = 1000;
            const currentMissiles = weapon.secondaryWeapon.currentAmmo ?? 0;
            const maxMissiles = weapon.secondaryWeapon.maxAmmo ?? 4;

            while (currentMissiles + cargo.credits / missileCost >= 1 && currentMissiles < maxMissiles && cargo.credits >= missileCost) {
                cargo.credits -= missileCost;
                weapon.secondaryWeapon.currentAmmo = currentMissiles + 1;
                console.log(`[AISystem] AI ${entityId} bought missile (${currentMissiles + 1}/${maxMissiles})`);
            }
        }
    }

    private _calculateRepairCost(entityId: EntityId): number {
        const health = this.getComponent<HealthComponent>(entityId, 'Health');
        const shipHull = this.getComponent<ShipHullComponent>(entityId, 'ShipHull');
        const shield = this.getComponent<ShipShieldComponent>(entityId, 'ShipShield');

        let totalCost = 0;

        if (health && health.current < health.max) {
            totalCost += Math.max(0, Math.round((health.max - health.current) * 2));
        }

        if (shipHull && shipHull.currentHull < shipHull.maxHull) {
            totalCost += Math.max(0, Math.round((shipHull.maxHull - shipHull.currentHull) * 2));
        }

        if (shield && shield.currentShield < shield.maxShield) {
            totalCost += Math.max(0, Math.round((shield.maxShield - shield.currentShield) * 3));
        }

        return totalCost;
    }

    private _faceTarget(entityId: EntityId, transform: TransformComponent, target: TransformComponent, deltaTime: number, velocity: VelocityComponent): void {
        const dx = target.x - transform.x;
        const dy = target.y - transform.y;
        const targetAngle = Math.atan2(dy, dx);
        
        let angleDiff = targetAngle - transform.rotation;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const rotationSpeed = 10.0;
        velocity.angularVelocity = angleDiff * rotationSpeed;
    }

    private _tryFire(entityId: EntityId, transform: TransformComponent, ai: AIControllerComponent, isMining: boolean): void {
        if (!ai.target || typeof ai.target.id !== 'number') return;

        const targetId = ai.target.id as EntityId;
        const targetTransform = this.getComponent<TransformComponent>(targetId, 'Transform');
        if (!targetTransform) return;

        // Check if AI is inside any station shield - if so, don't fire at anything
        const aiStations = [
            { x: 1500, y: 0, shieldRadius: 550 },
            { x: -1500, y: 0, shieldRadius: 550 }
        ];
        for (const station of aiStations) {
            const aiDx = transform.x - station.x;
            const aiDy = transform.y - station.y;
            const aiDist = Math.sqrt(aiDx * aiDx + aiDy * aiDy);
            if (aiDist < station.shieldRadius) {
                return; // AI is inside shield, don't fire
            }
        }

        // Check if target (asteroid or enemy) is inside any station shield
        for (const station of aiStations) {
            const targetDx = targetTransform.x - station.x;
            const targetDy = targetTransform.y - station.y;
            const targetDist = Math.sqrt(targetDx * targetDx + targetDy * targetDy);
            if (targetDist < station.shieldRadius) {
                return; // Target is inside shield, don't fire
            }
        }

        const weapon = this.getComponent<ShipWeaponComponent>(entityId, 'ShipWeapon');
        if (!weapon) return;

        if (weapon.cooldown > 0) return;
        if (weapon.isOverheated) return;

        const dx = targetTransform.x - transform.x;
        const dy = targetTransform.y - transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (isMining) {
            const otherTag = (this.world as any).getEntity(targetId)?.tag || '';
            if (otherTag !== 'asteroid') return;
            if (dist > ai.attackRange * 1.5) return;
        } else {
            if (dist > ai.attackRange) return;

            const myFaction = this.getComponent<FactionComponent>(entityId, 'Faction');
            const targetFaction = this.getComponent<FactionComponent>(targetId, 'Faction');

            if (myFaction && targetFaction) {
                const isAllied = this._areAllies(myFaction, targetFaction);
                if (isAllied) return;
            } else if (!targetFaction) {
                const otherTag = (this.world as any).getEntity(targetId)?.tag || '';
                if (otherTag !== 'enemy' && otherTag !== 'Misiks') return;
            }

            const otherTag = (this.world as any).getEntity(ai.target.id)?.tag || '';
            if (otherTag === 'asteroid' && !isMining) return;
        }

        if (this._isAllyInLineOfFire(entityId, transform, targetTransform, dist)) return;

        const targetAngle = Math.atan2(dy, dx);
        let angleDiff = Math.abs(targetAngle - transform.rotation);
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

        let fireCone = 1.0 + ai.personality.aggressiveness * 0.4;

        if (isMining) {
            const targetTag = (this.world as any).getEntity(targetId)?.tag || '';
            if (targetTag === 'asteroid' && dist < 100) {
                fireCone = Math.PI;
            }
        }

        if (angleDiff > fireCone) return;

        const reactor = this.getComponent<ShipReactorComponent>(entityId, 'ShipReactor');
        if (reactor && reactor.currentEnergy < weapon.energyCost) return;

        // Cooldown after target switch prevents firing at old target position
        if (ai.targetSwitchCooldown > 0) return;

        // Safety check: verify target still exists before firing
        const targetEntity = (this.world as any).getEntity(targetId);
        if (!targetEntity) return;

        this.emit('ai:fire', {
            entityId,
            targetId: ai.target.id,
            weaponType: 'primary'
        });

        weapon.cooldown = 1 / weapon.fireRate;
    }

    private _isAllyInLineOfFire(
        entityId: EntityId,
        transform: TransformComponent,
        targetTransform: TransformComponent,
        targetDist: number
    ): boolean {
        const myFaction = this.getComponent<FactionComponent>(entityId, 'Faction');
        if (!myFaction) return false;

        const allShips = this.queryEntities(['Transform', 'Faction', 'ShipHull']);
        
        for (const otherId of allShips) {
            if (otherId === entityId) continue;

            const otherFaction = this.getComponent<FactionComponent>(otherId, 'Faction');
            if (!otherFaction) continue;

            if (!this._areAllies(myFaction, otherFaction)) continue;

            const otherTransform = this.getComponent<TransformComponent>(otherId, 'Transform');
            if (!otherTransform) continue;

            const otherDx = otherTransform.x - transform.x;
            const otherDy = otherTransform.y - transform.y;
            const otherDist = Math.sqrt(otherDx * otherDx + otherDy * otherDy);

            if (otherDist < 30 || otherDist > targetDist - 20) continue;

            const angleToTarget = Math.atan2(targetTransform.y - transform.y, targetTransform.x - transform.x);
            const angleToOther = Math.atan2(otherDy, otherDx);
            let angleDiff = Math.abs(angleToTarget - angleToOther);
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

            if (angleDiff < 0.26) return true;
        }

        return false;
    }

    private _getAllyAvoidanceForce(
        entityId: EntityId,
        transform: TransformComponent,
        targetTransform: TransformComponent,
        maxForce: number
    ): { x: number; y: number } {
        const myFaction = this.getComponent<FactionComponent>(entityId, 'Faction');
        if (!myFaction) return { x: 0, y: 0 };

        const allShips = this.queryEntities(['Transform', 'Faction', 'ShipHull']);
        let avoidX = 0;
        let avoidY = 0;

        for (const otherId of allShips) {
            if (otherId === entityId) continue;

            const otherFaction = this.getComponent<FactionComponent>(otherId, 'Faction');
            if (!otherFaction) continue;

            if (!this._areAllies(myFaction, otherFaction)) continue;

            const otherTransform = this.getComponent<TransformComponent>(otherId, 'Transform');
            if (!otherTransform) continue;

            const otherDx = otherTransform.x - transform.x;
            const otherDy = otherTransform.y - transform.y;
            const otherDist = Math.sqrt(otherDx * otherDx + otherDy * otherDy);

            if (otherDist > 150 || otherDist < 20) continue;

            const angleToTarget = Math.atan2(targetTransform.y - transform.y, targetTransform.x - transform.x);
            const angleToOther = Math.atan2(otherDy, otherDx);
            let angleDiff = Math.abs(angleToTarget - angleToOther);
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

            if (angleDiff < 0.52) {
                const strength = (150 - otherDist) / 150;
                const perpAngle = angleToTarget + Math.PI / 2;
                avoidX += Math.cos(perpAngle) * strength * maxForce;
                avoidY += Math.sin(perpAngle) * strength * maxForce;
            }
        }

        return { x: avoidX, y: avoidY };
    }

    private _handleAsteroidDestroyed(x: number, y: number, parentScale: number): void {
        // Find all AI entities that were mining and are near this position
        const entities = this.queryEntities(['AIController', 'Transform']);
        
        for (const entityId of entities) {
            const ai = this.getComponent<AIControllerComponent>(entityId, 'AIController');
            const transform = this.getComponent<TransformComponent>(entityId, 'Transform');
            
            if (!ai || !transform) continue;
            
            // Only affect AI that was mining
            if (ai.state !== AIState.MINING) continue;
            
            const dx = transform.x - x;
            const dy = transform.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Only affect AI that was near the destroyed asteroid (within 400px)
            if (dist > 400) continue;
            
            // Look for fragments near the destruction point
            const fragment = this._findNearestFragment(x, y, 200);
            if (fragment) {
                const fragTransform = this.getComponent<TransformComponent>(fragment, 'Transform');
                if (fragTransform) {
                    // Set new target to fragment immediately
                    ai.target = {
                        id: fragment,
                        type: AITargetType.ASTEROID,
                        position: { x: fragTransform.x, y: fragTransform.y },
                        priority: 100
                    };
                    // Reset approach tracking for new target
                    ai.initialApproachComplete = false;
                    ai.emergencyRetreatCooldown = 0;
                    // Short cooldown to prevent firing at old target position (backup safety)
                    ai.targetSwitchCooldown = 0.03;
                }
            }
        }
    }

    private _findNearestFragment(x: number, y: number, range: number): EntityId | null {
        const asteroids = (this.world as any).getEntitiesByTag('asteroid') as any[];
        if (asteroids.length === 0) return null;

        let nearestId: EntityId | null = null;
        let nearestDist = range;

        for (const ast of asteroids) {
            const t = this.getComponent<TransformComponent>(ast.id, 'Transform');
            if (!t) continue;
            
            // Skip if already targeted by this AI (handled elsewhere)
            const dx = t.x - x;
            const dy = t.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestId = ast.id;
            }
        }

        return nearestId;
    }

    private _areAllies(faction1: FactionComponent, faction2: FactionComponent): boolean {
        // Allies only if same faction
        return faction1.factionId === faction2.factionId;
    }

    private _getAsteroidSize(asteroidId: EntityId): number {
        const collider = this.getComponent<ColliderComponent>(asteroidId, 'Collider');
        return collider?.radius || 20;
    }
}

export default AISystem;

