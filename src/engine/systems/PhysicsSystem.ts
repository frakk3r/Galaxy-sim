/**
 * =============================================================================
 * PHYSICS-SYSTEM.TS - Sistema per fisica avanzata
 * =============================================================================
 */

import System from '../ecs/System';
import { TransformComponent } from '../../game/components/Transform';
import { VelocityComponent } from '../../game/components/Velocity';
import { PhysicsComponent } from '../../game/components/Physics';
import { ColliderComponent, CollisionLayer } from '../../game/components/Collider';
import { HealthComponent } from '../../game/components/Health';
import { FactionComponent } from '../../game/components/Faction';
import { ShipHullComponent } from '../../game/components/ShipHull';
import { ShipShieldComponent } from '../../game/components/ShipShield';
import { EntityId, IWorld } from '../ecs/types';

interface Force {
    fx: number;
    fy: number;
}

interface Impulse {
    ix: number;
    iy: number;
}

interface GlobalForce {
    id: string;
    x: number | ((entityId: EntityId, transform: TransformComponent) => number);
    y: number | ((entityId: EntityId, transform: TransformComponent) => number);
}

export class PhysicsSystem extends System {
    private _globalForces: GlobalForce[];
    private _pendingForces: Map<EntityId, Force>;
    private _pendingImpulses: Map<EntityId, Impulse>;
    private _collisionListener: (() => void) | null;
    private _collisionStayListener: (() => void) | null;
    private _separationBias: number;
    private _minSeparation: number;

    constructor() {
        super('PhysicsSystem', 60);

        this._globalForces = [];
        this._pendingForces = new Map();
        this._pendingImpulses = new Map();
        this._collisionListener = null;
        this._collisionStayListener = null;
        this._separationBias = 1.5;
        this._minSeparation = 0.5;
    }

    init(world: IWorld): void {
        super.init(world);

        if (this._collisionListener) {
            this._collisionListener();
        }
        if (this._collisionStayListener) {
            this._collisionStayListener();
        }

        // Ascolta eventi di collisione per risposta fisica
        this._collisionListener = this.on('collision:enter', (data) => {
            this._handleCollision(data, false); // false = primo impatto
        });

        // Ascolta anche collision:stay per separazione continua
        this._collisionStayListener = this.on('collision:stay', (data) => {
            this._handleCollision(data, true); // true = contatto continuo
        });

        console.log('[PhysicsSystem] Inizializzato');
    }

