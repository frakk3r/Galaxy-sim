/**
 * =============================================================================
 * STATION-MENU.TSX - Space Station Interface
 * =============================================================================
 */

import React from 'react';
import { CargoComponent } from '../../game/components/Cargo';
import { ShipHullComponent } from '../../game/components/ShipHull';
import { ShipReactorComponent } from '../../game/components/ShipReactor';
import { ShipWeaponComponent } from '../../game/components/ShipWeapon';

interface StationMenuProps {
    cargo: CargoComponent;
    hull: ShipHullComponent;
    reactor: ShipReactorComponent;
    weapon: ShipWeaponComponent | null;
    onClose: () => void;
    onSellAll: () => void;
    onRepair: () => void;
    onRecharge: () => void;
    onBuyMissiles: () => void;
}

export function StationMenu({ cargo, hull, reactor, weapon, onClose, onSellAll, onRepair, onRecharge, onBuyMissiles }: StationMenuProps) {
    const repairCost = Math.max(0, Math.round((hull.maxHull - hull.currentHull) * 2));
    const rechargeCost = Math.max(0, Math.round((reactor.energyCapacity - reactor.currentEnergy) * 0.5));

    const missileCost = 1000;
    const canBuyMissiles = weapon && weapon.secondaryWeapon && weapon.secondaryWeapon.currentAmmo !== undefined &&
                           (weapon.secondaryWeapon.currentAmmo ?? 0) < (weapon.secondaryWeapon.maxAmmo ?? 4);
    const currentMissiles = weapon?.secondaryWeapon?.currentAmmo ?? 0;
    const maxMissiles = weapon?.secondaryWeapon?.maxAmmo ?? 4;

    const totalValue = cargo.items.reduce((sum, item) => sum + (item.value * item.quantity), 0);

    return (
        <div className="station-menu-overlay">
            <div className="station-menu">
                <div className="station-header">
                    <h1>TRADE STATION</h1>
                    <div className="station-credits">
                        CREDITS: <span className="credits-value">{cargo.credits}</span>
                    </div>
                </div>

                <div className="station-content">
                    <div className="station-section">
                        <h2>MARKET</h2>
                        <div className="station-inventory">
                            {cargo.items.length === 0 ? (
                                <div className="empty-msg">No cargo to sell</div>
                            ) : (
                                cargo.items.map((item, i) => (
                                    <div key={i} className="station-item">
                                        <span className="item-name">{item.name} <span className="item-qty">x{item.quantity}</span></span>
                                        <span className="item-value">{item.value * item.quantity} CR</span>
                                    </div>
                                ))
                            )}
                        </div>
                        <button
                            className="station-btn sell-btn"
                            disabled={cargo.items.length === 0}
                            onClick={onSellAll}
                        >
                            SELL ALL (+{totalValue} CR)
                        </button>
                    </div>

                    <div className="station-section">
                        <h2>ENGINEERING</h2>

                        <div className="service-row">
                            <div className="service-info">
                                <span className="service-label">Hull Repair</span>
                                <div className="service-bar-container">
                                    <div
                                        className="service-bar-fill"
                                        style={{ width: `${(hull.currentHull / hull.maxHull) * 100}%`, backgroundColor: '#ff4444' }}
                                    ></div>
                                </div>
                            </div>
                            <button
                                className="station-btn service-btn"
                                disabled={repairCost <= 0 || cargo.credits < repairCost}
                                onClick={onRepair}
                            >
                                {repairCost > 0 ? `REPAIR (-${repairCost} CR)` : 'COMPLETE'}
                            </button>
                        </div>

                        <div className="service-row">
                            <div className="service-info">
                                <span className="service-label">Energy Recharge</span>
                                <div className="service-bar-container">
                                    <div
                                        className="service-bar-fill"
                                        style={{ width: `${(reactor.currentEnergy / reactor.energyCapacity) * 100}%`, backgroundColor: '#ffaa00' }}
                                    ></div>
                                </div>
                            </div>
                            <button
                                className="station-btn service-btn"
                                disabled={rechargeCost <= 0 || cargo.credits < rechargeCost}
                                onClick={onRecharge}
                            >
                                {rechargeCost > 0 ? `RECHARGE (-${rechargeCost} CR)` : 'COMPLETE'}
                            </button>
                        </div>

                        <div className="service-row">
                            <div className="service-info">
                                <span className="service-label">Missiles (Secondary Weapon)</span>
                                <div style={{ marginTop: '5px', fontSize: '12px', color: '#bdc3c7' }}>
                                    {currentMissiles} / {maxMissiles}
                                </div>
                                <div className="service-bar-container">
                                    <div
                                        className="service-bar-fill"
                                        style={{ width: `${(currentMissiles / maxMissiles) * 100}%`, backgroundColor: '#e74c3c' }}
                                    ></div>
                                </div>
                            </div>
                            <button
                                className="station-btn service-btn"
                                disabled={!canBuyMissiles || cargo.credits < missileCost}
                                onClick={onBuyMissiles}
                                style={{ backgroundColor: '#e74c3c', borderColor: '#c0392b' }}
                            >
                                BUY MISSILE
                                <span style={{ display: 'block', fontSize: '11px', marginTop: '3px' }}>
                                    (-{missileCost} CR)
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="station-footer">
                    <button className="station-btn close-btn" onClick={onClose}>LAUNCH (Esc)</button>
                </div>
            </div>
        </div>
    );
}

export default StationMenu;
