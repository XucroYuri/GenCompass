require('dotenv').config();
const express = require('express');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const SAVES_DIR = path.join(__dirname, 'data', 'saves');
const DB_PATH = path.join(__dirname, 'data', 'users.db');
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_key_change_me';

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// Initialize Database
const db = new sqlite3.Database(DB_PATH);
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password_hash TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS game_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      dungeon_name TEXT,
      world_type TEXT,
      system_type TEXT,
      ending_rank TEXT,
      ending_title TEXT,
      ending_desc TEXT,
      rounds INTEGER,
      completed_at TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      achievement_key TEXT,
      achievement_name TEXT,
      achievement_desc TEXT,
      unlocked_at TEXT,
      UNIQUE(username, achievement_key)
    )
  `);
});

// Read the base prompt
const BASE_PROMPT = fs.readFileSync(path.join(__dirname, 'docs', 'prompt.txt'), 'utf-8');

// Append formatting instructions so the frontend can parse structured output
const FORMAT_INSTRUCTIONS = `

【输出格式补充说明】
为了在游戏界面中正确展示，请遵循以下格式规范：
1. 叙事描写和对话内容正常输出即可。如果是系统本身在对玩家说话或进行旁白提示，请务必加上前缀（例如：“【001号系统】：...”）。如果是其他角色说话，也要标明角色名字。
2. 当你提供选项时，请务必使用以下精确格式：
===选项开始===
1. 选项内容
2. 选项内容
3. 选项内容
4. 其他（自行描述）
===选项结束===

3. 当展示新角色信息时，请使用：
===角色信息===
姓名：xxx
性别：xxx
年龄：xxx
身份：xxx
性格：xxx
外貌：xxx
===角色信息结束===

4. 当展示或更新任务时：
===任务===
【类型】限时任务/长期任务
【任务名】xxx
【描述】xxx
【状态】进行中/已完成/已失败
===任务结束===

5. 系统自身的状态摘要（每次回复末尾附上）：
===系统状态===
【副本世界观】xxx
【系统类型】xxx
【系统性格】xxx
===系统状态结束===

6. 副本开始时，必须在第一次回复中输出副本基础信息：
===副本信息===
【副本名称】xxx（为本次副本取一个有意境的名字）
【核心目标】xxx（本副本的主线目标，玩家需要达成的终极目的）
【世界观】xxx
【系统类型】xxx
===副本信息结束===

7. 当故事走到终点时（主线目标达成或失败、或触发特殊结局），你必须输出结局标记：
===副本结局===
【结局等级】S/A/B/C/?（只输出一个字母）
【结局标题】xxx（用一个短语概括这个结局）
【结局描述】xxx（2-3句话的结局总结）
===副本结局结束===

结局等级判定标准：
- S（完美结局）：主线目标完美达成，所有支线任务完成，关键抉择做出了最优选择
- A（好结局）：主线目标达成，大部分支线任务完成
- B（普通结局）：主线目标勉强达成，但过程中有较多遗憾
- C（坏结局）：主线目标失败，或关键角色遭遇不可挽回的结果
- ?（隐藏结局）：玩家的选择触发了出乎意料的特殊路线，走向了完全不同的方向

【副本节奏规则】
每条玩家消息会标注当前回合数，如"[第12轮/约50轮]"。你需要根据回合进度自然控制叙事节奏：
- 第1-15轮：铺设世界观，介绍角色，展开初始冲突，颁布首个任务
- 第16-35轮：深化矛盾，推进主线，穿插支线任务和角色发展
- 第36-45轮：推向高潮，关键抉择出现，伏笔回收
- 第46-50轮：进入收束，必须在这个阶段内推动故事走向结局
- 超过50轮：必须在最近1-2轮内结束故事并输出结局标记
注意：这是软性指引，故事可以在任何时刻因为剧情需要提前结束（比如玩家的选择导致了意外的结局），但不应无限拖延。

