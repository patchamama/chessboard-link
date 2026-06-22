// CDP driver: attach to the user's Chrome (--remote-debugging-port=9222),
// find the BLE bridge tab, and run a command against window.cblBridge.
//
// Usage:
//   node cdp.mjs state                 -> connection state
//   node cdp.mjs log                   -> dump the TX/RX log
//   node cdp.mjs clear                 -> clear the log
//   node cdp.mjs send "64"             -> send hex bytes
//   node cdp.mjs handshake             -> run the FEN+settings handshake
//   node cdp.mjs parity <tx> <rx>      -> set parity toggles (0/1)
//   node cdp.mjs eval "<js returning value>"
import { chromium } from 'playwright-core';

const CDP = 'http://localhost:9222';
const [, , cmd, ...args] = process.argv;

const browser = await chromium.connectOverCDP(CDP);
try {
  const contexts = browser.contexts();
  let page = null;
  for (const ctx of contexts) {
    for (const p of ctx.pages()) {
      if (p.url().includes(':8777') || (await p.title()).includes('BLE Bridge')) {
        page = p;
        break;
      }
    }
    if (page) break;
  }
  if (!page) {
    console.error('bridge tab not found (open http://localhost:8777 in that Chrome)');
    process.exit(2);
  }

  const run = (fn, arg) => page.evaluate(fn, arg);
  let out;
  switch (cmd) {
    case 'state':
      out = await run(() => window.cblBridge?.connectState() ?? 'no bridge');
      break;
    case 'log':
      out = await run(() => (window.cblBridge?.getLog() ?? []).map((e) => `${e.ts} ${e.kind.toUpperCase()} ${e.text}`).join('\n'));
      break;
    case 'clear':
      out = await run(() => { window.cblBridge?.clear(); return 'cleared'; });
      break;
    case 'send':
      out = await run((h) => { window.cblBridge?.send(h); return 'sent ' + h; }, args[0] ?? '');
      break;
    case 'handshake':
      out = await run(async () => { await window.cblBridge?.handshake(); return 'handshake done'; });
      break;
    case 'parity':
      out = await run((a) => { window.cblBridge?.setParity(a[0] === '1', a[1] === '1'); return 'parity tx=' + a[0] + ' rx=' + a[1]; }, args);
      break;
    case 'eval':
      out = await run((js) => eval(js), args[0] ?? 'null');
      break;
    default:
      out = 'unknown cmd; see header of cdp.mjs';
  }
  console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 2));
} finally {
  await browser.close(); // detaches from CDP; does NOT close the user's Chrome
}
