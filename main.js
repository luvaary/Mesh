/**
 * MESH - Speedcubing Timer
 * A modern, minimal, feature-rich timer for speedcubing practice
 */

// ============================================
// State Management
// ============================================

const State = {
  sessions: [],
  currentSessionId: null,
  timerState: 'idle', // idle, ready, running, inspection
  timerValue: 0,
  startTime: 0,
  intervalId: null,
  spacePressed: false,
  inspectionTime: 15,
  inspectionIntervalId: null,
  currentScramble: '',
  settings: {
    meshBar: true,
    stackmat: false,
    hideWhileRunning: false,
    voiceAlerts: false,
    showHistory: true,
    confirmDelete: true,
    theme: 'dark',
    typingMode: false
  },
  currentSolve: null,
  meshSplits: [0.2, 0.65],
  editingSolveId: null,
  editingSessionId: null,
  confirmCallback: null
};

// Goal benchmarks for different targets
const GOALS = {
  sub60: { cross: 8.0, f2l: 35.0, ll: 17.0, rotations: 6 },
  sub30: { cross: 3.5, f2l: 18.0, ll: 8.5, rotations: 4 },
  sub20: { cross: 1.8, f2l: 13.0, ll: 5.2, rotations: 3 },
  sub15: { cross: 1.5, f2l: 9.5, ll: 4.0, rotations: 2 },
  sub10: { cross: 1.2, f2l: 6.5, ll: 2.3, rotations: 1.5 },
  sub8: { cross: 1.0, f2l: 5.0, ll: 2.0, rotations: 1.2 },
  sub5: { cross: 0.8, f2l: 3.0, ll: 1.2, rotations: 1 },
  sub3: { cross: 0.5, f2l: 1.8, ll: 0.7, rotations: 0.5 }
};

// ============================================
// Initialization
// ============================================

function init() {
  loadState();

  if (State.sessions.length === 0) {
    createSession('normal');
  }

  if (!State.currentSessionId) {
    State.currentSessionId = State.sessions[0].id;
  }

  applyTheme(State.settings.theme);
  generateScramble();
  updateUI();
  attachEventListeners();
  updateTypingModeUI();
}

// ============================================
// State Persistence
// ============================================

function loadState() {
  try {
    const saved = localStorage.getItem('meshData');
    if (saved) {
      const data = JSON.parse(saved);
      State.sessions = data.sessions || [];
      State.currentSessionId = data.currentSessionId;
      State.settings = { ...State.settings, ...data.settings };
      State.meshSplits = data.meshSplits || State.meshSplits;
    }
  } catch (e) {
    console.error('Failed to load state:', e);
  }
}

