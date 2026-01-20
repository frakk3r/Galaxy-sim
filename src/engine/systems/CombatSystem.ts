/**
 * =============================================================================
 * COMBAT-SYSTEM.TS - Sistema per gestione combattimento
 * =============================================================================
 */

import System from '../ecs/System';
import { WeaponType, DamageType, ShipWeaponComponent, DamageTypeEnum, WeaponTypeEnum } from '../../game/components/ShipWeapon';
import { CollisionLayer, createCollider, ColliderComponent } from '../../game/components/Collider';
import { SHAPE_PRESETS, createRenderable, RenderableComponent } from '../../game/components/Renderable';
import { createTransform, TransformComponent } from '../../game/components/Transform';
import { createVelocity, VelocityComponent } from '../../game/components/Velocity';
import { createPhysics, PhysicsComponent } from '../../game/components/Physics';
import { createHealth, HealthComponent } from '../../game/components/Health';
import { ProjectileComponent } from '../../game/components/Projectile';
import { ShipHullComponent } from '../../game/components/ShipHull';
import { ShipShieldComponent } from '../../game/components/ShipShield';
import { ShipReactorComponent } from '../../game/components/ShipReactor';
import { createLifetime } from '../../game/components/Lifetime';
import { EntityId, IWorld, Entity } from '../ecs/types';
import { PhysicsSystem } from './PhysicsSystem';

export class CombatSystem extends System {
    private _projectilePool: any[];
    private _maxPoolSize: number;
    private _activeProjectiles: Set<EntityId>;
    private _stats: {
        projectilesFired: number;
        projectilesHit: number;
        damageDealt: number;
        entitiesDestroyed: number;
    };
    private _collisionImmunity: Map<EntityId, number>;
    private _collisionPairCooldown: Map<string, number>;
    private _processedCollisions: Set<string>;
    private _explosionEffects: Array<{ entityId: EntityId, destroyTime: number }>;

    constructor() {
        super('CombatSystem', 55);

        this._projectilePool = [];
        this._maxPoolSize = 500;
        this._activeProjectiles = new Set();
        this._stats = {
            projectilesFired: 0,
            projectilesHit: 0,
            damageDealt: 0,
            entitiesDestroyed: 0
        };
        this._collisionImmunity = new Map();
        this._collisionPairCooldown = new Map();
        this._processedCollisions = new Set();
        this._explosionEffects = [];
    }

    init(world: IWorld): void {
        super.init(world);

        this.on('trigger:enter', (data: any) => this._handleProjectileCollision(data));
        this.on('collision:enter', (data: any) => this._handleProjectileCollision(data));
        this.on('ai:fire', (data: any) => this._handleFireRequest(data.entityId));
        this.on('input:action:pressed', (data: any) => {
            if (data.action === 'fire_primary' || data.action === 'fire_secondary') {
                const players = (this.world as any).getEntitiesByTag('player') as Entity[];
                if (players.length > 0) {
                    const isSecondary = data.action === 'fire_secondary';
                    this._handleFireRequest(players[0].id, isSecondary);
                }
            }
        });
        this.on('physics:collision', (data: any) => this._handleCollisionDamage(data));
    }

    update(deltaTime: number): void {
        this._updateWeapons(deltaTime);
        this._updateProjectiles(deltaTime);
        this._updateShields(deltaTime);
        this._updateReactors(deltaTime);

        const now = performance.now();
        for (const [pairKey, timestamp] of this._collisionPairCooldown) {
            if (now - timestamp > 1500) {
                this._collisionPairCooldown.delete(pairKey);
            }
        }

        // Cleanup explosion effects that have exceeded their lifetime
        for (let i = this._explosionEffects.length - 1; i >= 0; i--) {
            const effect = this._explosionEffects[i];
            if (now >= effect.destroyTime) {
                if (this.world!.entityExists(effect.entityId)) {
                    this.world!.destroyEntity(effect.entityId);
                    console.log(`[Combat] Destroyed explosion effect: entityId=${effect.entityId}`);
                }
                this._explosionEffects.splice(i, 1);
            }
        }

        const inputSystem = this.world!.getSystem('InputSystem') as any;
        if (inputSystem) {
            const players = (this.world as any).getEntitiesByTag('player') as Entity[];
            if (players.length > 0) {
                const playerId = players[0].id;

                const primaryPressed = inputSystem.isActionPressed('fire_primary');
                const secondaryPressed = inputSystem.isActionPressed('fire_secondary');

                if (primaryPressed || secondaryPressed) {
                    this._handleFireRequest(playerId, secondaryPressed);
                }
            }
        }
    }

