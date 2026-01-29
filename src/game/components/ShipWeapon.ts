/**
 * =============================================================================
 * SHIP-WEAPON.TS - Componente arma nave
 * =============================================================================
 */

import { BaseComponent } from '../../engine/ecs/types';

export const WeaponType = {
    PROJECTILE: 'projectile',
    LASER: 'laser',
    PLASMA: 'plasma',
    MISSILE: 'missile',
    BEAM: 'beam'
} as const;

export type WeaponTypeEnum = typeof WeaponType[keyof typeof WeaponType];

export const DamageType = {
    KINETIC: 'kinetic',
    ENERGY: 'energy',
    EXPLOSIVE: 'explosive',
    EMP: 'emp'
} as const;

export type DamageTypeEnum = typeof DamageType[keyof typeof DamageType];

export interface ShipWeaponComponent extends BaseComponent {
    moduleType: string;
    moduleId: string;
    size: number;
    weaponType: WeaponTypeEnum;
    damageType: DamageTypeEnum;
    damage: number;
    aoeDamage: number;  // AOE damage for explosive weapons
    fireRate: number;
    cooldown: number;
    range: number;
    projectileSpeed: number;
    spread: number;
    energyCost: number;
    maxAmmo: number | null;
    currentAmmo: number | null;
    heat: number;
    maxHeat: number;
    heatPerShot: number;
    heatDissipation: number;
    isOverheated: boolean;
    overheatThreshold: number;
    isActive: boolean;
    isFiring: boolean;
    offsetX: number;
    offsetY: number;
    efficiency: number;
    health: number;
    maxHealth: number;
    fireSound: string;
    projectileSprite: string;
    projectileRadius: number;
    explosionRadius: number;
    secondaryWeapon?: Partial<ShipWeaponComponent> | null;
    secondaryCooldown: number;
}

export function createShipWeapon(config: Partial<ShipWeaponComponent> = {}): ShipWeaponComponent {
    return {
        moduleType: 'weapon',
        moduleId: config.moduleId ?? 'basic_laser',
        size: config.size ?? 1,
        weaponType: config.weaponType ?? WeaponType.PROJECTILE,
        damageType: config.damageType ?? DamageType.KINETIC,
        damage: config.damage ?? 10,
        aoeDamage: config.aoeDamage ?? 0,
        fireRate: config.fireRate ?? 2,
        cooldown: 0,
        range: config.range ?? 500,
        projectileSpeed: config.projectileSpeed ?? 600,
        spread: config.spread ?? 0.05,
        energyCost: config.energyCost ?? 5,
        maxAmmo: config.maxAmmo ?? null,
        currentAmmo: config.currentAmmo ?? config.maxAmmo ?? null,
        heat: 0,
        maxHeat: config.maxHeat ?? 100,
        heatPerShot: config.heatPerShot ?? 10,
        heatDissipation: config.heatDissipation ?? 20,
        isOverheated: false,
        overheatThreshold: config.overheatThreshold ?? 80,
        isActive: true,
        isFiring: false,
        offsetX: config.offsetX ?? 0,
        offsetY: config.offsetY ?? 0,
        efficiency: 1.0,
        health: config.health ?? 30,
        maxHealth: config.maxHealth ?? 30,
        fireSound: config.fireSound ?? 'weapon_fire_default',
        projectileSprite: config.projectileSprite ?? 'projectile_default',
        projectileRadius: config.projectileRadius ?? 4,
        explosionRadius: config.explosionRadius ?? 0,
        secondaryWeapon: config.secondaryWeapon ?? null,
        secondaryCooldown: config.secondaryCooldown ?? 0
    };
}

export const WEAPON_PRESETS: Record<string, Partial<ShipWeaponComponent>> = {
    LASER_LIGHT: {
        moduleId: 'weapon_laser_light',
        size: 1,
        weaponType: WeaponType.LASER,
        damageType: DamageType.ENERGY,
        damage: 15,
        fireRate: 4,
        range: 400,
        projectileSpeed: 1000,
        energyCost: 3,
        heatPerShot: 5
    },
    LASER_HEAVY: {
        moduleId: 'weapon_laser_heavy',
        size: 2,
        weaponType: WeaponType.LASER,
        damageType: DamageType.ENERGY,
        damage: 25,
        fireRate: 1.5,
        range: 600,
        projectileSpeed: 1200,
        energyCost: 10,
        heatPerShot: 15
    },
    MACHINEGUN: {
        moduleId: 'weapon_machinegun',
        size: 1,
        weaponType: WeaponType.PROJECTILE,
        damageType: DamageType.KINETIC,
        damage: 5,
        fireRate: 10,
        range: 350,
        projectileSpeed: 800,
        spread: 0.1,
        energyCost: 1,
        maxAmmo: 500,
        heatPerShot: 2
    },
    CANNON: {
        moduleId: 'weapon_cannon',
        size: 2,
        weaponType: WeaponType.PROJECTILE,
        damageType: DamageType.KINETIC,
        damage: 35,
        fireRate: 0.8,
        range: 500,
        projectileSpeed: 500,
        spread: 0.02,
        energyCost: 5,
        maxAmmo: 100,
        heatPerShot: 20
    },
    PLASMA: {
        moduleId: 'weapon_plasma',
        size: 2,
        weaponType: WeaponType.PLASMA,
        damageType: DamageType.ENERGY,
        damage: 40,
        fireRate: 1,
        range: 450,
        projectileSpeed: 400,
        energyCost: 15,
        heatPerShot: 25
    },
    MISSILE_LAUNCHER: {
        moduleId: 'weapon_missile',
        size: 2,
        weaponType: WeaponType.MISSILE,
        damageType: DamageType.EXPLOSIVE,
        damage: 60,
        fireRate: 0.5,
        range: 800,
        projectileSpeed: 300,
        energyCost: 20,
        maxAmmo: 20,
        heatPerShot: 5
    },
    BEAM: {
        moduleId: 'weapon_beam',
        size: 3,
        weaponType: WeaponType.BEAM,
        damageType: DamageType.ENERGY,
        damage: 50,
        fireRate: 0,
        range: 350,
        energyCost: 30,
        heatPerShot: 40
    },
    EMP_CANNON: {
        moduleId: 'weapon_emp',
        size: 2,
        weaponType: WeaponType.PROJECTILE,
        damageType: DamageType.EMP,
        damage: 5,
        fireRate: 0.3,
        range: 400,
        projectileSpeed: 500,
        energyCost: 40,
        heatPerShot: 30
    },
    PLAYER_PRIMARY: {
        moduleId: 'weapon_player_primary',
        size: 1,
        weaponType: WeaponType.LASER,
        damageType: DamageType.ENERGY,
        damage: 15,
        fireRate: 2,
        range: 400,
        projectileSpeed: 800,
        energyCost: 3,
        heatPerShot: 5,
        projectileRadius: 4
    },
    PLAYER_SECONDARY: {
        moduleId: 'weapon_player_secondary',
        size: 2,
        weaponType: WeaponType.PROJECTILE,
        damageType: DamageType.EXPLOSIVE,
        damage: 60,
        fireRate: 0.1,
        range: 800,
        projectileSpeed: 400,
        energyCost: 0,
        heatPerShot: 10,
        projectileRadius: 12,
        explosionRadius: 100,
        aoeDamage: 20,
        maxAmmo: 4,
        currentAmmo: 1
    }
};

export default createShipWeapon;
