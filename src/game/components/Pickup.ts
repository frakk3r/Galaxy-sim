/**
 * =============================================================================
 * PICKUP.TS - Componente per oggetti raccoglibili nello spazio
 * =============================================================================
 */

import { BaseComponent } from '../../engine/ecs/types';

export const ResourceType = {
    IRON: 'iron',
    GOLD: 'gold',
    CRYSTAL: 'crystal',
    SCRAP: 'scrap'
} as const;

export interface ResourceDef {
    id: string;
    name: string;
    value: number;
    color: string;
}

export const RESOURCES: Record<string, ResourceDef> = {
    [ResourceType.SCRAP]: { id: 'scrap', name: 'Rottami', value: 5, color: '#6b6b6b' },
    [ResourceType.IRON]: { id: 'iron', name: 'Ferro', value: 10, color: '#d4a574' },
    [ResourceType.GOLD]: { id: 'gold', name: 'Oro', value: 50, color: '#ffd700' },
    [ResourceType.CRYSTAL]: { id: 'crystal', name: 'Cristalli', value: 100, color: '#00ffff' }
};

export interface PickupComponent extends BaseComponent {
    resourceId: string;
    quantity: number;
    magnetRange: number; // Distanza a cui inizia ad essere attratto
    isBeingCollected: boolean; // Se sta volando verso la nave
    collectorId: number | null;
}

export function createPickup(config: Partial<PickupComponent> = {}): PickupComponent {
    return {
        resourceId: config.resourceId ?? 'scrap',
        quantity: config.quantity ?? 1,
        magnetRange: config.magnetRange ?? 300,
        isBeingCollected: false,
        collectorId: null
    };
}

export default createPickup;