    private _updateWeapons(deltaTime: number): void {
        const entities = this.queryEntities(['ShipWeapon']);

        for (const entityId of entities) {
            const weapon = this.getComponent<ShipWeaponComponent>(entityId, 'ShipWeapon');
            if (!weapon) continue;

            if (weapon.cooldown > 0) {
                weapon.cooldown -= deltaTime;
            }

            if (weapon.secondaryCooldown! > 0) {
                weapon.secondaryCooldown -= deltaTime;
            }

            if (weapon.heat! > 0) {
                weapon.heat! -= weapon.heatDissipation! * deltaTime;
                weapon.heat = Math.max(0, weapon.heat!);

                if (weapon.isOverheated! && weapon.heat! < weapon.overheatThreshold! * 0.5) {
                    weapon.isOverheated = false;
                }
            }
        }
    }

    private _updateProjectiles(deltaTime: number): void {
        for (const projectileId of this._activeProjectiles) {
            if (!this.world!.entityExists(projectileId)) {
                this._activeProjectiles.delete(projectileId);
                continue;
            }

            const projectile = this.getComponent<ProjectileComponent>(projectileId, 'Projectile');
            if (!projectile) continue;

            projectile.lifetime -= deltaTime;

            if (projectile.lifetime <= 0) {
                this._destroyProjectile(projectileId);
            }
        }
    }

    private _updateShields(deltaTime: number): void {
        const entities = this.queryEntities(['ShipShield']);

        for (const entityId of entities) {
            const shield = this.getComponent<ShipShieldComponent>(entityId, 'ShipShield');
            const reactor = this.getComponent<ShipReactorComponent>(entityId, 'ShipReactor');

            if (!shield || !shield.isActive) continue;

            if (shield.regenTimer > 0) {
                shield.regenTimer -= deltaTime;
            }

            if (shield.regenTimer <= 0 && shield.currentShield < shield.maxShield) {
                const energyNeeded = shield.energyPerRegen * shield.regenRate * deltaTime;
                
                if (!reactor || reactor.currentEnergy >= energyNeeded) {
                    if (reactor) {
                        reactor.currentEnergy -= energyNeeded;
                    }

                    shield.currentShield += shield.regenRate * deltaTime * shield.efficiency;
                    shield.currentShield = Math.min(shield.currentShield, shield.maxShield);

                    if (shield.currentShield > 0) {
                        shield.isDown = false;
                    }
                }
            }

            if (reactor && shield.currentShield > 0) {
                reactor.currentEnergy -= shield.passiveEnergyDrain * deltaTime;
            }
        }
    }

    private _updateReactors(deltaTime: number): void {
        const entities = this.queryEntities(['ShipReactor']);

        for (const entityId of entities) {
            const reactor = this.getComponent<ShipReactorComponent>(entityId, 'ShipReactor');
            if (!reactor || !reactor.isActive) continue;

            if (reactor.currentEnergy < reactor.energyCapacity) {
                reactor.currentEnergy += reactor.energyGeneration * deltaTime * reactor.efficiency;
                if (reactor.currentEnergy > reactor.energyCapacity) {
                    reactor.currentEnergy = reactor.energyCapacity;
                }
            }
        }
    }

