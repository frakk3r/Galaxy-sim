/**
 * =============================================================================
 * DEBRIS-SYSTEM.TS - Sistema per gestire frammenti di asteroidi appena creati
 * =============================================================================
 */

import System from '../ecs/System';
import { EntityId, IWorld } from '../ecs/types';
import { TransformComponent } from '../../game/components/Transform';
import { ColliderComponent } from '../../game/components/Collider';
import { DebrisSpawnComponent } from '../../game/components/DebrisSpawn';

export class DebrisSystem extends System {
    constructor() {
        super('DebrisSystem', 60);
    }

    init(world: IWorld): void {
        super.init(world);
    }

    update(deltaTime: number): void {
        const entities = this.queryEntities(['DebrisSpawn']);

        const now = performance.now();

        for (const entityId of entities) {
            const debrisSpawn = this.getComponent<DebrisSpawnComponent>(entityId, 'DebrisSpawn');
            const collider = this.getComponent<ColliderComponent>(entityId, 'Collider');

            if (!debrisSpawn || !collider) continue;

            if (now - debrisSpawn.spawnTime >= debrisSpawn.collisionDelay) {
                this.world!.removeComponent(entityId, 'DebrisSpawn');
            }
        }
    }

    render(interpolation: number): void {
    }

    destroy(): void {
        super.destroy();
    }
}

export default DebrisSystem;
