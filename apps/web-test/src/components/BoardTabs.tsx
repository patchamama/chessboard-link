import type { BoardRegistration } from 'chess-board-link';
import type { BoardSession } from '../boards/boardStorage.js';

interface BoardTabsProps {
  boards: BoardRegistration[];
  sessions: Record<string, BoardSession>;
  activeId: string;
  onSelect: (boardId: string) => void;
  onAdd: (boardId: string) => void;
  onRemove: (boardId: string) => void;
}

/** Tabs for each connected/added board; switching loads that board's session. */
export function BoardTabs({ boards, sessions, activeId, onSelect, onAdd, onRemove }: BoardTabsProps) {
  const open = Object.keys(sessions);
  return (
    <div className="board-tabs">
      {open.map((id) => {
        const reg = boards.find((b) => b.id === id);
        return (
          <div key={id} className={`tab ${id === activeId ? 'active' : ''}`}>
            <button type="button" className="tab-name" onClick={() => onSelect(id)}>
              {reg?.name ?? id}
            </button>
            <button type="button" className="tab-close" title="Remove" onClick={() => onRemove(id)}>
              ×
            </button>
          </div>
        );
      })}
      <select
        className="tab-add"
        value=""
        onChange={(e) => e.target.value && onAdd(e.target.value)}
        aria-label="Add board"
      >
        <option value="">+ add board…</option>
        {boards.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} ({b.transportType}){b.experimental ? ' · experimental' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
