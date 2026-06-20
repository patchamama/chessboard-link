/**
 * chess-board-link — connect physical chess boards to a web app over Web
 * Bluetooth / Web Serial, with online-platform integration.
 */

// Core
export * from './core/types.js';
export { TypedEventEmitter } from './core/EventEmitter.js';
export {
  BaseBoardAdapter,
  type BoardAdapter,
  type ConnectOptions,
} from './core/BoardAdapter.js';
export { BoardRegistry, type BoardRegistration } from './core/BoardRegistry.js';
export {
  emptyBoard,
  startingBoard,
  fenToBoard,
  boardToFen,
  boardsEqual,
} from './core/boardState.js';
export { detectMove, type DetectMoveOptions } from './core/moveDetection.js';
export { highlightMove, clearLeds } from './core/ledHelpers.js';

// Utils
export { indexToSquare, squareToIndex } from './utils/squares.js';
export { toHex, fromHex } from './utils/hex.js';

// Transports
export {
  WebBluetoothTransport,
  type WebBluetoothTransportOptions,
} from './transports/WebBluetoothTransport.js';
export {
  WebSerialTransport,
  type WebSerialTransportOptions,
} from './transports/WebSerialTransport.js';

// Adapters
export { ChessnutAdapter } from './adapters/chessnut/ChessnutAdapter.js';
export * as ChessnutProtocol from './adapters/chessnut/protocol.js';
export { DgtAdapter } from './adapters/dgt/DgtAdapter.js';
export * as DgtProtocol from './adapters/dgt/protocol.js';
export { ChessUpAdapter } from './adapters/chessup/ChessUpAdapter.js';
export * as ChessUpProtocol from './adapters/chessup/protocol.js';
export { IChessOneAdapter } from './adapters/ichessone/IChessOneAdapter.js';
export * as IChessOneProtocol from './adapters/ichessone/protocol.js';
export { MockAdapter } from './adapters/mock/MockAdapter.js';

// Platforms
export {
  type PlatformAdapter,
  type PlatformMoveListener,
  NotImplementedError,
} from './platforms/PlatformAdapter.js';
export {
  LichessPlatform,
  type LichessPlatformOptions,
} from './platforms/LichessPlatform.js';
export { ChessComPlatform } from './platforms/ChessComPlatform.js';

// Convenience: a registry pre-populated with every shipped adapter.
import { BoardRegistry } from './core/BoardRegistry.js';
import { ChessnutAdapter } from './adapters/chessnut/ChessnutAdapter.js';
import { DgtAdapter } from './adapters/dgt/DgtAdapter.js';
import { ChessUpAdapter } from './adapters/chessup/ChessUpAdapter.js';
import { IChessOneAdapter } from './adapters/ichessone/IChessOneAdapter.js';
import { MockAdapter } from './adapters/mock/MockAdapter.js';

/** A registry with all bundled boards registered (chessup/mock flagged experimental). */
export function createDefaultRegistry(): BoardRegistry {
  return new BoardRegistry()
    .register({
      id: 'chessnut',
      name: 'Chessnut Air / Pro',
      transportType: 'bluetooth',
      create: () => new ChessnutAdapter(),
    })
    .register({
      id: 'dgt',
      name: 'DGT e-Board',
      transportType: 'serial',
      create: () => new DgtAdapter(),
    })
    .register({
      id: 'chessup',
      name: 'ChessUp',
      transportType: 'bluetooth',
      experimental: true,
      create: () => new ChessUpAdapter(),
    })
    .register({
      id: 'ichessone',
      name: 'iChessOne',
      transportType: 'bluetooth',
      experimental: true,
      create: () => new IChessOneAdapter(),
    })
    .register({
      id: 'mock',
      name: 'Mock board (no hardware)',
      transportType: 'bluetooth',
      experimental: true,
      create: () => new MockAdapter(),
    });
}