function saveState() {
  try {
    localStorage.setItem('meshData', JSON.stringify({
      sessions: State.sessions,
      currentSessionId: State.currentSessionId,
      settings: State.settings,
      meshSplits: State.meshSplits
    }));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

// ============================================
// Session Management
// ============================================

function createSession(type = 'normal') {
  const typeLabels = {
    'normal': 'Normal',
    'cross': 'Cross',
    'f2l': 'F2L',
    'll': 'LL',
    'one-handed': 'OH',
    'blind': 'BLD'
  };

  const session = {
    id: Date.now().toString(),
    type,
    name: `${typeLabels[type] || type} ${State.sessions.length + 1}`,
    solves: [],
    createdAt: Date.now()
  };

  State.sessions.push(session);
  State.currentSessionId = session.id;
  saveState();
  updateUI();
  showToast('Session created');
}

function getCurrentSession() {
  return State.sessions.find(s => s.id === State.currentSessionId);
}

function deleteSession(sessionId) {
  const index = State.sessions.findIndex(s => s.id === sessionId);
  if (index === -1) return;

  State.sessions.splice(index, 1);

  if (State.sessions.length === 0) {
    createSession('normal');
  } else if (State.currentSessionId === sessionId) {
    State.currentSessionId = State.sessions[0].id;
  }

  saveState();
  updateUI();
  showToast('Session deleted');
}

function renameSession(sessionId, newName) {
  const session = State.sessions.find(s => s.id === sessionId);
  if (session) {
    session.name = newName;
    saveState();
    updateUI();
  }
}

// ============================================
// Scramble Generation
// ============================================

function generateScramble() {
  const moves = ['R', 'L', 'U', 'D', 'F', 'B'];
  const modifiers = ['', "'", '2'];
  const scramble = [];
  let lastMove = '';
  let lastAxis = '';

  for (let i = 0; i < 20; i++) {
    let move;
    do {
      move = moves[Math.floor(Math.random() * moves.length)];
    } while (move === lastMove || getAxis(move) === lastAxis);

    const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
    scramble.push(move + modifier);
    lastMove = move;
    lastAxis = getAxis(move);
  }

  State.currentScramble = scramble.join(' ');
  document.getElementById('scrambleText').textContent = State.currentScramble;
}

function getAxis(move) {
  if (move === 'R' || move === 'L') return 'RL';
  if (move === 'U' || move === 'D') return 'UD';
  if (move === 'F' || move === 'B') return 'FB';
  return '';
}

// ============================================
// Event Listeners
// ============================================

function attachEventListeners() {
  // Keyboard events
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);

  // Touch events for mobile
  const mainArea = document.getElementById('mainArea');
  let touchStartTime = 0;

  mainArea.addEventListener('touchstart', (e) => {
    if (State.settings.typingMode) return;
    if (e.target.closest('input, button, .typing-input-container')) return;

    e.preventDefault();
    touchStartTime = Date.now();

    if (State.timerState === 'idle') {
      if (document.getElementById('inspectionToggle').checked) {
        startInspection();
      } else {
        document.getElementById('timerDisplay').classList.add('ready');
        State.spacePressed = true;
      }
    }
  }, { passive: false });

  mainArea.addEventListener('touchend', (e) => {
    if (State.settings.typingMode) return;
    if (e.target.closest('input, button, .typing-input-container')) return;

    e.preventDefault();

    if (State.timerState === 'idle' && State.spacePressed) {
      State.spacePressed = false;
      startTimer();
    } else if (State.timerState === 'running') {
      stopTimer();
    } else if (State.timerState === 'inspection') {
      stopInspection();
      startTimer();
    }
  }, { passive: false });

  // Header controls
  document.getElementById('copyScramble').addEventListener('click', () => {
    navigator.clipboard.writeText(State.currentScramble);
    showToast('Scramble copied!');
  });

  document.getElementById('newScramble').addEventListener('click', () => {
    generateScramble();
    showToast('New scramble generated');
  });

  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('helpBtn').addEventListener('click', () => {
    document.getElementById('helpModal').classList.remove('hidden');
  });

  // Typing mode toggle
  document.getElementById('typingModeToggle').addEventListener('change', (e) => {
    State.settings.typingMode = e.target.checked;
    saveState();
    updateTypingModeUI();
  });

  // Typing mode input
  document.getElementById('typingInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      addTypedTime();
    }
  });

  document.getElementById('addTypedTime').addEventListener('click', addTypedTime);

  // Sidebar controls
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  document.getElementById('toggleSidebar').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  });

  // Session controls
  document.getElementById('newSession').addEventListener('click', () => {
    const type = document.getElementById('sessionType').value;
    createSession(type);
  });

  // Data management
  document.getElementById('exportData').addEventListener('click', exportData);
  document.getElementById('importData').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', importData);

  // Settings modal
  document.getElementById('showSettings').addEventListener('click', showSettings);
  document.getElementById('closeSettings').addEventListener('click', saveSettings);

  // Goals modal
  document.getElementById('showGoals').addEventListener('click', showGoals);
  document.getElementById('closeGoals').addEventListener('click', () => {
    document.getElementById('goalsModal').classList.add('hidden');
  });
  document.getElementById('goalSelect').addEventListener('change', updateGoalTable);

  // Analytics modal
  document.getElementById('showAnalytics').addEventListener('click', showAnalytics);
  document.getElementById('closeAnalytics').addEventListener('click', () => {
    document.getElementById('analyticsModal').classList.add('hidden');
  });

  // Help modal
  document.getElementById('closeHelp').addEventListener('click', () => {
    document.getElementById('helpModal').classList.add('hidden');
  });

  // Mesh metrics modal
  document.getElementById('saveMeshMetrics').addEventListener('click', saveMeshMetrics);
  document.getElementById('skipMeshMetrics').addEventListener('click', skipMeshMetrics);

  // Mesh bar dividers
  const dividers = document.querySelectorAll('.mesh-divider');
  dividers.forEach(div => {
    div.addEventListener('mousedown', startDrag);
    div.addEventListener('touchstart', startDragTouch, { passive: false });
  });

  // Solve edit modal
  document.getElementById('editPenaltyNone').addEventListener('click', () => setPenalty(null));
  document.getElementById('editPenaltyPlus2').addEventListener('click', () => setPenalty('+2'));
  document.getElementById('editPenaltyDNF').addEventListener('click', () => setPenalty('DNF'));
  document.getElementById('deleteSolve').addEventListener('click', deleteCurrentSolve);
  document.getElementById('closeEditSolve').addEventListener('click', () => {
    document.getElementById('solveEditModal').classList.add('hidden');
    State.editingSolveId = null;
    updateUI();
  });

  // Session edit modal
  document.getElementById('deleteSession').addEventListener('click', deleteCurrentSession);
  document.getElementById('saveSessionEdit').addEventListener('click', saveSessionEdit);

  // Confirm modal
  document.getElementById('confirmCancel').addEventListener('click', () => {
    document.getElementById('confirmModal').classList.add('hidden');
    State.confirmCallback = null;
  });
  document.getElementById('confirmOk').addEventListener('click', () => {
    if (State.confirmCallback) {
      State.confirmCallback();
      State.confirmCallback = null;
    }
    document.getElementById('confirmModal').classList.add('hidden');
  });

  // History clear button
  document.getElementById('clearHistory').addEventListener('click', () => {
    showConfirm('Clear All Solves', 'Are you sure you want to delete all solves in this session? This cannot be undone.', () => {
      const session = getCurrentSession();
      if (session) {
        session.solves = [];
        saveState();
        updateUI();
        showToast('All solves cleared');
      }
    });
  });

  // Click outside modals to close
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  });
}

// ============================================
// Keyboard Handling
// ============================================