    private _handleFireRequest(entityId: EntityId, isSecondary: boolean = false): void {
        const weapon = this.getComponent<ShipWeaponComponent>(entityId, 'ShipWeapon');
        const transform = this.getComponent<TransformComponent>(entityId, 'Transform');
        const reactor = this.getComponent<ShipReactorComponent>(entityId, 'ShipReactor');

        if (!transform || !weapon) {
            return;
        }

        if (isSecondary && !weapon.secondaryWeapon) {
            return;
        }

        const targetWeapon = isSecondary ? weapon.secondaryWeapon! : weapon;

        if (!this._canFireCustom(targetWeapon, weapon, reactor, isSecondary)) {
            return;
        }

        if (reactor) {
            reactor.currentEnergy -= (targetWeapon.energyCost ?? 0);
        }

        const maxAmmo = targetWeapon.maxAmmo;
        const currentAmmo = targetWeapon.currentAmmo;
        if (maxAmmo !== null && currentAmmo !== null && (currentAmmo ?? 0) > 0) {
            targetWeapon.currentAmmo = (currentAmmo ?? 0) - 1;
        }

        if (isSecondary) {
            weapon.secondaryCooldown = 1 / (targetWeapon.fireRate ?? 1);
        } else {
            if (reactor) {
                reactor.currentEnergy -= (targetWeapon.energyCost ?? 0);
            }
            weapon.heat = (weapon.heat ?? 0) + (targetWeapon.heatPerShot ?? 0);
            if ((weapon.heat ?? 0) >= (weapon.maxHeat ?? 100)) {
                weapon.isOverheated = true;
            }
            weapon.cooldown = 1 / (targetWeapon.fireRate ?? 1);
        }

        this._createProjectile(entityId, targetWeapon as ShipWeaponComponent, transform, isSecondary);

        this._stats.projectilesFired++;

        this.emit('combat:fire', {
            entityId,
            weaponId: targetWeapon.moduleId,
            weaponType: targetWeapon.weaponType
        });
    }

    private _getEntityWeapons(entityId: EntityId): ShipWeaponComponent[] {
        const weapon = this.getComponent<ShipWeaponComponent>(entityId, 'ShipWeapon');
        return weapon ? [weapon] : [];
    }

    private _canFire(weapon: ShipWeaponComponent, reactor: ShipReactorComponent | undefined): boolean {
        if (!weapon.isActive) return false;
        if (weapon.cooldown > 0) return false;
        if (weapon.isOverheated) return false;
        if (weapon.maxAmmo !== null && weapon.currentAmmo !== null && weapon.currentAmmo <= 0) return false;
        if (reactor && reactor.currentEnergy < weapon.energyCost) return false;
        return true;
    }

    private _canFireCustom(targetWeapon: Partial<ShipWeaponComponent>, mainWeapon: ShipWeaponComponent, reactor: ShipReactorComponent | undefined, isSecondary: boolean): boolean {
        const isActive = targetWeapon.isActive === false ? false : true;
        if (!isActive) return false;
        if (isSecondary) {
            if ((mainWeapon.secondaryCooldown ?? 0) > 0) return false;
        } else {
            if ((targetWeapon.cooldown ?? 0) > 0) return false;
            if (targetWeapon.isOverheated === true) return false;
        }
        const maxAmmo = targetWeapon.maxAmmo;
        const currentAmmo = targetWeapon.currentAmmo;
        if (maxAmmo !== null && currentAmmo !== null && (currentAmmo ?? 0) <= 0) return false;
        if (reactor && reactor.currentEnergy < (targetWeapon.energyCost ?? 0)) return false;
        return true;
    }

    private _createProjectile(shooterId: EntityId, weapon: ShipWeaponComponent, shooterTransform: TransformComponent, isSecondary: boolean = false): EntityId {
        const spawnDist = 20;
        const spread = (Math.random() - 0.5) * weapon.spread;
        const angle = shooterTransform.rotation + spread;

        const x = shooterTransform.x + Math.cos(shooterTransform.rotation) * spawnDist + weapon.offsetX;
        const y = shooterTransform.y + Math.sin(shooterTransform.rotation) * spawnDist + weapon.offsetY;

        const projectileId = this.world!.createEntity('projectile');

        this.world!.addComponent(projectileId, 'Transform', createTransform({
            x, y,
            rotation: angle,
            scale: 1,
            prevX: x,
            prevY: y,
            prevRotation: angle
        }));

        const speed = weapon.projectileSpeed!;
        this.world!.addComponent(projectileId, 'Velocity', createVelocity({
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            angularVelocity: 0,
            maxSpeed: speed * 1.5,
            drag: 0
        }));

        const projColor = this._getProjectileColor(weapon.damageType!);
        const projRadius = weapon.projectileRadius!;
  
        // Check if this is an explosive weapon with AOE damage
        const isExplosive = weapon.damageType === DamageType.EXPLOSIVE && weapon.explosionRadius > 0;
        const missileRadius = 15; // 15px for missiles (both render and hitbox)
        const hitboxRadius = isExplosive ? missileRadius : projRadius;

        // Use hitbox radius for rendering too so visual matches collision
        const renderRadius = hitboxRadius;

        this.world!.addComponent(projectileId, 'Renderable', createRenderable({
            type: 'circle',
            radius: renderRadius,
            fillColor: projColor,
            strokeColor: '#ffffff',
            strokeWidth: 2,
            glowEnabled: true,
            glowColor: projColor,
            glowIntensity: 20,
            layer: 15,
            visible: true,
            alpha: 1.0
        }));

        this.world!.addComponent(projectileId, 'Collider', createCollider({
            type: 'circle',
            radius: hitboxRadius,
            layer: CollisionLayer.PROJECTILE,
            mask: CollisionLayer.ALL & ~CollisionLayer.PROJECTILE,
            isTrigger: true,
            enabled: true
        }));

        this.world!.addComponent(projectileId, 'Projectile', {
            ownerId: shooterId,
            damage: weapon.damage!,
            aoeDamage: weapon.aoeDamage ?? 0,
            damageType: weapon.damageType!,
            weaponType: weapon.weaponType!,
            lifetime: weapon.range! / speed,
            piercing: false,
            maxPierces: 1,
            pierceCount: 0,
            explosionRadius: weapon.explosionRadius ?? 0,
            hitEntities: []
        });

        console.log(`[Combat] Created projectile: type=${weapon.weaponType}, damage=${weapon.damage}, aoeDamage=${weapon.aoeDamage ?? 0}, explRadius=${weapon.explosionRadius ?? 0}, hitbox=${hitboxRadius}px, render=${renderRadius}px`);

        this._activeProjectiles.add(projectileId);

        return projectileId;
    }

