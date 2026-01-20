/**
 * =============================================================================
 * UI/APP.TSX - Componente principale React UI
 * =============================================================================
 */

import React, { useState, useEffect } from 'react';
import { HUD, PlayerData } from './components/HUD';
import { DebugPanel } from './components/DebugPanel';
import { PauseMenu } from './components/PauseMenu';
import { StationMenu } from './components/StationMenu';
import { ShipHullComponent } from '../game/components/ShipHull';
import { ShipShieldComponent } from '../game/components/ShipShield';
import { ShipReactorComponent } from '../game/components/ShipReactor';
import { VelocityComponent } from '../game/components/Velocity';
import { CargoComponent } from '../game/components/Cargo';
import { TransformComponent } from '../game/components/Transform';
import { DockingComponent, DockStatus } from '../game/components/Docking';
import { RESOURCES } from '../game/components/Pickup';

// Inventory HUD Component - Bottom Right
function InventoryHUD({ playerId, world }: { playerId: number; world: any }) {
    const [cargo, setCargo] = useState<CargoComponent | null>(null);

    useEffect(() => {
        if (!world) return;

        const updateCargo = () => {
            const c = world.getComponent(playerId, 'Cargo');
            if (c) setCargo({ ...c });
        };

        updateCargo();
        const interval = setInterval(updateCargo, 100);
        return () => clearInterval(interval);
    }, [playerId, world]);

    if (!cargo) return null;

    const capacity = cargo.capacity ?? 750;  // 15 slots * 50 = 750
    const currentVolume = cargo.currentVolume ?? 0;
    const fillPercent = Math.round((currentVolume / capacity) * 100);

    // Show each slot with its individual quantity
    const resourceColors: Record<string, string> = {
        'scrap': '#6b6b6b',
        'iron': '#d4a574',
        'gold': '#ffd700',
        'crystal': '#00ffff'
    };

    const resourceNames: Record<string, string> = {
        'scrap': 'SCRAP',
        'iron': 'IRON',
        'gold': 'GOLD',
        'crystal': 'CRYSTAL'
    };

    return (
        <div className="inventory-hud">
            <div className="inventory-header">
                <span className="inventory-icon">📦</span>
                <span className="inventory-title">CARGO</span>
                <span className="inventory-percent">{fillPercent}%</span>
            </div>
            <div className="inventory-bar">
                <div 
                    className="inventory-fill" 
                    style={{ 
                        width: `${fillPercent}%`,
                        background: fillPercent > 80 ? '#e74c3c' : fillPercent > 50 ? '#f39c12' : '#3498db'
                    }}
                />
            </div>
            <div className="inventory-items">
                {cargo.items.map((item: any, idx: number) => (
                    <div key={`${item.id}_${idx}`} className="inventory-item">
                        <span className="item-dot" style={{ background: resourceColors[item.id] || '#fff' }} />
                        <span className="item-name">{resourceNames[item.id] || item.id}</span>
                        <span className="item-qty">{item.quantity}/{item.maxQuantity || 50}</span>
                    </div>
                ))}
                {cargo.items.length === 0 && (
                    <div className="inventory-empty">EMPTY</div>
                )}
            </div>
        </div>
    );
}

/**
 * Hook per ottenere stats del gioco ogni N ms
 */
function useGameStats(gameRef: any, interval = 100) {
    const [stats, setStats] = useState({
        fps: 0,
        entities: 0,
        state: 'stopped',
        speed: 1
    });

    useEffect(() => {
        if (!gameRef) return;

        const updateStats = () => {
            const loopStats = gameRef.gameLoop?.getStats() || {};
            const worldStats = gameRef.world?.getStats() || {};

            setStats({
                fps: loopStats.fps || 0,
                entities: worldStats.entities?.active || 0,
                state: gameRef.gameLoop?.state || 'stopped',
                speed: gameRef.gameLoop?.speed || 1
            });
        };

        const intervalId = setInterval(updateStats, interval);
        return () => clearInterval(intervalId);
    }, [gameRef, interval]);

    return stats;
}

interface NotificationItemData {
    id: number;
    quantity: number;
    resourceId: string;
    timestamp: number;
}