请严格遵循以上标记格式，其余内容自由发挥。`;

const SYSTEM_PROMPT = BASE_PROMPT + FORMAT_INSTRUCTIONS;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.API_KEY,
  baseURL: process.env.API_BASE_URL || 'https://api.openai.com/v1',
});
const MODEL = process.env.MODEL || 'gpt-4o';

// In-memory game sessions (keyed by sessionId)
const sessions = {};

function getSession(sessionId) {
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      id: sessionId,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }],
      metadata: {},
      roundCount: 0,
      createdAt: new Date().toISOString(),
    };
  }
  return sessions[sessionId];
}

// --- Middleware ---

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未登录' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: '登录已过期' });
    req.user = user;
    next();
  });
}

function getUserSavesDir(username) {
  // Use simple hash/encoding to prevent directory traversal
  const safeName = encodeURIComponent(username);
  const dir = path.join(SAVES_DIR, safeName);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// --- Auth Routes ---

app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码必填' });
  if (username.length < 2 || password.length < 4) return res.status(400).json({ error: '用户名至少2位，密码至少4位' });

  db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
    if (err) return res.status(500).json({ error: '数据库错误' });
    if (row) return res.status(400).json({ error: '用户名已存在' });

    const hash = bcrypt.hashSync(password, 10);
    db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash], function(err) {
      if (err) return res.status(500).json({ error: '注册失败' });
      
      const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ success: true, token, username });
    });
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码必填' });

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).json({ error: '数据库错误' });
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, username: user.username });
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ username: req.user.username });
});

// --- API Routes ---

// GET /api/status — check API config
app.get('/api/status', authenticateToken, (req, res) => {
  res.json({
    configured: !!process.env.API_KEY && process.env.API_KEY !== 'sk-your-api-key-here',
    baseUrl: process.env.API_BASE_URL || 'https://api.openai.com/v1',
    model: MODEL,
  });
});

// POST /api/game/start — begin a new game
app.post('/api/game/start', authenticateToken, async (req, res) => {
  try {
    const sessionId = uuidv4();
    const session = getSession(sessionId);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Session-Id', sessionId);

    // Send sessionId first
    res.write(`data: ${JSON.stringify({ type: 'session', sessionId })}\n\n`);

    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages: session.messages,
      stream: true,
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        res.write(`data: ${JSON.stringify({ type: 'content', content })}\n\n`);
      }
    }

    session.messages.push({ role: 'assistant', content: fullContent });
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Game start error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
      res.end();
    }
  }
});

// POST /api/game/action — send player action
app.post('/api/game/action', authenticateToken, async (req, res) => {
  try {
    const { sessionId, action } = req.body;
    if (!sessionId || !sessions[sessionId]) {
      return res.status(400).json({ error: '无效的游戏会话' });
    }

    const session = sessions[sessionId];
    session.roundCount = (session.roundCount || 0) + 1;
    const roundTag = `[第${session.roundCount}轮/约50轮]`;
    const taggedAction = `${roundTag} ${action}`;
    session.messages.push({ role: 'user', content: taggedAction });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send round count to frontend
    res.write(`data: ${JSON.stringify({ type: 'round', round: session.roundCount })}\n\n`);

    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages: session.messages,
      stream: true,
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        res.write(`data: ${JSON.stringify({ type: 'content', content })}\n\n`);
      }
    }

    session.messages.push({ role: 'assistant', content: fullContent });
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Action error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
      res.end();
    }
  }
});

// GET /api/saves — list all saves
app.get('/api/saves', authenticateToken, (req, res) => {
  const saves = [];
  const userDir = getUserSavesDir(req.user.username);
  
  for (let i = 1; i <= 6; i++) {
    const filePath = path.join(userDir, `save_${i}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        saves.push({ slot: i, savedAt: data.savedAt, metadata: data.metadata, hasData: true });
      } catch { saves.push({ slot: i, hasData: false }); }
    } else {
      saves.push({ slot: i, hasData: false });
    }
  }
  res.json(saves);
});

