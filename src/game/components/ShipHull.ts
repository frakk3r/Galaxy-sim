/**
 * =============================================================================
 * SHIP-HULL.TS - Componente scafo nave
 * =============================================================================
 */

import { BaseComponent } from '../../engine/ecs/types';

export const ModuleSlotType = {
    ENGINE: 'engine',
    REACTOR: 'reactor',
    SHIELD: 'shield',
    WEAPON: 'weapon',
    UTILITY: 'utility',
    CARGO: 'cargo',
    SENSOR: 'sensor'
} as const;

export type ModuleSlotTypeEnum = typeof ModuleSlotType[keyof typeof ModuleSlotType];

export const HullClass = {
    FIGHTER: 'fighter',
    CORVETTE: 'corvette',
    FRIGATE: 'frigate',
    DESTROYER: 'destroyer',
    CRUISER: 'cruiser',
    BATTLESHIP: 'battleship',
    CARRIER: 'carrier',
    STATION: 'station'
} as const;

export type HullClassEnum = typeof HullClass[keyof typeof HullClass];

export interface ModuleSlot {
    type: ModuleSlotTypeEnum;
    size: number;
    moduleId: string | null;
}

export interface DamageZones {
    front: number;
    rear: number;
    left: number;
    right: number;
}

export interface ShipHullComponent extends BaseComponent {
    hullType: string;
    hullClass: HullClassEnum;
    maxHull: number;
    currentHull: number;
    armor: number;
    armorType: string;
    slots: ModuleSlot[];
    baseEnergyCapacity: number;
    baseMass: number;
    damageZones: DamageZones;
    isRepairing: boolean;
    repairRate: number;
}

export function createShipHull(config: Partial<ShipHullComponent> = {}): ShipHullComponent {
    return {
        hullType: config.hullType ?? 'basic_fighter',
        hullClass: config.hullClass ?? HullClass.FIGHTER,
        maxHull: config.maxHull ?? 100,
        currentHull: config.currentHull ?? config.maxHull ?? 100,
        armor: config.armor ?? 0,
        armorType: config.armorType ?? 'standard',
        slots: config.slots ?? [
            { type: ModuleSlotType.ENGINE, size: 2, moduleId: null },
            { type: ModuleSlotType.REACTOR, size: 2, moduleId: null },
            { type: ModuleSlotType.WEAPON, size: 1, moduleId: null },
            { type: ModuleSlotType.WEAPON, size: 1, moduleId: null },
            { type: ModuleSlotType.SHIELD, size: 1, moduleId: null },
            { type: ModuleSlotType.UTILITY, size: 1, moduleId: null }
        ],
        baseEnergyCapacity: config.baseEnergyCapacity ?? 50,
        baseMass: config.baseMass ?? 50,
        damageZones: config.damageZones ?? {
            front: 1.0,
            rear: 1.2,
            left: 1.0,
            right: 1.0
        },
        isRepairing: false,
        repairRate: config.repairRate ?? 0.5
    };
}

export const HULL_PRESETS: Record<string, Partial<ShipHullComponent>> = {
    LIGHT_FIGHTER: {
        hullType: 'light_fighter',
        hullClass: HullClass.FIGHTER,
        maxHull: 80,
        armor: 5,
        baseMass: 30,
        slots: [
            { type: ModuleSlotType.ENGINE, size: 1, moduleId: null },
            { type: ModuleSlotType.REACTOR, size: 1, moduleId: null },
            { type: ModuleSlotType.WEAPON, size: 1, moduleId: null },
            { type: ModuleSlotType.WEAPON, size: 1, moduleId: null }
        ]
    },
    HEAVY_FIGHTER: {
        hullType: 'heavy_fighter',
        hullClass: HullClass.FIGHTER,
        maxHull: 200,
        armor: 50,
        baseMass: 60,
        slots: [
            { type: ModuleSlotType.ENGINE, size: 2, moduleId: null },
            { type: ModuleSlotType.REACTOR, size: 2, moduleId: null },
            { type: ModuleSlotType.WEAPON, size: 2, moduleId: null },
            { type: ModuleSlotType.WEAPON, size: 1, moduleId: null },
            { type: ModuleSlotType.SHIELD, size: 1, moduleId: null }
        ]
    },
    CORVETTE: {
        hullType: 'corvette',
        hullClass: HullClass.CORVETTE,
        maxHull: 300,
        armor: 25,
        baseMass: 150,
        slots: [
            { type: ModuleSlotType.ENGINE, size: 2, moduleId: null },
            { type: ModuleSlotType.ENGINE, size: 1, moduleId: null },
            { type: ModuleSlotType.REACTOR, size: 2, moduleId: null },
            { type: ModuleSlotType.WEAPON, size: 2, moduleId: null },
            { type: ModuleSlotType.WEAPON, size: 2, moduleId: null },
            { type: ModuleSlotType.SHIELD, size: 2, moduleId: null },
            { type: ModuleSlotType.CARGO, size: 1, moduleId: null }
        ]
    },
    FREIGHTER: {
        hullType: 'freighter',
        hullClass: HullClass.FRIGATE,
        maxHull: 400,
        armor: 10,
        baseMass: 300,
        slots: [
            { type: ModuleSlotType.ENGINE, size: 3, moduleId: null },
            { type: ModuleSlotType.REACTOR, size: 2, moduleId: null },
            { type: ModuleSlotType.WEAPON, size: 1, moduleId: null },
            { type: ModuleSlotType.SHIELD, size: 1, moduleId: null },
            { type: ModuleSlotType.CARGO, size: 3, moduleId: null },
            { type: ModuleSlotType.CARGO, size: 3, moduleId: null },
            { type: ModuleSlotType.CARGO, size: 2, moduleId: null }
        ]
    }
};

export default createShipHull;