    update(deltaTime: number): void {
        const entities = this.queryEntities(['Transform', 'Velocity', 'Physics']);

        const stations = [
            { x: 1500, y: 0, faction: 'Misiks' },
            { x: -1500, y: 0, faction: 'Elarans' },
            { x: 0, y: 1500, faction: 'Malagasy' },
            { x: 0, y: -1500, faction: 'Okropoyds' }
        ];

        const colliders = this.queryEntities(['Transform', 'Collider']);

        for (const entityId of colliders) {
            const collider = this.getComponent<ColliderComponent>(entityId as EntityId, 'Collider');
            const transform = this.getComponent<TransformComponent>(entityId as EntityId, 'Transform');
            const velocity = this.getComponent<VelocityComponent>(entityId as EntityId, 'Velocity');
            const health = this.getComponent<HealthComponent>(entityId as EntityId, 'Health');
            const faction = this.getComponent<FactionComponent>(entityId as EntityId, 'Faction');
            const shipHull = this.getComponent<ShipHullComponent>(entityId as EntityId, 'ShipHull');

            if (!collider || !transform || !velocity) continue;

            if (collider.layer === CollisionLayer.STATION) continue;

            const effectiveRadius = collider.layer === CollisionLayer.ASTEROID ? collider.radius : 20;

            let isShip = collider.layer === CollisionLayer.ENEMY || collider.layer === CollisionLayer.PLAYER;

            for (const station of stations) {
                const dx = transform.x - station.x;
                const dy = transform.y - station.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const shieldEdge = 550;

                const isTouchingShield = dist < shieldEdge + effectiveRadius && dist > shieldEdge - effectiveRadius * 2;

                let shouldBounce = false;

                if (collider.layer === CollisionLayer.ASTEROID) {
                    shouldBounce = true;
                } else if (isShip) {
                    const shipFaction = faction?.factionId || 'neutral';
                    if (shipFaction !== station.faction) {
                        shouldBounce = true;
                    }
                }

                if (isTouchingShield && shouldBounce) {
                    const impactForce = Math.sqrt(velocity.vx * velocity.vx + velocity.vy * velocity.vy);

                    const bounceAngle = Math.atan2(dy, dx);
                    const bounceForce = impactForce * 1.8;

                    velocity.vx = Math.cos(bounceAngle) * bounceForce;
                    velocity.vy = Math.sin(bounceAngle) * bounceForce;

                    transform.x = station.x + Math.cos(bounceAngle) * (shieldEdge + effectiveRadius + 5);
                    transform.y = station.y + Math.sin(bounceAngle) * (shieldEdge + effectiveRadius + 5);

                    if (collider.layer === CollisionLayer.ASTEROID && health) {
                        const damage = Math.max(30, Math.floor(impactForce * 0.5));
                        health.current -= damage;

                        if (health.current <= 0) {
                            this.emit('entity:destroyed', { entityId, killerId: 'station_shield' });
                        }
                    } else if (isShip) {
                        const totalDamage = Math.floor(Math.max(15, Math.floor(impactForce * 0.25)));
                        let remainingDamage = totalDamage;

                        const shield = this.getComponent<ShipShieldComponent>(entityId as EntityId, 'ShipShield');
                        if (shield && shield.currentShield > 0) {
                            if (shield.currentShield >= remainingDamage) {
                                shield.currentShield -= remainingDamage;
                                remainingDamage = 0;
                            } else {
                                remainingDamage -= shield.currentShield;
                                shield.currentShield = 0;
                            }
                        }

                        if (remainingDamage > 0 && shipHull) {
                            shipHull.currentHull -= remainingDamage;
                            if (shipHull.currentHull <= 0) {
                                this.emit('entity:destroyed', { entityId, killerId: 'station_shield' });
                            }
                        }
                    }
                }
            }
        }

        for (const entityId of entities) {
            this._processEntity(entityId, deltaTime);
        }

        this._pendingForces.clear();
        this._pendingImpulses.clear();
    }

    private _processEntity(entityId: EntityId, deltaTime: number): void {
        const transform = this.getComponent<TransformComponent>(entityId, 'Transform');
        const velocity = this.getComponent<VelocityComponent>(entityId, 'Velocity');
        const physics = this.getComponent<PhysicsComponent>(entityId, 'Physics');

        if (!transform || !velocity || !physics) return;
        if (physics.isKinematic) return;

        // STEP 1: Applica forze globali
        for (const force of this._globalForces) {
            const fx = typeof force.x === 'function' ? force.x(entityId, transform) : force.x;
            const fy = typeof force.y === 'function' ? force.y(entityId, transform) : force.y;

            velocity.vx += (fx / physics.mass) * deltaTime;
            velocity.vy += (fy / physics.mass) * deltaTime;
        }

        // STEP 2: Applica forze pendenti
        const force = this._pendingForces.get(entityId);
        if (force) {
            velocity.vx += (force.fx / physics.mass) * deltaTime;
            velocity.vy += (force.fy / physics.mass) * deltaTime;
        }

        // STEP 3: Applica impulsi
        const impulse = this._pendingImpulses.get(entityId);
        if (impulse) {
            velocity.vx += impulse.ix / physics.mass;
            velocity.vy += impulse.iy / physics.mass;
        }

        // STEP 4: Applica attrito
        if (physics.friction > 0) {
            const frictionFactor = 1 - physics.friction * deltaTime;
            velocity.vx *= frictionFactor;
            velocity.vy *= frictionFactor;
        }
    }