    private _getProjectileColor(damageType: DamageTypeEnum): string {
        switch (damageType) {
            case DamageType.ENERGY: return '#00ff00';
            case DamageType.KINETIC: return '#ffaa00';
            case DamageType.EXPLOSIVE: return '#ff4400';
            case DamageType.EMP: return '#00ffff';
            default: return '#ffffff';
        }
    }

    private _handleProjectileCollision(data: any): void {
        const { entityA, entityB } = data;

        let projectileId: EntityId | undefined, targetId: EntityId | undefined;
        const projA = this.getComponent<ProjectileComponent>(entityA, 'Projectile');
        const projB = this.getComponent<ProjectileComponent>(entityB, 'Projectile');

        if (projA && !projB) {
            projectileId = entityA;
            targetId = entityB;
        } else if (projB && !projA) {
            projectileId = entityB;
            targetId = entityA;
        } else {
            return;
        }

        const projectile = this.getComponent<ProjectileComponent>(projectileId, 'Projectile');
        if (!projectile) return;

        if (targetId === projectile.ownerId) return;

        // Skip if we've already hit this specific target (prevent double processing)
        if (projectile.hitEntities.includes(targetId)) return;
        projectile.hitEntities.push(targetId);

        console.log(`[Combat] Projectile hit TARGET: targetId=${targetId}, directDamage=${projectile.damage}, aoeDamage=${projectile.aoeDamage}`);

        this._applyDamage(targetId, { damage: projectile.damage, damageType: projectile.damageType });
        console.log(`[Combat] Applied DIRECT damage to target ${targetId}`);

        this._stats.projectilesHit++;

        if (projectile.explosionRadius > 0) {
            const projTransform = this.getComponent<TransformComponent>(projectileId, 'Transform');
            const projCollider = this.getComponent<ColliderComponent>(projectileId, 'Collider');
            const targetCollider = this.getComponent<ColliderComponent>(targetId, 'Collider');

            if (projTransform && projCollider && targetCollider) {
                let impactX = projTransform.x;
                let impactY = projTransform.y;

                if (data.normal) {
                    const normal = data.normal;
                    const projRadius = projCollider.radius || 30;
                    const targetRadius = targetCollider.radius || 28;

                    if (entityA === projectileId) {
                        impactX = projTransform.x + normal.x * projRadius;
                        impactY = projTransform.y + normal.y * projRadius;
                    } else {
                        impactX = projTransform.x - normal.x * projRadius;
                        impactY = projTransform.y - normal.y * projRadius;
                    }
                    console.log(`[Combat] FIRST CONTACT: missileRadius=${projRadius}px, targetRadius=${targetRadius}px, impact=(${impactX.toFixed(0)}, ${impactY.toFixed(0)})`);
                } else {
                    console.log(`[Combat] Explosion at projectile center (no normal): (${projTransform.x.toFixed(0)}, ${projTransform.y.toFixed(0)})`);
                }

                this._createExplosion(impactX, impactY, projectile);
            }
        } else {
            const projTransform = this.getComponent<TransformComponent>(projectileId, 'Transform');
            const renderable = this.getComponent<RenderableComponent>(projectileId, 'Renderable');
            if (projTransform) {
                const color = renderable ? renderable.fillColor : '#f39c12';
                this._createHitEffect(projTransform.x, projTransform.y, color);
            }
        }

        this._destroyProjectile(projectileId);

        this.emit('combat:hit', {
            projectileId,
            targetId,
            damage: projectile.damage,
            damageType: projectile.damageType
        });
    }

