/**
 * =============================================================================
 * PHYSICS.TS - Componente per proprietà fisiche
 * =============================================================================
 */

import { BaseComponent } from '../../engine/ecs/types';

export interface PhysicsComponent extends BaseComponent {
    mass: number;
    restitution: number;
    friction: number;
    isKinematic: boolean;
    gravityScale: number;
    isSleeping: boolean;
    sleepThreshold: number;
    sleepTimer: number;
}

export function createPhysics(config: Partial<PhysicsComponent> = {}): PhysicsComponent {
    return {
        mass: config.mass ?? 1,
        restitution: config.restitution ?? 0.5,
        friction: config.friction ?? 0,
        isKinematic: config.isKinematic ?? false,
        gravityScale: config.gravityScale ?? 1,
        isSleeping: false,
        sleepThreshold: config.sleepThreshold ?? 0.1,
        sleepTimer: 0
    };
}

export const PHYSICS_PRESETS: Record<string, Partial<PhysicsComponent>> = {
    SHIP: {
        mass: 100,
        restitution: 0.3,
        friction: 0.1
    },
    SHIP_HEAVY: {
        mass: 500,
        restitution: 0.2,
        friction: 0.05
    },
    ASTEROID: {
        mass: 200,
        restitution: 0.6,
        friction: 0
    },
    PROJECTILE: {
        mass: 1,
        restitution: 0,
        friction: 0
    },
    STATION: {
        mass: 10000,
        restitution: 0.1,
        friction: 0,
        isKinematic: true
    },
    DEBRIS: {
        mass: 5,
        restitution: 0.8,
        friction: 0.02
    }
};

export default createPhysics;
