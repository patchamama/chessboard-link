export type LogKind =
  | 'you'
  | 'bot'
  | 'received' // move/data from the physical board
  | 'sent' // bytes sent to the physical board
  | 'status'
  | 'error'
  | 'info';

export interface LogEntry {
  ts: string;
  text: string;
  kind: LogKind;
}

export function EventLog({ log }: { log: LogEntry[] }) {
  return (
    <aside className="log">
      <h3>Event log</h3>
      <ul>
        {log.map((e, i) => (
          <li key={i} className={`log-${e.kind}`}>
            <span className="ts">{e.ts}</span>
            <span className="log-tag">{e.kind}</span>
            {e.text}
          </li>
        ))}
      </ul>
    </aside>
  );
}
