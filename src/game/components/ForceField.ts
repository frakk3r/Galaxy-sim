/**
 * =============================================================================
 * FORCE-FIELD.TS - Componente campo di forza (scudo stazionario)
 * =============================================================================
 */

import { BaseComponent } from '../../engine/ecs/types';

export interface ForceFieldComponent extends BaseComponent {
    radius: number;
    damage: number; // Danno al secondo o all'impatto
    pushForce: number;
    active: boolean;
    parentEntityId: number | null; // ID dell'entità che genera lo scudo (per seguire la posizione)
}

export function createForceField(config: Partial<ForceFieldComponent> = {}): ForceFieldComponent {
    return {
        radius: config.radius ?? 500,
        damage: config.damage ?? 50,
        pushForce: config.pushForce ?? 500,
        active: config.active ?? true,
        parentEntityId: config.parentEntityId ?? null
    };
}

export default createForceField;