function handleKeyDown(e) {
  // Ignore if typing in input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }

  // Escape key handling
  if (e.code === 'Escape') {
    if (State.timerState === 'running') {
      cancelSolve();
    } else {
      closeAllModals();
    }
    return;
  }

  // Spacebar for timer (only in non-typing mode)
  if (e.code === 'Space' && !State.settings.typingMode) {
    e.preventDefault();

    if (!State.spacePressed && State.timerState === 'idle') {
      State.spacePressed = true;

      if (document.getElementById('inspectionToggle').checked) {
        startInspection();
      } else {
        document.getElementById('timerDisplay').classList.add('ready');
      }
    }
    return;
  }

  // Keyboard shortcuts
  if (State.timerState === 'idle') {
    switch (e.key) {
      case '1':
        applyPenaltyToLastSolve('+2');
        break;
      case '2':
        applyPenaltyToLastSolve('DNF');
        break;
      case '3':
        applyPenaltyToLastSolve(null);
        break;
      case 'Delete':
      case 'Backspace':
        if (!e.target.closest('input')) {
          deleteLastSolve();
        }
        break;
      case 's':
      case 'S':
        document.getElementById('sidebar').classList.toggle('open');
        break;
      case 'i':
      case 'I':
        const inspectionToggle = document.getElementById('inspectionToggle');
        inspectionToggle.checked = !inspectionToggle.checked;
        showToast(`Inspection ${inspectionToggle.checked ? 'enabled' : 'disabled'}`);
        break;
      case 't':
      case 'T':
        const typingToggle = document.getElementById('typingModeToggle');
        typingToggle.checked = !typingToggle.checked;
        State.settings.typingMode = typingToggle.checked;
        saveState();
        updateTypingModeUI();
        showToast(`Typing mode ${typingToggle.checked ? 'enabled' : 'disabled'}`);
        break;
      case 'n':
      case 'N':
        generateScramble();
        showToast('New scramble');
        break;
      case '?':
        document.getElementById('helpModal').classList.remove('hidden');
        break;
    }
  }
}

function handleKeyUp(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }

  if (e.code === 'Space' && !State.settings.typingMode) {
    e.preventDefault();

    if (State.spacePressed) {
      State.spacePressed = false;

      if (State.timerState === 'idle') {
        startTimer();
      } else if (State.timerState === 'running') {
        stopTimer();
      } else if (State.timerState === 'inspection') {
        stopInspection();
        startTimer();
      }
    }
  }
}

// ============================================
// Timer Functions
// ============================================

function startInspection() {
  State.timerState = 'inspection';
  State.inspectionTime = 15;
  updateTimerDisplay();

  document.getElementById('timerDisplay').classList.add('inspection');

  if (State.settings.voiceAlerts && 'speechSynthesis' in window) {
    speak('15');
  }

  State.inspectionIntervalId = setInterval(() => {
    State.inspectionTime--;
    updateTimerDisplay();

    if (State.settings.voiceAlerts && 'speechSynthesis' in window) {
      if (State.inspectionTime === 8) speak('8');
      if (State.inspectionTime === 3) speak('3');
    }

    if (State.inspectionTime <= 0) {
      stopInspection();
      startTimer();
    }
  }, 1000);
}

function stopInspection() {
  if (State.inspectionIntervalId) {
    clearInterval(State.inspectionIntervalId);
    State.inspectionIntervalId = null;
  }
  document.getElementById('timerDisplay').classList.remove('inspection');
  State.timerState = 'idle';
}

function speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.2;
  speechSynthesis.speak(utterance);
}

function startTimer() {
  const display = document.getElementById('timerDisplay');
  display.classList.remove('ready', 'inspection');
  display.classList.add('running');
  document.getElementById('meshBar').classList.add('hidden');
  document.getElementById('timerHint').style.opacity = '0';

  State.timerState = 'running';
  State.startTime = performance.now();
  State.timerValue = 0;

  State.intervalId = setInterval(() => {
    State.timerValue = performance.now() - State.startTime;
    updateTimerDisplay();
  }, 10);
}

function stopTimer() {
  clearInterval(State.intervalId);
  State.intervalId = null;
  State.timerState = 'idle';

  const time = State.timerValue;
  const display = document.getElementById('timerDisplay');
  display.classList.remove('running');
  document.getElementById('timerHint').style.opacity = '1';

  const solve = {
    id: Date.now().toString(),
    time,
    scramble: State.currentScramble,
    timestamp: Date.now(),
    splits: null,
    metrics: {},
    penalty: null
  };

  State.currentSolve = solve;

  if (State.settings.meshBar) {
    showMeshBar(time);
  } else {
    completeSolve();
  }
}

function cancelSolve() {
  if (State.intervalId) {
    clearInterval(State.intervalId);
    State.intervalId = null;
  }
  if (State.inspectionIntervalId) {
    clearInterval(State.inspectionIntervalId);
    State.inspectionIntervalId = null;
  }

  State.timerState = 'idle';
  State.timerValue = 0;
  State.spacePressed = false;

  const display = document.getElementById('timerDisplay');
  display.classList.remove('running', 'ready', 'inspection');
  display.textContent = '0.00';
  document.getElementById('timerHint').style.opacity = '1';

  showToast('Solve cancelled');
}

// ============================================
// Typing Mode Functions
// ============================================

function updateTypingModeUI() {
  const container = document.getElementById('typingInputContainer');
  const hint = document.getElementById('timerHint');
  const typingToggle = document.getElementById('typingModeToggle');

  typingToggle.checked = State.settings.typingMode;

  if (State.settings.typingMode) {
    container.classList.remove('hidden');
    hint.textContent = 'Enter time manually below';
    document.getElementById('typingInput').focus();
  } else {
    container.classList.add('hidden');
    hint.textContent = 'Press Space to start';
  }
}

function parseTimeInput(input) {
  input = input.trim();

  // Check for DNF
  if (input.toLowerCase() === 'dnf') {
    return { time: 0, penalty: 'DNF' };
  }

  // Check for +2 suffix
  let penalty = null;
  if (input.endsWith('+') || input.endsWith('+2')) {
    penalty = '+2';
    input = input.replace(/\+2?$/, '').trim();
  }

  // Parse time formats: MM:SS.ms, SS.ms, or just SS
  let timeMs = 0;

  if (input.includes(':')) {
    // MM:SS.ms format
    const [minutes, rest] = input.split(':');
    const seconds = parseFloat(rest);
    if (isNaN(parseInt(minutes)) || isNaN(seconds)) return null;
    timeMs = (parseInt(minutes) * 60 + seconds) * 1000;
  } else {
    // SS.ms or SS format
    const seconds = parseFloat(input);
    if (isNaN(seconds)) return null;
    timeMs = seconds * 1000;
  }

  if (timeMs <= 0 || timeMs > 3600000) return null; // Max 1 hour

  return { time: timeMs, penalty };
}

