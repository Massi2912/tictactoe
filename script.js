(() => {
  'use strict';

  const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

    const $ = (sel) => document.querySelector(sel);

  const el = {
    board: $('#board'),
    status: $('#status'),
    winline: $('#winline'),
    line: $('#winline line'),
    fieldDifficulty: $('#field-difficulty'),
    fieldSymbol: $('#field-symbol'),
    tileX: $('#tile-x'),
    tileO: $('#tile-o'),
    nameX: $('#name-x'),
    nameO: $('#name-o'),
    scoreX: $('#score-x'),
    scoreO: $('#score-o'),
    scoreDraw: $('#score-draw'),
    againLabel: $('#again-label'),
    btnAgain: $('#btn-again'),
    btnReset: $('#btn-reset')
  };

  const settings = { mode: 'bot', difficulty: 'medium', symbol: 'X' };

  const state = {
    mode: 'bot',
    difficulty: 'medium',
    human: 'X',
    bot: 'O',
    board: Array(9).fill(null),
    current: 'X',
    starter: 'X',
    over: false,
    locked: false,
    scores: { X: 0, O: 0, draw: 0 },
    timer: null
  };

  const other = (p) => (p === 'X' ? 'O' : 'X');
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* ---------- Spiellogik ---------- */

  function getWinner(b) {
    for (const line of LINES) {
      const [a, c, d] = line;
      if (b[a] && b[a] === b[c] && b[a] === b[d]) {
        return { player: b[a], line };
      }
    }
    return null;
  }

  const emptyCells = (b) => b.map((v, i) => (v ? null : i)).filter((i) => i !== null);

  /* ---------- Computergegner ---------- */

  function minimax(b, turn, bot, depth) {
    const win = getWinner(b);
    if (win) return win.player === bot ? 10 - depth : depth - 10;
    const empties = emptyCells(b);
    if (!empties.length) return 0;

    let best = turn === bot ? -Infinity : Infinity;
    for (const i of empties) {
      b[i] = turn;
      const score = minimax(b, other(turn), bot, depth + 1);
      b[i] = null;
      best = turn === bot ? Math.max(best, score) : Math.min(best, score);
    }
    return best;
  }

  function bestMoves(b, bot) {
    let bestScore = -Infinity;
    let moves = [];
    for (const i of emptyCells(b)) {
      b[i] = bot;
      const score = minimax(b, other(bot), bot, 1);
      b[i] = null;
      if (score > bestScore) {
        bestScore = score;
        moves = [i];
      } else if (score === bestScore) {
        moves.push(i);
      }
    }
    return moves;
  }

  function findWinningMove(b, player) {
    for (const i of emptyCells(b)) {
      b[i] = player;
      const win = getWinner(b);
      b[i] = null;
      if (win) return i;
    }
    return null;
  }

  // Mittel: gewinnt, wenn möglich, blockt sonst, spielt sonst zufällig
  function mediumMove(b, bot) {
    const win = findWinningMove(b, bot);
    if (win !== null) return win;
    const block = findWinningMove(b, other(bot));
    if (block !== null) return block;
    return rand(emptyCells(b));
  }

  function chooseMove() {
    const b = state.board.slice();
    const bot = state.bot;

    switch (state.difficulty) {
      case 'easy':
        return rand(emptyCells(b));
      case 'medium':
        return mediumMove(b, bot);
      case 'hard':
        // Spielt meistens perfekt, macht aber ab und zu einen Fehler
        return Math.random() < 0.2 ? mediumMove(b, bot) : rand(bestMoves(b, bot));
      default:
        return rand(bestMoves(b, bot));
    }
  }

  function scheduleBot() {
    if (state.mode !== 'bot' || state.over || state.current !== state.bot) return;
    state.locked = true;
    state.timer = setTimeout(() => {
      state.locked = false;
      place(chooseMove());
    }, 450 + Math.random() * 450);
  }

  /* ---------- Darstellung ---------- */

  function buildBoard() {
    el.board.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cell';
      btn.dataset.index = i;
      btn.setAttribute('aria-label', `Feld ${i + 1}, leer`);
      btn.addEventListener('click', () => onCellClick(i));
      el.board.appendChild(btn);
    }
  }

  function markSvg(player) {
    if (player === 'X') {
      return '<svg class="x" viewBox="0 0 100 100" aria-hidden="true">' +
        '<path d="M24 24 L76 76" pathLength="1"></path>' +
        '<path d="M76 24 L24 76" pathLength="1"></path></svg>';
    }
    return '<svg class="o" viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle cx="50" cy="50" r="28" pathLength="1"></circle></svg>';
  }

  function renderCell(i) {
    const cell = el.board.children[i];
    const value = state.board[i];
    const v = value || '';
    if (cell.dataset.v !== v) {
      cell.innerHTML = v ? markSvg(v) : '';
      cell.dataset.v = v;
    }
    cell.disabled = state.over || Boolean(value);
    cell.setAttribute('aria-label', `Feld ${i + 1}, ${value || 'leer'}`);
  }

  function renderScores() {
    el.scoreX.textContent = state.scores.X;
    el.scoreO.textContent = state.scores.O;
    el.scoreDraw.textContent = state.scores.draw;
  }

  function renderNames() {
    if (state.mode === 'bot') {
      el.nameX.textContent = state.human === 'X' ? 'Du' : 'Computer';
      el.nameO.textContent = state.human === 'O' ? 'Du' : 'Computer';
    } else {
      el.nameX.textContent = 'Spieler X';
      el.nameO.textContent = 'Spieler O';
    }
  }

  function setStatus(text, kind = '') {
    el.status.textContent = text;
    el.status.className = 'status' + (kind ? ` ${kind}` : '');
  }

  function turnText() {
    if (state.mode === 'pvp') return `${state.current} ist dran`;
    return state.current === state.human ? 'Du bist dran' : 'Computer denkt …';
  }

  function winText(player) {
    if (state.mode === 'pvp') return `${player} gewinnt!`;
    return player === state.human ? 'Gewonnen!' : 'Diesmal der Computer.';
  }

  function updateTurnUI() {
    setStatus(turnText());
    el.tileX.classList.toggle('active', state.current === 'X');
    el.tileO.classList.toggle('active', state.current === 'O');
    const humanTurn = state.mode === 'pvp' || state.current === state.human;
    el.board.dataset.turn = humanTurn ? state.current.toLowerCase() : '';
  }

  function clearTurnUI() {
    el.tileX.classList.remove('active');
    el.tileO.classList.remove('active');
    el.board.dataset.turn = '';
  }

  function showWinLine(line) {
    const center = (i) => ({ x: (i % 3) * 100 + 50, y: Math.floor(i / 3) * 100 + 50 });
    const a = center(line[0]);
    const b = center(line[2]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const ext = 28;
    const ux = dx / len;
    const uy = dy / len;

    el.line.setAttribute('x1', a.x - ux * ext);
    el.line.setAttribute('y1', a.y - uy * ext);
    el.line.setAttribute('x2', b.x + ux * ext);
    el.line.setAttribute('y2', b.y + uy * ext);

    el.winline.classList.remove('show');
    void el.winline.getBoundingClientRect(); // Animation neu starten
    el.winline.classList.add('show');
  }

  /* ---------- Spielablauf ---------- */

  function newRound() {
    clearTimeout(state.timer);
    state.board = Array(9).fill(null);
    state.over = false;
    state.locked = false;
    state.current = state.starter;

    el.winline.classList.remove('show');
    for (let i = 0; i < 9; i++) {
      renderCell(i);
      el.board.children[i].classList.remove('dim', 'win');
    }

    el.againLabel.textContent = 'Neue Runde';
    updateTurnUI();
    scheduleBot();
  }

  function onCellClick(i) {
    if (state.mode === 'bot' && state.current !== state.human) return;
    place(i);
  }

  function place(i) {
    if (state.over || state.locked || state.board[i]) return;

    state.board[i] = state.current;
    renderCell(i);

    const win = getWinner(state.board);
    if (win) {
      finish(win);
      return;
    }

    if (!emptyCells(state.board).length) {
      finish(null);
      return;
    }

    state.current = other(state.current);
    updateTurnUI();
    scheduleBot();
  }

  function finish(win) {
    state.over = true;
    state.locked = false;
    clearTimeout(state.timer);
    clearTurnUI();

    if (win) {
      state.scores[win.player]++;
      setStatus(winText(win.player), win.player.toLowerCase());
      showWinLine(win.line);
      for (let i = 0; i < 9; i++) {
        el.board.children[i].classList.toggle('dim', !win.line.includes(i));
        el.board.children[i].classList.toggle('win', win.line.includes(i));
      }
    } else {
      state.scores.draw++;
      setStatus('Unentschieden, knapp!', 'draw');
    }

    for (let i = 0; i < 9; i++) renderCell(i);
    renderScores();
    el.againLabel.textContent = 'Nächste Runde';
  }

  function startMatch() {
    state.mode = settings.mode;
    state.difficulty = settings.difficulty;
    state.human = settings.symbol;
    state.bot = other(settings.symbol);
    state.scores = { X: 0, O: 0, draw: 0 };
    state.starter = 'X';

    renderNames();
    renderScores();
    newRound();
  }

  /* ---------- Einstellungen ---------- */

  function updateMenuFields() {
    const isBot = settings.mode === 'bot';
    el.fieldDifficulty.hidden = !isBot;
    el.fieldSymbol.hidden = !isBot;
  }

  document.querySelectorAll('.opts').forEach((group) => {
    const key = group.dataset.group;
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      settings[key] = btn.dataset.value;
      group.querySelectorAll('button').forEach((b) => {
        b.setAttribute('aria-pressed', String(b === btn));
      });
      updateMenuFields();
      startMatch();
    });
  });

  el.btnReset.addEventListener('click', startMatch);
  el.btnAgain.addEventListener('click', () => {
    if (state.over) state.starter = other(state.starter);
    newRound();
  });

  buildBoard();
  updateMenuFields();
  startMatch();
})();