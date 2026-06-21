# Board protocols (reverse-engineered)

Constants below were extracted from the official **ChessConnect** Chrome
extension (`background.js`, v6.0.3) and corroborated with open-source projects.
Boards marked ✅ are implemented in this library; ⏳ are documented but not yet
ported (their byte-level decode still needs verification against real hardware
or further extraction).

## Board enum (from the extension)

```
CHESSNUT=1, MILLENNIUM=2, TABUTRONIC=3, STAUNTON=4, DGT=5, DGT_PEGASUS=6,
ICHESSONE=7, YIZHI=8, CHESSUP=9, DGT_REVELATION_II=10, TABUTRONIC_SPECTRUM=11,
SENSEROBOT=12, PHANTOM=13, GOCHESS=14, MANYACYNUS=15
```

## ✅ ChessUp (Nordic UART, BLE)

- Service `6e400001-b5a3-f393-e0a9-e50e24dcca9e`, write `6e400002-…`, notify `6e400003-…`, plus battery service.
- Device filter: `namePrefix: "ChessUp"`.
- **Message framing** (corrected against a real board's traffic; the earlier
  "`[163,…]` move frame" idea was wrong):
  - *Outgoing* (`St`/`encodeMessage`): `[command]` for a bare command, or
    `[command, size, …data, 0]` with `size = data.length + 1` and a `0`
    terminator. Then parity-encoded (see below). Commands seen: `64` reset,
    `66` request board dump, `96` config, `99` send-move-to-board (light it).
  - *Incoming* (`processDataFromBoard`): a byte with **bit 7 set** starts a
    message (low 7 bits = command); the next one/two 7-bit bytes are the size;
    remaining bytes are data. Incoming bytes are **not** parity-encoded.
- **Position = occupancy via command `134`** (`parsePosition`): the data holds
  **five numbers per square** (an RFID tag); a square is occupied when any of the
  five is non-zero. Square index `8*(7-s)+a`. Identifying the actual piece needs
  the board's *learned* RFID→piece table (per piece set), so without it you get
  occupancy only — enough to infer moves from the start position with chess.js.
  Command `142` = board asks the host for a dump; `160` battery; `141` clock.
- **Parity:** every byte sent over BLE is parity-encoded by `computeXParity` /
  `addParityBit`: `e |= 0x80; for i in 0..6 if (e & (1<<i)) e ^= 0x80`. Source:
  `this.connectionType===BLUETOOTH&&(e=Ut.computeXParity(e))` before each write.
- **LEDs** (non-RGB ChessUp 1, `encodeLedStateSimple`): an 8-byte bitmap where
  byte `7-rank` has bit `1<<file` set per lit square (rank/file 0..7, white = 0).
  Sent via `sendLedStateToBoard` → `sendDataToBoard` (so it is parity-encoded
  like everything else). ChessUp 2 (`encodeLedState9x9rgb`) sends a 247-byte RGB
  frame `[255,85] + 243×RGB + [13,10]` — not ported.
- Source: `const cs="ChessUp",ls="6e400001-…",ds="6e400002-…",hs="6e400003-…"`,
  `encodeMessage(e){…[e.command, size, …data, 0]…}`, the incoming parser
  `processDataFromBoard(e){for(const t of e){if(128&t)…}}`, the command switch
  `case 134: parsePosition(e)` / `case 142: sendMessageToBoard(new St(66))`,
  `parsePosition` (5 numbers per square, index `8*(7-s)+a`), and
  `encodeLedState(e){…t[7-s]|=1<<i…}`.

## ✅ Chessnut Air / Pro (BLE)

- Service `1b7e8262-…`, notify(board) `1b7e8273-…`, write `1b7e8272-…`, confirm
  `1b7e8271-…`, notify-service `1b7e8261-…`.
- Device filter: `namePrefix: "Chessnut"`.
- Enable real-time: write `0x21 0x01 0x00`. LED: `Uint8Array([65,1,12])` /
  `([65,1,11])`. Battery query: `([41,1,0])`.
- Board state: notification bytes `[2,34)` = 32 bytes → 64 nibbles. For byte `i`:
  `r = 7 - floor(i/4)`, `c = 7 - (i%4)*2`; low nibble → field `(r, c)`, high
  nibble → `(r, c-1)`; internal field index `8*r + c`.