    private _handleCollision(data: any, isStay: boolean = false): void {
        const { entityA, entityB, normal, depth } = data;

        const physicsA = this.getComponent<PhysicsComponent>(entityA, 'Physics');
        const physicsB = this.getComponent<PhysicsComponent>(entityB, 'Physics');
        const velocityA = this.getComponent<VelocityComponent>(entityA, 'Velocity');
        const velocityB = this.getComponent<VelocityComponent>(entityB, 'Velocity');

        if (!physicsA && !physicsB) return;

        const colliderA = this.getComponent<ColliderComponent>(entityA, 'Collider');
        const colliderB = this.getComponent<ColliderComponent>(entityB, 'Collider');

        if (colliderA?.isTrigger || colliderB?.isTrigger) return;

        const isKinematicA = physicsA?.isKinematic ?? false;
        const isKinematicB = physicsB?.isKinematic ?? false;

        if (isKinematicA && isKinematicB) return;

        // CALCOLO DANNO DA IMPATTO
        if (!isStay) {
            const dvx = (velocityA?.vx ?? 0) - (velocityB?.vx ?? 0);
            const dvy = (velocityA?.vy ?? 0) - (velocityB?.vy ?? 0);
            const impactForce = Math.sqrt(dvx*dvx + dvy*dvy);

            const layerA = colliderA?.layer ?? 0;
            const layerB = colliderB?.layer ?? 0;
            const isAsteroidA = layerA === CollisionLayer.ASTEROID;
            const isAsteroidB = layerB === CollisionLayer.ASTEROID;

            if (impactForce > 50 && (!isAsteroidA || !isAsteroidB)) {
                const typeA = isAsteroidA ? 'ASTEROID' : layerA === CollisionLayer.PLAYER ? 'PLAYER' : layerA === CollisionLayer.ENEMY ? 'ENEMY' : 'OTHER';
                const typeB = isAsteroidB ? 'ASTEROID' : layerB === CollisionLayer.PLAYER ? 'PLAYER' : layerB === CollisionLayer.ENEMY ? 'ENEMY' : 'OTHER';
                console.log(`[Physics] ${typeA} <-> ${typeB} Force: ${impactForce.toFixed(2)}`);
            }

            if (!isStay) {
                this.emit('physics:collision', {
                    entityA,
                    entityB,
                    normal,
                    depth,
                    impactForce,
                    isFirstImpact: true
                });
            }
        }

        const transformA = this.getComponent<TransformComponent>(entityA, 'Transform');
        const transformB = this.getComponent<TransformComponent>(entityB, 'Transform');

        const massA = isKinematicA ? Infinity : (physicsA?.mass ?? 1);
        const massB = isKinematicB ? Infinity : (physicsB?.mass ?? 1);

        // Controlla se collisiona con la stazione o boundary
        const isStationA = colliderA?.layer === CollisionLayer.STATION;
        const isStationB = colliderB?.layer === CollisionLayer.STATION;
        const isBoundaryA = colliderA?.layer === CollisionLayer.BOUNDARY;
        const isBoundaryB = colliderB?.layer === CollisionLayer.BOUNDARY;
        const isStationOrBoundaryCollision = isStationA || isStationB || isBoundaryA || isBoundaryB;

        // SEPARAZIONE - disabilitata per collisioni con stazione/boundary per evitare teleport
        if (!isStationOrBoundaryCollision) {
            const effectiveDepth = Math.max(depth * this._separationBias, this._minSeparation);

            if (effectiveDepth > 0 && transformA && transformB) {
                if (isKinematicA && !isKinematicB) {
                    transformB.x += normal.x * effectiveDepth;
                    transformB.y += normal.y * effectiveDepth;
                } else if (!isKinematicA && isKinematicB) {
                    transformA.x -= normal.x * effectiveDepth;
                    transformA.y -= normal.y * effectiveDepth;
                } else {
                    const totalMass = massA + massB;
                    const ratioA = massB / totalMass;
                    const ratioB = massA / totalMass;

                    transformA.x -= normal.x * effectiveDepth * ratioA;
                    transformA.y -= normal.y * effectiveDepth * ratioA;
                    transformB.x += normal.x * effectiveDepth * ratioB;
                    transformB.y += normal.y * effectiveDepth * ratioB;
                }
            }
        }

        // RISPOSTA VELOCITÀ - sempre attiva anche per stazioni
        if (velocityA || velocityB) {
            const vAx = velocityA?.vx ?? 0;
            const vAy = velocityA?.vy ?? 0;
            const vBx = velocityB?.vx ?? 0;
            const vBy = velocityB?.vy ?? 0;

            const relVelX = vAx - vBx;
            const relVelY = vAy - vBy;
            const relVelNormal = relVelX * normal.x + relVelY * normal.y;

            if (relVelNormal > 0) return;

            const restitution = Math.min(
                physicsA?.restitution ?? 0.5,
                physicsB?.restitution ?? 0.5
            );

            let invMassA = isKinematicA ? 0 : (1 / massA);
            let invMassB = isKinematicB ? 0 : (1 / massB);

            if (invMassA + invMassB === 0) return;

            let j = -(1 + restitution) * relVelNormal;
            j /= invMassA + invMassB;

            if (!isKinematicA && velocityA) {
                velocityA.vx += j * invMassA * normal.x;
                velocityA.vy += j * invMassA * normal.y;
            }
            if (!isKinematicB && velocityB) {
                velocityB.vx -= j * invMassB * normal.x;
                velocityB.vy -= j * invMassB * normal.y;
            }
        }
    }

