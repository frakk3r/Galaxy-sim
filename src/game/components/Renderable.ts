/**
 * =============================================================================
 * RENDERABLE.TS - Componente per il rendering visivo
 * =============================================================================
 */

import { BaseComponent } from '../../engine/ecs/types';

export interface RenderableComponent extends BaseComponent {
    type: 'circle' | 'rect' | 'polygon' | 'sprite' | 'rotatingText';
    fillColor: string;
    strokeColor: string;
    strokeWidth: number;
    radius: number;
    width: number;
    height: number;
    vertices: number[][] | null;
    layer: number;
    visible: boolean;
    alpha: number;
    glowEnabled: boolean;
    glowColor: string;
    glowIntensity: number;
    text?: string;
    textColor?: string;
    textFont?: string;
    textSize?: number;
    textOffsetRadius?: number;
    textRotationSpeed?: number;
}

export function createRenderable(config: Partial<RenderableComponent> = {}): RenderableComponent {
    return {
        type: config.type ?? 'circle',
        fillColor: config.fillColor ?? '#ffffff',
        strokeColor: config.strokeColor ?? '#ffffff',
        strokeWidth: config.strokeWidth ?? 1,
        radius: config.radius ?? 10,
        width: config.width ?? 20,
        height: config.height ?? 20,
        vertices: config.vertices ?? null,
        layer: config.layer ?? 0,
        visible: config.visible ?? true,
        alpha: config.alpha ?? 1,
        glowEnabled: config.glowEnabled ?? false,
        glowColor: config.glowColor ?? '#ffffff',
        glowIntensity: config.glowIntensity ?? 10,
        text: config.text,
        textColor: config.textColor ?? '#ffffff',
        textFont: config.textFont ?? 'Arial',
        textSize: config.textSize ?? 24,
        textOffsetRadius: config.textOffsetRadius ?? 0,
        textRotationSpeed: config.textRotationSpeed ?? 0.5
    };
}

export const SHAPE_PRESETS: Record<string, Partial<RenderableComponent>> = {
    SHIP_BASIC: {
        type: 'polygon',
        vertices: [
            [15, 0],    // Prua (punta)
            [-13, -11.5], // Poppa sinistra - più larga (15% più largo)
            [-6, 0],    // Centro posteriore
            [-13, 11.5]   // Poppa destra - più larga (15% più largo)
        ],
        fillColor: '#3498db',
        strokeColor: '#2980b9'
    },
    ASTEROID: {
        type: 'polygon',
        vertices: [
            [30, 0], [21, 24], [-9, 30],
            [-30, 9], [-24, -21], [6, -30]
        ],
        fillColor: '#7f8c8d',
        strokeColor: '#5d6d7e',
        strokeWidth: 2
    },
    PROJECTILE: {
        type: 'circle',
        radius: 3,
        fillColor: '#f39c12',
        glowEnabled: true,
        glowColor: '#f39c12'
    },
    STATION: {
        type: 'polygon',
        vertices: [
            // Corpo principale
            [-80, -40], [80, -40], [100, 0], [80, 40], 
            // Molo (LARGHEZZA 80)
            [40, 40], [40, 120], [-40, 120], [-40, 40],
            // Chiusura corpo
            [-80, 40], [-100, 0]
        ],
        fillColor: '#2c3e50',
        strokeColor: '#3498db',
        strokeWidth: 2,
        glowEnabled: true,
        glowColor: '#3498db',
        glowIntensity: 20
    }
};

export default createRenderable;
