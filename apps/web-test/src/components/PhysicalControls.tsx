import type { ConnectionStatus } from 'chess-board-link';

interface PhysicalControlsProps {
  status: ConnectionStatus;
  transportType: 'bluetooth' | 'serial';
  hasKnownDevice: boolean;
  supportsLeds: boolean;
  canHighlight: boolean;
  onConnect: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  onHighlightLast: () => void;
  onClearLeds: () => void;
  onSyncFromPhysical: () => void;
  onShowPhysicalState: () => void;
}

/** Buttons to interact with the physical board, enabled per capability. */
export function PhysicalControls(p: PhysicalControlsProps) {
  const connected = p.status === 'connected';
  const label = p.transportType === 'serial' ? '(USB)' : '(Bluetooth)';
  return (
    <div className="physical-controls">
      <button type="button" onClick={p.onConnect} disabled={connected}>
        Connect {label}
      </button>
      <button
        type="button"
        onClick={p.onReconnect}
        disabled={connected || !p.hasKnownDevice}
        title={p.hasKnownDevice ? 'Reconnect to the last paired device' : 'No saved device'}
      >
        Reconnect
      </button>
      <button type="button" onClick={p.onDisconnect} disabled={!connected}>
        Disconnect
      </button>
      <button
        type="button"
        onClick={p.onHighlightLast}
        disabled={!connected || !p.supportsLeds || !p.canHighlight}
        title={p.supportsLeds ? 'Light the last move on the board' : 'This board has no LEDs'}
      >
        Highlight last move
      </button>
      <button
        type="button"
        onClick={p.onClearLeds}
        disabled={!connected || !p.supportsLeds}
      >
        Clear LEDs
      </button>
      <button type="button" onClick={p.onSyncFromPhysical} disabled={!connected}>
        Sync from board
      </button>
      <button type="button" onClick={p.onShowPhysicalState} disabled={!connected}>
        Show physical state
      </button>
      <span className={`status status-${p.status}`}>{p.status}</span>
    </div>
  );
}
