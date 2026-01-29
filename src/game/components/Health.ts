/**
 * =============================================================================
 * HEALTH.TS - Componente salute generico
 * =============================================================================
 */

import { BaseComponent } from '../../engine/ecs/types';

export interface HealthResistances {
    kinetic: number;
    energy: number;
    explosive: number;
    emp: number;
}

export interface HealthComponent extends BaseComponent {
    currentHealth: number;
    maxHealth: number;
    armor: number;
    resistances: HealthResistances;
    destroyOnDeath: boolean;
    showDamageEffects: boolean;
    isInvulnerable: boolean;
    invulnerabilityTimer: number;
    lootTable: string | null;
    value: number;
    lastDamageAmount: number;
    lastDamageType: string | null;
    lastDamageTime: number;
}

export function createHealth(config: Partial<HealthComponent> = {}): HealthComponent {
    const maxHealth = config.maxHealth ?? 50;
    
    return {
        currentHealth: config.currentHealth ?? maxHealth,
        maxHealth: maxHealth,
        armor: config.armor ?? 0,
        resistances: config.resistances ?? {
            kinetic: 1.0,
            energy: 1.0,
            explosive: 1.0,
            emp: 0.0
        },
        destroyOnDeath: config.destroyOnDeath ?? true,
        showDamageEffects: config.showDamageEffects ?? true,
        isInvulnerable: false,
        invulnerabilityTimer: 0,
        lootTable: config.lootTable ?? null,
        value: config.value ?? 0,
        lastDamageAmount: 0,
        lastDamageType: null,
        lastDamageTime: 0
    };
}

export const HEALTH_PRESETS: Record<string, Partial<HealthComponent>> = {
    ASTEROID_SMALL: {
        maxHealth: 75,
        armor: 0,
        resistances: {
            kinetic: 1.0,
            energy: 1.0,
            explosive: 0.5,
            emp: 0.0
        },
        value: 10
    },
    ASTEROID_MEDIUM: {
        maxHealth: 150,
        armor: 0,
        resistances: {
            kinetic: 1.0,
            energy: 1.0,
            explosive: 0.4,
            emp: 0.0
        },
        value: 50
    },
    ASTEROID_LARGE: {
        maxHealth: 250,
        armor: 0,
        resistances: {
            kinetic: 1.0,
            energy: 1.0,
            explosive: 0.3,
            emp: 0.0
        },
        value: 50
    },
    CARGO_CONTAINER: {
        maxHealth: 20,
        armor: 0,
        resistances: {
            kinetic: 1.0,
            energy: 1.0,
            explosive: 2.0,
            emp: 0.0
        },
        value: 100
    },
    DEBRIS: {
        maxHealth: 10,
        armor: 0,
        resistances: {
            kinetic: 1.0,
            energy: 1.0,
            explosive: 1.5,
            emp: 0.0
        },
        value: 5
    },
    STRUCTURE: {
        maxHealth: 200,
        armor: 15,
        resistances: {
            kinetic: 0.8,
            energy: 0.8,
            explosive: 1.0,
            emp: 0.5
        },
        value: 200
    }
};

export default createHealth;
