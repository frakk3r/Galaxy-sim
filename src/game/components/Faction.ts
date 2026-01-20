/**
 * =============================================================================
 * FACTION.TS - Componente per appartenenza a fazione
 * =============================================================================
 */

import { BaseComponent } from '../../engine/ecs/types';

export const FactionRelation = {
    ALLIED: 'allied',
    FRIENDLY: 'friendly',
    NEUTRAL: 'neutral',
    HOSTILE: 'hostile',
    WAR: 'war'
} as const;

export type FactionRelationType = typeof FactionRelation[keyof typeof FactionRelation];

export interface FactionComponent extends BaseComponent {
    factionId: string;
    reputation: Record<string, number>;
    rank: number;
    isLeader: boolean;
    squadTag: string | null;
}

export function createFaction(config: Partial<FactionComponent> = {}): FactionComponent {
    return {
        factionId: config.factionId ?? 'neutral',
        reputation: config.reputation ?? {},
        rank: config.rank ?? 0,
        isLeader: config.isLeader ?? false,
        squadTag: config.squadTag ?? null
    };
}

interface FactionDef {
    id: string;
    name: string;
    color: string;
    defaultRelations: Record<string, FactionRelationType>;
}

export const FACTIONS: Record<string, FactionDef> = {
    NEUTRAL: {
        id: 'neutral',
        name: 'Neutrali',
        color: '#888888',
        defaultRelations: {}
    },
    PLAYER: {
        id: 'player',
        name: 'Giocatore',
        color: '#00ff00',
        defaultRelations: {
            'Elarans': FactionRelation.HOSTILE,
            'Misiks': FactionRelation.FRIENDLY,
            'Malagasy': FactionRelation.HOSTILE,
            'Okropoyds': FactionRelation.HOSTILE,
            'military': FactionRelation.NEUTRAL
        }
    },
    ELARANS: {
        id: 'Elarans',
        name: 'Elarans',
        color: '#ff0000',
        defaultRelations: {
            'player': FactionRelation.HOSTILE,
            'Misiks': FactionRelation.HOSTILE,
            'Malagasy': FactionRelation.HOSTILE,
            'Okropoyds': FactionRelation.HOSTILE,
            'military': FactionRelation.WAR,
            'Elarans': FactionRelation.FRIENDLY
        }
    },
    MISIKS: {
        id: 'Misiks',
        name: 'Misiks',
        color: '#ffff00',
        defaultRelations: {
            'player': FactionRelation.FRIENDLY,
            'Elarans': FactionRelation.HOSTILE,
            'Malagasy': FactionRelation.HOSTILE,
            'Okropoyds': FactionRelation.HOSTILE,
            'military': FactionRelation.FRIENDLY
        }
    },
    MALAGASY: {
        id: 'Malagasy',
        name: 'Malagasy',
        color: '#00ff00',
        defaultRelations: {
            'player': FactionRelation.HOSTILE,
            'Elarans': FactionRelation.HOSTILE,
            'Misiks': FactionRelation.HOSTILE,
            'Okropoyds': FactionRelation.HOSTILE,
            'military': FactionRelation.HOSTILE,
            'Malagasy': FactionRelation.FRIENDLY
        }
    },
    OKROPOYDS: {
        id: 'Okropoyds',
        name: 'Okropoyds',
        color: '#ff8800',
        defaultRelations: {
            'player': FactionRelation.HOSTILE,
            'Elarans': FactionRelation.HOSTILE,
            'Misiks': FactionRelation.HOSTILE,
            'Malagasy': FactionRelation.HOSTILE,
            'military': FactionRelation.HOSTILE,
            'Okropoyds': FactionRelation.FRIENDLY
        }
    },
    MILITARY: {
        id: 'military',
        name: 'Flotta Militare',
        color: '#0066ff',
        defaultRelations: {
            'player': FactionRelation.NEUTRAL,
            'Elarans': FactionRelation.WAR,
            'Misiks': FactionRelation.FRIENDLY,
            'Malagasy': FactionRelation.HOSTILE,
            'Okropoyds': FactionRelation.HOSTILE
        }
    }
};

export default createFaction;