function addTypedTime() {
  const input = document.getElementById('typingInput');
  const parsed = parseTimeInput(input.value);

  if (!parsed) {
    showToast('Invalid time format');
    return;
  }

  const solve = {
    id: Date.now().toString(),
    time: parsed.time,
    scramble: State.currentScramble,
    timestamp: Date.now(),
    splits: null,
    metrics: {},
    penalty: parsed.penalty,
    typed: true
  };

  const session = getCurrentSession();
  session.solves.push(solve);

  saveState();
  generateScramble();
  updateUI();

  input.value = '';
  input.focus();

  showToast('Time added');
}

// ============================================
// Mesh Bar Functions
// ============================================

function showMeshBar(time) {
  const bar = document.getElementById('meshBar');
  const cross = document.getElementById('crossSegment');
  const f2l = document.getElementById('f2lSegment');
  const ll = document.getElementById('llSegment');

  const crossTime = time * State.meshSplits[0];
  const f2lTime = time * (State.meshSplits[1] - State.meshSplits[0]);
  const llTime = time * (1 - State.meshSplits[1]);

  cross.style.flex = State.meshSplits[0];
  f2l.style.flex = State.meshSplits[1] - State.meshSplits[0];
  ll.style.flex = 1 - State.meshSplits[1];

  document.getElementById('crossTime').textContent = formatTime(crossTime);
  document.getElementById('f2lTime').textContent = formatTime(f2lTime);
  document.getElementById('llTime').textContent = formatTime(llTime);

  bar.classList.remove('hidden');

  setTimeout(() => {
    bar.classList.add('hidden');
    showMeshInputModal();
  }, 2500);
}

function showMeshInputModal() {
  document.getElementById('meshInputModal').classList.remove('hidden');
  document.getElementById('crossMoves').value = '';
  document.getElementById('crossRotations').value = '';
  document.getElementById('f2lRotations').value = '';
  document.getElementById('f2lPause').checked = false;
  document.getElementById('llRecognition').checked = false;
  document.getElementById('crossMoves').focus();
}

function saveMeshMetrics() {
  const crossMoves = document.getElementById('crossMoves').value;
  const crossRotations = document.getElementById('crossRotations').value;
  const f2lRotations = document.getElementById('f2lRotations').value;
  const f2lPause = document.getElementById('f2lPause').checked;
  const llRecognition = document.getElementById('llRecognition').checked;

  State.currentSolve.metrics = {
    crossMoves: crossMoves ? parseInt(crossMoves) : null,
    crossRotations: crossRotations ? parseInt(crossRotations) : null,
    f2lRotations: f2lRotations ? parseInt(f2lRotations) : null,
    f2lPause,
    llRecognition
  };

  const time = State.currentSolve.time;
  State.currentSolve.splits = {
    cross: time * State.meshSplits[0],
    f2l: time * (State.meshSplits[1] - State.meshSplits[0]),
    ll: time * (1 - State.meshSplits[1])
  };

  document.getElementById('meshInputModal').classList.add('hidden');
  completeSolve();
}

function skipMeshMetrics() {
  document.getElementById('meshInputModal').classList.add('hidden');
  completeSolve();
}

function completeSolve() {
  const session = getCurrentSession();
  session.solves.push(State.currentSolve);
  State.currentSolve = null;

  saveState();
  generateScramble();
  updateUI();
}

// ============================================
// Drag Functions for Mesh Bar
// ============================================

function startDrag(e) {
  const divider = e.target;
  const index = parseInt(divider.dataset.index);

  const onMove = (e) => {
    const container = document.querySelector('.mesh-track');
    const rect = container.getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width;
    updateMeshSplit(index, relativeX);
  };

  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    saveState();
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function startDragTouch(e) {
  e.preventDefault();
  const divider = e.target;
  const index = parseInt(divider.dataset.index);

  const onMove = (e) => {
    const touch = e.touches[0];
    const container = document.querySelector('.mesh-track');
    const rect = container.getBoundingClientRect();
    const relativeX = (touch.clientX - rect.left) / rect.width;
    updateMeshSplit(index, relativeX);
  };

  const onUp = () => {
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onUp);
    saveState();
  };

  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onUp);
}

function updateMeshSplit(index, relativeX) {
  if (index === 0) {
    State.meshSplits[0] = Math.max(0.1, Math.min(0.4, relativeX));
    if (State.meshSplits[0] >= State.meshSplits[1] - 0.1) {
      State.meshSplits[0] = State.meshSplits[1] - 0.1;
    }
  } else if (index === 1) {
    State.meshSplits[1] = Math.max(0.5, Math.min(0.9, relativeX));
    if (State.meshSplits[1] <= State.meshSplits[0] + 0.1) {
      State.meshSplits[1] = State.meshSplits[0] + 0.1;
    }
  }

  const cross = document.getElementById('crossSegment');
  const f2l = document.getElementById('f2lSegment');
  const ll = document.getElementById('llSegment');

  cross.style.flex = State.meshSplits[0];
  f2l.style.flex = State.meshSplits[1] - State.meshSplits[0];
  ll.style.flex = 1 - State.meshSplits[1];

  if (State.currentSolve) {
    const time = State.currentSolve.time;
    document.getElementById('crossTime').textContent = formatTime(time * State.meshSplits[0]);
    document.getElementById('f2lTime').textContent = formatTime(time * (State.meshSplits[1] - State.meshSplits[0]));
    document.getElementById('llTime').textContent = formatTime(time * (1 - State.meshSplits[1]));
  }
}

