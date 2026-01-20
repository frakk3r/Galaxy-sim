/**
 * =============================================================================
 * AI-CONTROLLER.TS - Componente per il controllo IA avanzato
 * =============================================================================
 * Include: FSM completa, personalità, steering behaviors
 */

import { BaseComponent, EntityId } from '../../engine/ecs/types';

export const AIState = {
    IDLE: 'idle',
    EXPLORE: 'explore',
    MINING: 'mining',
    COLLECTING: 'collecting',
    COMBAT: 'combat',
    RETREAT: 'retreat',
    DOCKING: 'docking',
    REPLY: 'reply',
    EXIT_SHIELD: 'exit_shield'
} as const;

export type AIStateType = typeof AIState[keyof typeof AIState];

export const AITargetType = {
    ASTEROID: 'asteroid',
    ENEMY: 'enemy',
    LOOT: 'loot',
    STATION: 'station'
} as const;

export type AITargetTypeType = typeof AITargetType[keyof typeof AITargetType];

export interface AIPersonality {
    aggressiveness: number;
    preferredDistance: number;
    targetingBias: 'nearest' | 'largest' | 'weakest' | 'random';
    reactionSpeed: number;
    caution: number;
    miningEfficiency: number;
}

export interface AITarget {
    id: EntityId | string;
    type: AITargetTypeType;
    position: { x: number; y: number };
    priority: number;
}

export interface AISensorData {
    obstacles: Array<{ entityId: EntityId; distance: number; angle: number }>;
    enemies: Array<{ entityId: EntityId; distance: number; angle: number; threat: number }>;
    loot: Array<{ entityId: EntityId; distance: number; angle: number; value: number }>;
    asteroids: Array<{ entityId: EntityId; distance: number; angle: number; size: number }>;
}

export interface AIControllerComponent extends BaseComponent {
    state: AIStateType;
    target: AITarget | null;
    secondaryTarget: AITarget | null;
    sensors: AISensorData;
    personality: AIPersonality;
    sightRange: number;
    attackRange: number;
    minCombatRange: number;
    decisionTimer: number;
    decisionInterval: number;
    homeStationId: EntityId | null;
    missileSlots: number;
    missileCooldown: number;
    repairTimer: number;
    energyLevel: number;
}

export function createAIController(config: Partial<AIControllerComponent> = {}): AIControllerComponent {
    const personality: AIPersonality = config.personality ?? {
        aggressiveness: 0.5 + Math.random() * 0.5,
        preferredDistance: 150 + Math.random() * 150,
        targetingBias: ['nearest', 'largest', 'weakest', 'random'][Math.floor(Math.random() * 4)] as 'nearest' | 'largest' | 'weakest' | 'random',
        reactionSpeed: 0.5 + Math.random() * 0.5,
        caution: Math.random(),
        miningEfficiency: 0.7 + Math.random() * 0.3
    };

    return {
        state: config.state ?? AIState.IDLE,
        target: null,
        secondaryTarget: null,
        sensors: {
            obstacles: [],
            enemies: [],
            loot: [],
            asteroids: []
        },
        personality,
        sightRange: config.sightRange ?? 550,
        attackRange: config.attackRange ?? 400,
        minCombatRange: config.minCombatRange ?? 100,
        decisionTimer: 0,
        decisionInterval: config.decisionInterval ?? 0.15,
        homeStationId: config.homeStationId ?? null,
        missileSlots: 4,
        missileCooldown: 0,
        repairTimer: 0,
        energyLevel: 1.0
    };
}

export function createAggressivePersonality(): AIPersonality {
    return {
        aggressiveness: 0.9,
        preferredDistance: 200,
        targetingBias: 'weakest',
        reactionSpeed: 0.9,
        caution: 0.2,
        miningEfficiency: 0.8
    };
}

export function createCautiousPersonality(): AIPersonality {
    return {
        aggressiveness: 0.3,
        preferredDistance: 400,
        targetingBias: 'largest',
        reactionSpeed: 0.5,
        caution: 0.8,
        miningEfficiency: 0.7
    };
}

export function createBalancedPersonality(): AIPersonality {
    return {
        aggressiveness: 0.6,
        preferredDistance: 250,
        targetingBias: 'nearest',
        reactionSpeed: 0.7,
        caution: 0.5,
        miningEfficiency: 0.85
    };
}

export default createAIController;
