const State = {
  sessions: [],
  currentSessionId: null,
  timerState: 'idle',
  timerValue: 0,
  startTime: 0,
  intervalId: null,
  spacePressed: false,
  inspectionTime: 15,
  inspectionIntervalId: null,
  currentScramble: '',
  settings: {
    meshBar: true,
    stackmat: false
  },
  currentSolve: null,
  meshSplits: [0.2, 0.65]
};

const GOALS = {
  sub20: { cross: 1.8, f2l: 13.0, ll: 5.2, rotations: 3 },
  sub15: { cross: 1.5, f2l: 9.5, ll: 4.0, rotations: 2 },
  sub10: { cross: 1.2, f2l: 6.5, ll: 2.3, rotations: 1.5 },
  sub5: { cross: 1.0, f2l: 3.0, ll: 1.0, rotations: 1 },
  sub3: { cross: 1.2, f2l: 2.0, ll: 0.8, rotations: 1 }
};

function init() {
  loadState();
  if (State.sessions.length === 0) {
    createSession('normal');
  }
  if (!State.currentSessionId) {
    State.currentSessionId = State.sessions[0].id;
  }
  
  generateScramble();
  updateUI();
  attachEventListeners();
}

function loadState() {
  try {
    const saved = localStorage.getItem('meshData');
    if (saved) {
      const data = JSON.parse(saved);
      State.sessions = data.sessions || [];
      State.currentSessionId = data.currentSessionId;
      State.settings = data.settings || State.settings;
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

function createSession(type = 'normal') {
  const session = {
    id: Date.now().toString(),
    type,
    name: `${type.charAt(0).toUpperCase() + type.slice(1)} Session ${State.sessions.length + 1}`,
    solves: [],
    createdAt: Date.now()
  };
  State.sessions.push(session);
  State.currentSessionId = session.id;
  saveState();
  updateUI();
}

function getCurrentSession() {
  return State.sessions.find(s => s.id === State.currentSessionId);
}

function generateScramble() {
  const moves = ["R", "L", "U", "D", "F", "B"];
  const modifiers = ["", "'", "2"];
  let scramble = [];
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

function attachEventListeners() {
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
  
  document.getElementById('copyScramble').addEventListener('click', () => {
    navigator.clipboard.writeText(State.currentScramble);
  });
  
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  
  document.getElementById('toggleSidebar').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  });
  
  document.getElementById('newSession').addEventListener('click', () => {
    const type = document.getElementById('sessionType').value;
    createSession(type);
  });
  
  document.getElementById('exportData').addEventListener('click', exportData);
  document.getElementById('importData').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', importData);
  
  document.getElementById('showSettings').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('hidden');
    document.getElementById('settingMeshBar').checked = State.settings.meshBar;
    document.getElementById('settingStackmat').checked = State.settings.stackmat;
  });
  
  document.getElementById('closeSettings').addEventListener('click', () => {
    State.settings.meshBar = document.getElementById('settingMeshBar').checked;
    State.settings.stackmat = document.getElementById('settingStackmat').checked;
    document.getElementById('settingsModal').classList.add('hidden');
    saveState();
  });
  
  document.getElementById('showGoals').addEventListener('click', showGoals);
  document.getElementById('closeGoals').addEventListener('click', () => {
    document.getElementById('goalsModal').classList.add('hidden');
  });
  
  document.getElementById('showAnalytics').addEventListener('click', showAnalytics);
  document.getElementById('closeAnalytics').addEventListener('click', () => {
    document.getElementById('analyticsModal').classList.add('hidden');
  });
  
  document.getElementById('saveMeshMetrics').addEventListener('click', saveMeshMetrics);
  document.getElementById('skipMeshMetrics').addEventListener('click', skipMeshMetrics);
  
  const dividers = document.querySelectorAll('.mesh-divider');
  dividers.forEach(div => {
    div.addEventListener('mousedown', startDrag);
  });
  
  document.getElementById('goalSelect').addEventListener('change', updateGoalTable);
}

function handleKeyDown(e) {
  if (e.code === 'Space' && !State.spacePressed && State.timerState === 'idle') {
    e.preventDefault();
    State.spacePressed = true;
    
    if (document.getElementById('inspectionToggle').checked) {
      startInspection();
    } else {
      document.getElementById('timerDisplay').classList.add('ready');
    }
  }
}

