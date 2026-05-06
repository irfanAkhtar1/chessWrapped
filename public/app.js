// ─── ELEMENTS ────────────────────────────────────────────────────────────────
const landing = document.getElementById('landing');
const scene = document.getElementById('scene');
const errEl = document.getElementById('err');
const goBtn = document.getElementById('go-btn');
const usernameEl = document.getElementById('username');
const resetBtn = document.getElementById('reset-btn');
const cards = document.querySelectorAll('.card');

// ─── CANVAS BG ───────────────────────────────────────────────────────────────
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
let offset = 0;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function drawBg() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const size = 80;
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;

  const cols = Math.ceil(canvas.width / size) + 2;
  const rows = Math.ceil(canvas.height / size) + 2;
  const ox = offset % size;

  for (let x = -1; x < cols; x++) {
    ctx.beginPath();
    ctx.moveTo(x * size + ox, 0);
    ctx.lineTo(x * size + ox, canvas.height);
    ctx.stroke();
  }
  for (let y = -1; y < rows; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * size + ox);
    ctx.lineTo(canvas.width, y * size + ox);
    ctx.stroke();
  }
  offset += 0.3;
  requestAnimationFrame(drawBg);
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);
drawBg();

// ─── EVENTS ──────────────────────────────────────────────────────────────────
goBtn.addEventListener('click', analyze);
usernameEl.addEventListener('keypress', e => e.key === 'Enter' && analyze());
resetBtn.addEventListener('click', () => {
  scene.style.display = 'none';
  landing.style.display = 'flex';
  usernameEl.value = '';
});

// ─── FETCH ───────────────────────────────────────────────────────────────────
async function analyze() {
  const user = usernameEl.value.trim();
  if (!user) return setErr('Enter a username');
  setErr('');
  goBtn.disabled = true;
  goBtn.textContent = 'LOADING...';

  try {
    const res = await fetch(`/api/stats/${user}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    render(data);
  } catch (e) {
    setErr(e.message);
  } finally {
    goBtn.disabled = false;
    goBtn.textContent = 'GO →';
  }
}

// ─── RENDER ──────────────────────────────────────────────────────────────────
function render(d) {
  const b = d.timeControlBreakdown || {};

  // Profile pic
  const pfpImg = document.getElementById('pfp');
  const pfpFallback = document.getElementById('pfp-fallback');
  if (d.avatarUrl) {
    pfpImg.src = d.avatarUrl;
    pfpImg.style.display = 'block';
    pfpFallback.style.display = 'none';
  } else {
    pfpImg.style.display = 'none';
    pfpFallback.style.display = 'flex';
    pfpFallback.textContent = d.username[0].toUpperCase();
  }

  document.getElementById('card-username').textContent = d.username;

  // Game type trio
  document.getElementById('trio-games').innerHTML =
    ['rapid', 'bullet', 'blitz'].map(t =>
      `<div class="trio-item">
        <span class="trio-val">${b[t] ?? 0}</span>
        <span class="trio-label">${t}</span>
      </div>`).join('');

  // Fav time control
  const fav = (b.rapid >= b.bullet && b.rapid >= b.blitz) ? 'Rapid'
    : b.bullet >= b.blitz ? 'Bullet' : 'Blitz';
  document.getElementById('fav-tc').textContent = fav;

  // Ratings
  const ratings = d.ratings || {};
  document.getElementById('ratings').innerHTML =
    Object.entries(ratings).map(([k, v]) =>
      `<div class="r-item">
        <span class="r-val">${v}</span>
        <span class="r-label">${k}</span>
      </div>`).join('') || '';

  // Persona & roast
  document.getElementById('persona-type').textContent = d.personality?.type || '';
  document.getElementById('persona-desc').textContent = d.personality?.desc || '';
  document.getElementById('roast').textContent = d.roast || '';

  // Badges
  if ((d.winRate || 0) > 55) document.getElementById('win-badge').style.display = 'inline-block';
  if ((d.bestStreak || 0) > 5) document.getElementById('streak-fire').style.display = 'block';

  // Show scene
  landing.style.display = 'none';
  scene.style.display = 'block';
  initCards(d);
}

// ─── CARD SYSTEM ─────────────────────────────────────────────────────────────
let currentCard = 0;

function initCards(d) {
  currentCard = 0;
  buildDots();
  scrollToCard(0);

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      if (el.classList.contains('c-games')) countUp('total-games', d.totalGames);
      if (el.classList.contains('c-wins')) countUpFloat('win-rate', d.winRate);
      if (el.classList.contains('c-streak')) countUp('best-streak', d.bestStreak);
      el.classList.add('card-in');
      updateDots(Array.from(cards).indexOf(el));
    });
  }, { threshold: 0.6 });

  cards.forEach(c => io.observe(c));

  // 3D tilt
  cards.forEach(card => {
    const inner = card.querySelector('.card-3d');
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const rx = ((e.clientY - cy) / (r.height / 2)) * -10;
      const ry = ((e.clientX - cx) / (r.width / 2)) * 10;
      inner.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(10px)`;
    });
    card.addEventListener('mouseleave', () => {
      inner.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
    });
  });

  // Keyboard nav
  document.onkeydown = e => {
    if (e.key === 'ArrowDown' || e.key === ' ') {
      e.preventDefault();
      scrollToCard(Math.min(currentCard + 1, cards.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      scrollToCard(Math.max(currentCard - 1, 0));
    }
  };
}

function scrollToCard(idx) {
  cards[idx]?.scrollIntoView({ behavior: 'smooth' });
  updateDots(idx);
  currentCard = idx;
}

function buildDots() {
  const dotsEl = document.getElementById('progress-dots');
  dotsEl.innerHTML = '';
  cards.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'dot' + (i === 0 ? ' active' : '');
    d.onclick = () => scrollToCard(i);
    dotsEl.appendChild(d);
  });
}

function updateDots(idx) {
  currentCard = idx;
  document.querySelectorAll('.dot').forEach((d, i) =>
    d.classList.toggle('active', i === idx));
}

// ─── COUNT UP ────────────────────────────────────────────────────────────────
function countUp(id, end) {
  const el = document.getElementById(id);
  if (!el || !end) return;
  const t0 = Date.now();
  const dur = 1500;
  (function tick() {
    const p = Math.min((Date.now() - t0) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 4);
    el.textContent = Math.floor(ease * end);
    if (p < 1) requestAnimationFrame(tick);
  })();
}

function countUpFloat(id, end) {
  const el = document.getElementById(id);
  if (!el || !end) return;
  const t0 = Date.now();
  const dur = 1500;
  (function tick() {
    const p = Math.min((Date.now() - t0) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 4);
    el.innerHTML = (ease * end).toFixed(1) + '<span class="pct">%</span>';
    if (p < 1) requestAnimationFrame(tick);
  })();
}

function setErr(msg) { errEl.textContent = msg; }
