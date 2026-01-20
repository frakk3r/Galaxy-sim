/**
 * =============================================================================
 * VELOCITY.TS - Componente per velocità lineare e angolare
 * =============================================================================
 */

import { BaseComponent } from '../../engine/ecs/types';

export interface VelocityComponent extends BaseComponent {
    vx: number;
    vy: number;
    angularVelocity: number;
    maxSpeed: number;
    maxAngularSpeed: number;
    drag: number;
    angularDrag: number;
}

export function createVelocity(config: Partial<VelocityComponent> = {}): VelocityComponent {
    return {
        vx: config.vx ?? 0,
        vy: config.vy ?? 0,
        angularVelocity: config.angularVelocity ?? 0,
        maxSpeed: config.maxSpeed ?? 1000,
        maxAngularSpeed: config.maxAngularSpeed ?? Math.PI * 2,
        drag: config.drag ?? 0,
        angularDrag: config.angularDrag ?? 0
    };
}

export const VELOCITY_DEFAULTS: Partial<VelocityComponent> = {
    vx: 0,
    vy: 0,
    angularVelocity: 0,
    maxSpeed: 1000,
    maxAngularSpeed: Math.PI * 2,
    drag: 0,
    angularDrag: 0
};

export default createVelocity;
