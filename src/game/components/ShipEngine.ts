/**
 * =============================================================================
 * SHIP-ENGINE.TS - Componente motore nave
 * =============================================================================
 */

import { BaseComponent } from '../../engine/ecs/types';

export interface ShipEngineComponent extends BaseComponent {
    moduleType: string;
    moduleId: string;
    size: number;
    thrustForward: number;
    thrustBackward: number;
    thrustStrafe: number;
    rotationSpeed: number;
    energyConsumption: number;
    maxSpeed: number;
    isActive: boolean;
    currentThrust: number;
    overheating: boolean;
    heat: number;
    maxHeat: number;
    heatGeneration: number;
    heatDissipation: number;
    efficiency: number;
    health: number;
    maxHealth: number;
}

export function createShipEngine(config: Partial<ShipEngineComponent> = {}): ShipEngineComponent {
    return {
        moduleType: 'engine',
        moduleId: config.moduleId ?? 'basic_engine',
        size: config.size ?? 1,
        thrustForward: config.thrustForward ?? 200,
        thrustBackward: config.thrustBackward ?? 100,
        thrustStrafe: config.thrustStrafe ?? 80,
        rotationSpeed: config.rotationSpeed ?? 3,
        energyConsumption: config.energyConsumption ?? 5,
        maxSpeed: config.maxSpeed ?? 300,
        isActive: true,
        currentThrust: 0,
        overheating: false,
        heat: 0,
        maxHeat: config.maxHeat ?? 100,
        heatGeneration: config.heatGeneration ?? 10,
        heatDissipation: config.heatDissipation ?? 15,
        efficiency: 1.0,
        health: config.health ?? 50,
        maxHealth: config.maxHealth ?? 50
    };
}

export const ENGINE_PRESETS: Record<string, Partial<ShipEngineComponent>> = {
    BASIC: {
        moduleId: 'engine_basic',
        size: 1,
        thrustForward: 150,
        thrustBackward: 75,
        rotationSpeed: 2.5,
        maxSpeed: 250,
        energyConsumption: 3
    },
    FAST: {
        moduleId: 'engine_fast',
        size: 1,
        thrustForward: 120,
        thrustBackward: 60,
        rotationSpeed: 4,
        maxSpeed: 400,
        energyConsumption: 5
    },
    POWER: {
        moduleId: 'engine_power',
        size: 2,
        thrustForward: 300,
        thrustBackward: 150,
        rotationSpeed: 2,
        maxSpeed: 200,
        energyConsumption: 8
    },
    EFFICIENT: {
        moduleId: 'engine_efficient',
        size: 1,
        thrustForward: 130,
        thrustBackward: 65,
        rotationSpeed: 2.5,
        maxSpeed: 280,
        energyConsumption: 2,
        heatGeneration: 5
    },
    AFTERBURNER: {
        moduleId: 'engine_afterburner',
        size: 2,
        thrustForward: 400,
        thrustBackward: 100,
        rotationSpeed: 3,
        maxSpeed: 500,
        energyConsumption: 15,
        heatGeneration: 25
    }
};

export default createShipEngine;
