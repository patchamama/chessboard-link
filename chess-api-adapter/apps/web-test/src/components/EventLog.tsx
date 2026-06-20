export interface LogEntry {
  ts: string;
  text: string;
}

export function EventLog({ log }: { log: LogEntry[] }) {
  return (
    <aside className="log">
      <h3>Event log</h3>
      <ul>
        {log.map((e, i) => (
          <li key={i}>
            <span className="ts">{e.ts}</span> {e.text}
          </li>
        ))}
      </ul>
    </aside>
  );
}