    private _applyDamage(targetId: EntityId, source: { damage: number, damageType: DamageTypeEnum }): void {
        let damage = source.damage;
        const damageType = source.damageType;

        console.log(`[Combat] _applyDamage called: targetId=${targetId}, damage=${damage}, damageType=${damageType}`);

        // Check if target is an asteroid (has HealthComponent but NOT ShipHullComponent)
        const hasShipHull = !!this.getComponent<ShipHullComponent>(targetId, 'ShipHull');
        const hasHealth = !!this.getComponent<HealthComponent>(targetId, 'Health');
        const isAsteroid = hasHealth && !hasShipHull;

        // Asteroids take FULL damage - no armor/shield reduction
        if (isAsteroid) {
            console.log(`[Combat] Asteroid detected - applying FULL damage without reduction`);
            const health = this.getComponent<HealthComponent>(targetId, 'Health');
            if (health && !health.isInvulnerable) {
                health.currentHealth -= damage;
                console.log(`[Combat] Applied ${damage} FULL damage to asteroid ${targetId}, remaining: ${health.currentHealth.toFixed(1)}`);

                health.lastDamageAmount = damage;
                health.lastDamageType = damageType;
                health.lastDamageTime = performance.now();

                this._stats.damageDealt += damage;

                this.emit('combat:damage', {
                    targetId,
                    damage: damage,
                    damageType,
                    remainingHealth: health.currentHealth
                });

                if (health.currentHealth <= 0 && health.destroyOnDeath) {
                    this._destroyGenericEntity(targetId, health);
                }
            }
            return;
        }

        // Ships take damage - Armor acts as a consumable buffer (max 50 total)
        // Damage first reduces armor, overflow goes to hull
        if (damage > 0) {
            const hull = this.getComponent<ShipHullComponent>(targetId, 'ShipHull');
            if (hull) {
                let damageToHull = damage;
                let armorAbsorbed = 0;

                // Damage reduces armor first (armor is a buffer, max 50)
                if (hull.armor > 0) {
                    if (hull.armor >= damage) {
                        // All damage absorbed by armor
                        armorAbsorbed = damage;
                        hull.armor -= damage;
                        damageToHull = 0;
                        console.log(`[Combat] All ${damage} damage absorbed by armor, remaining armor: ${hull.armor}`);
                    } else {
                        // Armor depleted, overflow goes to hull
                        armorAbsorbed = hull.armor;
                        damageToHull = damage - hull.armor;
                        hull.armor = 0;
                        hull.currentHull -= damageToHull;
                        console.log(`[Combat] Armor depleted (${armorAbsorbed} total absorbed), ${damageToHull} damage to hull, remaining hull: ${hull.currentHull.toFixed(1)}`);
                    }
                } else {
                    // No armor, all damage to hull
                    hull.currentHull -= damageToHull;
                    console.log(`[Combat] No armor remaining, ${damageToHull} damage to hull, remaining hull: ${hull.currentHull.toFixed(1)}`);
                }

                this._stats.damageDealt += damageToHull;

                this.emit('combat:damage', {
                    targetId,
                    damage: damageToHull,
                    damageType,
                    remainingHull: hull.currentHull,
                    remainingArmor: hull.armor
                });

                if (hull.currentHull <= 0) {
                    this._destroyEntity(targetId);
                }
                return;
            }
        }

        if (damage > 0) {
            const health = this.getComponent<HealthComponent>(targetId, 'Health');
            if (health && !health.isInvulnerable) {
                const resistance = health.resistances?.[damageType as keyof typeof health.resistances] ?? 1;
                const effectiveDamage = Math.max(1, (damage * resistance) - health.armor);
                health.currentHealth -= effectiveDamage;
                console.log(`[Combat] Applied ${effectiveDamage} health damage to entity ${targetId}`);

                health.lastDamageAmount = effectiveDamage;
                health.lastDamageType = damageType;
                health.lastDamageTime = performance.now();

                this._stats.damageDealt += effectiveDamage;

                this.emit('combat:damage', {
                    targetId,
                    damage: effectiveDamage,
                    damageType,
                    remainingHealth: health.currentHealth
                });

                if (health.currentHealth <= 0 && health.destroyOnDeath) {
                    this._destroyGenericEntity(targetId, health);
                }
            }
        }
    }