// ============================================
// Display Updates
// ============================================

function updateTimerDisplay() {
  const display = document.getElementById('timerDisplay');

  if (State.timerState === 'inspection') {
    display.textContent = State.inspectionTime;
  } else if (State.timerState === 'running') {
    if (State.settings.hideWhileRunning) {
      display.textContent = '...';
    } else {
      display.textContent = formatTime(State.timerValue);
    }
  } else {
    display.textContent = formatTime(State.timerValue) || '0.00';
  }
}

function updateUI() {
  updateStats();
  updateSessionList();
  updateHistoryList();
}

function updateStats() {
  const session = getCurrentSession();

  if (!session || session.solves.length === 0) {
    document.getElementById('ao5').textContent = '-';
    document.getElementById('ao12').textContent = '-';
    document.getElementById('ao50').textContent = '-';
    document.getElementById('ao100').textContent = '-';
    document.getElementById('best').textContent = '-';
    document.getElementById('worst').textContent = '-';
    document.getElementById('mean').textContent = '-';
    document.getElementById('count').textContent = '0';
    return;
  }

  const validSolves = session.solves.filter(s => s.penalty !== 'DNF');
  const times = validSolves.map(s => getEffectiveTime(s));

  document.getElementById('ao5').textContent = formatTime(calculateAverage(session.solves, 5));
  document.getElementById('ao12').textContent = formatTime(calculateAverage(session.solves, 12));
  document.getElementById('ao50').textContent = formatTime(calculateAverage(session.solves, 50));
  document.getElementById('ao100').textContent = formatTime(calculateAverage(session.solves, 100));

  if (times.length > 0) {
    document.getElementById('best').textContent = formatTime(Math.min(...times));
    document.getElementById('worst').textContent = formatTime(Math.max(...times));
    document.getElementById('mean').textContent = formatTime(times.reduce((a, b) => a + b, 0) / times.length);
  } else {
    document.getElementById('best').textContent = '-';
    document.getElementById('worst').textContent = '-';
    document.getElementById('mean').textContent = '-';
  }

  document.getElementById('count').textContent = session.solves.length;
}

function getEffectiveTime(solve) {
  if (solve.penalty === 'DNF') return Infinity;
  if (solve.penalty === '+2') return solve.time + 2000;
  return solve.time;
}

function calculateAverage(solves, n) {
  if (solves.length < n) return null;

  const recent = solves.slice(-n);
  const dnfCount = recent.filter(s => s.penalty === 'DNF').length;

  // If more than one DNF in average, it's DNF
  if (dnfCount > 1) return null;

  const times = recent.map(s => getEffectiveTime(s));
  const sorted = [...times].sort((a, b) => a - b);
  const trimmed = sorted.slice(1, -1);

  // Check if trimmed still has Infinity (DNF)
  if (trimmed.some(t => t === Infinity)) return null;

  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

function formatTime(ms) {
  if (ms === null || ms === undefined || ms === Infinity) return '-';

  const totalSeconds = ms / 1000;

  if (totalSeconds >= 60) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(2);
    return `${minutes}:${seconds.padStart(5, '0')}`;
  }

  return totalSeconds.toFixed(2);
}

function formatTimeWithPenalty(solve) {
  if (solve.penalty === 'DNF') {
    return `DNF(${formatTime(solve.time)})`;
  }
  if (solve.penalty === '+2') {
    return `${formatTime(solve.time + 2000)}+`;
  }
  return formatTime(solve.time);
}

function updateSessionList() {
  const list = document.getElementById('sessionList');
  list.innerHTML = '';

  State.sessions.forEach(session => {
    const item = document.createElement('div');
    item.className = 'session-item';
    if (session.id === State.currentSessionId) {
      item.classList.add('active');
    }

    const header = document.createElement('div');
    header.className = 'session-item-header';

    const name = document.createElement('div');
    name.className = 'session-name';
    name.textContent = session.name;

    const count = document.createElement('div');
    count.className = 'session-count';
    count.textContent = `${session.solves.length} solves`;

    header.appendChild(name);
    header.appendChild(count);

    const avg = document.createElement('div');
    avg.className = 'session-avg';
    if (session.solves.length > 0) {
      const validSolves = session.solves.filter(s => s.penalty !== 'DNF');
      if (validSolves.length > 0) {
        const times = validSolves.map(s => getEffectiveTime(s));
        const mean = times.reduce((a, b) => a + b, 0) / times.length;
        avg.textContent = `Avg: ${formatTime(mean)}`;
      }
    }

    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'session-edit-btn';
    editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>`;
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showSessionEditModal(session.id);
    });

    item.appendChild(header);
    item.appendChild(avg);
    item.appendChild(editBtn);

    item.addEventListener('click', () => {
      State.currentSessionId = session.id;
      saveState();
      updateUI();
    });

    list.appendChild(item);
  });
}

function updateHistoryList() {
  const list = document.getElementById('historyList');
  list.innerHTML = '';

  const session = getCurrentSession();
  if (!session || session.solves.length === 0) {
    list.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">No solves yet</span>';
    return;
  }

  // Show most recent solves first (reverse order), limit to 20
  const recentSolves = [...session.solves].reverse().slice(0, 20);

  recentSolves.forEach((solve, index) => {
    const solveNumber = session.solves.length - index;
    const item = document.createElement('div');
    item.className = 'history-item';

    const number = document.createElement('span');
    number.className = 'history-item-number';
    number.textContent = `#${solveNumber}`;

    const time = document.createElement('span');
    time.className = 'history-item-time';

    if (solve.penalty === 'DNF') {
      time.classList.add('dnf');
      time.textContent = formatTime(solve.time);
    } else if (solve.penalty === '+2') {
      time.classList.add('plus2');
      time.textContent = formatTime(solve.time + 2000);
    } else {
      time.textContent = formatTime(solve.time);
    }

    item.appendChild(number);
    item.appendChild(time);

    if (solve.penalty) {
      const penalty = document.createElement('span');
      penalty.className = 'history-item-penalty';
      penalty.textContent = solve.penalty;
      item.appendChild(penalty);
    }

    item.addEventListener('click', () => showSolveEditModal(solve.id));
    list.appendChild(item);
  });
}

