/**
 * =============================================================================
 * DOCKING.TS - Componente stato attracco
 * =============================================================================
 */

import { BaseComponent, EntityId } from '../../engine/ecs/types';

export const DockStatus = {
    APPROACHING: 'approaching',
    DOCKED: 'docked',
    UNDOCKING: 'undocking'
} as const;

export type DockStatusType = typeof DockStatus[keyof typeof DockStatus];

export interface DockingComponent extends BaseComponent {
    stationId: EntityId;
    status: DockStatusType;
    targetX: number;
    targetY: number;
    targetRotation: number;
}

export function createDocking(config: Partial<DockingComponent> = {}): DockingComponent {
    return {
        stationId: config.stationId ?? -1,
        status: config.status ?? DockStatus.APPROACHING,
        targetX: config.targetX ?? 0,
        targetY: config.targetY ?? 0,
        targetRotation: config.targetRotation ?? 0
    };
}

export default createDocking;
