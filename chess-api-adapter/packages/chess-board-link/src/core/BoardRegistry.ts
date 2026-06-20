import type { BoardAdapter } from './BoardAdapter.js';
import type { TransportType } from './types.js';

/** Metadata describing a registered board type and how to instantiate it. */
export interface BoardRegistration {
  id: string;
  name: string;
  transportType: TransportType;
  /** Whether the protocol is fully implemented vs. an experimental stub. */
  experimental?: boolean;
  /** Factory creating a fresh adapter instance. */
  create: () => BoardAdapter;
}

/**
 * Registry of available board types. The web app queries it to build its
 * "choose a board" UI and to create the adapter the user picks.
 */
export class BoardRegistry {
  private readonly entries = new Map<string, BoardRegistration>();

  register(reg: BoardRegistration): this {
    if (this.entries.has(reg.id)) {
      throw new Error(`board "${reg.id}" already registered`);
    }
    this.entries.set(reg.id, reg);
    return this;
  }

  list(): BoardRegistration[] {
    return [...this.entries.values()];
  }

  get(id: string): BoardRegistration | undefined {
    return this.entries.get(id);
  }

  create(id: string): BoardAdapter {
    const reg = this.entries.get(id);
    if (!reg) throw new Error(`unknown board "${id}"`);
    return reg.create();
  }
}
