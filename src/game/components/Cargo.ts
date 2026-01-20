/**
 * =============================================================================
 * CARGO.TS - Componente per stiva e inventario (Slot-based system)
 * =============================================================================
 * Ogni slot può contenere massimo 50 unità di UN tipo di risorsa.
 * Quando uno slot si riempie (50/50), ne viene aperto uno nuovo.
 */

import { BaseComponent } from '../../engine/ecs/types';

export interface CargoItem {
    id: string;
    name: string;
    quantity: number;
    value: number; // Valore unitario in crediti
    maxQuantity: number; // Massimo per slot (50)
}

export interface CargoComponent extends BaseComponent {
    capacity: number;      // Capacità massima totale (15 * 50 = 750)
    currentVolume: number; // Volume totale occupato (somma di tutte le quantity)
    items: CargoItem[];    // Lista slot (ogni slot = 1 tipo di risorsa)
    credits: number;       // Denaro del proprietario
    maxItems: number;      // Numero massimo di slot (15)
    slotCapacity: number;  // Capacità per slot (50)
}

export function createCargo(config: Partial<CargoComponent> = {}): CargoComponent {
    return {
        capacity: config.capacity ?? 750,      // 15 slots * 50 = 750
        currentVolume: config.currentVolume ?? 0,
        items: config.items ?? [],
        credits: config.credits ?? 0,
        maxItems: config.maxItems ?? 15,
        slotCapacity: config.slotCapacity ?? 50
    };
}

export const CARGO_PRESETS = {
    FIGHTER: { capacity: 750, credits: 100, maxItems: 15, slotCapacity: 50 },
    FREIGHTER: { capacity: 1000, credits: 1000, maxItems: 20, slotCapacity: 50 },
    STATION: { capacity: 10000, credits: 100000, maxItems: 100, slotCapacity: 50 }
};

export default createCargo;
