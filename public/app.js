/* =============================================
   AI 副本游戏 — Frontend App
   ============================================= */

(function () {
  'use strict';

  // --- State ---
  const state = {
    sessionId: null,
    screen: 'auth',
    isStreaming: false,
    streamBuffer: '',
    characters: {},
    tasks: {},
    roundCount: 0,
    gameEnded: false,
    dungeonInfo: {},
    token: localStorage.getItem('rangame_token') || null,
    username: localStorage.getItem('rangame_username') || null,
    currentRoundEl: null,
  };

  // --- DOM Refs ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    screenAuth: $('#screen-auth'),
    screenMenu: $('#screen-menu'),
    screenGame: $('#screen-game'),
    inputUsername: $('#input-username'),
    inputPassword: $('#input-password'),
    btnLogin: $('#btn-login'),
    btnRegister: $('#btn-register'),
    authStatus: $('#auth-status'),
    menuUserStatus: $('#menu-user-status'),
    btnNewGame: $('#btn-new-game'),
    btnLoadGame: $('#btn-load-game'),
    btnLogout: $('#btn-logout'),
    btnProfile: $('#btn-profile'),
    btnGallery: $('#btn-gallery'),
    storyContent: $('#story-content'),
    storyScroll: $('#story-scroll'),
    storyLoading: $('#story-loading'),
    choicesContainer: $('#choices-container'),
    inputAction: $('#input-action'),
    btnSendAction: $('#btn-send-action'),
    btnSaveGame: $('#btn-save-game'),
    btnBackMenu: $('#btn-back-menu'),
    characterInfo: $('#character-info'),
    systemInfo: $('#system-info'),
    taskInfo: $('#task-info'),
    dungeonInfo: $('#dungeon-info'),
    roundCounter: $('#round-counter'),
    endingOverlay: $('#ending-overlay'),
    endingRankDisplay: $('#ending-rank-display'),
    endingTitleDisplay: $('#ending-title-display'),
    endingDescDisplay: $('#ending-desc-display'),
    endingDungeonName: $('#ending-dungeon-name'),
    endingRounds: $('#ending-rounds'),
    endingWorld: $('#ending-world'),
    endingAchievements: $('#ending-achievements'),
    btnEndingMenu: $('#btn-ending-menu'),
    achievementToast: $('#achievement-toast'),
    toastAchievementName: $('#toast-achievement-name'),
    toastAchievementDesc: $('#toast-achievement-desc'),
    profileStats: $('#profile-stats'),
    achievementsGrid: $('#achievements-grid'),
    recordsList: $('#records-list'),
    btnProfileBack: $('#btn-profile-back'),
    galleryGrid: $('#gallery-grid'),
    btnGalleryBack: $('#btn-gallery-back'),
    endingStats: $('#ending-stats'),
    modalOverlay: $('#modal-overlay'),
    modalTitle: $('#modal-title'),
    saveSlots: $('#save-slots'),
    btnModalClose: $('#btn-modal-close'),
    btnTabChar: $('#btn-tab-char'),
    btnTabDungeon: $('#btn-tab-dungeon'),
    btnTabTask: $('#btn-tab-task'),
    mobilePanelOverlay: $('#mobile-panel-overlay'),
    mobilePanelTitle: $('#mobile-panel-title'),
    mobilePanelContent: $('#mobile-panel-content'),
    btnMobileClose: $('#btn-mobile-close'),
  };

  // --- Screen Management ---
  function showScreen(name) {
    $$('.screen').forEach((el) => el.classList.remove('active'));
    const target = $(`#screen-${name}`);
    if (target) {
      target.classList.add('active');
      state.screen = name;
    }
  }

  // --- Auth Logic ---
  async function performAuth(action) {
    const username = dom.inputUsername.value.trim();
    const password = dom.inputPassword.value.trim();
    if (!username || !password) {
      dom.authStatus.textContent = '请输入用户名和密码';
      return;
    }

    dom.authStatus.textContent = '处理中...';
    try {
      const res = await fetch(`/api/auth/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.success) {
        state.token = data.token;
        state.username = data.username;
        localStorage.setItem('rangame_token', data.token);
        localStorage.setItem('rangame_username', data.username);
        dom.inputPassword.value = '';
        dom.authStatus.textContent = '';
        dom.menuUserStatus.textContent = `USER: ${state.username}`;
        showScreen('menu');
      } else {
        dom.authStatus.textContent = data.error || '登录失败';
      }
    } catch (err) {
      dom.authStatus.textContent = '网络错误，请重试';
    }
  }

  function logout() {
    state.token = null;
    state.username = null;
    localStorage.removeItem('rangame_token');
    localStorage.removeItem('rangame_username');
    showScreen('auth');
  }

  // --- Helper for Auth Headers ---
  function getHeaders(extra = {}) {
    const headers = { ...extra };
    if (state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
    }
    return headers;
  }

  // --- Story Rendering ---
  function appendStoryBlock(html, className) {
    if (!state.currentRoundEl) {
      state.currentRoundEl = document.createElement('div');
      state.currentRoundEl.className = 'story-round latest-round';
      dom.storyContent.appendChild(state.currentRoundEl);
    }
    const div = document.createElement('div');
    div.className = 'story-block' + (className ? ` ${className}` : '');
    div.innerHTML = html;
    state.currentRoundEl.appendChild(div);
    scrollStoryToBottom();
  }

  function appendPlayerAction(text) {
    document.querySelectorAll('.story-round.latest-round').forEach(el => el.classList.remove('latest-round'));
    
    state.currentRoundEl = document.createElement('div');
    state.currentRoundEl.className = 'story-round latest-round';
    dom.storyContent.appendChild(state.currentRoundEl);

    const div = document.createElement('div');
    div.className = 'story-block player-action';
    div.textContent = `▸ ${text}`;
    state.currentRoundEl.appendChild(div);
    scrollStoryToBottom();
  }

  function scrollStoryToBottom() {
    requestAnimationFrame(() => {
      dom.storyScroll.scrollTop = dom.storyScroll.scrollHeight;
    });
  }

  // --- LLM Output Parser ---
  function parseAndRender(fullText) {
    const choicesMatch = fullText.match(/===选项开始===([\s\S]*?)===选项结束===/);
    const charMatches = [...fullText.matchAll(/===角色信息===([\s\S]*?)===角色信息结束===/g)];
    const taskMatches = [...fullText.matchAll(/===任务===([\s\S]*?)===任务结束===/g)];
    const statusMatch = fullText.match(/===系统状态===([\s\S]*?)===系统状态结束===/);
    const dungeonMatch = fullText.match(/===副本信息===([\s\S]*?)===副本信息结束===/);
    const endingMatch = fullText.match(/===副本结局===([\s\S]*?)===副本结局结束===/);

    let narrative = fullText;
    const blocks = [
      /===选项开始===[\s\S]*?===选项结束===/g,
      /===角色信息===[\s\S]*?===角色信息结束===/g,
      /===任务===[\s\S]*?===任务结束===/g,
      /===系统状态===[\s\S]*?===系统状态结束===/g,
      /===副本信息===[\s\S]*?===副本信息结束===/g,
      /===副本结局===[\s\S]*?===副本结局结束===/g,
    ];
    blocks.forEach((re) => { narrative = narrative.replace(re, ''); });
    narrative = narrative.trim();

    if (narrative) {
      const escaped = escapeHtml(narrative);
      const paragraphs = escaped.split('<br>');
      const pages = [];
      let currentPage = [];
      let currentLen = 0;
      
      for (const p of paragraphs) {
        const stripped = p.replace(/<[^>]*>?/gm, '');
        if (currentLen + stripped.length > 150 && currentPage.length > 0) {
          pages.push(currentPage.join('<br>'));
          currentPage = [p];
          currentLen = stripped.length;
        } else {
          currentPage.push(p);
          currentLen += stripped.length;
        }
      }
      if (currentPage.length > 0) pages.push(currentPage.join('<br>'));

      let html = '';
      pages.forEach((pageContent, idx) => {
        const isActive = idx === 0 ? ' active' : '';
        const isLast = idx === pages.length - 1;
        const indicator = isLast ? '' : '<div class="mobile-next-indicator blink">▼</div>';
        html += `<span class="story-page${isActive}" data-page="${idx}">${pageContent}${indicator}</span>`;
      });
      
      const div = document.createElement('div');
      div.className = 'story-block narrative-block';
      div.innerHTML = html;
      div.dataset.totalPages = pages.length;
      div.dataset.currentPage = 0;
      
      div.addEventListener('click', (e) => {
        if (window.innerWidth > 900) return;
        let cp = parseInt(div.dataset.currentPage);
        const tp = parseInt(div.dataset.totalPages);
        if (cp < tp - 1) {
          div.querySelector(`.story-page[data-page="${cp}"]`).classList.remove('active');
          cp++;
          div.dataset.currentPage = cp;
          div.querySelector(`.story-page[data-page="${cp}"]`).classList.add('active');
          scrollStoryToBottom();
          
          if (cp === tp - 1) {
            document.querySelector('.game-footer').classList.remove('hide-on-mobile');
            scrollStoryToBottom();
          }
        }
      });
      
      if (!state.currentRoundEl) {
        state.currentRoundEl = document.createElement('div');
        state.currentRoundEl.className = 'story-round latest-round';
        dom.storyContent.appendChild(state.currentRoundEl);
      }
      state.currentRoundEl.appendChild(div);
      
      if (pages.length > 1 && window.innerWidth <= 900) {
        document.querySelector('.game-footer').classList.add('hide-on-mobile');
      } else {
        document.querySelector('.game-footer').classList.remove('hide-on-mobile');
      }
      scrollStoryToBottom();
    }

    // Dungeon info
    if (dungeonMatch) {
      renderDungeonInfo(dungeonMatch[1].trim());
    }

    // Choices (skip if game ended)
    if (!endingMatch) {
      if (choicesMatch) {
        renderChoices(choicesMatch[1].trim());
      } else {
        const fallbackChoices = detectChoices(fullText);
        if (fallbackChoices.length > 0) {
          renderChoicesFromArray(fallbackChoices);
        }
      }
    }

    if (charMatches.length > 0) {
      charMatches.forEach((m) => { addCharacterToRoster(m[1].trim()); });
      renderAllCharacters();
    }

    let newTasksAdded = false;
    if (taskMatches.length > 0) {
      taskMatches.forEach((m) => { addTaskToRoster(m[1].trim()); });
      newTasksAdded = true;
    } else {
      const fbTask = detectTaskFallback(fullText);
      if (fbTask) { addTaskToRoster(fbTask); newTasksAdded = true; }
    }
    if (newTasksAdded) { renderAllTasks(); }

    if (statusMatch) {
      renderSystemStatus(statusMatch[1].trim());
    } else {
      const fbStatus = detectStatusFallback(fullText);
      if (fbStatus) renderSystemStatus(fbStatus);
    }

    // Ending detection
    if (endingMatch) {
      handleEnding(endingMatch[1].trim());
    }
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');
  }

  // Fallback choice detection
  function detectChoices(text) {
    const lines = text.split('\n');
    const choices = [];
    const choiceRe = /^([1-4])[.、．]\s*(.+)/;
    for (const line of lines) {
      const m = line.trim().match(choiceRe);
      if (m) {
        choices.push({ num: m[1], text: m[2] });
      }
    }
    return choices;
  }

  function renderChoices(choiceText) {
    const choices = [];
    const lines = choiceText.split('\n').filter((l) => l.trim());
    const choiceRe = /^([1-4])[.、．]\s*(.+)/;
    for (const line of lines) {
      const m = line.trim().match(choiceRe);
      if (m) {
        choices.push({ num: m[1], text: m[2] });
      }
    }
    renderChoicesFromArray(choices);
  }

  function renderChoicesFromArray(choices) {
    dom.choicesContainer.innerHTML = '';
    choices.forEach((c) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = `${c.num}. ${c.text}`;
      btn.addEventListener('click', () => {
        if (c.num === '4') {
          dom.inputAction.focus();
        } else {
          sendAction(c.num);
        }
      });
      dom.choicesContainer.appendChild(btn);
    });
  }

  // Parse a character block and add/update in the roster by name
  function addCharacterToRoster(text) {
    const fields = parseKeyValues(text);
    const nameField = fields.find(([k]) => k.includes('姓名') || k.includes('名字'));
    const name = nameField ? nameField[1] : `角色${Object.keys(state.characters).length + 1}`;
    state.characters[name] = fields;
  }

  // Render all accumulated characters
  function renderAllCharacters() {
    const names = Object.keys(state.characters);
    if (names.length === 0) return;

    let html = '';
    names.forEach((name, idx) => {
      const fields = state.characters[name];
      html += `<div class="char-card${idx > 0 ? ' char-card-sep' : ''}">`;
      html += `<div class="char-card-name">▸ ${escapeFieldHtml(name)}</div>`;
      fields.forEach(([k, v]) => {
        if (k.includes('姓名') || k.includes('名字')) return; // skip name, already in header
        html += `<div class="char-field"><span class="char-key">${escapeFieldHtml(k)}：</span><span class="char-val">${escapeFieldHtml(v)}</span></div>`;
      });
      html += `</div>`;
    });
    dom.characterInfo.innerHTML = html;
  }

  function renderSystemStatus(text) {
    const fields = parseKeyValues(text);
    if (fields.length === 0) return;
    let html = '';
    fields.forEach(([k, v]) => {
      html += `<div class="status-field"><strong>${escapeFieldHtml(k)}：</strong>${escapeFieldHtml(v)}</div>`;
    });
    if (html) dom.systemInfo.innerHTML = html;
  }

  // Parse a task block and add/update in the roster by title
  function addTaskToRoster(text) {
    const fields = parseKeyValues(text);
    if (fields.length === 0) return;
    const titleField = fields.find(([k]) => k.includes('任务名') || k.includes('名称'));
    const title = titleField ? titleField[1] : `任务${Object.keys(state.tasks).length + 1}`;
    state.tasks[title] = fields;
  }

  // Render all accumulated tasks
  function renderAllTasks() {
    const titles = Object.keys(state.tasks);
    if (titles.length === 0) {
      dom.taskInfo.innerHTML = '<p class="placeholder-text">暂无任务</p>';
      return;
    }

    let html = '';
    titles.forEach((title) => {
      const fields = state.tasks[title];
      let desc = '';
      let type = '';
      let status = '';
      
      fields.forEach(([k, v]) => {
        if (k.includes('描述') || k.includes('内容')) desc = v;
        else if (k.includes('类型')) type = v;
        else if (k.includes('状态') || k.includes('进度')) status = v;
      });

      html += `<div class="task-card">`;
      if (type) html += `<div class="task-card-type">${escapeFieldHtml(type)}</div>`;
      html += `<div class="task-card-title">◆ ${escapeFieldHtml(title)}</div>`;
      if (desc) html += `<div class="task-card-desc">${escapeFieldHtml(desc)}</div>`;
      if (status) html += `<div class="task-card-status">状态：${escapeFieldHtml(status)}</div>`;
      
      // Show any remaining fields
      fields.forEach(([k, v]) => {
        if (!k.includes('任务名') && !k.includes('名称') && !k.includes('描述') && !k.includes('内容') && !k.includes('类型') && !k.includes('状态') && !k.includes('进度')) {
          html += `<div class="task-card-desc">${escapeFieldHtml(k)}：${escapeFieldHtml(v)}</div>`;
        }
      });
      html += `</div>`;
    });
    
    dom.taskInfo.innerHTML = html;
  }

  // Robust key-value parser that handles multiple formats:
  // - 【key】value (no colon)
  // - 【key】：value or 【key】:value
  // - key：value or key:value
  // - Multiple 【key】value pairs on the same line
  function parseKeyValues(text) {
    const pairs = [];
    const lines = text.split('\n').filter((l) => l.trim());
    for (const line of lines) {
      const trimmed = line.trim();
      // Check if the line has multiple 【key】 patterns
      const bracketPairs = [...trimmed.matchAll(/【([^】]+)】[：:]?\s*([^【]*)/g)];
      if (bracketPairs.length > 0) {
        bracketPairs.forEach((m) => {
          const key = m[1].trim();
          const val = m[2].trim();
          if (key && val) pairs.push([key, val]);
        });
      } else {
        // Fallback: key：value or key:value format
        const m = trimmed.match(/^([^:：]{1,20})[：:]\s*(.+)/);
        if (m) {
          pairs.push([m[1].trim(), m[2].trim()]);
        }
      }
    }
    return pairs;
  }

  // Fallback: detect system status from raw text when === markers are absent
  function detectStatusFallback(text) {
    const statusKeys = ['副本世界观', '世界观', '系统类型', '系统性格', '系统身份'];
    const found = [];
    for (const key of statusKeys) {
      // Match patterns like: 副本世界观：xxx or 【副本世界观】xxx
      const re = new RegExp(`(?:【${key}】|${key})[：:]?\\s*([^\n【]+)`);
      const m = text.match(re);
      if (m) {
        found.push(`${key}：${m[1].trim()}`);
      }
    }
    if (found.length > 0) return found.join('\n');
    return null;
  }

  // Fallback: detect task info from raw text when === markers are absent
  function detectTaskFallback(text) {
    const taskKeys = ['任务名', '任务名称', '任务描述', '任务类型', '任务状态', '任务进度', '限时任务', '长期任务'];
    const found = [];
    for (const key of taskKeys) {
      const re = new RegExp(`(?:【${key}】|${key})[：:]?\\s*([^\n【]+)`);
      const m = text.match(re);
      if (m) {
        found.push(`【${key}】${m[1].trim()}`);
      }
    }
    if (found.length > 0) return found.join('\n');
    return null;
  }

  function escapeFieldHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // --- Dungeon Info ---
  function renderDungeonInfo(text) {
    const fields = parseKeyValues(text);
    if (fields.length === 0) return;
    fields.forEach(([k, v]) => {
      if (k.includes('副本名称') || k.includes('名称')) state.dungeonInfo.name = v;
      if (k.includes('核心目标') || k.includes('目标')) state.dungeonInfo.goal = v;
      if (k.includes('世界观')) state.dungeonInfo.world = v;
      if (k.includes('系统类型')) state.dungeonInfo.system = v;
    });
    let html = '';
    if (state.dungeonInfo.name) html += `<div class="dungeon-field"><strong>副本：</strong>${escapeFieldHtml(state.dungeonInfo.name)}</div>`;
    if (state.dungeonInfo.goal) html += `<div class="dungeon-field"><strong>目标：</strong>${escapeFieldHtml(state.dungeonInfo.goal)}</div>`;
    if (state.dungeonInfo.world) html += `<div class="dungeon-field"><strong>世界观：</strong>${escapeFieldHtml(state.dungeonInfo.world)}</div>`;
    if (html) dom.dungeonInfo.innerHTML = html;
  }

  // --- Ending Handler ---
  async function handleEnding(text) {
    state.gameEnded = true;
    const fields = parseKeyValues(text);
    let rank = 'B', title = '结局', desc = '';
    fields.forEach(([k, v]) => {
      if (k.includes('结局等级') || k.includes('等级')) rank = v.trim().charAt(0);
      if (k.includes('结局标题') || k.includes('标题')) title = v;
      if (k.includes('结局描述') || k.includes('描述')) desc = v;
    });

    // Disable input
    setInputEnabled(false);
    dom.choicesContainer.innerHTML = '';

    // Call complete API
    try {
      const res = await fetch('/api/game/complete', {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          sessionId: state.sessionId,
          dungeonName: state.dungeonInfo.name || '未知副本',
          worldType: state.dungeonInfo.world || '未知',
          systemType: state.dungeonInfo.system || '未知',
          endingRank: rank,
          endingTitle: title,
          endingDesc: desc,
        }),
      });
      const data = await res.json();
      showEndingScreen(rank, title, desc, data.newAchievements || []);
    } catch (err) {
      showEndingScreen(rank, title, desc, []);
    }
  }

  function showEndingScreen(rank, title, desc, achievements) {
    dom.endingRankDisplay.textContent = rank;
    dom.endingTitleDisplay.textContent = title;
    dom.endingDescDisplay.textContent = desc;
    dom.endingDungeonName.textContent = state.dungeonInfo.name || '—';
    dom.endingRounds.textContent = state.roundCount;
    dom.endingWorld.textContent = state.dungeonInfo.world || '—';

    if (achievements.length > 0) {
      dom.endingAchievements.style.display = 'block';
      dom.endingAchievements.innerHTML = '<div style="font-size:12px;letter-spacing:2px;margin-bottom:8px;opacity:0.6;">★ 新成就解锁 ★</div>' +
        achievements.map(a => `<div class="ending-achievement-item">${escapeFieldHtml(a.name)}</div>`).join('');
      // Show toasts with delay
      achievements.forEach((a, i) => {
        setTimeout(() => showAchievementToast(a.name, a.desc), 1500 + i * 1200);
      });
    } else {
      dom.endingAchievements.style.display = 'none';
    }

    dom.endingOverlay.style.display = 'flex';
  }

  function showAchievementToast(name, desc) {
    dom.toastAchievementName.textContent = name;
    dom.toastAchievementDesc.textContent = desc;
    // Clone to re-trigger animation
    const old = dom.achievementToast;
    const clone = old.cloneNode(true);
    old.parentNode.replaceChild(clone, old);
    dom.achievementToast = clone;
    clone.style.display = 'flex';
    setTimeout(() => { clone.style.display = 'none'; }, 4200);
  }

  // --- Profile Page ---
  async function showProfilePage() {
    showScreen('profile');
    try {
      const [recRes, achRes] = await Promise.all([
        fetch('/api/records', { headers: getHeaders() }),
        fetch('/api/achievements', { headers: getHeaders() }),
      ]);
      if (recRes.status === 401 || achRes.status === 401) return logout();
      const records = await recRes.json();
      const achievements = await achRes.json();
      renderProfileData(records, achievements);
    } catch { /* ignore */ }
  }

  function renderProfileData(records, achievements) {
    // Stats
    const counts = { total: records.length, S: 0, A: 0, B: 0, C: 0, '?': 0 };
    records.forEach(r => { if (counts[r.ending_rank] !== undefined) counts[r.ending_rank]++; });
    $('#stat-total').textContent = counts.total;
    $('#stat-s').textContent = counts.S;
    $('#stat-a').textContent = counts.A;
    $('#stat-b').textContent = counts.B;
    $('#stat-c').textContent = counts.C;
    $('#stat-hidden').textContent = counts['?'];

    // Achievements
    let achHtml = '';
    achievements.forEach(a => {
      const cls = a.unlocked ? '' : ' locked';
      const icon = a.unlocked ? '★' : '☆';
      achHtml += `<div class="achievement-card${cls}"><div class="achievement-icon">${icon}</div><div><div class="achievement-name">${escapeFieldHtml(a.name)}</div><div class="achievement-desc">${escapeFieldHtml(a.desc)}</div></div></div>`;
    });
    dom.achievementsGrid.innerHTML = achHtml || '<p class="placeholder-text">暂无成就数据</p>';

    // Records
    let recHtml = '';
    records.slice(0, 20).forEach(r => {
      const time = new Date(r.completed_at).toLocaleString('zh-CN');
      recHtml += `<div class="record-item"><div class="record-rank">${escapeFieldHtml(r.ending_rank)}</div><div class="record-info"><div class="record-name">${escapeFieldHtml(r.dungeon_name)}</div><div class="record-meta">${escapeFieldHtml(r.world_type)} · ${r.rounds}轮 · ${time}</div></div></div>`;
    });
    dom.recordsList.innerHTML = recHtml || '<p class="placeholder-text">暂无通关记录</p>';
  }

  // --- Gallery Page ---
  async function showGalleryPage() {
    showScreen('gallery');
    try {
      const res = await fetch('/api/gallery', { headers: getHeaders() });
      if (res.status === 401) return logout();
      const items = await res.json();
      renderGallery(items);
    } catch { /* ignore */ }
  }

  function renderGallery(items) {
    if (items.length === 0) {
      dom.galleryGrid.innerHTML = '<p class="placeholder-text">尚未通关任何副本，快去冒险吧！</p>';
      return;
    }
    let html = '';
    items.forEach(item => {
      const time = new Date(item.completed_at).toLocaleDateString('zh-CN');
      html += `<div class="gallery-card"><div class="gallery-card-rank">${escapeFieldHtml(item.ending_rank)}</div><div class="gallery-card-name">${escapeFieldHtml(item.dungeon_name)}</div><div class="gallery-card-field">世界观：${escapeFieldHtml(item.world_type)}</div><div class="gallery-card-field">系统：${escapeFieldHtml(item.system_type)}</div><div class="gallery-card-field">${time}</div></div>`;
    });
    dom.galleryGrid.innerHTML = html;
  }

  function updateRoundCounter(round) {
    state.roundCount = round;
    dom.roundCounter.textContent = `第 ${round} 轮`;
  }

  // --- Streaming ---
  async function streamRequest(url, body, onContent, onDone) {
    state.isStreaming = true;
    setInputEnabled(false);
    dom.storyLoading.style.display = 'block';
    dom.choicesContainer.innerHTML = '';
    state.streamBuffer = '';

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) logout();
        const err = await res.json().catch(() => ({ error: '请求失败' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const data = JSON.parse(raw);

            if (data.type === 'session') {
              state.sessionId = data.sessionId;
            } else if (data.type === 'round') {
              updateRoundCounter(data.round);
            } else if (data.type === 'content') {
              state.streamBuffer += data.content;
              if (onContent) onContent(data.content);
            } else if (data.type === 'done') {
              // Stream complete
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          } catch (parseErr) {
            if (parseErr.message && !parseErr.message.includes('JSON')) {
              throw parseErr;
            }
          }
        }
      }

      dom.storyLoading.style.display = 'none';
      if (onDone) onDone(state.streamBuffer);
    } catch (err) {
      dom.storyLoading.style.display = 'none';
      appendStoryBlock(`<span style="opacity:0.6;">[ 错误: ${escapeHtml(err.message)} ]</span>`);
    } finally {
      state.isStreaming = false;
      setInputEnabled(true);
    }
  }

  function setInputEnabled(enabled) {
    dom.inputAction.disabled = !enabled;
    dom.btnSendAction.disabled = !enabled;
    dom.choicesContainer.querySelectorAll('.choice-btn').forEach((b) => {
      b.disabled = !enabled;
    });
  }

  // --- Game Actions ---
  async function startNewGame() {
    showScreen('game');
    dom.storyContent.innerHTML = '';
    dom.choicesContainer.innerHTML = '';
    dom.characterInfo.innerHTML = '<p class="placeholder-text">等待角色信息...</p>';
    dom.systemInfo.innerHTML = '<p class="placeholder-text">系统初始化中...</p>';
    dom.taskInfo.innerHTML = '<p class="placeholder-text">暂无任务</p>';
    dom.dungeonInfo.innerHTML = '<p class="placeholder-text">等待初始化...</p>';
    dom.roundCounter.textContent = '第 0 轮';
    dom.endingOverlay.style.display = 'none';
    document.querySelector('.game-footer').classList.remove('hide-on-mobile');
    state.characters = {};
    state.tasks = {};
    state.roundCount = 0;
    state.gameEnded = false;
    state.currentRoundEl = null;
    state.dungeonInfo = {};

    // Create a temporary streaming display element
    const streamEl = document.createElement('div');
    streamEl.className = 'story-block';
    dom.storyContent.appendChild(streamEl);

    await streamRequest(
      '/api/game/start',
      {},
      (content) => {
        // Live stream: show raw text as it arrives
        streamEl.innerHTML = escapeHtml(state.streamBuffer);
        scrollStoryToBottom();
      },
      (fullText) => {
        // Stream complete: remove temp element, parse & render
        streamEl.remove();
        parseAndRender(fullText);
      }
    );
  }

  async function sendAction(action) {
    if (!action || state.isStreaming || !state.sessionId || state.gameEnded) return;

    appendPlayerAction(action);
    dom.inputAction.value = '';

    const streamEl = document.createElement('div');
    streamEl.className = 'story-block';
    dom.storyContent.appendChild(streamEl);

    await streamRequest(
      '/api/game/action',
      { sessionId: state.sessionId, action },
      (content) => {
        streamEl.innerHTML = escapeHtml(state.streamBuffer);
        scrollStoryToBottom();
      },
      (fullText) => {
        streamEl.remove();
        parseAndRender(fullText);
      }
    );
  }

  // --- Save / Load ---
  async function openSaveModal(mode) {
    dom.modalTitle.textContent = mode === 'save' ? '◆ 保 存 游 戏 ◆' : '◆ 读 取 存 档 ◆';
    dom.modalOverlay.style.display = 'flex';

    try {
      const res = await fetch('/api/saves', { headers: getHeaders() });
      if (res.status === 401 || res.status === 403) return logout();
      const saves = await res.json();
      renderSaveSlots(saves, mode);
    } catch {
      dom.saveSlots.innerHTML = '<p class="placeholder-text">加载存档失败</p>';
    }
  }

  function renderSaveSlots(saves, mode) {
    dom.saveSlots.innerHTML = '';
    saves.forEach((s) => {
      const slot = document.createElement('div');
      slot.className = 'save-slot';

      const info = document.createElement('div');
      info.className = 'save-slot-info';

      const label = document.createElement('div');
      label.className = 'save-slot-label';
      label.textContent = `存档 ${s.slot}`;

      const meta = document.createElement('div');
      meta.className = 'save-slot-meta';
      if (s.hasData) {
        const time = new Date(s.savedAt).toLocaleString('zh-CN');
        const world = s.metadata?.worldType || '未知副本';
        meta.textContent = `${time} — ${world}`;
      } else {
        meta.textContent = '— 空 —';
      }

      info.appendChild(label);
      info.appendChild(meta);
      slot.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'save-slot-actions';

      if (mode === 'save') {
        const btnSave = document.createElement('button');
        btnSave.className = 'pixel-btn-sm';
        btnSave.textContent = '保存';
        btnSave.addEventListener('click', () => saveToSlot(s.slot));
        actions.appendChild(btnSave);
      } else {
        if (s.hasData) {
          const btnLoad = document.createElement('button');
          btnLoad.className = 'pixel-btn-sm';
          btnLoad.textContent = '读取';
          btnLoad.addEventListener('click', () => loadFromSlot(s.slot));
          actions.appendChild(btnLoad);

          const btnDel = document.createElement('button');
          btnDel.className = 'pixel-btn-sm';
          btnDel.textContent = '删除';
          btnDel.addEventListener('click', async () => {
            await fetch(`/api/saves/${s.slot}`, { method: 'DELETE', headers: getHeaders() });
            openSaveModal(mode);
          });
          actions.appendChild(btnDel);
        }
      }

      slot.appendChild(actions);
      dom.saveSlots.appendChild(slot);
    });
  }

  async function saveToSlot(slot) {
    if (!state.sessionId) return;
    try {
      const res = await fetch(`/api/saves/${slot}`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ sessionId: state.sessionId }),
      });
      const data = await res.json();
      if (data.success) {
        dom.modalOverlay.style.display = 'none';
        appendStoryBlock('<span style="opacity:0.5;">[ 游戏已保存到存档 ' + slot + ' ]</span>');
      }
    } catch {
      appendStoryBlock('<span style="opacity:0.5;">[ 保存失败 ]</span>');
    }
  }

  async function loadFromSlot(slot) {
    try {
      const res = await fetch(`/api/saves/${slot}`, { headers: getHeaders() });
      if (res.status === 401 || res.status === 403) return logout();
      const data = await res.json();
      if (data.success) {
        state.sessionId = data.sessionId;
        state.roundCount = data.roundCount || 0;
        state.gameEnded = false;
        state.currentRoundEl = null;
        document.querySelector('.game-footer').classList.remove('hide-on-mobile');
        state.dungeonInfo = {};
        state.characters = {};
        state.tasks = {};
        dom.modalOverlay.style.display = 'none';
        dom.endingOverlay.style.display = 'none';
        showScreen('game');

        dom.storyContent.innerHTML = '';
        dom.choicesContainer.innerHTML = '';
        dom.dungeonInfo.innerHTML = '<p class="placeholder-text">等待初始化...</p>';
        dom.roundCounter.textContent = `第 ${state.roundCount} 轮`;

        const msgs = data.messages.filter((m) => m.role !== 'system');
        msgs.forEach((msg) => {
          if (msg.role === 'user') {
            appendPlayerAction(msg.content);
          } else if (msg.role === 'assistant') {
            parseAndRender(msg.content);
          }
        });
      }
    } catch {
      appendStoryBlock('<span style="opacity:0.5;">[ 读取存档失败 ]</span>');
    }
  }

  // --- Event Binding ---
  function showMobilePanel(title, contentHtml) {
    dom.mobilePanelTitle.textContent = title;
    dom.mobilePanelContent.innerHTML = contentHtml;
    dom.mobilePanelOverlay.style.display = 'flex';
  }

  function hideMobilePanel() {
    dom.mobilePanelOverlay.style.display = 'none';
  }

  function init() {
    // Auth
    dom.btnLogin.addEventListener('click', () => performAuth('login'));
    dom.btnRegister.addEventListener('click', () => performAuth('register'));
    dom.inputPassword.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') performAuth('login');
    });

    dom.btnNewGame.addEventListener('click', startNewGame);
    dom.btnLoadGame.addEventListener('click', () => openSaveModal('load'));
    dom.btnLogout.addEventListener('click', logout);
    dom.btnProfile.addEventListener('click', showProfilePage);
    dom.btnGallery.addEventListener('click', showGalleryPage);

    // Game actions
    dom.btnSendAction.addEventListener('click', () => {
      const val = dom.inputAction.value.trim();
      if (val) sendAction(val);
    });

    dom.inputAction.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = dom.inputAction.value.trim();
        if (val) sendAction(val);
      }
    });

    // Save / Menu
    dom.btnSaveGame.addEventListener('click', () => openSaveModal('save'));
    dom.btnBackMenu.addEventListener('click', () => showScreen('menu'));

    // Ending
    dom.btnEndingMenu.addEventListener('click', () => {
      dom.endingOverlay.style.display = 'none';
      showScreen('menu');
    });

    // Profile / Gallery back
    dom.btnProfileBack.addEventListener('click', () => showScreen('menu'));
    dom.btnGalleryBack.addEventListener('click', () => showScreen('menu'));

    // Modal close
    dom.btnModalClose.addEventListener('click', () => {
      dom.modalOverlay.style.display = 'none';
    });
    dom.modalOverlay.addEventListener('click', (e) => {
      if (e.target === dom.modalOverlay) {
        dom.modalOverlay.style.display = 'none';
      }
    });

    // Mobile Tabs
    dom.btnTabChar.addEventListener('click', () => showMobilePanel('◆ 角色信息', dom.characterInfo.innerHTML));
    dom.btnTabDungeon.addEventListener('click', () => {
      const html = dom.dungeonInfo.innerHTML + 
                   '<h3 class="panel-title" style="margin-top:16px; border-bottom:none;">◆ 系统状态</h3>' + 
                   dom.systemInfo.innerHTML;
      showMobilePanel('◆ 副本信息', html);
    });
    dom.btnTabTask.addEventListener('click', () => showMobilePanel('◆ 当前任务', dom.taskInfo.innerHTML));

    dom.btnMobileClose.addEventListener('click', hideMobilePanel);
    dom.mobilePanelOverlay.addEventListener('click', (e) => {
      if (e.target === dom.mobilePanelOverlay) hideMobilePanel();
    });
  }

  // --- Boot ---
  document.addEventListener('DOMContentLoaded', () => {
    init();
    if (state.token) {
      dom.menuUserStatus.textContent = `USER: ${state.username}`;
      showScreen('menu');
    } else {
      showScreen('auth');
    }
  });
})();
