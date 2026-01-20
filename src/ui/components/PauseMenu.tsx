/**
 * =============================================================================
 * PAUSE-MENU.TSX - Menu di pausa
 * =============================================================================
 */

import React from 'react';

interface PauseMenuProps {
    onResume: () => void;
    onSettings: () => void;
    onQuit: () => void;
}

export function PauseMenu({ onResume, onSettings, onQuit }: PauseMenuProps) {
    return (
        <div className="pause-menu-overlay">
            <div className="pause-menu">
                <h1>PAUSA</h1>
                
                <div className="pause-menu-buttons">
                    <button className="menu-button primary" onClick={onResume}>
                        Riprendi
                    </button>
                    <button className="menu-button" onClick={onSettings}>
                        Impostazioni
                    </button>
                    <button className="menu-button danger" onClick={onQuit}>
                        Esci
                    </button>
                </div>

                <div className="pause-menu-hint">
                    Premi ESC per tornare al gioco
                </div>
            </div>
        </div>
    );
}

export default PauseMenu;