// POST /api/saves/:slot — save game
app.post('/api/saves/:slot', authenticateToken, (req, res) => {
  const slot = parseInt(req.params.slot);
  if (slot < 1 || slot > 6) return res.status(400).json({ error: '存档位无效 (1-6)' });

  const { sessionId } = req.body;
  if (!sessionId || !sessions[sessionId]) {
    return res.status(400).json({ error: '无效的游戏会话' });
  }

  const session = sessions[sessionId];
  const saveData = {
    slot,
    savedAt: new Date().toISOString(),
    metadata: session.metadata,
    roundCount: session.roundCount || 0,
    messages: session.messages,
  };

  const userDir = getUserSavesDir(req.user.username);
  const filePath = path.join(userDir, `save_${slot}.json`);
  fs.writeFileSync(filePath, JSON.stringify(saveData, null, 2), 'utf-8');
  res.json({ success: true, slot });
});

// GET /api/saves/:slot — load game
app.get('/api/saves/:slot', authenticateToken, (req, res) => {
  const slot = parseInt(req.params.slot);
  const userDir = getUserSavesDir(req.user.username);
  const filePath = path.join(userDir, `save_${slot}.json`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '存档不存在' });
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    // Restore session in memory
    const sessionId = uuidv4();
    sessions[sessionId] = {
      id: sessionId,
      messages: data.messages,
      metadata: data.metadata || {},
      roundCount: data.roundCount || 0,
      createdAt: data.savedAt,
    };
    res.json({ success: true, sessionId, messages: data.messages, metadata: data.metadata, roundCount: data.roundCount || 0 });
  } catch (err) {
    res.status(500).json({ error: '读取存档失败' });
  }
});