// ============================================
// Solve Management
// ============================================

function showSolveEditModal(solveId) {
  const session = getCurrentSession();
  const solve = session.solves.find(s => s.id === solveId);
  if (!solve) return;

  State.editingSolveId = solveId;

  document.getElementById('editSolveTime').textContent = formatTime(solve.time);
  document.getElementById('editSolveScramble').textContent = solve.scramble;

  const penaltyBadge = document.getElementById('editSolvePenalty');
  if (solve.penalty === 'DNF') {
    penaltyBadge.textContent = 'DNF';
    penaltyBadge.className = 'penalty-badge dnf';
  } else if (solve.penalty === '+2') {
    penaltyBadge.textContent = '+2';
    penaltyBadge.className = 'penalty-badge';
  } else {
    penaltyBadge.textContent = '';
    penaltyBadge.className = 'penalty-badge';
  }

  // Update button states
  document.getElementById('editPenaltyNone').classList.toggle('active', !solve.penalty);
  document.getElementById('editPenaltyPlus2').classList.toggle('active', solve.penalty === '+2');
  document.getElementById('editPenaltyDNF').classList.toggle('active', solve.penalty === 'DNF');

  document.getElementById('solveEditModal').classList.remove('hidden');
}

function setPenalty(penalty) {
  const session = getCurrentSession();
  const solve = session.solves.find(s => s.id === State.editingSolveId);
  if (!solve) return;

  solve.penalty = penalty;
  saveState();

  // Update modal display
  const penaltyBadge = document.getElementById('editSolvePenalty');
  if (penalty === 'DNF') {
    penaltyBadge.textContent = 'DNF';
    penaltyBadge.className = 'penalty-badge dnf';
  } else if (penalty === '+2') {
    penaltyBadge.textContent = '+2';
    penaltyBadge.className = 'penalty-badge';
  } else {
    penaltyBadge.textContent = '';
    penaltyBadge.className = 'penalty-badge';
  }

  document.getElementById('editPenaltyNone').classList.toggle('active', !penalty);
  document.getElementById('editPenaltyPlus2').classList.toggle('active', penalty === '+2');
  document.getElementById('editPenaltyDNF').classList.toggle('active', penalty === 'DNF');

  updateUI();
}

function deleteCurrentSolve() {
  if (State.settings.confirmDelete) {
    showConfirm('Delete Solve', 'Are you sure you want to delete this solve?', () => {
      performDeleteSolve();
    });
  } else {
    performDeleteSolve();
  }
}

function performDeleteSolve() {
  const session = getCurrentSession();
  const index = session.solves.findIndex(s => s.id === State.editingSolveId);
  if (index !== -1) {
    session.solves.splice(index, 1);
    saveState();
    updateUI();
    showToast('Solve deleted');
  }
  document.getElementById('solveEditModal').classList.add('hidden');
  State.editingSolveId = null;
}

function applyPenaltyToLastSolve(penalty) {
  const session = getCurrentSession();
  if (session.solves.length === 0) return;

  const lastSolve = session.solves[session.solves.length - 1];
  lastSolve.penalty = penalty;
  saveState();
  updateUI();

  if (penalty === null) {
    showToast('Penalty removed');
  } else {
    showToast(`${penalty} applied`);
  }
}

function deleteLastSolve() {
  const session = getCurrentSession();
  if (session.solves.length === 0) return;

  if (State.settings.confirmDelete) {
    showConfirm('Delete Last Solve', 'Delete the last solve?', () => {
      session.solves.pop();
      saveState();
      updateUI();
      showToast('Solve deleted');
    });
  } else {
    session.solves.pop();
    saveState();
    updateUI();
    showToast('Solve deleted');
  }
}

// ============================================
// Session Edit Modal
// ============================================

function showSessionEditModal(sessionId) {
  const session = State.sessions.find(s => s.id === sessionId);
  if (!session) return;

  State.editingSessionId = sessionId;
  document.getElementById('sessionNameInput').value = session.name;
  document.getElementById('sessionEditModal').classList.remove('hidden');
}

function saveSessionEdit() {
  const newName = document.getElementById('sessionNameInput').value.trim();
  if (newName && State.editingSessionId) {
    renameSession(State.editingSessionId, newName);
  }
  document.getElementById('sessionEditModal').classList.add('hidden');
  State.editingSessionId = null;
}

function deleteCurrentSession() {
  showConfirm('Delete Session', 'Are you sure you want to delete this session and all its solves?', () => {
    deleteSession(State.editingSessionId);
    document.getElementById('sessionEditModal').classList.add('hidden');
    State.editingSessionId = null;
  });
}

