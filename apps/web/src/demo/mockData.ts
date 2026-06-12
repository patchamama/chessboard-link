import type { Book, Chapter } from '../features/library/api/libraryApi'
import type { ParsedWebpage } from '../features/webparser/api/webparserApi'

export const MOCK_BOOKS: Book[] = [
  {
    id: 1,
    title: 'My System',
    author: 'Nimzowitsch, Aaron',
    createdAt: '2024-01-10T10:00:00Z',
    description: '',
  },
  {
    id: 2,
    title: 'Chess Fundamentals',
    author: 'Capablanca, Jose Raul',
    createdAt: '2024-02-14T09:30:00Z',
    description: '',
  },
  {
    id: 3,
    title: 'Think Like a Grandmaster',
    author: 'Kotov, Alexander',
    createdAt: '2024-03-05T14:00:00Z',
    description: '',
  },
]

// Chapter with rich prose and real game notation — triggers recognizeGames
export const MOCK_CHAPTERS: Record<number, Chapter> = {
  1: {
    title: 'Chapter 1: The Blockade',
    toc: [
      { order: 0, title: 'The Blockade' },
      { order: 1, title: 'Overprotection' },
    ],
    html: `
<h2>The Blockade</h2>
<p>
Nimzowitsch's concept of the blockade is one of the most profound ideas in chess strategy.
A passed pawn is best blockaded by a knight, which sits immovably in front of it.
</p>
<p>
Consider this famous example. White plays energetically in the centre with
1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O d3
8. Qb3 Qf6 9. e5 Qg6 10. Re1 Nge7 11. Ba3 b5 12. Qxb5 Rb8 13. Qa4 Bb6
14. Nbd2 Bb7 15. Ne4 Qf5 16. Bxd3 Qh5 17. Nf6+ gxf6 18. exf6 Rg8 19. Rad1
Qxf3 20. Rxe7+ Nxe7 21. Qxd7+ Kxd7 22. Bf5+ Ke8 23. Bd7+ Kf8 24. Bxe7#.
</p>
<p>
This combination, known as the Immortal Game (Anderssen vs. Kieseritzky, 1851),
shows the power of initiative over material. White sacrificed both rooks and a queen.
</p>
<h3>Strategic Themes</h3>
<p>
The blockade idea was later extended by Nimzowitsch himself in many of his games.
In a simpler but instructive endgame, a king and pawn ending arises after
1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6 5. Nf3 Bf5 6. Bc4 e6 7. Bd2 c6
8. Nd5 Qd8 9. Nxf6+ Qxf6 10. Bg5 Qd6 11. O-O Nd7 and Black holds firm.
</p>`,
  },
  2: {
    title: 'Chapter 1: Elementary Endings',
    toc: [
      { order: 0, title: 'Elementary Endings' },
      { order: 1, title: 'Pawn Endgames' },
    ],
    html: `
<h2>Elementary Endings</h2>
<p>
Capablanca always insisted that the endgame must be studied first.
Before learning openings, a player must understand what they are trying to achieve.
</p>
<p>
The most famous endgame technique is the opposition. In this example, White wins with
1. e4 e5 2. Nf3 Nf6 3. Nxe5 d6 4. Nf3 Nxe4 5. d4 d5 6. Bd3 Nc6 7. O-O Be7
8. c4 Nb4 9. Be2 O-O 10. Nc3 Nxc3 11. bxc3 Nc6 12. Re1 Re8 13. cxd5 Qxd5
14. Bf4 Rac8 15. a4 Bf5 16. Bf1 Qd7 17. Rb1 Bd3 18. Rxb7 Bxf1 19. Kxf1 Qxb7
20. Bxc7 Red8 21. d5 Nd4 22. Nxd4 Rxd5 23. Re7 Qb1+ 24. Re1 Qb4 25. Nxf5 Rxf5
26. Re8+ Rxe8 27. Qxe8#.
</p>
<p>
Capablanca vs. Tartakower, New York 1924 — considered one of the finest endgame
conversions in chess history. The technique of advancing the passed pawn while keeping
the king active is timeless.
</p>`,
  },
  3: {
    title: 'Chapter 1: Candidate Moves',
    toc: [{ order: 0, title: 'Candidate Moves' }],
    html: `
<h2>The Method of Candidate Moves</h2>
<p>
Kotov's method of candidate moves revolutionised chess training.
When calculating, list ALL candidate moves before analysing any of them.
Never go back to a branch once you have moved on.
</p>
<p>
Study this combination carefully:
1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6
8. d5 Ne7 9. Nd2 a5 10. a3 Nd7 11. b4 axb4 12. axb4 Rxa1 13. Qxa1 f5
14. exf5 Nxf5 15. Nde4 Nf6 16. Nxf6+ Bxf6 17. Ne4 Bg7 18. c5 dxc5 19. bxc5
h6 20. Bb2 Kh7 21. Qc3 Nxd4 22. Bxd4 exd4 23. Qxd4 Bxe4 24. Bxe4+ f4
25. Bxg6+ Kxg6 26. Qxg7+ Kf5 27. Re1 and Black resigned.
</p>`,
  },
}

// Webparser mock — simulates parsing a famous chess blog post
export const MOCK_PARSED_WEBPAGE: ParsedWebpage = {
  html: `
<article>
  <h1>Kasparov vs. Karpov — The Match of the Century (1985)</h1>
  <p>
    Game 16 of the 1985 World Chess Championship match between Garry Kasparov and Anatoly Karpov
    is considered one of the greatest games ever played. Kasparov, playing Black in a Sicilian Defence,
    unleashed a spectacular queen sacrifice.
  </p>
  <img src="https://demo.chessreader.app/diagrams/kasparov_karpov_1985.png" alt="Position after 17...Nd4" />
  <p>
    The critical position arises after White's 17th move. Kasparov played
    1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 Nc6 5. Nb5 d6 6. c4 Nf6 7. N1c3 a6
    8. Na3 d5 9. cxd5 exd5 10. exd5 Nb4 11. Be2 Bc5 12. O-O O-O 13. Bf3 Bf5
    14. Bg5 Re8 15. Qd2 b5 16. Rad1 Nd3 17. Nab1 h6 18. Bh4 b4 19. Na4 Bd6
    20. Bg3 Rc8 21. b3 g5 22. Bxd6 Qxd6 23. g3 Nd7 24. Bg2 Qf4 25. Qe2 Nxf2
    26. Rxf2 Rxe2 27. Rxe2 Be4 28. Rxe4 Qxe4 and Black eventually won.
  </p>
  <p>
    For comparison, here is a simpler but elegant miniature:
    1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6
    7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O
    Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8#.
  </p>
  <img src="https://demo.chessreader.app/diagrams/morphy_opera.png" alt="The Opera Game final position" />
  <p>
    The Opera Game by Paul Morphy (1858) — played blindfolded during an opera performance — remains
    one of the most instructive examples of development and piece coordination ever recorded.
  </p>
</article>`,
  games: [],   // populated at runtime by the handler (games are extracted from html text)
  images: [
    {
      src: 'https://demo.chessreader.app/diagrams/kasparov_karpov_1985.png',
      alt: 'Position after 17...Nd4',
    },
    {
      src: 'https://demo.chessreader.app/diagrams/morphy_opera.png',
      alt: 'The Opera Game final position',
    },
  ],
}

export const MOCK_PENDING_USERS = [
  { id: 10, email: 'student1@example.com', status: 'pending' },
  { id: 11, email: 'coach@chessclub.org', status: 'pending' },
  { id: 12, email: 'reader@mail.com', status: 'pending' },
]
