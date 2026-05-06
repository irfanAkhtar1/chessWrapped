const express = require('express');
const path = require('path');

const app = express();

// Serve frontend
app.use(express.static(path.join(__dirname, '../public')));

// ─── HELPERS ─────────────────────────────────────────
const getYear = g => new Date((g?.end_time || 0) * 1000).getFullYear();

// ─── FETCH 2025 GAMES ────────────────────────────────
async function fetch2025Games(username) {
  const archRes = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
  if (!archRes.ok) throw new Error('Player not found');

  const { archives = [] } = await archRes.json();
  const games = [];

  for (const url of archives) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const { games: g = [] } = await r.json();
      games.push(...g.filter(x => getYear(x) === 2025));
    } catch { continue; }
  }

  return games;
}

// ─── PROFILE ─────────────────────────────────────────
async function fetchProfile(username) {
  try {
    const [profileRes, statsRes] = await Promise.all([
      fetch(`https://api.chess.com/pub/player/${username}`),
      fetch(`https://api.chess.com/pub/player/${username}/stats`)
    ]);

    const profile = profileRes.ok ? await profileRes.json() : {};
    const stats = statsRes.ok ? await statsRes.json() : {};

    const ratings = {};
    for (const [key, label] of [
      ['chess_rapid', 'Rapid'],
      ['chess_blitz', 'Blitz'],
      ['chess_bullet', 'Bullet']
    ]) {
      const r = stats[key]?.last?.rating;
      if (r) ratings[label] = r;
    }

    return { avatarUrl: profile.avatar || null, ratings };
  } catch {
    return { avatarUrl: null, ratings: {} };
  }
}

// ─── API ─────────────────────────────────────────────
app.get('/api/stats/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const [games, { avatarUrl, ratings }] = await Promise.all([
      fetch2025Games(username),
      fetchProfile(username)
    ]);

    const lower = username.toLowerCase();
    let wins = 0, streak = 0, bestStreak = 0;
    const breakdown = { rapid: 0, bullet: 0, blitz: 0 };

    for (const g of games) {
      const isWhite = g?.white?.username?.toLowerCase() === lower;
      const result = isWhite ? g?.white?.result : g?.black?.result;

      if (result === 'win') {
        wins++;
        bestStreak = Math.max(bestStreak, ++streak);
      } else {
        streak = 0;
      }

      const tc = g?.time_class;
      if (tc in breakdown) breakdown[tc]++;
    }

    const total = games.length;
    const winRate = total ? +(wins / total * 100).toFixed(1) : 0;

    let personality = { type: 'Balanced Player', desc: 'Classic chess enjoyer' };
    if (total > 2000) personality = { type: 'Grind Lord', desc: 'You live on Chess.com' };
    else if (winRate > 60) personality = { type: 'Chess Assassin', desc: 'Clean dominance' };
    else if (breakdown.bullet > breakdown.rapid) personality = { type: 'Speed Demon', desc: 'Fast & chaotic' };

    const roast =
      total > 3000 ? 'Bro is farming Chess.com like a job 💀'
        : winRate < 45 ? 'You donate pieces professionally.'
          : winRate > 65 ? 'Okay Magnus, relax.'
            : 'Solid player. Nothing to roast here.';

    res.json({
      username,
      avatarUrl,
      totalGames: total,
      winRate,
      bestStreak,
      timeControlBreakdown: breakdown,
      ratings,
      personality,
      roast
    });

  } catch (err) {
    res.status(404).json({ error: err.message || 'Server error' });
  }
});

// ✅ THIS is what Vercel needs
module.exports = app;

// ✅ Local testing only
if (process.env.NODE_ENV !== 'production') {
  const PORT = 3000;
  app.listen(PORT, () => console.log(`Local → http://localhost:${PORT}`));
}
