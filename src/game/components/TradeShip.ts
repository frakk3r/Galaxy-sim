/**
 * =============================================================================
 * TRADERSHIP.TS - Componente per navi commerciali della fazione rossa
 * =============================================================================
 */

import { BaseComponent } from '../../engine/ecs/types';

export type TradeState = 'IDLE' | 'HARVESTING' | 'RETURNING' | 'DOCKING' | 'TRADING' | 'PATROLLING' | 'WAITING_IN_BASE';

export interface TradeShipComponent extends BaseComponent {
    state: TradeState;
    cargoCapacity: number;
    currentCargo: number;
    credits: number;
    homeStationId: number;
    targetAsteroidId: number | null;
    miningTimer: number;
    miningInterval: number;
    lastRepairTime: number;
    repairInterval: number;
    patrolX: number;
    patrolY: number;
    isRetreatingFromCombat: boolean;
    baseWaitStartTime: number;
}

export function createTradeShip(config: Partial<TradeShipComponent> = {}): TradeShipComponent {
    return {
        state: config.state ?? 'IDLE',
        cargoCapacity: config.cargoCapacity ?? 50,
        currentCargo: config.currentCargo ?? 0,
        credits: config.credits ?? 500,
        homeStationId: config.homeStationId ?? -1,
        targetAsteroidId: config.targetAsteroidId ?? null,
        miningTimer: 0,
        miningInterval: config.miningInterval ?? 0.5,
        lastRepairTime: config.lastRepairTime ?? 0,
        repairInterval: config.repairInterval ?? 30,
        patrolX: config.patrolX ?? 0,
        patrolY: config.patrolY ?? 0,
        isRetreatingFromCombat: config.isRetreatingFromCombat ?? false,
        baseWaitStartTime: config.baseWaitStartTime ?? 0
    };
}

export default createTradeShip;