// DELETE /api/saves/:slot — delete save
app.delete('/api/saves/:slot', authenticateToken, (req, res) => {
  const slot = parseInt(req.params.slot);
  const userDir = getUserSavesDir(req.user.username);
  const filePath = path.join(userDir, `save_${slot}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  res.json({ success: true });
});

// --- Achievement Definitions ---
const ACHIEVEMENT_DEFS = {
  first_clear:  { name: '初涉副本',   desc: '首次通关任意副本' },
  first_s:      { name: '完美通关',   desc: '首次获得 S 评价' },
  first_hidden: { name: '命运的分岔', desc: '首次触发隐藏结局(?)' },
  clear_3:      { name: '副本探索者', desc: '累计通关 3 个副本' },
  clear_10:     { name: '老练冒险者', desc: '累计通关 10 个副本' },
  world_5:      { name: '万界旅人',   desc: '体验过 5 种不同世界观' },
  all_ranks:    { name: '命运书写者', desc: '集齐 S/A/B/C 四种结局' },
};

// Helper: check and unlock achievements after a game completion
function checkAchievements(username, userId, callback) {
  const newlyUnlocked = [];
  const now = new Date().toISOString();

  db.all('SELECT * FROM game_records WHERE username = ?', [username], (err, records) => {
    if (err || !records) return callback([]);

    db.all('SELECT achievement_key FROM achievements WHERE username = ?', [username], (err2, existing) => {
      const owned = new Set((existing || []).map(a => a.achievement_key));
      const toCheck = [];

      // first_clear
      if (!owned.has('first_clear') && records.length >= 1) {
        toCheck.push('first_clear');
      }
      // first_s
      if (!owned.has('first_s') && records.some(r => r.ending_rank === 'S')) {
        toCheck.push('first_s');
      }
      // first_hidden
      if (!owned.has('first_hidden') && records.some(r => r.ending_rank === '?')) {
        toCheck.push('first_hidden');
      }
      // clear_3
      if (!owned.has('clear_3') && records.length >= 3) {
        toCheck.push('clear_3');
      }
      // clear_10
      if (!owned.has('clear_10') && records.length >= 10) {
        toCheck.push('clear_10');
      }
      // world_5
      if (!owned.has('world_5')) {
        const worlds = new Set(records.map(r => r.world_type).filter(Boolean));
        if (worlds.size >= 5) toCheck.push('world_5');
      }
      // all_ranks
      if (!owned.has('all_ranks')) {
        const ranks = new Set(records.map(r => r.ending_rank).filter(Boolean));
        if (['S','A','B','C'].every(r => ranks.has(r))) toCheck.push('all_ranks');
      }

      if (toCheck.length === 0) return callback([]);

      let done = 0;
      toCheck.forEach(key => {
        const def = ACHIEVEMENT_DEFS[key];
        db.run(
          'INSERT OR IGNORE INTO achievements (user_id, username, achievement_key, achievement_name, achievement_desc, unlocked_at) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, username, key, def.name, def.desc, now],
          function(insertErr) {
            if (!insertErr && this.changes > 0) {
              newlyUnlocked.push({ key, name: def.name, desc: def.desc });
            }
            done++;
            if (done === toCheck.length) callback(newlyUnlocked);
          }
        );
      });
    });
  });
}

// POST /api/game/complete — record a completed game
app.post('/api/game/complete', authenticateToken, (req, res) => {
  const { sessionId, dungeonName, worldType, systemType, endingRank, endingTitle, endingDesc } = req.body;
  if (!sessionId || !sessions[sessionId]) {
    return res.status(400).json({ error: '无效的游戏会话' });
  }

  const session = sessions[sessionId];
  const rounds = session.roundCount || 0;
  const now = new Date().toISOString();
  const username = req.user.username;
  const userId = req.user.id;

  db.run(
    `INSERT INTO game_records (user_id, username, dungeon_name, world_type, system_type, ending_rank, ending_title, ending_desc, rounds, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, username, dungeonName || '未知副本', worldType || '未知', systemType || '未知', endingRank || 'B', endingTitle || '结局', endingDesc || '', rounds, now],
    function(insertErr) {
      if (insertErr) return res.status(500).json({ error: '保存记录失败' });

      checkAchievements(username, userId, (newAchievements) => {
        res.json({ success: true, recordId: this.lastID, newAchievements });
      });
    }
  );
});

// GET /api/records — get user's game records
app.get('/api/records', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM game_records WHERE username = ? ORDER BY completed_at DESC',
    [req.user.username],
    (err, rows) => {
      if (err) return res.status(500).json({ error: '查询失败' });
      res.json(rows || []);
    }
  );
});

// GET /api/achievements — get user's achievements
app.get('/api/achievements', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM achievements WHERE username = ? ORDER BY unlocked_at ASC',
    [req.user.username],
    (err, rows) => {
      if (err) return res.status(500).json({ error: '查询失败' });

      // Also send all possible achievements for display
      const all = Object.entries(ACHIEVEMENT_DEFS).map(([key, def]) => {
        const unlocked = (rows || []).find(r => r.achievement_key === key);
        return {
          key,
          name: def.name,
          desc: def.desc,
          unlocked: !!unlocked,
          unlockedAt: unlocked ? unlocked.unlocked_at : null,
        };
      });
      res.json(all);
    }
  );
});

// GET /api/gallery — get dungeon gallery (unique world+system combos)
app.get('/api/gallery', authenticateToken, (req, res) => {
  db.all(
    'SELECT DISTINCT world_type, system_type, dungeon_name, ending_rank, completed_at FROM game_records WHERE username = ? ORDER BY completed_at DESC',
    [req.user.username],
    (err, rows) => {
      if (err) return res.status(500).json({ error: '查询失败' });
      res.json(rows || []);
    }
  );
});

app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║   AI 副本游戏 — 服务器已启动          ║`);
  console.log(`  ║   地址: http://localhost:${PORT}         ║`);
  console.log(`  ║   模型: ${MODEL.padEnd(27)}║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);
});
