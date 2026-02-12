/* ==========================
   Typing Speed Test (Vanilla JS)
   - Timed + Words mode
   - Per-character spans
   - Live WPM/Accuracy/Errors
   - Start on first keystroke
   - Results modal + local history
   ========================== */

const els = {
  modeSelect: document.getElementById("modeSelect"),
  durationWrap: document.getElementById("durationWrap"),
  durationSelect: document.getElementById("durationSelect"),
  wordsWrap: document.getElementById("wordsWrap"),
  wordsSelect: document.getElementById("wordsSelect"),
  difficultySelect: document.getElementById("difficultySelect"),

  resetBtn: document.getElementById("resetBtn"),
  newTextBtn: document.getElementById("newTextBtn"),
  themeBtn: document.getElementById("themeBtn"),

  timerValue: document.getElementById("timerValue"),
  wpmValue: document.getElementById("wpmValue"),
  accValue: document.getElementById("accValue"),
  errValue: document.getElementById("errValue"),
  progressText: document.getElementById("progressText"),
  progressFill: document.getElementById("progressFill"),

  targetText: document.getElementById("targetText"),
  typeInput: document.getElementById("typeInput"),
  hintText: document.getElementById("hintText"),

  modalBackdrop: document.getElementById("modalBackdrop"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  retryBtn: document.getElementById("retryBtn"),
  modalNewTextBtn: document.getElementById("modalNewTextBtn"),

  finalWpm: document.getElementById("finalWpm"),
  finalAcc: document.getElementById("finalAcc"),
  finalErr: document.getElementById("finalErr"),
  finalTime: document.getElementById("finalTime"),
  finalChars: document.getElementById("finalChars"),
  barWpm: document.getElementById("barWpm"),
  barAcc: document.getElementById("barAcc"),

  historyList: document.getElementById("historyList"),
  clearHistoryBtn: document.getElementById("clearHistoryBtn"),
  scrollTopBtn: document.getElementById("scrollTopBtn"),

  toHistory: document.getElementById("toHistory"),
  toInstructions: document.getElementById("toInstructions"),
};

const TEXT_BANK = {
  easy: [
    "the quick brown fox jumps over the lazy dog and then runs away to the hill",
    "typing is fun when the words are short and the pace is calm and steady",
    "small steps each day can build strong skills and make progress feel easy",
  ],
  medium: [
    "A steady rhythm helps you type faster, but accuracy matters more than raw speed.",
    "Good typing comes from relaxed hands, clear focus, and consistent practice over time.",
    "The best results appear when you balance speed with control, even under a timer.",
  ],
  hard: [
    "In 2026, developers often juggle APIs, caching, edge cases, and UX—without breaking flow.",
    "Precision matters: punctuation, numbers (like 3.14), and symbols can disrupt careless typing.",
    "When pressure rises, keep control; correct errors quickly, and maintain a clean, steady cadence.",
  ],
};

const HISTORY_KEY = "typing_test_history_v1";

let state = {
  mode: "timed",            // timed | words
  durationSeconds: 60,
  wordTarget: 25,
  difficulty: "medium",

  targetText: "",
  startTime: null,
  elapsedSeconds: 0,
  remainingSeconds: 60,

  typedValue: "",
  correctChars: 0,
  incorrectChars: 0,
  totalTypedChars: 0,

  isRunning: false,
  isFinished: false,
  tickId: null,
};

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

function formatMMSS(totalSec){
  const s = Math.max(0, Math.floor(totalSec));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function pickRandom(arr){
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildTargetText(){
  // Simple approach: join 2-3 random bank entries for enough length
  const bank = TEXT_BANK[state.difficulty];
  const parts = [];
  const count = state.mode === "timed" ? 3 : 2;
  for(let i=0;i<count;i++) parts.push(pickRandom(bank));

  // Ensure longer text for longer timed sessions / large word targets
  let text = parts.join(" ");
  const needWords = state.mode === "words" ? state.wordTarget + 20 : 0;
  const currentWords = text.trim().split(/\s+/).filter(Boolean).length;

  if(state.mode === "words" && currentWords < needWords){
    while(text.trim().split(/\s+/).filter(Boolean).length < needWords){
      text += " " + pickRandom(bank);
    }
  }

  // For timed mode, try to make it decently long
  if(state.mode === "timed" && state.durationSeconds >= 60){
    text += " " + pickRandom(bank);
  }

  return text.trim();
}

function renderTargetText(text){
  els.targetText.innerHTML = "";
  const frag = document.createDocumentFragment();
  for(let i=0;i<text.length;i++){
    const span = document.createElement("span");
    span.className = "char pending";
    span.textContent = text[i];
    frag.appendChild(span);
  }
  els.targetText.appendChild(frag);
}

function getSpans(){
  return els.targetText.querySelectorAll(".char");
}

function preventPaste(e){
  e.preventDefault();
  els.hintText.textContent = "Paste is disabled. Please type manually 🙂";
  setTimeout(() => {
    if(!state.isRunning && !state.isFinished){
      els.hintText.textContent = "Start typing to begin. Paste is disabled for fairness.";
    }
  }, 1400);
}

function startTestIfNeeded(){
  if(state.isRunning || state.isFinished) return;
  state.isRunning = true;
  state.startTime = performance.now();

  if(state.mode === "timed"){
    state.remainingSeconds = state.durationSeconds;
  } else {
    // Words mode: timer counts up, but we still use elapsed time for WPM
    state.remainingSeconds = 0;
  }

  state.tickId = setInterval(tick, 250);
}

function tick(){
  if(!state.isRunning) return;

  const now = performance.now();
  state.elapsedSeconds = (now - state.startTime) / 1000;

  if(state.mode === "timed"){
    const rem = state.durationSeconds - state.elapsedSeconds;
    state.remainingSeconds = rem;
    els.timerValue.textContent = formatMMSS(rem);

    if(rem <= 0){
      finishTest();
      return;
    }
  } else {
    // words mode shows elapsed mm:ss
    els.timerValue.textContent = formatMMSS(state.elapsedSeconds);
  }

  updateMetricsUI(true);
}

function computeStats(){
  const elapsed = Math.max(0.001, state.elapsedSeconds);
  const correct = state.correctChars;
  const totalTyped = state.totalTypedChars;

  const wpm = (correct / 5) / (elapsed / 60);
  const acc = totalTyped === 0 ? 100 : (correct / totalTyped) * 100;

  return {
    elapsed,
    wpm: Math.max(0, wpm),
    accuracy: clamp(acc, 0, 100),
    errors: state.incorrectChars,
    totalTyped,
    correct,
  };
}

function updateMetricsUI(animateTick=false){
  const { wpm, accuracy, errors } = computeStats();

  setTextTick(els.wpmValue, Math.round(wpm));
  setTextTick(els.accValue, `${Math.round(accuracy)}%`);
  setTextTick(els.errValue, errors);

  // Progress based on characters typed vs target text length
  const progress = state.targetText.length === 0
    ? 0
    : clamp((state.typedValue.length / state.targetText.length) * 100, 0, 100);

  els.progressText.textContent = `${Math.floor(progress)}%`;
  els.progressFill.style.width = `${progress}%`;

  if(animateTick){
    // tiny "tick" animation on stat cards
    pulseStatCard(els.wpmValue);
    pulseStatCard(els.accValue);
    pulseStatCard(els.errValue);
  }
}

function pulseStatCard(valueEl){
  const card = valueEl.closest(".stat");
  if(!card) return;
  card.classList.add("tick");
  setTimeout(() => card.classList.remove("tick"), 120);
}

function setTextTick(el, value){
  const next = String(value);
  if(el.textContent !== next){
    el.textContent = next;
  }
}

function updateComparison(){
  const typed = state.typedValue;
  const target = state.targetText;
  const spans = getSpans();

  let correct = 0;
  let incorrect = 0;

  const len = Math.max(target.length, typed.length);

  for(let i=0;i<spans.length;i++){
    const span = spans[i];
    span.classList.remove("correct", "incorrect", "pending", "caret");

    const tChar = target[i];
    const uChar = typed[i];

    if(uChar == null){
      span.classList.add("pending");
    } else if(uChar === tChar){
      span.classList.add("correct");
      correct++;
    } else {
      span.classList.add("incorrect");
      incorrect++;
    }
  }

  // caret highlight at current index (within target bounds)
  const caretIndex = clamp(typed.length, 0, spans.length - 1);
  if(spans[caretIndex]) spans[caretIndex].classList.add("caret");

  state.correctChars = correct;
  state.incorrectChars = incorrect;
  state.totalTypedChars = typed.length;

  // Words mode end condition (simple): count completed words in typed input
  if(state.mode === "words" && state.isRunning && !state.isFinished){
    const typedWords = typed.trim().length === 0 ? 0 : typed.trim().split(/\s+/).length;
    if(typedWords >= state.wordTarget){
      finishTest();
      return;
    }
  }

  // If user finishes the whole text in timed mode, end early (default choice)
  if(state.mode === "timed" && state.isRunning && !state.isFinished){
    if(typed.length >= target.length){
      finishTest();
      return;
    }
  }

  updateMetricsUI(false);
}

function finishTest(){
  if(state.isFinished) return;
  state.isFinished = true;
  state.isRunning = false;

  if(state.tickId){
    clearInterval(state.tickId);
    state.tickId = null;
  }

  els.typeInput.disabled = true;

  // Final metric update and modal
  const stats = computeStats();
  showResults(stats);
  saveHistory(stats);
  renderHistory();
}

function resetTest({ newText=false } = {}){
  if(state.tickId){
    clearInterval(state.tickId);
    state.tickId = null;
  }

  state.isRunning = false;
  state.isFinished = false;
  state.startTime = null;
  state.elapsedSeconds = 0;
  state.typedValue = "";
  state.correctChars = 0;
  state.incorrectChars = 0;
  state.totalTypedChars = 0;

  // reset timer display
  if(state.mode === "timed"){
    state.remainingSeconds = state.durationSeconds;
    els.timerValue.textContent = formatMMSS(state.durationSeconds);
  } else {
    els.timerValue.textContent = formatMMSS(0);
  }

  els.typeInput.value = "";
  els.typeInput.disabled = false;

  if(newText){
    state.targetText = buildTargetText();
    renderTargetText(state.targetText);
  } else {
    // keep same text, just rerender for clean classes
    renderTargetText(state.targetText);
  }

  els.hintText.textContent = "Start typing to begin. Paste is disabled for fairness.";
  updateMetricsUI(false);
  closeModal();
  els.typeInput.focus();
}

function showResults(stats){
  els.finalWpm.textContent = String(Math.round(stats.wpm));
  els.finalAcc.textContent = `${Math.round(stats.accuracy)}%`;
  els.finalErr.textContent = String(stats.errors);

  // time shown: elapsed (words) or duration-elapsed (timed?) => spec says show Time; we show elapsed
  const shownSec = state.mode === "timed" ? Math.min(state.durationSeconds, stats.elapsed) : stats.elapsed;
  els.finalTime.textContent = `${Math.round(shownSec)}s`;
  els.finalChars.textContent = String(stats.totalTyped);

  // CSS-only bar vibe (scale to sensible caps)
  const wpmCap = 140; // adjust as you like
  els.barWpm.style.width = `${clamp((stats.wpm / wpmCap) * 100, 0, 100)}%`;
  els.barAcc.style.width = `${clamp(stats.accuracy, 0, 100)}%`;

  openModal();
}

function openModal(){
  els.modalBackdrop.classList.add("open");
  els.modalBackdrop.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal(){
  els.modalBackdrop.classList.remove("open");
  els.modalBackdrop.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function loadHistory(){
  try{
    const raw = localStorage.getItem(HISTORY_KEY);
    if(!raw) return [];
    const parsed = JSON.parse(raw);
    if(!Array.isArray(parsed)) return [];
    return parsed;
  }catch{
    return [];
  }
}

function saveHistory(stats){
  const item = {
    date: new Date().toISOString(),
    mode: state.mode,
    difficulty: state.difficulty,
    durationSeconds: state.durationSeconds,
    wordTarget: state.wordTarget,
    wpm: Math.round(stats.wpm),
    accuracy: Math.round(stats.accuracy),
    errors: stats.errors,
    timeSec: Math.round(state.mode === "timed" ? Math.min(state.durationSeconds, stats.elapsed) : stats.elapsed),
    chars: stats.totalTyped
  };

  const history = loadHistory();
  history.unshift(item);
  const trimmed = history.slice(0, 5);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

function renderHistory(){
  const history = loadHistory();
  if(history.length === 0){
    els.historyList.innerHTML = `<p class="muted">No history yet. Complete a test to see results here.</p>`;
    return;
  }

  els.historyList.innerHTML = "";
  for(const h of history){
    const div = document.createElement("div");
    div.className = "history-item";
    const d = new Date(h.date);

    const left = document.createElement("div");
    left.innerHTML = `
      <b>${h.wpm} WPM • ${h.accuracy}%</b>
      <div class="meta">
        ${h.mode.toUpperCase()} • ${h.difficulty.toUpperCase()}
        • ${h.mode === "timed" ? `${h.durationSeconds}s` : `${h.wordTarget}w`}
        • ${d.toLocaleString()}
      </div>
    `;

    const right = document.createElement("div");
    right.className = "meta";
    right.style.textAlign = "right";
    right.innerHTML = `
      Errors: ${h.errors}<br/>
      Time: ${h.timeSec}s<br/>
      Chars: ${h.chars}
    `;

    div.appendChild(left);
    div.appendChild(right);
    els.historyList.appendChild(div);
  }
}

/* ===== UI behavior ===== */

function applyModeUI(){
  const mode = els.modeSelect.value;
  state.mode = mode;

  if(mode === "timed"){
    els.durationWrap.classList.remove("hidden");
    els.wordsWrap.classList.add("hidden");
    state.durationSeconds = Number(els.durationSelect.value);
    els.timerValue.textContent = formatMMSS(state.durationSeconds);
  } else {
    els.wordsWrap.classList.remove("hidden");
    els.durationWrap.classList.add("hidden");
    state.wordTarget = Number(els.wordsSelect.value);
    els.timerValue.textContent = formatMMSS(0);
  }

  // regenerate text because requirements changed
  state.targetText = buildTargetText();
  resetTest({ newText:false });
}

function applyDifficulty(){
  state.difficulty = els.difficultySelect.value;
  state.targetText = buildTargetText();
  resetTest({ newText:false });
}

function applyDuration(){
  state.durationSeconds = Number(els.durationSelect.value);
  if(state.mode === "timed" && !state.isRunning){
    els.timerValue.textContent = formatMMSS(state.durationSeconds);
  }
}

function applyWordTarget(){
  state.wordTarget = Number(els.wordsSelect.value);
}

function toggleTheme(){
  const root = document.documentElement;
  const current = root.getAttribute("data-theme");
  const next = current === "light" ? "dark" : "light";
  root.setAttribute("data-theme", next);
  localStorage.setItem("typing_theme", next);
}

function loadTheme(){
  const saved = localStorage.getItem("typing_theme");
  if(saved === "light" || saved === "dark"){
    document.documentElement.setAttribute("data-theme", saved);
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
  }
}

function setupReveal(){
  const io = new IntersectionObserver((entries)=>{
    for(const e of entries){
      if(e.isIntersecting){
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.12 });

  document.querySelectorAll(".reveal").forEach(el => io.observe(el));
}

/* ===== Event bindings ===== */

els.typeInput.addEventListener("paste", preventPaste);

els.typeInput.addEventListener("input", (e)=>{
  // start on first keystroke
  startTestIfNeeded();

  state.typedValue = e.target.value;
  updateComparison();
});

els.modeSelect.addEventListener("change", applyModeUI);

els.durationSelect.addEventListener("change", ()=>{
  applyDuration();
  resetTest({ newText:false });
});

els.wordsSelect.addEventListener("change", ()=>{
  applyWordTarget();
  resetTest({ newText:false });
});

els.difficultySelect.addEventListener("change", applyDifficulty);

els.resetBtn.addEventListener("click", ()=> resetTest({ newText:false }));

els.newTextBtn.addEventListener("click", ()=>{
  state.targetText = buildTargetText();
  resetTest({ newText:false });
});

els.themeBtn.addEventListener("click", toggleTheme);

els.modalBackdrop.addEventListener("click", (e)=>{
  if(e.target === els.modalBackdrop) closeModal();
});
els.closeModalBtn.addEventListener("click", closeModal);

els.retryBtn.addEventListener("click", ()=>{
  resetTest({ newText:false });
});

els.modalNewTextBtn.addEventListener("click", ()=>{
  state.targetText = buildTargetText();
  resetTest({ newText:false });
});

els.clearHistoryBtn.addEventListener("click", ()=>{
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

els.scrollTopBtn.addEventListener("click", ()=>{
  document.getElementById("topbar").scrollIntoView({ behavior: "smooth" });
});

els.toHistory.addEventListener("click", (e)=>{
  e.preventDefault();
  document.getElementById("history").scrollIntoView({ behavior: "smooth" });
});

els.toInstructions.addEventListener("click", (e)=>{
  e.preventDefault();
  document.getElementById("instructions").scrollIntoView({ behavior: "smooth" });
});

// ESC closes modal
document.addEventListener("keydown", (e)=>{
  if(e.key === "Escape") closeModal();
});

/* ===== Init ===== */
function init(){
  loadTheme();
  setupReveal();

  // initial state
  state.mode = els.modeSelect.value;
  state.durationSeconds = Number(els.durationSelect.value);
  state.wordTarget = Number(els.wordsSelect.value);
  state.difficulty = els.difficultySelect.value;

  state.targetText = buildTargetText();
  renderTargetText(state.targetText);

  els.timerValue.textContent = formatMMSS(state.durationSeconds);
  updateMetricsUI(false);
  renderHistory();

  // focus input
  els.typeInput.focus();
}

init();
