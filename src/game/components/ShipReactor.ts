/**
 * =============================================================================
 * SHIP-REACTOR.TS - Componente reattore/generatore energia
 * =============================================================================
 */

import { BaseComponent } from '../../engine/ecs/types';

export interface ShipReactorComponent extends BaseComponent {
    moduleType: string;
    moduleId: string;
    size: number;
    energyCapacity: number;
    currentEnergy: number;
    energyGeneration: number;
    isActive: boolean;
    isOverloaded: boolean;
    overloadMultiplier: number;
    overloadDuration: number;
    overloadMaxDuration: number;
    overloadCooldown: number;
    overloadCooldownTime: number;
    efficiency: number;
    health: number;
    maxHealth: number;
    explosionDamage: number;
    explosionRadius: number;
}

export function createShipReactor(config: Partial<ShipReactorComponent> = {}): ShipReactorComponent {
    const capacity = config.energyCapacity ?? 100;
    
    return {
        moduleType: 'reactor',
        moduleId: config.moduleId ?? 'basic_reactor',
        size: config.size ?? 1,
        energyCapacity: capacity,
        currentEnergy: config.currentEnergy ?? capacity,
        energyGeneration: config.energyGeneration ?? 20,
        isActive: true,
        isOverloaded: false,
        overloadMultiplier: config.overloadMultiplier ?? 1.5,
        overloadDuration: 0,
        overloadMaxDuration: config.overloadMaxDuration ?? 5,
        overloadCooldown: 0,
        overloadCooldownTime: config.overloadCooldownTime ?? 10,
        efficiency: 1.0,
        health: config.health ?? 80,
        maxHealth: config.maxHealth ?? 80,
        explosionDamage: config.explosionDamage ?? 50,
        explosionRadius: config.explosionRadius ?? 100
    };
}

export const REACTOR_PRESETS: Record<string, Partial<ShipReactorComponent>> = {
    BASIC: {
        moduleId: 'reactor_basic',
        size: 1,
        energyCapacity: 80,
        energyGeneration: 5
    },
    CAPACITOR: {
        moduleId: 'reactor_capacitor',
        size: 2,
        energyCapacity: 200,
        energyGeneration: 2
    },
    FUSION: {
        moduleId: 'reactor_fusion',
        size: 2,
        energyCapacity: 200,
        energyGeneration: 10,
        explosionDamage: 100,
        explosionRadius: 150
    },
    MICRO: {
        moduleId: 'reactor_micro',
        size: 1,
        energyCapacity: 50,
        energyGeneration: 12
    },
    MILITARY: {
        moduleId: 'reactor_military',
        size: 3,
        energyCapacity: 300,
        energyGeneration: 50,
        overloadMultiplier: 2.0
    }
};

export default createShipReactor;
