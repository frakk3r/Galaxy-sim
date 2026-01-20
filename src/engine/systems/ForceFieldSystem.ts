/**
 * =============================================================================
 * FORCE-FIELD-SYSTEM.TS - Gestione campi di forza (FIXED)
 * =============================================================================
 */

import System from '../ecs/System';
import { IWorld } from '../ecs/types';
import { TransformComponent } from '../../game/components/Transform';
import { VelocityComponent } from '../../game/components/Velocity';
import { ForceFieldComponent } from '../../game/components/ForceField';
import { ColliderComponent } from '../../game/components/Collider';
import { FactionComponent } from '../../game/components/Faction';
import { CombatSystem } from './CombatSystem';
import { DamageType } from '../../game/components/ShipWeapon';

export class ForceFieldSystem extends System {
    constructor() {
        super('ForceFieldSystem', 65);
    }

    init(world: IWorld): void {
        super.init(world);

        // Gestiamo SOLO stay → niente doppioni
        this.on('trigger:stay', (data: any) => this._handleFieldContact(data));
        this.on('collision:stay', (data: any) => this._handleFieldContact(data));
    }

    update(): void {
        const fields = this.queryEntities(['ForceField', 'Transform']);

        for (const fieldId of fields) {
            const field = this.getComponent<ForceFieldComponent>(fieldId, 'ForceField');
            if (!field?.parentEntityId) continue;

            const parentTransform = this.getComponent<TransformComponent>(
                field.parentEntityId,
                'Transform'
            );
            const transform = this.getComponent<TransformComponent>(fieldId, 'Transform');

            if (parentTransform && transform) {
                transform.x = parentTransform.x;
                transform.y = parentTransform.y;
            }
        }
    }

    private _handleFieldContact(data: any): void {
        const { entityA, entityB } = data;

        let fieldId: number;
        let targetId: number;

        if (this.world!.hasComponent(entityA, 'ForceField')) {
            fieldId = entityA;
            targetId = entityB;
        } else if (this.world!.hasComponent(entityB, 'ForceField')) {
            fieldId = entityB;
            targetId = entityA;
        } else {
            return;
        }

        const field = this.getComponent<ForceFieldComponent>(fieldId, 'ForceField');
        if (!field?.active || !field.parentEntityId) return;

        const stationFaction = this.getComponent<FactionComponent>(
            field.parentEntityId,
            'Faction'
        );
        const targetFaction = this.getComponent<FactionComponent>(
            targetId,
            'Faction'
        );

        // ✅ Stessa fazione → passaggio libero
        if (
            stationFaction &&
            targetFaction &&
            stationFaction.factionId === targetFaction.factionId
        ) {
            return;
        }

        const targetCollider = this.getComponent<ColliderComponent>(targetId, 'Collider');
        if (!targetCollider) return;

        const fTransform = this.getComponent<TransformComponent>(fieldId, 'Transform');
        const tTransform = this.getComponent<TransformComponent>(targetId, 'Transform');
        const tVelocity = this.getComponent<VelocityComponent>(targetId, 'Velocity');

        if (!fTransform || !tTransform || !tVelocity) return;

        const dx = tTransform.x - fTransform.x;
        const dy = tTransform.y - fTransform.y;
        const dist = Math.hypot(dx, dy);

        if (dist === 0) return;

        const nx = dx / dist;
        const ny = dy / dist;

        const push = field.pushForce * 0.016;
        tVelocity.vx += nx * push;
        tVelocity.vy += ny * push;

        const combatSystem = this.world!.getSystem('CombatSystem') as CombatSystem;
        if (combatSystem && field.damage > 0) {
            const dps = field.damage * 0.016;
            combatSystem.dealDamage(targetId, dps, DamageType.ENERGY);
        }
    }
}

export default ForceFieldSystem;