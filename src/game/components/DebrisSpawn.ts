/**
 * =============================================================================
 * DEBRISSPAWN.TS - Componente per frammenti di asteroidi appena creati
 * =============================================================================
 */

import { BaseComponent } from '../../engine/ecs/types';

export interface DebrisSpawnComponent extends BaseComponent {
    spawnTime: number;
    collisionDelay: number;
}

export function createDebrisSpawn(config: Partial<DebrisSpawnComponent> = {}): DebrisSpawnComponent {
    return {
        spawnTime: config.spawnTime ?? performance.now(),
        collisionDelay: config.collisionDelay ?? 2000
    };
}

export default createDebrisSpawn;
