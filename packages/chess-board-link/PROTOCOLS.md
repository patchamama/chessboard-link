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
> **Note:** verified against ChessConnect **v5.9.1** (what shipping boards run),
> which is simpler than v6.0.3. There is **no** bit-7 framing or message-size
> bytes: the first byte is the opcode directly.

- **Messages are RAW bytes — no parity.** Confirmed live against a real board:
  both outgoing and inbound are `[opcode, …data]` with the opcode as the raw
  first byte (e.g. `163`). An earlier version XOR-parity-encoded the writes
  (`computeXParity`) and the board rejected them with `error 0x26/38`; sending
  raw bytes lit the squares and produced a clean move report. (The extension's
  `computeXParity` path applies to a different transport/board, not ChessUp BLE.)
- **Connect handshake** (`startGame`), in order — **verified byte-for-byte from
  real boards on both lichess and chess.com**:
  1. `RESET` `[100]` (0x64).
  2. `SEND_FEN` `[102, len, …payload]` (0x66). Captured exactly:
     `66 38 72 6e … 20 2d 20 00 00 01`. Here `len = 0x38 = 56 = payload length`.
     The payload is the first 4 FEN fields joined by spaces **plus a trailing
     space** (`"rnbqkbnr/… w KQkq - "`, 53 chars), then 3 bytes:
     halfmove, fullmove-hi, fullmove-lo (`00 00 01`).
  3. `GAME_SETTINGS` `[185, 2,0,1,1,0,1,1,0,0,1,0]` (0xB9) — app-vs-board settings.
  The board does **not** send explicit reply opcodes between steps; it pushes a
  position notification after the FEN. The extension paces the steps ~100–300ms
  apart. (An earlier 6.0.3-based guess sent different bytes and dropped the board
  into firmware-update mode, "update ready, plug in the charging cable".)
- **Reading moves:** the host **polls** by sending `21` (0x21); the board then
  reports the move. Logs show `sending to ChessUpBoard: 21` →
  `received move from board: (e2)->(e4)`.
- **Move (inbound, opcode `163`):** `[163, 53, fromCol, fromRow, toCol, toRow]`
  — `from = W(e[3], e[2])`, `to = W(e[5], e[4])`, `W(row, col)` (row 0..7 = rank
  1..8, col 0..7 = a..h). Castling king→rook, normalised to UCI king-target.
  Host ACKs with `[33]` (raw). **Verified live:** the board reported e2e4 as
  `a3 35 04 01 04 03` (= 163, 53, col4 row1 = e2, col4 row3 = e4).
- **Send move to board (light the opponent's move), opcode `153`:**
  `[153, fromIndex, toIndex]`, index = `row*8 + col` (`fieldToIndex`). Verified:
  `99 34 24` for e7e5 (e7 = 6*8+4 = 52 = 0x34, e5 = 4*8+4 = 36 = 0x24).
- Other inbound opcodes: `151` promotion, `184` piece-touched, `38` error,
  `0x6c`/108 spontaneous status frames.
- **LEDs** (non-RGB ChessUp 1, `encodeLedStateSimple`): an 8-byte bitmap where
  byte `7-rank` has bit `1<<file` set per lit square (rank/file 0..7, white = 0),
  sent raw. ChessUp 2 (`encodeLedState9x9rgb`) sends a 247-byte RGB frame
  `[255,85] + 243×RGB + [13,10]` — not ported.
- Source (v5.9.1 beautified): `startGame()` →
  `sendDataToBoard(Uint8Array.from([100]))`,
  `sendDataToBoard(new Uint8Array([102, i.length, ...i]))` (FEN, wait `e[0]===177`),
  `sendGameSettings()` = `[185, 2,0,1,1,0,1,1,0, …]` (wait `e[0]===36`);
  `onMoveFromBoard` reads `W(e[3],e[2])`/`W(e[5],e[4])`;
  `sendMoveToBoard` = `[153, fieldToIndex(from), fieldToIndex(to)]`;
  `fieldToIndex(e){return e.row*8+e.col}`.

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
