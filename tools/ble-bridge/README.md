# BLE Bridge — live ChessUp debugging

A tiny standalone page that connects to the ChessUp board over Web Bluetooth and
lets us watch every byte sent/received and send arbitrary commands. It exposes
`window.cblBridge` so Claude can drive it over CDP while **you** do the one
required user gesture (the Connect click).

## Why this exists

Web Bluetooth needs a real user gesture to open the device picker, so it can't
run in headless Playwright. Instead: you run Chrome with remote debugging, open
this page, click **Connect** and pick the board. Claude then attaches to that
same Chrome over CDP to read the live log and send test commands — no more
copy-pasting console logs back and forth.

## How to run

1. **Quit Chrome completely**, then launch it with remote debugging:

   ```bash
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
     --remote-debugging-port=9222 \
     --user-data-dir=/tmp/cbl-chrome
   ```

   (A separate `--user-data-dir` keeps it isolated from your normal profile.)

2. **Serve the page** (Web Bluetooth needs https or localhost). From this folder:

   ```bash
   npx --yes serve -l 8777 .
   # then open http://localhost:8777 in that Chrome
   ```

3. In the page, click **Connect (Bluetooth)** and pick your ChessUp. Once the
   status shows **connected**, tell Claude — it will attach over CDP
   (`http://localhost:9222`) and start driving:
   - read the live TX/RX log (`window.cblBridge.getLog()`),
   - send bytes (`window.cblBridge.send('64')`, `.handshake()`, etc.),
   - toggle parity on TX/RX to find the right framing.

## Manual use (without Claude)

- **Send hex**: type bytes like `64`, `21`, or a full message and press Enter.
- **Presets**: reset(64), poll(21), and the FEN+settings handshake button.
- **parity TX / de-parity RX** checkboxes: toggle to compare what the board
  accepts (this is exactly the open question — whether ChessUp BLE expects the
  `computeXParity` encoding or raw bytes).

The log shows both hex and an ASCII view (after `& 0x7f`) for each frame.
