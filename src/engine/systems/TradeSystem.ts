/**
 * =============================================================================
 * TRADE-SYSTEM.TS - AI commerciale vuota (da rifare)
 * =============================================================================
 */

import System from '../ecs/System';
import { EntityId, IWorld } from '../ecs/types';
import { TransformComponent } from '../../game/components/Transform';
import { VelocityComponent } from '../../game/components/Velocity';
import { TradeShipComponent } from '../../game/components/TradeShip';

export class TradeSystem extends System {
    private _requiredComponents: string[];

    constructor() {
        super('TradeSystem', 52);
        this._requiredComponents = ['TradeShip', 'Transform', 'Velocity'];
    }

    init(world: IWorld): void {
        super.init(world);
        console.log('[TradeSystem] Inizializzato');
    }

    update(deltaTime: number): void {
        const entities = this.queryEntities(this._requiredComponents);
        for (const entityId of entities) {
            this._updateTradeShip(entityId, deltaTime);
        }
    }

    private _updateTradeShip(entityId: EntityId, deltaTime: number): void {
    }

    render(interpolation: number): void {
    }

    destroy(): void {
        super.destroy();
    }
}

export default TradeSystem;