- Piece LUT (nibble → piece): `["_","q","k","b","p","n","R","P","r","B","N","Q","K"]`.
- Source: `for(let i=0;i<32;i++){const n=e[t+i],a=15&n,o=n>>>4,r=7-Math.floor(i/4),c=7-i%4*2;dt.setField(s,r,c,a),dt.setField(s,r,c-1,o)}` and `setField(e,t,s,i){this.board[8*t+s]=…}`.

## ✅ DGT e-Board (USB serial)

- Serial `9600,N,8,1`. USB vendor id `11648` (0x2D80).
- Commands: `SEND_RESET 0x40`, `SEND_BRD 0x42`, `SEND_UPDATE 0x43`,
  `SEND_UPDATE_BRD 0x44`, `SEND_UPDATE_NICE 0x4b`.
- Messages: `BOARD_DUMP 0x06`, `FIELD_UPDATE 0x0e`; 3-byte header
  `[id|0x80, lenMSB(7b), lenLSB(7b)]`, length is total incl. header.
- Piece codes 0–12, squares a8..h1. (From DGT's published header.)
- DGT Pegasus is the BLE variant (`CPIRQ` / `RB` string commands).

## ✅ iChessOne (BLE)

- Nordic UART (`6e400001-…` / `6e400002-…` / `6e400003-…`), device name `"iChessOne"`.
- **ASCII protocol**: a position dump is a frame whose first char is `'s'` (total
  length 67) followed by 64 board chars. For rank `s` (0..7) and file `i` (0..7)
  the char is at index `7 - i + 1 + 8*s`; FEN-style letters (uppercase = white,
  lowercase = black, `.` = empty). Command-length map by first char:
  `s→67, l→3, x→3, v→7, w→7, r→7, i→100`.
- Source: `boardFromPositionData(e){…7-i+1+8*s…}` and the `lengthOfCommand`
  switch `case"s":return 67;…`.

## ⏳ GoChess (BLE)

- Nordic UART (`6e400001-…` etc). Init writes `Uint8Array([53])`; LED writes a
  13-byte frame starting `50,…` with `16*(row+1)+(col+1)` per lit square. Max
  message size 512, min 25 ms between sends.
- Position frame opcode `3`: payload is `e.slice(1)`, then **array-reversed and
  each byte bit-reversed** via `Vs = e => (170&(e=(204&(e=(240&e)>>4|(15&e)<<4))>>2|(51&e)<<2))>>1|(85&e)<<1`,
  then read as a packed bitstream (`be` reader) by `getBoardFromBinaryPosition`.
  Battery frame: `e[0]==42 && e[2]==57`. Not yet ported — the packed-bitstream
  square mapping still needs verifying against hardware.

## ⏳ Millennium (USB serial + BLE)

- Serial `9600,N,8,1`. BLE `namePrefix: "MILLENNIUM CHESS"`. USB vendor id `2341`.
- ASCII command protocol; decode not yet ported.

## ⏳ Certabo / Tabutronic / Sentio, Staunton, Yizhi, SenseRobot, Phantom, ManyaCynus

- Mix of BLE and USB serial (`9600,N,8,1`). Notable filters: SenseRobot
  `namePrefix: "sense-robot"`, ManyaCynus `namePrefix: "CYNUS"`, Certabo app
  name `"HOSBoard"`.
- Listed for completeness; not yet ported.

## chess.com move injection

chess.com has no move API. The extension plays moves by simulating pointer
events on the board element, computing each square center from
`getBoundingClientRect()` with small random jitter and orientation handling:

```
centerOfField(el, field, flipped){
  const r=el.getBoundingClientRect(), s=r.width/8, o=r.height/8;
  const a=s*(Math.random()-.5)*.9, b=o*(Math.random()-.5)*.9;
  return flipped
    ? {x:r.left+s*field.col+s/2+a,           y:r.top+r.height-o*field.row-o/2+b}
    : {x:r.left+r.width-s*field.col-s/2+a,    y:r.top+o*field.row+o/2+b};
}
```

Click = `pointerdown` → wait 100ms → `pointerup` → `click`. Ported in
`ChessComPlatform` (see its doc comment and the ToS warning).
