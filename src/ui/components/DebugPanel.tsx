/**
 * =============================================================================
 * DEBUG-PANEL.TSX - Debug panel updated for current gameplay
 * =============================================================================
 */

import React, { useState, useEffect } from 'react';

interface SectionProps {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

const Section: React.FC<SectionProps> = ({ title, children, defaultOpen = true }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="debug-section">
            <div 
                className="debug-section-header"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span>{isOpen ? '▼' : '▶'}</span>
                <span>{title}</span>
            </div>
            {isOpen && (
                <div className="debug-section-content">
                    {children}
                </div>
            )}
        </div>
    );
};

interface StatRowProps {
    label: string;
    value: string | number;
    color?: string;
}

const StatRow: React.FC<StatRowProps> = ({ label, value, color = '#fff' }) => {
    return (
        <div className="stat-row">
            <span className="stat-label">{label}</span>
            <span className="stat-value" style={{ color }}>{value}</span>
        </div>
    );
};

/**
 * AI Status row component
 */
const AIStatusRow = ({ ai, world }: { ai: any; world: any }) => {
    if (!ai || !world) return null;

    const transform = world.getComponent(ai.id, 'Transform');
    const hull = world.getComponent(ai.id, 'ShipHull');
    const shield = world.getComponent(ai.id, 'ShipShield');
    const reactor = world.getComponent(ai.id, 'ShipReactor');
    const cargo = world.getComponent(ai.id, 'Cargo');
    const weapon = world.getComponent(ai.id, 'ShipWeapon');
    const faction = world.getComponent(ai.id, 'Faction');

    const hullPercent = hull ? Math.round((hull.currentHull / hull.maxHull) * 100) : 0;
    const shieldPercent = shield ? Math.round((shield.currentShield / shield.maxShield) * 100) : 0;
    const energyPercent = reactor ? Math.round((reactor.currentEnergy / reactor.energyCapacity) * 100) : 0;
    const missiles = weapon?.secondaryWeapon?.currentAmmo ?? 0;
    const cargoVolume = cargo?.currentVolume ?? 0;
    const cargoCapacity = cargo?.capacity ?? 750;  // 15 slots * 50 = 750
    const cargoPercent = cargo ? Math.round((cargoVolume / cargoCapacity) * 100) : 0;
    const cargoSlots = cargo?.items?.length ?? 0;
    const cargoMaxSlots = cargo?.maxItems ?? 15;

    const factionColor = faction?.factionId === 'Misiks' ? '#3498db' : '#e74c3c';
    const hullColor = hullPercent > 50 ? '#2ecc71' : hullPercent > 25 ? '#f39c12' : '#e74c3c';
    const shieldColor = shieldPercent > 50 ? '#3498db' : '#95a5a6';

    return (
        <div className="ai-status-row">
            <div className="ai-info">
                <span className="ai-faction" style={{ color: factionColor }}>
                    {faction?.factionId === 'Misiks' ? '[TRADER]' : '[PIRATE]'}
                </span>
                <span className="ai-id">#{ai.id}</span>
                <span className="ai-state">{ai.state}</span>
            </div>
            <div className="ai-stats">
                <div className="ai-stat-bar" title={`Hull: ${hull?.currentHull}/${hull?.maxHull}`}>
                    <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${hullPercent}%`, background: hullColor }} />
                    </div>
                    <span className="bar-value">{hullPercent}%</span>
                </div>
                <div className="ai-stat-bar small" title={`Shield: ${shield?.currentShield}/${shield?.maxShield}`}>
                    <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${shieldPercent}%`, background: shieldColor }} />
                    </div>
                    <span className="bar-value">{shieldPercent}%</span>
                </div>
                <div className="ai-stat-bar small" title={`Energy: ${Math.round(reactor?.currentEnergy)}/${reactor?.energyCapacity}`}>
                    <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${energyPercent}%`, background: '#f1c40f' }} />
                    </div>
                    <span className="bar-value">{energyPercent}%</span>
                </div>
                <div className="ai-cargo" title={`Volume: ${cargoVolume}/${cargoCapacity}`}>
                    <span className="cargo-icon">📦</span>
                    <span className="cargo-value">{cargoVolume}</span>
                    <span className="cargo-percent">({cargoPercent}%)</span>
                </div>
                <div className="ai-missiles">
                    <span className="missile-icon">🚀</span>
                    <span className="missile-value">{missiles}/4</span>
                </div>
            </div>
        </div>
    );
}

/**
 * DebugPanel - Pannello principale aggiornato
 */
export function DebugPanel({ gameRef, stats, onClose }) {
    const [systemStats, setSystemStats] = useState({});
    const [aiList, setAIList] = useState<any[]>([]);

    useEffect(() => {
        if (!gameRef?.world) return;

        const updateData = () => {
            const world = gameRef.world;
            const systems = world.systems.getStats();
            setSystemStats(systems);

            // Get all AI entities
            const ais: any[] = [];
            world.entities.forEach((entity) => {
                const ai = world.getComponent(entity.id, 'AIController');
                if (ai) {
                    ais.push({
                        id: entity.id,
                        tag: entity.tag,
                        ...ai
                    });
                }
            });
            setAIList(ais);
        };

        const interval = setInterval(updateData, 100);
        return () => clearInterval(interval);
    }, [gameRef]);

    // Spawn handlers
    const handleSpawn = (type) => {
        if (!gameRef?.world) return;
        const world = gameRef.world;

        if (type === 'asteroid') {
            // Random position in space (avoiding stations)
            let x, y, valid;
            do {
                valid = true;
                x = (Math.random() - 0.5) * 3000;
                y = (Math.random() - 0.5) * 2000;
                
                // Check distance from stations
                const distFromPirateStation = Math.sqrt((x + 1500) ** 2 + y ** 2);
                const distFromTraderStation = Math.sqrt((x - 1500) ** 2 + y ** 2);
                
                if (distFromPirateStation < 800 || distFromTraderStation < 800) {
                    valid = false;
                }
            } while (!valid);
            
            spawnAsteroid(world, x, y);
            return;
        }

        // For ships, spawn inside shield area at random safe position
        if (type === 'pirate') {
            // Pirate station at x=-1500, spawn inside shield (550px)
            const stationX = -1500;
            const stationY = 0;
            const shieldRadius = 500; // Slightly inside shield
            const minDistFromStation = 200;
            const minDistBetweenShips = 80;
            
            // Find existing pirate ships to avoid overlap
            const existingPositions: Array<{ x: number; y: number }> = [];
            world.entities.forEach((entity) => {
                if (entity.tag === 'enemy_pirate') {
                    const t = world.getComponent(entity.id, 'Transform');
                    if (t) existingPositions.push({ x: t.x, y: t.y });
                }
            });

            // Try random positions until safe
            let x, y, valid;
            let attempts = 0;
            do {
                valid = true;
                const angle = Math.random() * Math.PI * 2;
                const dist = minDistFromStation + Math.random() * (shieldRadius - minDistFromStation);
                x = stationX + Math.cos(angle) * dist;
                y = stationY + Math.sin(angle) * dist;
                
                // Check distance from other pirate ships
                for (const pos of existingPositions) {
                    const d = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
                    if (d < minDistBetweenShips) {
                        valid = false;
                        break;
                    }
                }
                attempts++;
            } while (!valid && attempts < 50);

            // Find pirate station ID
            let stationId = null;
            world.entities.forEach((entity) => {
                if (entity.tag === 'station' && stationId === null) {
                    const entityFaction = world.getComponent(entity.id, 'Faction');
                    if (entityFaction && entityFaction.factionId === 'Elarans') {
                        stationId = entity.id;
                    }
                }
            });

            gameRef.spawnEnemyShip(x, y, stationId);
        } else {
            // Trader station at x=1500, spawn inside shield (550px)
            const stationX = 1500;
            const stationY = 0;
            const shieldRadius = 500;
            const minDistFromStation = 200;
            const minDistBetweenShips = 80;
            
            // Find existing trader ships to avoid overlap
            const existingPositions: Array<{ x: number; y: number }> = [];
            world.entities.forEach((entity) => {
                if (entity.tag === 'blue_trader') {
                    const t = world.getComponent(entity.id, 'Transform');
                    if (t) existingPositions.push({ x: t.x, y: t.y });
                }
            });

            // Try random positions until safe
            let x, y, valid;
            let attempts = 0;
            do {
                valid = true;
                const angle = Math.random() * Math.PI * 2;
                const dist = minDistFromStation + Math.random() * (shieldRadius - minDistFromStation);
                x = stationX + Math.cos(angle) * dist;
                y = stationY + Math.sin(angle) * dist;
                
                // Check distance from other trader ships
                for (const pos of existingPositions) {
                    const d = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
                    if (d < minDistBetweenShips) {
                        valid = false;
                        break;
                    }
                }
                attempts++;
            } while (!valid && attempts < 50);

            // Find trader station ID
            let stationId = null;
            world.entities.forEach((entity) => {
                if (entity.tag === 'station' && stationId === null) {
                    const entityFaction = world.getComponent(entity.id, 'Faction');
                    if (entityFaction && entityFaction.factionId === 'Misiks') {
                        stationId = entity.id;
                    }
                }
            });

            // Face pirate station
            const dx = -1500 - x;
            const dy = 0 - y;
            const rotation = Math.atan2(dy, dx);

            gameRef.spawnBlueTradeShip(x, y, rotation, stationId);
        }
    };

    const handleSpeed = (speed) => {
        if (gameRef?.gameLoop) {
            gameRef.gameLoop.setSpeed(speed);
        }
    };

    return (
        <div className="debug-panel">
            <div className="debug-panel-header">
                <span>Debug Panel (F3)</span>
                <button onClick={onClose}>✕</button>
            </div>

            <div className="debug-panel-content">
                {/* Performance */}
                <Section title="Performance">
                    <StatRow label="FPS" value={stats.fps} color={stats.fps >= 55 ? '#2ecc71' : stats.fps >= 30 ? '#f39c12' : '#e74c3c'} />
                    <StatRow label="Entities" value={stats.entities} />
                    <StatRow label="Speed" value={`${stats.speed}x`} />
                    <StatRow label="AI Count" value={aiList.length} color={aiList.length > 0 ? '#3498db' : '#888'} />
                </Section>

                {/* Simulation Controls */}
                <Section title="Simulation">
                    <div className="debug-button-row">
                        <button onClick={() => gameRef?.gameLoop?.togglePause()}>
                            {stats.state === 'paused' ? '▶ Resume' : '⏸ Pause'}
                        </button>
                        <button onClick={() => gameRef?.gameLoop?.step()}>⏭ Step</button>
                    </div>
                    <div className="debug-button-row">
                        <button onClick={() => handleSpeed(0.5)}>0.5x</button>
                        <button onClick={() => handleSpeed(1)}>1x</button>
                        <button onClick={() => handleSpeed(2)}>2x</button>
                        <button onClick={() => handleSpeed(5)}>5x</button>
                    </div>
                </Section>

                {/* Spawn */}
                <Section title="Spawn">
                    <div className="debug-button-row">
                        <button onClick={() => handleSpawn('asteroid')}>+ Asteroid</button>
                    </div>
                    <div className="debug-button-row">
                        <button onClick={() => handleSpawn('pirate')} style={{ background: 'rgba(231, 76, 60, 0.3)', borderColor: '#e74c3c' }}>
                            + Pirate
                        </button>
                        <button onClick={() => handleSpawn('trader')} style={{ background: 'rgba(52, 152, 219, 0.3)', borderColor: '#3498db' }}>
                            + Trader
                        </button>
                    </div>
                </Section>

                {/* AI Status - Main Feature */}
                <Section title={`AI Ships (${aiList.length})`} defaultOpen={true}>
                    {aiList.length === 0 ? (
                        <div style={{ color: '#888', fontStyle: 'italic', padding: '10px' }}>
                            No AI ships in game
                        </div>
                    ) : (
                        <div className="ai-status-list">
                            {aiList.map(ai => (
                                <div key={ai.id}>
                                    <AIStatusRow ai={ai} world={gameRef?.world} />
                                </div>
                            ))}
                        </div>
                    )}
                </Section>

                {/* Systems */}
                <Section title="Systems" defaultOpen={false}>
                    {Array.isArray(systemStats) && systemStats.map(sys => (
                        <StatRow 
                            key={sys.name}
                            label={sys.name}
                            value={`${sys.lastUpdateTime?.toFixed(2) || 0}ms`}
                            color={sys.enabled ? '#2ecc71' : '#888'}
                        />
                    ))}
                </Section>
            </div>
        </div>
    );
}

// Spawn helpers
function spawnAsteroid(world, x, y) {
    const id = world.createEntity('asteroid');
    world.addComponent(id, 'Transform', { 
        x, y, rotation: Math.random() * Math.PI * 2, 
        scale: 0.5 + Math.random() * 0.8, prevX: x, prevY: y, prevRotation: 0 
    });
    world.addComponent(id, 'Velocity', { 
        vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, 
        angularVelocity: (Math.random() - 0.5), maxSpeed: 100, drag: 0 
    });
    world.addComponent(id, 'Renderable', { 
        type: 'polygon', 
        vertices: [[10,0],[7,8],[-3,10],[-10,3],[-8,-7],[2,-10]], 
        fillColor: '#7f8c8d', strokeColor: '#5d6d7e', strokeWidth: 1, layer: 0, visible: true, alpha: 1 
    });
    world.addComponent(id, 'Collider', { type: 'circle', radius: 15, layer: 16, mask: 31 });
    world.addComponent(id, 'Health', { maxHealth: 50, currentHealth: 50, value: 0, lootTable: null });
    world.addComponent(id, 'Physics', { mass: 100, friction: 0.1, restitution: 0.5, isKinematic: false });
}

export default DebugPanel;