function handleKeyUp(e) {
  if (e.code === 'Space' && State.spacePressed) {
    e.preventDefault();
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

function startInspection() {
  State.timerState = 'inspection';
  State.inspectionTime = 15;
  updateTimerDisplay();
  
  State.inspectionIntervalId = setInterval(() => {
    State.inspectionTime--;
    updateTimerDisplay();
    
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
  State.timerState = 'idle';
}

function startTimer() {
  document.getElementById('timerDisplay').classList.remove('ready', 'inspection');
  document.getElementById('timerDisplay').classList.add('running');
  document.getElementById('meshBar').classList.add('hidden');
  
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
  document.getElementById('timerDisplay').classList.remove('running');
  
  const solve = {
    id: Date.now().toString(),
    time,
    scramble: State.currentScramble,
    timestamp: Date.now(),
    splits: null,
    metrics: {}
  };
  
  State.currentSolve = solve;
  
  if (State.settings.meshBar) {
    showMeshBar(time);
  } else {
    completeSolve();
  }
}

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
  
  bar.classList.remove('hidden');
  
  setTimeout(() => {
    bar.classList.add('hidden');
    showMeshInputModal();
  }, 2000);
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
    f2lPause: f2lPause,
    llRecognition: llRecognition
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

function startDrag(e) {
  const divider = e.target;
  const index = parseInt(divider.dataset.index);
  const startX = e.clientX;
  const startSplits = [...State.meshSplits];
  
  const onMove = (e) => {
    const container = document.querySelector('.mesh-track');
    const rect = container.getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width;
    
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
    
    document.getElementById('crossSegment').style.flex = State.meshSplits[0];
    document.getElementById('f2lSegment').style.flex = State.meshSplits[1] - State.meshSplits[0];
    document.getElementById('llSegment').style.flex = 1 - State.meshSplits[1];
  };
  
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    saveState();
  };
  
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function updateTimerDisplay() {
  const display = document.getElementById('timerDisplay');
  
  if (State.timerState === 'inspection') {
    display.textContent = State.inspectionTime;
    display.classList.add('inspection');
  } else if (State.timerState === 'running') {
    const seconds = (State.timerValue / 1000).toFixed(2);
    display.textContent = seconds;
  } else {
    const seconds = (State.timerValue / 1000).toFixed(2);
    display.textContent = seconds || '0.00';
  }
}

function updateUI() {
  updateStats();
  updateSessionList();
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
    return;
  }
  
  const times = session.solves.map(s => s.time);
  
  document.getElementById('ao5').textContent = formatTime(calculateAverage(times, 5));
  document.getElementById('ao12').textContent = formatTime(calculateAverage(times, 12));
  document.getElementById('ao50').textContent = formatTime(calculateAverage(times, 50));
  document.getElementById('ao100').textContent = formatTime(calculateAverage(times, 100));
  document.getElementById('best').textContent = formatTime(Math.min(...times));
  document.getElementById('worst').textContent = formatTime(Math.max(...times));
  document.getElementById('mean').textContent = formatTime(times.reduce((a, b) => a + b, 0) / times.length);
}

function calculateAverage(times, n) {
  if (times.length < n) return null;
  const recent = times.slice(-n);
  const sorted = [...recent].sort((a, b) => a - b);
  const trimmed = sorted.slice(1, -1);
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

function formatTime(ms) {
  if (ms === null || ms === undefined) return '-';
  return (ms / 1000).toFixed(2);
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
      const times = session.solves.map(s => s.time);
      const mean = times.reduce((a, b) => a + b, 0) / times.length;
      avg.textContent = `Avg: ${formatTime(mean)}`;
    }
    
    item.appendChild(header);
    item.appendChild(avg);
    
    item.addEventListener('click', () => {
      State.currentSessionId = session.id;
      saveState();
      updateUI();
    });
    
    list.appendChild(item);
  });
}

function exportData() {
  const data = {
    sessions: State.sessions,
    settings: State.settings,
    exportedAt: Date.now()
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mesh-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      State.sessions = data.sessions || [];
      State.settings = data.settings || State.settings;
      if (State.sessions.length > 0) {
        State.currentSessionId = State.sessions[0].id;
      }
      saveState();
      updateUI();
    } catch (err) {
      console.error('Import failed:', err);
    }
  };
  reader.readAsText(file);
}

function showGoals() {
  document.getElementById('goalsModal').classList.remove('hidden');
  updateGoalTable();
}