    private _destroyGenericEntity(entityId: EntityId, health: HealthComponent): void {
        const transform = this.getComponent<TransformComponent>(entityId, 'Transform');
        const collider = this.getComponent<ColliderComponent>(entityId, 'Collider');

        if (!this.world!.entityExists(entityId)) return;

        if (transform && collider && collider.layer === CollisionLayer.ASTEROID) {
            this._spawnAsteroidDebris(transform);
        }

        if (transform) {
            this.emit('combat:explosion', {
                x: transform.x,
                y: transform.y,
                radius: 30,
                damage: 0
            });
        }

        this._stats.entitiesDestroyed++;

        this.emit('combat:destroyed', {
            entityId,
            value: health.value ?? 0,
            lootTable: health.lootTable ?? null
        });

        this.world!.destroyEntity(entityId);
    }

    private _createExplosion(x: number, y: number, projectile: ProjectileComponent): void {
        const now = performance.now();
        const physicsSystem = this.world!.getSystem('PhysicsSystem') as PhysicsSystem;
        const explRadius = projectile.explosionRadius ?? 0;
        let aoeDamage = projectile.aoeDamage ?? 0;
        
        // Override AOE damage to 20 as requested
        aoeDamage = 20;
        projectile.aoeDamage = 20;

        console.log(`[Combat] Multi-pulse explosion at (${x.toFixed(0)}, ${y.toFixed(0)}): explRadius=${explRadius}px, aoeDamage=${aoeDamage}, pulses=4`);

        // Create a single persistent explosion visual effect (0.9s duration)
        const explosionId = this.world!.createEntity('explosion_multipulse');
        this.world!.addComponent(explosionId, 'Transform', createTransform({ x, y, rotation: 0, scale: 1 }));
        this.world!.addComponent(explosionId, 'Renderable', {
            type: 'circle',
            radius: 50,
            fillColor: 'rgba(255, 100, 0, 0.3)',
            strokeColor: '#ff4400',
            strokeWidth: 3,
            glowEnabled: true,
            glowColor: '#ff6600',
            glowIntensity: 30,
            layer: 25,
            visible: true,
            alpha: 1.0
        });
        this.world!.addComponent(explosionId, 'Lifetime', createLifetime({
            totalLife: 0.9,
            remainingLife: 0.9,
            fade: true,
            shrink: false
        }));
        this._explosionEffects.push({ entityId: explosionId, destroyTime: now + 900 });
        
        console.log(`[Combat] Created multi-pulse explosion: entityId=${explosionId}, duration=0.9s`);

        // Helper function to apply AOE damage and flash effect
        const applyAOEPulse = (pulseNumber: number, delay: number) => {
            setTimeout(() => {
                if (!this.world!.entityExists(explosionId)) return;

                const renderable = this.getComponent<RenderableComponent>(explosionId, 'Renderable');
                if (renderable) {
                    // Flash effect: bright yellow flash
                    renderable.fillColor = 'rgba(255, 255, 100, 0.8)';
                    renderable.strokeColor = '#ffffff';
                    renderable.glowColor = '#ffff00';
                    renderable.glowIntensity = 60;
                    renderable.strokeWidth = 5;
                    console.log(`[Combat] EXPLOSION FLASH #${pulseNumber} at ${delay}s`);
                }

                // Apply AOE damage
                const entities = this.queryEntities(['Transform', 'Collider']);
                for (const entityId of entities) {
                    if (entityId === projectile.ownerId) continue;

                    const transform = this.getComponent<TransformComponent>(entityId, 'Transform');
                    if (!transform) continue;

                    const dx = transform.x - x;
                    const dy = transform.y - y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist <= explRadius) {
                        const falloff = 1 - (dist / explRadius);
                        const damage = Math.round(aoeDamage * falloff);
                        if (damage > 0) {
                            console.log(`[Combat] Pulse #${pulseNumber} AOE: entity ${entityId}: ${damage} (dist=${dist.toFixed(0)}px, falloff=${(falloff * 100).toFixed(0)}%)`);
                            this._applyDamage(entityId, { damage: damage, damageType: projectile.damageType });
                        }
                    }
                }

                // Restore normal appearance after flash (100ms later)
                setTimeout(() => {
                    if (!this.world!.entityExists(explosionId)) return;
                    const rend = this.getComponent<RenderableComponent>(explosionId, 'Renderable');
                    if (rend) {
                        rend.fillColor = 'rgba(255, 100, 0, 0.3)';
                        rend.strokeColor = '#ff4400';
                        rend.glowColor = '#ff6600';
                        rend.glowIntensity = 30;
                        rend.strokeWidth = 3;
                    }
                }, 100);

            }, delay);
        };