// ============================================
// Settings
// ============================================

function showSettings() {
  document.getElementById('settingMeshBar').checked = State.settings.meshBar;
  document.getElementById('settingStackmat').checked = State.settings.stackmat;
  document.getElementById('settingHideWhileRunning').checked = State.settings.hideWhileRunning;
  document.getElementById('settingVoiceAlerts').checked = State.settings.voiceAlerts;
  document.getElementById('settingShowHistory').checked = State.settings.showHistory;
  document.getElementById('settingConfirmDelete').checked = State.settings.confirmDelete;
  document.getElementById('settingsModal').classList.remove('hidden');
}

function saveSettings() {
  State.settings.meshBar = document.getElementById('settingMeshBar').checked;
  State.settings.stackmat = document.getElementById('settingStackmat').checked;
  State.settings.hideWhileRunning = document.getElementById('settingHideWhileRunning').checked;
  State.settings.voiceAlerts = document.getElementById('settingVoiceAlerts').checked;
  State.settings.showHistory = document.getElementById('settingShowHistory').checked;
  State.settings.confirmDelete = document.getElementById('settingConfirmDelete').checked;
  document.getElementById('settingsModal').classList.add('hidden');
  saveState();
  showToast('Settings saved');
}

// ============================================
// Theme
// ============================================

function toggleTheme() {
  const newTheme = State.settings.theme === 'dark' ? 'light' : 'dark';
  State.settings.theme = newTheme;
  applyTheme(newTheme);
  saveState();
}

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
}

// ============================================
// Goals Modal
// ============================================

function showGoals() {
  document.getElementById('goalsModal').classList.remove('hidden');
  updateGoalTable();
}

function updateGoalTable() {
  const goalKey = document.getElementById('goalSelect').value;
  const container = document.getElementById('goalTable');

  if (!goalKey) {
    container.innerHTML = '<p style="color: var(--text-tertiary);">Select a goal to view requirements and compare your performance.</p>';
    return;
  }

  const goal = GOALS[goalKey];
  const session = getCurrentSession();

  let userStats = { cross: 0, f2l: 0, ll: 0, rotations: 0 };

  if (session && session.solves.length > 0) {
    const solvesWithSplits = session.solves.filter(s => s.splits);
    if (solvesWithSplits.length > 0) {
      userStats.cross = solvesWithSplits.reduce((a, s) => a + s.splits.cross, 0) / solvesWithSplits.length / 1000;
      userStats.f2l = solvesWithSplits.reduce((a, s) => a + s.splits.f2l, 0) / solvesWithSplits.length / 1000;
      userStats.ll = solvesWithSplits.reduce((a, s) => a + s.splits.ll, 0) / solvesWithSplits.length / 1000;
    }

    const solvesWithRotations = session.solves.filter(s => s.metrics?.f2lRotations != null);
    if (solvesWithRotations.length > 0) {
      userStats.rotations = solvesWithRotations.reduce((a, s) => a + s.metrics.f2lRotations, 0) / solvesWithRotations.length;
    }
  }

  container.innerHTML = `
    <table>
      <tr>
        <th>Phase</th>
        <th>Target</th>
        <th>Your Avg</th>
        <th>Status</th>
      </tr>
      <tr>
        <td>Cross</td>
        <td>&le; ${goal.cross.toFixed(1)}s</td>
        <td class="${userStats.cross > goal.cross ? 'over' : 'under'}">${userStats.cross > 0 ? userStats.cross.toFixed(2) + 's' : '-'}</td>
        <td>${userStats.cross > 0 ? (userStats.cross <= goal.cross ? '&#10003;' : '&#10005;') : '-'}</td>
      </tr>
      <tr>
        <td>F2L</td>
        <td>&le; ${goal.f2l.toFixed(1)}s</td>
        <td class="${userStats.f2l > goal.f2l ? 'over' : 'under'}">${userStats.f2l > 0 ? userStats.f2l.toFixed(2) + 's' : '-'}</td>
        <td>${userStats.f2l > 0 ? (userStats.f2l <= goal.f2l ? '&#10003;' : '&#10005;') : '-'}</td>
      </tr>
      <tr>
        <td>Last Layer</td>
        <td>&le; ${goal.ll.toFixed(1)}s</td>
        <td class="${userStats.ll > goal.ll ? 'over' : 'under'}">${userStats.ll > 0 ? userStats.ll.toFixed(2) + 's' : '-'}</td>
        <td>${userStats.ll > 0 ? (userStats.ll <= goal.ll ? '&#10003;' : '&#10005;') : '-'}</td>
      </tr>
      <tr>
        <td>Rotations</td>
        <td>&le; ${goal.rotations}</td>
        <td class="${userStats.rotations > goal.rotations ? 'over' : 'under'}">${userStats.rotations > 0 ? userStats.rotations.toFixed(1) : '-'}</td>
        <td>${userStats.rotations > 0 ? (userStats.rotations <= goal.rotations ? '&#10003;' : '&#10005;') : '-'}</td>
      </tr>
    </table>
  `;
}

// ============================================
// Analytics Modal
// ============================================

