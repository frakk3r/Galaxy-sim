/**
 * =============================================================================
 * STATION.TS - Componente per stazioni spaziali e punti di attracco
 * =============================================================================
 */

import { BaseComponent } from '../../engine/ecs/types';

export interface StationComponent extends BaseComponent {
    // Coordinate locali del punto di attracco (relative al centro della stazione)
    dockingPort: { 
        x: number; 
        y: number; 
        angle: number; // Angolo di approccio (es. Math.PI/2 per entrare dal basso)
    };
    dockingRadius: number; // Raggio di cattura per l'attracco automatico
    isOccupied: boolean;
    dockedEntityId: number | null;
}

export function createStationComponent(config: Partial<StationComponent> = {}): StationComponent {
    return {
        dockingPort: config.dockingPort ?? { x: 0, y: 100, angle: -Math.PI/2 },
        dockingRadius: config.dockingRadius ?? 300,
        isOccupied: false,
        dockedEntityId: null
    };
}

export default createStationComponent;