        // Schedule 4 pulses: 0s, 0.3s, 0.6s, 0.9s
        applyAOEPulse(1, 0);     // Impact
        applyAOEPulse(2, 300);   // 0.3s
        applyAOEPulse(3, 600);   // 0.6s
        applyAOEPulse(4, 900);   // 0.9s

        console.log(`[Combat] Scheduled 4 pulses at 0s, 0.3s, 0.6s, 0.9s`);

        this.emit('combat:explosion', {
            x, y,
            radius: explRadius,
            damage: projectile.damage,
            aoeDamage: aoeDamage
        });
    }

    private _createHitEffect(x: number, y: number, color: string): void {
        const effectId = this.world!.createEntity('hit_effect');
        
        this.world!.addComponent(effectId, 'Transform', createTransform({
            x, y,
            rotation: Math.random() * Math.PI * 2,
            scale: 1,
            prevX: x,
            prevY: y,
            prevRotation: 0
        }));

        this.world!.addComponent(effectId, 'Renderable', createRenderable({
            type: 'circle',
            radius: 12,
            fillColor: color,
            strokeColor: '#ffffff',
            strokeWidth: 2,
            glowEnabled: true,
            glowColor: color,
            glowIntensity: 15,
            layer: 20,
            alpha: 1.0,
            visible: true
        }));

        this.world!.addComponent(effectId, 'Projectile', {
            lifetime: 0.15,
            damage: 0,
            ownerId: -1,
            damageType: DamageType.KINETIC,
            weaponType: WeaponType.PROJECTILE,
            piercing: false,
            maxPierces: 0,
            pierceCount: 0,
            explosionRadius: 0,
            hitEntities: []
        });

        this._activeProjectiles.add(effectId);
    }

    private _destroyProjectile(projectileId: EntityId): void {
        this._activeProjectiles.delete(projectileId);
        this.world!.destroyEntity(projectileId);
    }

    private _destroyEntity(entityId: EntityId): void {
        if (!this.world!.entityExists(entityId)) return;

        const transform = this.getComponent<TransformComponent>(entityId, 'Transform');
        const collider = this.getComponent<ColliderComponent>(entityId, 'Collider');
        const reactor = this.getComponent<ShipReactorComponent>(entityId, 'ShipReactor');

        if (transform && collider && collider.layer === CollisionLayer.ASTEROID) {
            this._spawnAsteroidDebris(transform);
        }

        if (transform && reactor) {
            const physicsSystem = this.world!.getSystem('PhysicsSystem') as PhysicsSystem;
            if (physicsSystem) {
                physicsSystem.applyExplosion(
                    transform.x, transform.y,
                    reactor.explosionRadius,
                    reactor.explosionDamage
                );
            }
        }

        this._stats.entitiesDestroyed++;

        this.emit('combat:destroyed', { entityId });

        this.world!.destroyEntity(entityId);
    }

    private _spawnAsteroidDebris(parentTransform: TransformComponent): void {
        if (parentTransform.scale < 0.4) {
            return;
        }

        const count = 2;
        const newScale = parentTransform.scale * 0.6;
        const fragmentRadius = 28 * newScale;

        const TRADER_STATION = { x: 1500, y: 0, shieldRadius: 550 };
        const PIRATE_STATION = { x: -1500, y: 0, shieldRadius: 550 };
        const SHIELD_MARGIN = 80;

        function isInsideAnyShield(x: number, y: number): boolean {
            const stations = [TRADER_STATION, PIRATE_STATION];
            for (const station of stations) {
                const dx = x - station.x;
                const dy = y - station.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < station.shieldRadius + SHIELD_MARGIN) {
                    return true;
                }
            }
            return false;
        }

        const baseAngle = Math.random() * Math.PI * 2;

        for (let i = 0; i < count; i++) {
            const debrisId = this.world!.createEntity('asteroid');

            const angle = baseAngle + (i * Math.PI);
            const distance = 20 * parentTransform.scale;

            let x = parentTransform.x + Math.cos(angle) * distance;
            let y = parentTransform.y + Math.sin(angle) * distance;

            if (isInsideAnyShield(x, y)) {
                console.log(`[Combat] Frammento evitato dentro scudo, distrutto`);
                this.world!.destroyEntity(debrisId);
                continue;
            }

            const speed = 40 + Math.random() * 20;

            this.world!.addComponent(debrisId, 'Transform', createTransform({
                x, y,
                rotation: Math.random() * Math.PI * 2,
                scale: newScale,
                prevX: x,
                prevY: y
            }));

            this.world!.addComponent(debrisId, 'Velocity', createVelocity({
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                angularVelocity: (Math.random() - 0.5) * 3,
                maxSpeed: 250
            }));

            this.world!.addComponent(debrisId, 'Renderable', createRenderable({
                ...SHAPE_PRESETS.ASTEROID
            }));

            this.world!.addComponent(debrisId, 'Collider', createCollider({
                type: 'circle',
                radius: fragmentRadius,
                layer: CollisionLayer.ASTEROID,
                mask: CollisionLayer.ALL,
                enabled: true
            }));

            this.world!.addComponent(debrisId, 'Physics', createPhysics({
                mass: 500 * newScale,
                friction: 0.1,
                restitution: 0.5
            }));

            const maxHp = Math.round(50 * newScale);
            this.world!.addComponent(debrisId, 'Health', createHealth({
                currentHealth: maxHp,
                maxHealth: maxHp
            }));
        }
    }

    dealDamage(targetId: EntityId, damage: number, damageType: DamageTypeEnum = DamageType.KINETIC): void {
        this._applyDamage(targetId, { damage, damageType });
    }

    private _handleCollisionDamage(data: any): void {
        const { entityA, entityB, impactForce, isFirstImpact } = data;

        if (!isFirstImpact) return;

        const pairKey = entityA < entityB ? `${entityA},${entityB}` : `${entityB},${entityA}`;

        const now = performance.now();
        const lastPairCollision = this._collisionPairCooldown.get(pairKey) || 0;
        if (now - lastPairCollision < 10000) {
            return;
        }
        this._collisionPairCooldown.set(pairKey, now);

        const MIN_IMPACT_FOR_DAMAGE = 10;
        const force = impactForce ?? 0;
        if (force < MIN_IMPACT_FOR_DAMAGE) return;

        const baseDamage = Math.log10(force + 1) * 3;
        const damage = Math.max(1, Math.round(baseDamage));

        this._applyCollisionDamageToEntity(entityA, damage, entityB);
        this._applyCollisionDamageToEntity(entityB, damage, entityA);
    }

    private _applyCollisionDamageToEntity(entityId: EntityId, damage: number, otherId: EntityId): void {
        if (this.getComponent(entityId, 'Projectile')) return;

        const health = this.getComponent<HealthComponent>(entityId, 'Health');

        if (!health) return;

        const now = performance.now();
        const lastCollision = this._collisionImmunity.get(entityId) || 0;

        if (now - lastCollision < 500) {
            return;
        }
        this._collisionImmunity.set(entityId, now);

        this._applyDamage(entityId, {
            damage,
            damageType: DamageType.KINETIC
        });

        this.emit('combat:collision_damage', {
            entityId,
            damage,
            causedBy: otherId
        });
    }

    getStats(): object {
        return {
            ...super.getStats(),
            ...this._stats,
            activeProjectiles: this._activeProjectiles.size
        };
    }

    destroy(): void {
        for (const id of this._activeProjectiles) {
            if (this.world && this.world.entityExists(id)) {
                this.world.destroyEntity(id);
            }
        }
        this._activeProjectiles.clear();
        this._projectilePool = [];
        super.destroy();
    }
}

export default CombatSystem;