function showAnalytics() {
  document.getElementById('analyticsModal').classList.remove('hidden');
  const session = getCurrentSession();
  const container = document.getElementById('analyticsContent');

  if (!session || session.solves.length === 0) {
    container.innerHTML = '<p style="color: var(--text-tertiary);">No solves in current session. Start solving to see analytics!</p>';
    return;
  }

  const validSolves = session.solves.filter(s => s.penalty !== 'DNF');
  const solvesWithSplits = session.solves.filter(s => s.splits);
  const solvesWithMetrics = session.solves.filter(s => s.metrics && Object.keys(s.metrics).length > 0);

  let html = '<h4>Session Overview</h4>';
  html += `<p>Total solves: ${session.solves.length}</p>`;
  html += `<p>Valid solves: ${validSolves.length}</p>`;
  html += `<p>DNFs: ${session.solves.length - validSolves.length}</p>`;

  if (validSolves.length > 0) {
    const times = validSolves.map(s => getEffectiveTime(s));
    const best = Math.min(...times);
    const worst = Math.max(...times);
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const stdDev = Math.sqrt(times.reduce((a, t) => a + Math.pow(t - mean, 2), 0) / times.length);

    html += `<p>Best: ${formatTime(best)}</p>`;
    html += `<p>Worst: ${formatTime(worst)}</p>`;
    html += `<p>Mean: ${formatTime(mean)}</p>`;
    html += `<p>Std Dev: ${formatTime(stdDev)}</p>`;
  }

  if (solvesWithSplits.length > 0) {
    html += '<h4>Phase Breakdown</h4>';

    const avgCross = solvesWithSplits.reduce((a, s) => a + s.splits.cross, 0) / solvesWithSplits.length;
    const avgF2L = solvesWithSplits.reduce((a, s) => a + s.splits.f2l, 0) / solvesWithSplits.length;
    const avgLL = solvesWithSplits.reduce((a, s) => a + s.splits.ll, 0) / solvesWithSplits.length;
    const total = avgCross + avgF2L + avgLL;

    const crossPct = (avgCross / total * 100).toFixed(1);
    const f2lPct = (avgF2L / total * 100).toFixed(1);
    const llPct = (avgLL / total * 100).toFixed(1);

    html += `<div class="breakdown-bar">
      <div class="breakdown-segment" style="background: var(--mesh-cross); flex: ${crossPct};">${crossPct}%</div>
      <div class="breakdown-segment" style="background: var(--mesh-f2l); flex: ${f2lPct};">${f2lPct}%</div>
      <div class="breakdown-segment" style="background: var(--mesh-ll); flex: ${llPct};">${llPct}%</div>
    </div>`;

    html += `<p>Cross: ${formatTime(avgCross)} (${crossPct}%)</p>`;
    html += `<p>F2L: ${formatTime(avgF2L)} (${f2lPct}%)</p>`;
    html += `<p>Last Layer: ${formatTime(avgLL)} (${llPct}%)</p>`;
  }

  if (solvesWithMetrics.length > 0) {
    html += '<h4>Efficiency Metrics</h4>';

    const crossMovesData = solvesWithMetrics.filter(s => s.metrics.crossMoves != null);
    if (crossMovesData.length > 0) {
      const avgMoves = crossMovesData.reduce((a, s) => a + s.metrics.crossMoves, 0) / crossMovesData.length;
      html += `<p>Avg cross moves: ${avgMoves.toFixed(1)}</p>`;
    }

    const rotationsData = solvesWithMetrics.filter(s => s.metrics.f2lRotations != null);
    if (rotationsData.length > 0) {
      const avgRot = rotationsData.reduce((a, s) => a + s.metrics.f2lRotations, 0) / rotationsData.length;
      html += `<p>Avg F2L rotations: ${avgRot.toFixed(1)}</p>`;
    }

    const pauseData = solvesWithMetrics.filter(s => s.metrics.f2lPause !== undefined);
    if (pauseData.length > 0) {
      const pauseRate = pauseData.filter(s => s.metrics.f2lPause).length / pauseData.length;
      html += `<p>F2L pause rate: ${(pauseRate * 100).toFixed(0)}%</p>`;
    }

    const recognitionData = solvesWithMetrics.filter(s => s.metrics.llRecognition !== undefined);
    if (recognitionData.length > 0) {
      const recogRate = recognitionData.filter(s => s.metrics.llRecognition).length / recognitionData.length;
      html += `<p>LL recognition delay rate: ${(recogRate * 100).toFixed(0)}%</p>`;
    }
  } else {
    html += '<h4>Efficiency Metrics</h4>';
    html += '<p style="color: var(--text-tertiary);">No efficiency metrics recorded yet. Enable Mesh Bar in settings to track metrics.</p>';
  }

  container.innerHTML = html;
}

// ============================================
// Import/Export
// ============================================

function exportData() {
  const data = {
    sessions: State.sessions,
    settings: State.settings,
    meshSplits: State.meshSplits,
    exportedAt: Date.now(),
    version: '2.0'
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mesh-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data exported');
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      // Merge or replace sessions
      if (data.sessions && Array.isArray(data.sessions)) {
        State.sessions = data.sessions;
      }

      if (data.settings) {
        State.settings = { ...State.settings, ...data.settings };
      }

      if (data.meshSplits) {
        State.meshSplits = data.meshSplits;
      }

      if (State.sessions.length > 0) {
        State.currentSessionId = State.sessions[0].id;
      }

      saveState();
      applyTheme(State.settings.theme);
      updateUI();
      showToast('Data imported successfully');
    } catch (err) {
      console.error('Import failed:', err);
      showToast('Import failed - invalid file');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ============================================
// Utility Functions
// ============================================

function showToast(message) {
  const toast = document.getElementById('toast');
  document.getElementById('toastMessage').textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

function showConfirm(title, message, callback) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  State.confirmCallback = callback;
  document.getElementById('confirmModal').classList.remove('hidden');
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.classList.add('hidden');
  });
  document.getElementById('sidebar').classList.remove('open');
}

// ============================================
// Initialize Application
// ============================================

document.addEventListener('DOMContentLoaded', init);
