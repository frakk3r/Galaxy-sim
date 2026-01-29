/**
 * =============================================================================
 * TRANSFORM.TS - Componente per posizione e rotazione
 * =============================================================================
 */

import { BaseComponent } from '../../engine/ecs/types';

export interface TransformComponent extends BaseComponent {
    x: number;
    y: number;
    rotation: number;
    scale: number;
    prevX: number;
    prevY: number;
    prevRotation: number;
}

export function createTransform(config: Partial<TransformComponent> = {}): TransformComponent {
    return {
        x: config.x ?? 0,
        y: config.y ?? 0,
        rotation: config.rotation ?? 0,
        scale: config.scale ?? 1,
        prevX: config.x ?? 0,
        prevY: config.y ?? 0,
        prevRotation: config.rotation ?? 0
    };
}

export const TRANSFORM_DEFAULTS: Partial<TransformComponent> = {
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1
};

export default createTransform;
