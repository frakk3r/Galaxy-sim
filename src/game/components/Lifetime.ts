/**
 * =============================================================================
 * LIFETIME.TS - Componente per entità a tempo (particelle, proiettili)
 * =============================================================================
 */

import { BaseComponent } from '../../engine/ecs/types';

export interface LifetimeComponent extends BaseComponent {
    totalLife: number;
    remainingLife: number;
    fade: boolean;      // Se true, riduce alpha del Renderable
    shrink: boolean;    // Se true, riduce scale del Transform
}

export function createLifetime(config: Partial<LifetimeComponent> = {}): LifetimeComponent {
    return {
        totalLife: config.totalLife ?? 1.0,
        remainingLife: config.remainingLife ?? config.totalLife ?? 1.0,
        fade: config.fade ?? true,
        shrink: config.shrink ?? false
    };
}

export default createLifetime;