    applyForce(entityId: EntityId, fx: number, fy: number): void {
        const existing = this._pendingForces.get(entityId);
        if (existing) {
            existing.fx += fx;
            existing.fy += fy;
        } else {
            this._pendingForces.set(entityId, { fx, fy });
        }
    }

    applyImpulse(entityId: EntityId, ix: number, iy: number): void {
        const existing = this._pendingImpulses.get(entityId);
        if (existing) {
            existing.ix += ix;
            existing.iy += iy;
        } else {
            this._pendingImpulses.set(entityId, { ix, iy });
        }
    }

    applyExplosion(x: number, y: number, radius: number, force: number): void {
        const entities = this.queryEntities(['Transform', 'Velocity', 'Physics']);

        for (const entityId of entities) {
            const transform = this.getComponent<TransformComponent>(entityId, 'Transform');
            const physics = this.getComponent<PhysicsComponent>(entityId, 'Physics');

            if (!transform || !physics || physics.isKinematic) continue;

            const dx = transform.x - x;
            const dy = transform.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist >= radius || dist === 0) continue;

            const falloff = 1 - (dist / radius);
            const impulseStrength = force * falloff;

            const nx = dx / dist;
            const ny = dy / dist;

            this.applyImpulse(entityId, nx * impulseStrength, ny * impulseStrength);
        }

        this.emit('physics:explosion', { x, y, radius, force });
    }

    addGlobalForce(id: string, x: number | ((entityId: EntityId, transform: TransformComponent) => number), y: number | ((entityId: EntityId, transform: TransformComponent) => number)): void {
        this.removeGlobalForce(id);
        this._globalForces.push({ id, x, y });
    }

    removeGlobalForce(id: string): void {
        this._globalForces = this._globalForces.filter(f => f.id !== id);
    }

    addGravityWell(id: string, x: number, y: number, strength: number, maxRange: number = Infinity): void {
        this.addGlobalForce(id,
            (entityId: EntityId, transform: TransformComponent) => {
                const dx = x - transform.x;
                const dy = y - transform.y;
                const distSq = dx * dx + dy * dy;
                const dist = Math.sqrt(distSq);

                if (dist > maxRange || dist < 1) return 0;

                const gx = (dx / dist) * (strength / distSq);
                return gx;
            },
            (entityId: EntityId, transform: TransformComponent) => {
                const dx = x - transform.x;
                const dy = y - transform.y;
                const distSq = dx * dx + dy * dy;
                const dist = Math.sqrt(distSq);

                if (dist > maxRange || dist < 1) return 0;

                const gy = (dy / dist) * (strength / distSq);
                return gy;
            }
        );
    }

    getStats(): object {
        return {
            ...super.getStats(),
            globalForces: this._globalForces.length,
            pendingForces: this._pendingForces.size,
            pendingImpulses: this._pendingImpulses.size
        };
    }

    destroy(): void {
        if (this._collisionListener) {
            this._collisionListener();
            this._collisionListener = null;
        }
        if (this._collisionStayListener) {
            this._collisionStayListener();
            this._collisionStayListener = null;
        }
        this._globalForces = [];
        this._pendingForces.clear();
        this._pendingImpulses.clear();
        super.destroy();
    }
}

export default PhysicsSystem;