// Componente Notifiche Loot - Fisso in alto a destra
function NotificationList({ notifications }: { notifications: NotificationItemData[] }) {
    const MAX_NOTIFICATIONS = 4;
    const displayNotifications = notifications.slice(-MAX_NOTIFICATIONS);

    return (
        <div className="loot-notifications">
            {displayNotifications.map((n, index) => {
                const age = Date.now() - n.timestamp;
                const isOldest = index === 0;
                const fadeStart = 1000;
                const fadeDuration = 500;
                let opacity = 1;
                
                if (isOldest && age > fadeStart) {
                    opacity = Math.max(0, 1 - (age - fadeStart) / fadeDuration);
                }

                const resourceColors: Record<string, string> = {
                    'CRYSTAL': '#9b59b6',
                    'GOLD': '#f1c40f',
                    'IRON': '#95a5a6',
                    'COPPER': '#e67e22',
                    'SCRAP': '#7f8c8d'
                };
                const color = resourceColors[n.resourceId.toUpperCase()] || '#3498db';

                return (
                    <div 
                        key={n.id} 
                        className="loot-notification-item"
                        style={{ opacity }}
                    >
                        <span className="loot-plus" style={{ color: '#2ecc71' }}>+</span>
                        <span className="loot-qty">{n.quantity}</span>
                        <span className="loot-name" style={{ color }}>{n.resourceId.toUpperCase()}</span>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * App - Componente principale UI
 */
export function App({ gameRef }: { gameRef: any }) {
    // Stati UI
    const [showDebug, setShowDebug] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isTrading, setIsTrading] = useState(false); // Menu stazione
    const [notifications, setNotifications] = useState<NotificationItemData[]>([]);
    const [secondaryCooldown, setSecondaryCooldown] = useState(0);
    const [secondaryMaxCooldown, setSecondaryMaxCooldown] = useState(10);

    // Stats dal gioco
    const stats = useGameStats(gameRef, 100);

    // Dati player
    const [playerData, setPlayerData] = useState<PlayerData & { canDock: boolean, dockStatus: string | null }>({
        hull: 100,
        maxHull: 100,
        shield: 50,
        maxShield: 50,
        energy: 100,
        maxEnergy: 100,
        speed: 0,
        cargo: [],
        canDock: false,
        dockStatus: null
    });

    // Gestione notifiche raccolta (solo per il giocatore)
    useEffect(() => {
        if (!gameRef?.eventBus || !gameRef?.playerId) return;

        const handleCollection = (data: any) => {
            if (data.collectorId !== gameRef.playerId) return;

            const id = Date.now() + Math.random();
            const notification: NotificationItemData = { 
                id, 
                quantity: data.quantity, 
                resourceId: data.resourceId,
                timestamp: Date.now()
            };
            
            setNotifications(prev => [...prev, notification].slice(-20));

            // Rimuovi dopo 3 secondi
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== id));
            }, 3000);
        };

        const unsubscribe = gameRef.eventBus.on('inventory:collected', handleCollection);
        return unsubscribe;
    }, [gameRef]);

    // Aggiorna dati player e prossimità docking
    useEffect(() => {
        if (!gameRef?.world || !gameRef?.playerId) return;

        const updatePlayerData = () => {
            const world = gameRef.world;
            const playerId = gameRef.playerId;
            const stationId = gameRef.stationId;

            const hull = world.getComponent(playerId, 'ShipHull') as ShipHullComponent;
            const shield = world.getComponent(playerId, 'ShipShield') as ShipShieldComponent;
            const reactor = world.getComponent(playerId, 'ShipReactor') as ShipReactorComponent;
            const velocity = world.getComponent(playerId, 'Velocity') as VelocityComponent;
            const cargo = world.getComponent(playerId, 'Cargo') as CargoComponent;
            const docking = world.getComponent(playerId, 'Docking') as DockingComponent;

            const pTransform = world.getComponent(playerId, 'Transform') as TransformComponent;
            const sTransform = world.getComponent(stationId, 'Transform') as TransformComponent;

            let canDock = false;
            if (pTransform && sTransform) {
                const dx = pTransform.x - sTransform.x;
                const dy = pTransform.y - sTransform.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < 400) canDock = true;
            }

            setPlayerData({
                hull: hull?.currentHull ?? 100,
                maxHull: hull?.maxHull ?? 100,
                shield: shield?.currentShield ?? 0,
                maxShield: shield?.maxShield ?? 0,
                energy: reactor?.currentEnergy ?? 100,
                maxEnergy: reactor?.energyCapacity ?? 100,
                speed: velocity ? Math.sqrt(velocity.vx ** 2 + velocity.vy ** 2) : 0,
                cargo: cargo?.items ?? [],
                canDock,
                dockStatus: docking ? docking.status : null
            });
        };

        const intervalId = setInterval(updatePlayerData, 50);
        return () => clearInterval(intervalId);
    }, [gameRef]);

    // Aggiorna cooldown arma secondaria
    useEffect(() => {
        if (!gameRef?.world || !gameRef?.playerId) return;

        const updateSecondaryCooldown = () => {
            const world = gameRef.world;
            const playerId = gameRef.playerId;
            const weapon = world.getComponent(playerId, 'ShipWeapon') as any;

            if (weapon && weapon.secondaryCooldown !== undefined) {
                setSecondaryCooldown(Math.max(0, weapon.secondaryCooldown));
            }
        };

        const intervalId = setInterval(updateSecondaryCooldown, 50);
        return () => clearInterval(intervalId);
    }, [gameRef]);

    // Handler per il menu stazione
    const handleSellAll = () => {
        const cargo = gameRef.world.getComponent(gameRef.playerId, 'Cargo') as CargoComponent;
        if (!cargo) return;

        let totalValue = 0;
        cargo.items.forEach(item => {
            totalValue += item.value * item.quantity;
        });

        cargo.items = [];
        cargo.currentVolume = 0;
        cargo.credits += totalValue;
    };

    const handleRepair = () => {
        const hull = gameRef.world.getComponent(gameRef.playerId, 'ShipHull') as ShipHullComponent;
        const cargo = gameRef.world.getComponent(gameRef.playerId, 'Cargo') as CargoComponent;

        if (!hull || !cargo) return;

        const cost = Math.max(0, Math.round((hull.maxHull - hull.currentHull) * 2));
        if (cost > 0 && cargo.credits >= cost) {
            cargo.credits -= cost;
            hull.currentHull = hull.maxHull;
        }
    };

    const handleRecharge = () => {
        const reactor = gameRef.world.getComponent(gameRef.playerId, 'ShipReactor') as ShipReactorComponent;
        const cargo = gameRef.world.getComponent(gameRef.playerId, 'Cargo') as CargoComponent;

        if (!reactor || !cargo) return;

        const cost = Math.max(0, Math.round((reactor.energyCapacity - reactor.currentEnergy) * 0.5));
        if (cost > 0 && cargo.credits >= cost) {
            cargo.credits -= cost;
            reactor.currentEnergy = reactor.energyCapacity;
        }
    };

    const handleBuyMissiles = () => {
        const weapon = gameRef.world.getComponent(gameRef.playerId, 'ShipWeapon') as any;
        const cargo = gameRef.world.getComponent(gameRef.playerId, 'Cargo') as CargoComponent;

        if (!weapon || !cargo || !weapon.secondaryWeapon) return;

        const missileCost = 1000;
        const currentMissiles = weapon.secondaryWeapon.currentAmmo ?? 0;
        const maxMissiles = weapon.secondaryWeapon.maxAmmo ?? 4;

        if (currentMissiles >= maxMissiles || cargo.credits < missileCost) return;

        cargo.credits -= missileCost;
        weapon.secondaryWeapon.currentAmmo = currentMissiles + 1;
    };

    // Gestione tasti UI
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // T: Gestito da StationSystem (engine) per attracco fisico

            // Y: Menu Trading (solo se docked fisicamente)
            if (e.key === 'y' || e.key === 'Y') {
                const docking = gameRef.world.getComponent(gameRef.playerId, 'Docking') as DockingComponent;
                if (docking && docking.status === DockStatus.DOCKED) {
                    setIsTrading(true);
                    setIsPaused(true);
                }
            }

            if (e.key === 'Escape') {
                if (isTrading) {
                    setIsTrading(false);
                    setIsPaused(false);
                } else {
                    setIsPaused(p => !p);
                }
            }
            if (e.key === 'F3') {
                e.preventDefault();
                setShowDebug(d => !d);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameRef, isTrading]);

    // Sync stato pausa con game loop
    useEffect(() => {
        if (!gameRef?.gameLoop) return;
        
        // Pausa solo se menu aperto o pausa manuale.
        // NON pausare durante auto-docking (fisica deve girare)
        const shouldPause = isPaused || isTrading;

        if (shouldPause && gameRef.gameLoop.isRunning) {
            gameRef.gameLoop.pause();
        } else if (!shouldPause && gameRef.gameLoop.isPaused) {
            gameRef.gameLoop.resume();
        }
    }, [isPaused, isTrading, gameRef]);

    // Recupera componenti attuali per passarli al menu al render
    const currentCargo = gameRef.world.getComponent(gameRef.playerId, 'Cargo') as CargoComponent;
    const currentHull = gameRef.world.getComponent(gameRef.playerId, 'ShipHull') as ShipHullComponent;
    const currentReactor = gameRef.world.getComponent(gameRef.playerId, 'ShipReactor') as ShipReactorComponent;
    const currentWeapon = gameRef.world.getComponent(gameRef.playerId, 'ShipWeapon') as any;

    return (
        <div className="ui-root">
            {/* HUD sempre visibile (tranne menu) */}
            {!isTrading && (
                <HUD 
                    playerData={playerData}
                    stats={stats}
                />
            )}

            {/* Debug panel (toggle con F3) */}
            {showDebug && (
                <DebugPanel 
                    gameRef={gameRef}
                    stats={stats}
                    onClose={() => setShowDebug(false)}
                />
            )}

            {/* Menu pausa */}
            {isPaused && !isTrading && (
                <PauseMenu 
                    onResume={() => setIsPaused(false)}
                    onSettings={() => console.log('Settings')}
                    onQuit={() => console.log('Quit')}
                />
            )}

            {/* Station Menu */}
            {isTrading && currentCargo && (
                <StationMenu
                    cargo={currentCargo}
                    hull={currentHull}
                    reactor={currentReactor}
                    weapon={currentWeapon}
                    onClose={() => { setIsTrading(false); setIsPaused(false); }}
                    onSellAll={handleSellAll}
                    onRepair={handleRepair}
                    onRecharge={handleRecharge}
                    onBuyMissiles={handleBuyMissiles}
                />
            )}

            {/* Docking Status Hints */}
            {!isTrading && !isPaused && (
                <>
                    {/* Docking Hint */}
                    {playerData.canDock && !playerData.dockStatus && (
                        <div className="docking-hint">
                            HOLD <span className="key">T</span> TO DOCK
                        </div>
                    )}

                    {/* Docking Status In Progress */}
                    {playerData.dockStatus === DockStatus.APPROACHING && (
                        <div className="docking-status">
                            AUTO-DOCKING IN PROGRESS...
                        </div>
                    )}

                    {/* Docked Status */}
                    {playerData.dockStatus === DockStatus.DOCKED && (
                        <div className="docking-menu-hint">
                            <div className="status">STATION CONNECTED</div>
                            <div className="actions">
                                <div><span className="key">Y</span> TRADE</div>
                                <div><span className="key">T</span> UNDOCK</div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Notifiche Loot */}
            <NotificationList notifications={notifications} />

            {/* Cooldown arma secondaria */}
            {secondaryCooldown > 0 && (
                <div className="secondary-cooldown-bar">
                    <div className="cooldown-label">MISSILE - {secondaryCooldown.toFixed(1)}s</div>
                    <div className="cooldown-track">
                        <div
                            className="cooldown-fill"
                            style={{
                                width: `${((secondaryMaxCooldown - secondaryCooldown) / secondaryMaxCooldown) * 100}%`
                            }}
                        />
                    </div>
                </div>
            )}

            {!secondaryCooldown && currentWeapon?.secondaryWeapon && currentWeapon.secondaryWeapon.currentAmmo !== undefined && (
                <div className="secondary-cooldown-bar">
                    <div className="cooldown-label">MISSILE READY</div>
                    <div className="cooldown-track">
                        <div className="cooldown-fill" style={{ width: '100%', background: '#2ecc71' }} />
                    </div>
                </div>
            )}

            {/* Munizioni missili */}
            {currentWeapon?.secondaryWeapon && (
                <div className="missile-ammo-bar">
                    <div className="missile-ammo-label">
                        MISSILES {(currentWeapon.secondaryWeapon.currentAmmo ?? 0) === 0 && (
                            <span style={{ color: '#e74c3c', marginLeft: '5px' }}>NO AMMO</span>
                        )}
                    </div>
                    <div className="missile-ammo-track">
                        {Array.from({ length: 4 }, (_, i) => (
                            <div
                                key={i}
                                className={`missile-ammo-slot ${i < (currentWeapon.secondaryWeapon.currentAmmo ?? 0) ? 'filled' : 'empty'}`}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Inventory HUD - Bottom Right */}
            <InventoryHUD playerId={gameRef.playerId} world={gameRef.world} />

            {/* Velocità - Centro sotto missile cooldown */}
            <div className="speed-display">
                <div className="speed-value">{Math.round(playerData.speed)}</div>
                <div className="speed-unit">m/s</div>
            </div>

            {/* Legend controls */}
            <div className="controls-legend">
                <div className="legend-title">CONTROLS</div>
                <div className="legend-row"><span className="key">W A S D</span> <span className="desc">Move</span></div>
                <div className="legend-row"><span className="key">SPACE</span> <span className="desc">Brake</span></div>
                <div className="legend-row"><span className="key">L M B</span> <span className="desc">Laser</span></div>
                <div className="legend-row"><span className="key">R M B</span> <span className="desc">Missile</span></div>
                <div className="legend-row"><span className="key">T</span> <span className="desc">Dock</span></div>
                <div className="legend-row"><span className="key">Y</span> <span className="desc">Trade</span></div>
                <div className="legend-row"><span className="key">ESC</span> <span className="desc">Pause</span></div>
                <div className="legend-row"><span className="key">F3</span> <span className="desc">Debug</span></div>
            </div>
        </div>
    );
}

export default App;
