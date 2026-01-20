/**
 * =============================================================================
 * PROJECTILE.TS - Componente per proiettili
 * =============================================================================
 */

import { BaseComponent, EntityId } from '../../engine/ecs/types';
import { DamageType, DamageTypeEnum, WeaponType, WeaponTypeEnum } from './ShipWeapon';

export interface ProjectileComponent extends BaseComponent {
    ownerId: EntityId | null;
    damage: number;
    aoeDamage: number;  // AOE damage for explosive weapons
    damageType: DamageTypeEnum;
    weaponType: WeaponTypeEnum;
    lifetime: number;
    piercing: boolean;
    maxPierces: number;
    pierceCount: number;
    explosionRadius: number;
    hitEntities: EntityId[];
}

export function createProjectile(config: Partial<ProjectileComponent> = {}): ProjectileComponent {
    return {
        ownerId: config.ownerId ?? null,
        damage: config.damage ?? 10,
        aoeDamage: config.aoeDamage ?? 0,
        damageType: config.damageType ?? DamageType.KINETIC,
        weaponType: config.weaponType ?? WeaponType.PROJECTILE,
        lifetime: config.lifetime ?? 2,
        piercing: config.piercing ?? false,
        maxPierces: config.maxPierces ?? 1,
        pierceCount: 0,
        explosionRadius: config.explosionRadius ?? 0,
        hitEntities: []
    };
}

export default createProjectile;