function updateGoalTable() {
  const goalKey = document.getElementById('goalSelect').value;
  const container = document.getElementById('goalTable');
  
  if (!goalKey) {
    container.innerHTML = '<p style="color: #888;">Select a goal to view requirements.</p>';
    return;
  }
  
  const goal = GOALS[goalKey];
  const session = getCurrentSession();
  
  let userStats = { cross: 0, f2l: 0, ll: 0, rotations: 0 };
  
  if (session && session.solves.length > 0) {
    const solvesWithSplits = session.solves.filter(s => s.splits);
    if (solvesWithSplits.length > 0) {
      userStats.cross = solvesWithSplits.reduce((a, s) => a + s.splits.cross, 0) / solvesWithSplits.length;
      userStats.f2l = solvesWithSplits.reduce((a, s) => a + s.splits.f2l, 0) / solvesWithSplits.length;
      userStats.ll = solvesWithSplits.reduce((a, s) => a + s.splits.ll, 0) / solvesWithSplits.length;
    }
    
    const solvesWithRotations = session.solves.filter(s => s.metrics?.f2lRotations !== null);
    if (solvesWithRotations.length > 0) {
      userStats.rotations = solvesWithRotations.reduce((a, s) => a + s.metrics.f2lRotations, 0) / solvesWithRotations.length;
    }
  }
  
  container.innerHTML = `
    <table>
      <tr>
        <th>Phase</th>
        <th>Requirement</th>
        <th>Your Avg</th>
      </tr>
      <tr>
        <td>Cross</td>
        <td>≤ ${goal.cross.toFixed(1)}s</td>
        <td class="${userStats.cross > goal.cross * 1000 ? 'over' : 'under'}">${formatTime(userStats.cross)}</td>
      </tr>
      <tr>
        <td>F2L</td>
        <td>≤ ${goal.f2l.toFixed(1)}s</td>
        <td class="${userStats.f2l > goal.f2l * 1000 ? 'over' : 'under'}">${formatTime(userStats.f2l)}</td>
      </tr>
      <tr>
        <td>LL</td>
        <td>≤ ${goal.ll.toFixed(1)}s</td>
        <td class="${userStats.ll > goal.ll * 1000 ? 'over' : 'under'}">${formatTime(userStats.ll)}</td>
      </tr>
      <tr>
        <td>Rotations</td>
        <td>≤ ${goal.rotations}</td>
        <td class="${userStats.rotations > goal.rotations ? 'over' : 'under'}">${userStats.rotations.toFixed(1)}</td>
      </tr>
    </table>
  `;
}

function showAnalytics() {
  document.getElementById('analyticsModal').classList.remove('hidden');
  const session = getCurrentSession();
  const container = document.getElementById('analyticsContent');
  
  if (!session || session.solves.length === 0) {
    container.innerHTML = 'No solves in current session.';
    return;
  }
  
  const solvesWithSplits = session.solves.filter(s => s.splits);
  const solvesWithMetrics = session.solves.filter(s => s.metrics && Object.keys(s.metrics).length > 0);
  
  let html = '<h4>Mesh Breakdown</h4>';
  
  if (solvesWithSplits.length > 0) {
    const avgCross = solvesWithSplits.reduce((a, s) => a + s.splits.cross, 0) / solvesWithSplits.length;
    const avgF2L = solvesWithSplits.reduce((a, s) => a + s.splits.f2l, 0) / solvesWithSplits.length;
    const avgLL = solvesWithSplits.reduce((a, s) => a + s.splits.ll, 0) / solvesWithSplits.length;
    const total = avgCross + avgF2L + avgLL;
    
    const crossPct = (avgCross / total * 100).toFixed(1);
    const f2lPct = (avgF2L / total * 100).toFixed(1);
    const llPct = (avgLL / total * 100).toFixed(1);
    
    html += `<div class="breakdown-bar">
      <div class="breakdown-segment" style="background: #3f51b5; flex: ${crossPct};">${crossPct}%</div>
      <div class="breakdown-segment" style="background: #2196f3; flex: ${f2lPct};">${f2lPct}%</div>
      <div class="breakdown-segment" style="background: #00bcd4; flex: ${llPct};">${llPct}%</div>
    </div>`;
    
    html += `<p>Cross: ${formatTime(avgCross)} (${crossPct}%)</p>`;
    html += `<p>F2L: ${formatTime(avgF2L)} (${f2lPct}%)</p>`;
    html += `<p>LL: ${formatTime(avgLL)} (${llPct}%)</p>`;
  }
  
  html += '<br><h4>Efficiency Summary</h4>';
  
  if (solvesWithMetrics.length > 0) {
    const crossMovesData = solvesWithMetrics.filter(s => s.metrics.crossMoves !== null);
    if (crossMovesData.length > 0) {
      const avgMoves = crossMovesData.reduce((a, s) => a + s.metrics.crossMoves, 0) / crossMovesData.length;
      html += `<p>Avg cross moves: ${avgMoves.toFixed(1)}</p>`;
    }
    
    const rotationsData = solvesWithMetrics.filter(s => s.metrics.f2lRotations !== null);
    if (rotationsData.length > 0) {
      const avgRot = rotationsData.reduce((a, s) => a + s.metrics.f2lRotations, 0) / rotationsData.length;
      html += `<p>Avg rotations: ${avgRot.toFixed(1)}</p>`;
    }
    
    const pauseData = solvesWithMetrics.filter(s => s.metrics.f2lPause !== undefined);
    if (pauseData.length > 0) {
      const pauseRate = pauseData.filter(s => s.metrics.f2lPause).length / pauseData.length;
      html += `<p>Pause rate: ${(pauseRate * 100).toFixed(0)}%</p>`;
    }
  } else {
    html += '<p>No efficiency metrics recorded yet.</p>';
  }
  
  container.innerHTML = html;
}

init();
