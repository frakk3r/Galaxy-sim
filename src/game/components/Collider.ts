/**
 * =============================================================================
 * COLLIDER.TS - Componente per il rilevamento collisioni
 * =============================================================================
 */

import { BaseComponent } from '../../engine/ecs/types';

/**
 * Layer di collisione predefiniti (bitmask)
 */
export const CollisionLayer = {
    NONE: 0,
    DEFAULT: 1 << 0,      // 1
    PLAYER: 1 << 1,       // 2
    ENEMY: 1 << 2,        // 4
    PROJECTILE: 1 << 3,   // 8
    ASTEROID: 1 << 4,     // 16
    STATION: 1 << 5,      // 32
    PICKUP: 1 << 6,       // 64
    TRIGGER: 1 << 7,      // 128
    ALL: 0xFFFFFFFF       // Tutti i layer
} as const;

export type CollisionLayerType = typeof CollisionLayer[keyof typeof CollisionLayer];

export interface ColliderComponent extends BaseComponent {
    type: 'circle' | 'aabb' | 'polygon';
    radius: number;
    width: number;
    height: number;
    vertices: number[][] | null;
    offsetX: number;
    offsetY: number;
    layer: number;
    mask: number;
    isTrigger: boolean;
    isStatic: boolean;
    enabled: boolean;
    _isColliding: boolean;
    _collidingWith: number[];
    _lastCollisionNormal: { x: number, y: number };
}

export function createCollider(config: Partial<ColliderComponent> = {}): ColliderComponent {
    return {
        type: config.type ?? 'circle',
        radius: config.radius ?? 10,
        width: config.width ?? 20,
        height: config.height ?? 20,
        vertices: config.vertices ?? null,
        offsetX: config.offsetX ?? 0,
        offsetY: config.offsetY ?? 0,
        layer: config.layer ?? CollisionLayer.DEFAULT,
        mask: config.mask ?? CollisionLayer.ALL,
        isTrigger: config.isTrigger ?? false,
        isStatic: config.isStatic ?? false,
        enabled: config.enabled ?? true,
        _isColliding: false,
        _collidingWith: [],
        _lastCollisionNormal: { x: 0, y: 0 }
    };
}

export const COLLIDER_PRESETS: Record<string, Partial<ColliderComponent>> = {
    SHIP_SMALL: {
        type: 'circle',
        radius: 12,
        layer: CollisionLayer.PLAYER
    },
    SHIP_MEDIUM: {
        type: 'circle',
        radius: 20,
        layer: CollisionLayer.PLAYER
    },
    ASTEROID_SMALL: {
        type: 'circle',
        radius: 15,
        layer: CollisionLayer.ASTEROID,
        mask: CollisionLayer.ALL & ~CollisionLayer.ASTEROID
    },
    ASTEROID_LARGE: {
        type: 'circle',
        radius: 40,
        layer: CollisionLayer.ASTEROID
    },
    PROJECTILE: {
        type: 'circle',
        radius: 3,
        layer: CollisionLayer.PROJECTILE,
        mask: CollisionLayer.ENEMY | CollisionLayer.ASTEROID
    },
    STATION: {
        type: 'aabb',
        width: 50,
        height: 50,
        layer: CollisionLayer.STATION,
        isStatic: true
    },
    TRIGGER_ZONE: {
        type: 'circle',
        radius: 100,
        layer: CollisionLayer.TRIGGER,
        isTrigger: true
    }
};

export default createCollider;
