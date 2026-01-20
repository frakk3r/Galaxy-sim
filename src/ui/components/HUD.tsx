/**
 * =============================================================================
 * HUD.TSX - Heads-Up Display del gioco (Improved)
 * =============================================================================
 */

import React from 'react';

interface StatusBarProps {
    label: string;
    icon: string;
    current: number;
    max: number;
    color: string;
}

function StatusBar({ label, icon, current, max, color }: StatusBarProps) {
    const percent = max > 0 ? (current / max) * 100 : 0;
    const isLow = percent <= 25;
    const isCritical = percent <= 15;

    return (
        <div className={`ship-status-bar ${isLow ? 'low' : ''} ${isCritical ? 'critical' : ''}`}>
            <div className="status-bar-header">
                <span className="status-icon">{icon}</span>
                <span className="status-label">{label}</span>
                <span className="status-value">
                    {Math.round(current)}<span className="status-max">/{Math.round(max)}</span>
                </span>
            </div>
            <div className="status-bar-track">
                <div
                    className="status-bar-fill"
                    style={{
                        width: `${percent}%`,
                        background: isCritical
                            ? `linear-gradient(90deg, #ff0000, #ff4444)`
                            : isLow
                                ? `linear-gradient(90deg, #ff6600, #ff9900)`
                                : color
                    }}
                />
                <div
                    className="status-bar-shine"
                    style={{ width: `${percent}%` }}
                />
            </div>
            <div
                className="status-bar-marker"
                style={{ left: `${percent}%` }}
            />
        </div>
    );
}

interface GameStats {
    fps: number;
    entities: number;
    state: string;
    speed: number;
}

interface SystemInfoProps {
    stats: GameStats;
}

function SystemInfo({ stats }: SystemInfoProps) {
    const stateColors: Record<string, string> = {
        running: '#00ff00',
        paused: '#ffff00',
        stopped: '#ff0000'
    };

    return (
        <div className="hud-system-info">
            <div className="system-info-row">
                <span className="info-label">FPS</span>
                <span className="info-value" style={{
                    color: stats.fps >= 55 ? '#00ff00' : stats.fps >= 30 ? '#ffff00' : '#ff0000'
                }}>
                    {stats.fps}
                </span>
            </div>
            <div className="system-info-row">
                <span className="info-label">ENT</span>
                <span className="info-value">{stats.entities}</span>
            </div>
            <div className="system-info-row">
                <span className="info-label">SPD</span>
                <span className="info-value">{stats.speed}x</span>
            </div>
            <div
                className="system-state"
                style={{ color: stateColors[stats.state] || '#888' }}
            >
                {stats.state?.toUpperCase()}
            </div>
        </div>
    );
}

export interface PlayerData {
    hull: number;
    maxHull: number;
    shield: number;
    maxShield: number;
    energy: number;
    maxEnergy: number;
    speed: number;
}

interface HUDProps {
    playerData: PlayerData;
    stats: GameStats;
}

export function HUD({ playerData, stats }: HUDProps) {
    return (
        <div className="hud">
            <div className="hud-status-bars">
                <StatusBar
                    label="SHIP"
                    icon="◆"
                    current={playerData.hull}
                    max={playerData.maxHull}
                    color="linear-gradient(90deg, #e74c3c, #c0392b)"
                />
                <StatusBar
                    label="SHIELD"
                    icon="◈"
                    current={playerData.shield}
                    max={playerData.maxShield}
                    color="linear-gradient(90deg, #3498db, #2980b9)"
                />
                <StatusBar
                    label="ENERGY"
                    icon="◇"
                    current={playerData.energy}
                    max={playerData.maxEnergy}
                    color="linear-gradient(90deg, #f1c40f, #f39c12)"
                />
            </div>

            <SystemInfo stats={stats} />
        </div>
    );
}

export default HUD;
