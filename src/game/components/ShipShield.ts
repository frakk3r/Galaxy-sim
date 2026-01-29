/**
 * =============================================================================
 * SHIP-SHIELD.TS - Componente scudi nave
 * =============================================================================
 */

import { BaseComponent } from '../../engine/ecs/types';

export interface ShieldResistances {
    kinetic: number;
    energy: number;
    explosive: number;
    emp: number;
}

export interface ShipShieldComponent extends BaseComponent {
    moduleType: string;
    moduleId: string;
    size: number;
    maxShield: number;
    currentShield: number;
    regenRate: number;
    regenDelay: number;
    regenTimer: number;
    energyPerRegen: number;
    passiveEnergyDrain: number;
    resistances: ShieldResistances;
    isActive: boolean;
    isDown: boolean;
    efficiency: number;
    health: number;
    maxHealth: number;
}

export function createShipShield(config: Partial<ShipShieldComponent> = {}): ShipShieldComponent {
    return {
        moduleType: 'shield',
        moduleId: config.moduleId ?? 'basic_shield',
        size: config.size ?? 1,
        maxShield: config.maxShield ?? 50,
        currentShield: config.currentShield ?? config.maxShield ?? 50,
        regenRate: config.regenRate ?? 5,
        regenDelay: config.regenDelay ?? 3,
        regenTimer: 0,
        energyPerRegen: config.energyPerRegen ?? 2,
        passiveEnergyDrain: config.passiveEnergyDrain ?? 1,
        resistances: config.resistances ?? {
            kinetic: 1.0,
            energy: 0.8,
            explosive: 1.2,
            emp: 2.0
        },
        isActive: true,
        isDown: false,
        efficiency: 1.0,
        health: config.health ?? 40,
        maxHealth: config.maxHealth ?? 40
    };
}

export const SHIELD_PRESETS: Record<string, Partial<ShipShieldComponent>> = {
    BASIC: {
        moduleId: 'shield_basic',
        size: 1,
        maxShield: 50,
        regenRate: 0,
        regenDelay: 0
    },
    HEAVY: {
        moduleId: 'shield_heavy',
        size: 2,
        maxShield: 50,
        regenRate: 0,
        regenDelay: 0,
        passiveEnergyDrain: 3
    },
    FAST: {
        moduleId: 'shield_fast',
        size: 1,
        maxShield: 50,
        regenRate: 0,
        regenDelay: 0,
        energyPerRegen: 3
    },
    REFLECTIVE: {
        moduleId: 'shield_reflective',
        size: 2,
        maxShield: 50,
        regenRate: 0,
        resistances: {
            kinetic: 1.3,
            energy: 0.5,
            explosive: 1.0,
            emp: 1.5
        }
    },
    REACTIVE: {
        moduleId: 'shield_reactive',
        size: 2,
        maxShield: 50,
        regenRate: 0,
        resistances: {
            kinetic: 0.6,
            energy: 1.2,
            explosive: 0.8,
            emp: 2.0
        }
    }
};

export default createShipShield;
