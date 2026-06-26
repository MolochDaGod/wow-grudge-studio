/** Launcher HTML is on wow.grudge-studio.com (Vercel); API is always wow-api (tunnel → gateway). */
const API = (() => {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return 'http://127.0.0.1:8787/api';
  return 'https://wow-api.grudge-studio.com/api';
})();

const API_FALLBACKS = [...new Set([
  API,
  'http://127.0.0.1:8787/api',
])];

async function gatewayFetch(path, opts = {}) {
  const errors = [];
  for (const base of API_FALLBACKS) {
    try {
      const response = await fetch(`${base}${path}`, opts);
      if (response.ok) return response;
      errors.push(`${base}${path} → ${response.status}`);
    } catch (err) {
      errors.push(`${base}${path} → ${err?.message || 'network'}`);
    }
  }
  throw new Error(errors.join('; ') || 'Gateway unreachable');
}

const GRUDGE_AUTH_URL = 'https://id.grudge-studio.com';
const GRUDGE_ID_API = 'https://id.grudge-studio.com';
const GRUDGE_MAIN_API = 'https://api.grudge-studio.com';
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,30}$/;

const Auth = {
  requiresAuth() {
    const host = window.location.hostname;
    return host !== 'localhost' && host !== '127.0.0.1';
  },

  getToken() {
    return localStorage.getItem('grudge_auth_token')
      || localStorage.getItem('grudge_token')
      || null;
  },

  getGrudgeId() {
    return localStorage.getItem('grudge_id');
  },

  getUsername() {
    return localStorage.getItem('grudge_username') || 'Player';
  },

  persistSession(token, profile = {}) {
    if (!token) return;
    localStorage.setItem('grudge_auth_token', token);
    localStorage.setItem('grudge_token', token);
    const grudgeId = profile.grudgeId || profile.grudge_id || '';
    const username = profile.username || profile.displayName || profile.name || '';
    if (grudgeId) localStorage.setItem('grudge_id', grudgeId);
    if (username) localStorage.setItem('grudge_username', username);
    try {
      localStorage.setItem('grudge_user', JSON.stringify({
        grudgeId,
        username,
        ...(profile.user || profile),
      }));
    } catch (_) {}
  },

  async fetchIdProfile(token) {
    const headers = { Authorization: `Bearer ${token}` };
    for (const base of [GRUDGE_ID_API, GRUDGE_MAIN_API]) {
      try {
        const response = await fetch(`${base}/api/auth/me`, {
          headers,
          credentials: 'include',
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) continue;
        const data = await response.json();
        const grudgeId = data.grudgeId || data.grudge_id || data.user?.grudgeId || data.user?.grudge_id || '';
        const username = data.username || data.displayName || data.user?.username || data.name || 'Player';
        return {
          grudgeId,
          username,
          needsProfile: Boolean(data.needsProfile || data.needs_profile),
          user: data,
        };
      } catch (_) {}
    }
    return null;
  },

  async hydrateFromUrlToken() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('grudge_token')
      || params.get('sso_token')
      || params.get('token')
      || params.get('auth_token');
    if (!token) return false;

    const grudgeId = params.get('grudge_id') || params.get('grudgeId') || params.get('auth_grudge_id') || '';
    const username = params.get('grudge_username') || params.get('username') || params.get('auth_user') || '';

    this.persistSession(token, { grudgeId, username });

    if (!grudgeId || !username) {
      const profile = await this.fetchIdProfile(token);
      if (profile) this.persistSession(token, profile);
    }

    sessionStorage.setItem('wow_autoplay', '1');
    this.cleanAuthParamsFromUrl();
    return true;
  },

  cleanAuthParamsFromUrl() {
    const params = new URLSearchParams(window.location.search);
    ['grudge_token', 'sso_token', 'token', 'auth_token', 'grudge_id', 'grudgeId', 'auth_grudge_id',
      'grudge_username', 'username', 'auth_user'].forEach((k) => params.delete(k));
    const qs = params.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
    window.history.replaceState({}, document.title, url);
  },

  setUsername(name) {
    if (name) {
      localStorage.setItem('grudge_username', name);
      try {
        const user = JSON.parse(localStorage.getItem('grudge_user') || '{}');
        user.username = name;
        user.grudgeId = user.grudgeId || this.getGrudgeId();
        localStorage.setItem('grudge_user', JSON.stringify(user));
      } catch (_) {}
    }
  },

  isLoggedIn() {
    if (this.getGrudgeId()) return true;
    if (typeof window.grudgeAuthIsLoggedIn === 'function' && window.grudgeAuthIsLoggedIn()) {
      return true;
    }
    return !!this.getToken();
  },

  headers() {
    const token = this.getToken();
    const h = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  },

  fetchOptions(body) {
    const opts = {
      credentials: 'include',
      headers: this.headers(),
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    return opts;
  },

  buildFallbackPlayer(profile) {
    const grudgeId = profile?.grudgeId || this.getGrudgeId();
    const grudgeUsername = profile?.username || this.getUsername();
    return {
      grudgeId,
      grudgeUsername,
      needsUsernameSetup: Boolean(profile?.needsProfile),
      wowAccountReady: false,
      source: 'grudge-id',
    };
  },

  openSignIn() {
    // id.grudge-studio.com edge-v2 reads ?redirect= (not ?return=) and appends ?grudge_token=
    const returnUrl = `${window.location.origin}/?autoplay=1`;
    window.location.href = `${GRUDGE_AUTH_URL}?redirect=${encodeURIComponent(returnUrl)}`;
  },

  signOut() {
    sessionStorage.removeItem('wow_launch_creds');
    sessionStorage.removeItem('wow_autoplay');
    if (typeof window.grudgeAuthLogout === 'function') {
      window.grudgeAuthLogout();
      return;
    }
    ['grudge_auth_token', 'grudge_token', 'grudge_user_id', 'grudge_id', 'grudge_username', 'grudge_user'].forEach((k) => {
      localStorage.removeItem(k);
    });
    window.dispatchEvent(new CustomEvent('grudge:auth:logout'));
  },
};

function characterCardHtml(c) {
  const online = c.online ? '<span class="char-card-badge">Online</span>' : '';
  return `<li>
    <div>
      <div class="char-card-name">${c.name}</div>
      <div class="char-card-meta">Lv ${c.level} ${c.race} ${c.class}</div>
    </div>
    ${online}
  </li>`;
}

const App = {
  config: null,
  player: null,
  characters: [],
  launchInProgress: false,
  autoplayLaunch: false,

  async init() {
    this.overlayEl = document.getElementById('screenOverlay');
    this.overlayMessageEl = document.getElementById('overlayMessage');
    this.configMetaEl = document.getElementById('configMeta');
    this.serverStatusEl = document.getElementById('serverStatus');
    this.sessionStatusEl = document.getElementById('sessionStatus');
    this.frameEl = document.getElementById('wowserFrame');
    this.canvasEl = document.getElementById('gameCanvas');

    this.launchBtn = document.getElementById('launchBtn');
    this.retryBtn = document.getElementById('retryBtn');
    this.fullscreenBtn = document.getElementById('fullscreenBtn');
    this.disconnectBtn = document.getElementById('disconnectBtn');
    this.overlayLaunchBtn = document.getElementById('overlayLaunchBtn');
    this.overlaySignInBtn = document.getElementById('overlaySignInBtn');

    this.userPillEl = document.getElementById('userPill');
    this.signInBtn = document.getElementById('signInBtn');
    this.signOutBtn = document.getElementById('signOutBtn');

    this.usernameOverlayEl = document.getElementById('usernameOverlay');
    this.usernameInputEl = document.getElementById('usernameInput');
    this.usernameHintEl = document.getElementById('usernameHint');
    this.usernameIntroEl = document.getElementById('usernameIntro');
    this.usernameAcceptBtn = document.getElementById('usernameAcceptBtn');
    this.usernameSaveBtn = document.getElementById('usernameSaveBtn');

    this.credentialsOverlayEl = document.getElementById('credentialsOverlay');
    this.credGrudgeUserEl = document.getElementById('credGrudgeUser');
    this.credWowLoginEl = document.getElementById('credWowLogin');
    this.credWowPassEl = document.getElementById('credWowPass');
    this.charactersPanelEl = document.getElementById('charactersPanel');
    this.charactersListEl = document.getElementById('charactersList');
    this.charactersEmptyEl = document.getElementById('charactersEmpty');
    this.credentialsPlayBtn = document.getElementById('credentialsPlayBtn');
    this.pendingLaunchUrl = null;

    this.launcherCharactersEl = document.getElementById('launcherCharacters');
    this.launcherCharactersListEl = document.getElementById('launcherCharactersList');
    this.launcherCharactersEmptyEl = document.getElementById('launcherCharactersEmpty');
    this.launcherCharactersPendingEl = document.getElementById('launcherCharactersPending');
    this.launcherCharactersLoadingEl = document.getElementById('launcherCharactersLoading');
    this.refreshCharactersBtn = document.getElementById('refreshCharactersBtn');

    this.bindControls();
    this.bindAuthEvents();
    this.refreshAuthUi();
    await this.consumeAuthParamsFromUrl();
    await this.bootstrap();
  },

  bindControls() {
    this.launchBtn.addEventListener('click', () => this.startSession());
    this.retryBtn.addEventListener('click', () => this.startSession());
    this.overlayLaunchBtn.addEventListener('click', () => this.startSession());
    this.overlaySignInBtn.addEventListener('click', () => Auth.openSignIn());
    this.signInBtn.addEventListener('click', () => Auth.openSignIn());
    this.signOutBtn.addEventListener('click', () => {
      this.disconnect();
      Auth.signOut();
      this.player = null;
      this.refreshAuthUi();
      this.showOverlay('Signed out. Sign in with your Grudge ID to play.');
      this.setSessionStatus('Signed out', 'warn');
    });
    this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    this.disconnectBtn.addEventListener('click', () => this.disconnect());

    this.usernameAcceptBtn.addEventListener('click', () => this.submitUsername('accept'));
    this.usernameSaveBtn.addEventListener('click', () => this.submitUsername('set'));
    this.usernameInputEl.addEventListener('input', () => this.validateUsernameInput());
    this.usernameInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.submitUsername('set');
    });
    this.credentialsPlayBtn.addEventListener('click', () => this.enterAzeroth());
    this.refreshCharactersBtn.addEventListener('click', () => this.loadCharacters(true));
  },

  renderCharacterPanels(chars) {
    const list = chars || [];
    if (list.length) {
      const html = list.map(characterCardHtml).join('');
      this.charactersListEl.innerHTML = html;
      this.charactersPanelEl.classList.remove('hidden');
      this.charactersEmptyEl.classList.add('hidden');
      this.launcherCharactersListEl.innerHTML = html;
      this.launcherCharactersEmptyEl.classList.add('hidden');
    } else {
      this.charactersPanelEl.classList.add('hidden');
      this.charactersEmptyEl.classList.remove('hidden');
      this.launcherCharactersListEl.innerHTML = '';
      this.launcherCharactersEmptyEl.classList.remove('hidden');
    }
  },

  updateLauncherCharactersPanel(state = 'ready') {
    const show = this.player && !this.player.needsUsernameSetup && Auth.isLoggedIn();
    if (!show) {
      this.launcherCharactersEl.classList.add('hidden');
      return;
    }

    this.launcherCharactersEl.classList.remove('hidden');
    this.launcherCharactersLoadingEl.classList.add('hidden');

    if (!this.player.wowAccountReady) {
      this.launcherCharactersListEl.innerHTML = '';
      this.launcherCharactersEmptyEl.classList.add('hidden');
      this.launcherCharactersPendingEl.classList.remove('hidden');
      return;
    }

    this.launcherCharactersPendingEl.classList.add('hidden');

    if (state === 'loading') {
      this.launcherCharactersListEl.innerHTML = '';
      this.launcherCharactersEmptyEl.classList.add('hidden');
      this.launcherCharactersLoadingEl.classList.remove('hidden');
      return;
    }

    this.renderCharacterPanels(this.characters);
  },

  async loadCharacters(force = false) {
    if (!Auth.isLoggedIn() || this.player?.needsUsernameSetup) {
      this.characters = [];
      this.updateLauncherCharactersPanel();
      return [];
    }

    this.updateLauncherCharactersPanel('loading');

    try {
      const response = await fetch(`${API}/player/characters`, {
        ...Auth.fetchOptions(),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('Could not load characters');
      const data = await response.json();
      this.characters = data.characters || [];
      if (data.grudgeUsername) {
        this.player = { ...this.player, grudgeUsername: data.grudgeUsername, wowAccountReady: !!data.wowLogin };
      }
      this.launcherCharactersEmptyEl.textContent = 'No characters yet — launch Wowser to create one.';
      this.renderCharacterPanels(this.characters);
      this.updateLauncherCharactersPanel();
      return this.characters;
    } catch {
      this.characters = [];
      this.launcherCharactersLoadingEl.classList.add('hidden');
      this.launcherCharactersEmptyEl.textContent = 'Could not load characters — realm may be offline.';
      this.launcherCharactersEmptyEl.classList.remove('hidden');
      this.launcherCharactersListEl.innerHTML = '';
      return [];
    }
  },

  showCredentialsOverlay(payload) {
    this.credGrudgeUserEl.textContent = payload.grudgeUsername || '—';
    this.credWowLoginEl.textContent = payload.wowAccount?.login || '—';
    this.credWowPassEl.textContent = payload.wowAccount?.password || '—';

    const chars = payload.characters || this.characters || [];
    this.renderCharacterPanels(chars);

    this.hideUsernameOverlay();
    this.overlayEl.classList.add('hidden');
    this.credentialsOverlayEl.classList.remove('hidden');
    this.frameEl.classList.add('hidden');
  },

  hideCredentialsOverlay() {
    this.credentialsOverlayEl.classList.add('hidden');
  },

  enterAzeroth() {
    if (!this.pendingLaunchUrl) return;
    this.frameEl.src = this.pendingLaunchUrl;
    this.hideCredentialsOverlay();
    this.hideOverlay();
    this.launcherCharactersEl.classList.add('hidden');
    this.setSessionStatus(`In world as ${this.player?.grudgeUsername || Auth.getUsername()}`, 'ok');
  },

  launchClient(config, payload) {
    this.pendingLaunchUrl = this.resolveClientUrl(config, payload);
    if (payload.wowAccount?.created && !this.autoplayLaunch) {
      this.showCredentialsOverlay(payload);
      return;
    }
    this.frameEl.src = this.pendingLaunchUrl;
    this.hideOverlay();
    this.launcherCharactersEl.classList.add('hidden');
    const count = (payload.characters || []).length;
    const suffix = count ? ` · ${count} character${count === 1 ? '' : 's'}` : '';
    this.setSessionStatus(`Entering Azeroth as ${payload.grudgeUsername}${suffix}`, 'ok');
  },

  shouldAutoplay() {
    const params = new URLSearchParams(window.location.search);
    return params.get('autoplay') === '1' || sessionStorage.getItem('wow_autoplay') === '1';
  },

  clearAutoplayFlag() {
    sessionStorage.removeItem('wow_autoplay');
    const params = new URLSearchParams(window.location.search);
    if (params.has('autoplay')) {
      params.delete('autoplay');
      const qs = params.toString();
      const url = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
      window.history.replaceState({}, document.title, url);
    }
  },

  async maybeAutostartAfterAuth() {
    if (!this.shouldAutoplay()) return;
    if (!Auth.isLoggedIn()) return;
    if (this.launchInProgress || (this.frameEl.src && this.frameEl.src !== 'about:blank')) return;

    if (!this.player) {
      await this.loadPlayerProfile();
    }
    if (!this.player) {
      const profile = await Auth.fetchIdProfile(Auth.getToken());
      this.player = Auth.buildFallbackPlayer(profile);
      this.refreshAuthUi();
    }
    if (this.player?.needsUsernameSetup) {
      this.showUsernameOverlay(this.player);
      return;
    }

    this.showPostAuthLauncher();

    this.autoplayLaunch = true;
    this.clearAutoplayFlag();
    try {
      await this.startSession();
    } finally {
      this.autoplayLaunch = false;
    }
  },

  showPostAuthLauncher() {
    const name = this.player?.grudgeUsername || Auth.getUsername();
    const count = this.characters.length;
    const charNote = count
      ? `You have ${count} character${count === 1 ? '' : 's'} on this realm.`
      : 'Launch to provision your WoW account and create a character.';
    this.overlayMessageEl.textContent = `Welcome back, ${name}. ${charNote} Starting client…`;
    this.overlayEl.classList.remove('hidden');
    this.overlaySignInBtn.classList.add('hidden');
    this.overlayLaunchBtn.classList.remove('hidden');
    this.updateLauncherCharactersPanel();
    this.setSessionStatus('Signed in — launching', 'ok');
  },

  bindAuthEvents() {
    window.addEventListener('grudge:auth:success', async () => {
      this.refreshAuthUi();
      await this.loadPlayerProfile();
      await this.maybeAutostartAfterAuth();
    });
    window.addEventListener('grudge:auth:logout', () => {
      this.player = null;
      this.refreshAuthUi();
    });
  },

  async consumeAuthParamsFromUrl() {
    try {
      const hadToken = await Auth.hydrateFromUrlToken();
      if (hadToken) {
        this.refreshAuthUi();
        window.dispatchEvent(new CustomEvent('grudge:auth:success'));
      }
    } catch (err) {
      console.error('Auth redirect handling failed:', err);
    }
  },

  validateUsernameInput() {
    const value = this.usernameInputEl.value.trim();
    if (!value) {
      this.usernameHintEl.textContent = 'Enter a username or press Accept to keep your current name.';
      this.usernameHintEl.className = 'username-hint';
      return false;
    }
    if (!USERNAME_RE.test(value)) {
      this.usernameHintEl.textContent = 'Use 3–30 letters, numbers, underscore, or hyphen.';
      this.usernameHintEl.className = 'username-hint username-hint-error';
      return false;
    }
    this.usernameHintEl.textContent = `"${value}" looks good.`;
    this.usernameHintEl.className = 'username-hint username-hint-ok';
    return true;
  },

  showUsernameOverlay(player) {
    const suggested = player?.grudgeUsername || player?.displayName || Auth.getUsername();
    this.usernameInputEl.value = suggested;
    this.usernameIntroEl.textContent = player?.isFirstLaunch
      ? 'Welcome to Grudge WoW. Confirm the name you want other Grudge games and this realm to use.'
      : 'Your Grudge username is how we reference you across games. Accept it or pick a new one.';
    this.validateUsernameInput();
    this.usernameOverlayEl.classList.remove('hidden');
    this.overlayEl.classList.add('hidden');
    this.frameEl.classList.add('hidden');
    this.setSessionStatus('Username required', 'warn');
  },

  hideUsernameOverlay() {
    this.usernameOverlayEl.classList.add('hidden');
  },

  async submitUsername(action) {
    const value = this.usernameInputEl.value.trim();
    if (action === 'set' && !this.validateUsernameInput()) return;

    this.usernameAcceptBtn.disabled = true;
    this.usernameSaveBtn.disabled = true;

    try {
      const body = action === 'accept'
        ? { action: 'accept' }
        : { action: 'set', username: value };

      const response = await fetch(`${API}/player/username`, {
        method: 'POST',
        ...Auth.fetchOptions(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not save username.');

      this.player = payload.player;
      Auth.setUsername(this.player.grudgeUsername);
      this.hideUsernameOverlay();
      this.refreshAuthUi();
      await this.loadCharacters();
      if (this.shouldAutoplay()) {
        await this.maybeAutostartAfterAuth();
        return;
      }
      this.showOverlay(`Welcome, ${this.player.grudgeUsername}. Press Start Client to enter Azeroth.`);
      this.setSessionStatus('Ready to launch', 'ok');
    } catch (error) {
      this.usernameHintEl.textContent = error.message;
      this.usernameHintEl.className = 'username-hint username-hint-error';
    } finally {
      this.usernameAcceptBtn.disabled = false;
      this.usernameSaveBtn.disabled = false;
    }
  },

  async loadPlayerProfile() {
    if (!Auth.isLoggedIn()) {
      this.player = null;
      return null;
    }

    try {
      const response = await fetch(`${API}/player/me`, {
        ...Auth.fetchOptions(),
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) {
        this.player = await response.json();
      } else {
        const profile = await Auth.fetchIdProfile(Auth.getToken());
        this.player = Auth.buildFallbackPlayer(profile);
      }

      Auth.setUsername(this.player.grudgeUsername || Auth.getUsername());
      this.refreshAuthUi();

      if (this.player.needsUsernameSetup) {
        this.showUsernameOverlay(this.player);
      } else {
        await this.loadCharacters();
        if (!this.frameEl.src || this.frameEl.src === 'about:blank') {
          if (this.shouldAutoplay()) return;
          const count = this.characters.length;
          const charNote = count ? ` You have ${count} character${count === 1 ? '' : 's'}.` : '';
          this.showOverlay(`Signed in as ${this.player.grudgeUsername}.${charNote} Press Start Client to enter Azeroth.`);
          this.setSessionStatus('Ready to launch', 'ok');
        }
      }
      return this.player;
    } catch {
      const profile = await Auth.fetchIdProfile(Auth.getToken());
      if (!profile) return null;
      this.player = Auth.buildFallbackPlayer(profile);
      Auth.setUsername(this.player.grudgeUsername);
      this.refreshAuthUi();
      return this.player;
    }
  },

  refreshAuthUi() {
    const authed = Auth.isLoggedIn();
    const needsAuth = Auth.requiresAuth();
    const name = this.player?.grudgeUsername || Auth.getUsername();
    const canLaunch = authed && (!needsAuth || (this.player && !this.player.needsUsernameSetup));

    if (authed) {
      const shortId = (Auth.getGrudgeId() || '').slice(0, 8).toUpperCase();
      this.userPillEl.textContent = `${name} · ${shortId}`;
      this.userPillEl.classList.remove('hidden');
      this.signInBtn.classList.add('hidden');
      this.signOutBtn.classList.remove('hidden');
      this.overlaySignInBtn.classList.add('hidden');
      this.overlayLaunchBtn.classList.toggle('hidden', !canLaunch);
      this.setLaunchButtonsDisabled(!canLaunch);
    } else if (needsAuth) {
      this.userPillEl.classList.add('hidden');
      this.signInBtn.classList.remove('hidden');
      this.signOutBtn.classList.add('hidden');
      this.overlaySignInBtn.classList.remove('hidden');
      this.overlayLaunchBtn.classList.add('hidden');
      this.setLaunchButtonsDisabled(true);
      this.setSessionStatus('Sign in required', 'warn');
    } else {
      this.userPillEl.classList.add('hidden');
      this.signInBtn.classList.add('hidden');
      this.signOutBtn.classList.add('hidden');
      this.overlaySignInBtn.classList.add('hidden');
      this.overlayLaunchBtn.classList.remove('hidden');
      this.setLaunchButtonsDisabled(false);
    }
  },

  setServerStatus(label, state = 'muted') {
    this.serverStatusEl.textContent = label;
    this.serverStatusEl.className = `pill pill-${state}`;
  },

  setSessionStatus(label, state = 'muted') {
    this.sessionStatusEl.textContent = label;
    this.sessionStatusEl.className = `pill pill-${state}`;
  },

  showOverlay(message) {
    if (message) this.overlayMessageEl.textContent = message;
    this.hideUsernameOverlay();
    this.hideCredentialsOverlay();
    this.overlayEl.classList.remove('hidden');
    this.frameEl.classList.add('hidden');
    this.updateLauncherCharactersPanel();
  },

  hideOverlay() {
    this.overlayEl.classList.add('hidden');
    this.frameEl.classList.remove('hidden');
  },

  setLaunchButtonsDisabled(disabled) {
    [this.launchBtn, this.retryBtn, this.overlayLaunchBtn].forEach((btn) => {
      btn.disabled = disabled;
    });
  },

  async ensureCanPlay() {
    if (!Auth.requiresAuth()) return true;
    if (!Auth.isLoggedIn()) {
      this.showOverlay('Sign in with your Grudge ID to play on wow.grudge-studio.com.');
      Auth.openSignIn();
      return false;
    }
    if (!this.player) await this.loadPlayerProfile();
    if (this.player?.needsUsernameSetup) {
      this.showUsernameOverlay(this.player);
      return false;
    }
    return true;
  },

  async bootstrap() {
    await this.checkHealth();
    await this.loadConfig();
    if (Auth.isLoggedIn()) {
      await this.loadPlayerProfile();
      await this.maybeAutostartAfterAuth();
    } else if (Auth.requiresAuth()) {
      this.showOverlay('Sign in with your Grudge ID to play Wrath of the Lich King in your browser.');
    }
  },

  async checkHealth() {
    try {
      const response = await gatewayFetch('/health', { signal: AbortSignal.timeout(8000) });
      const data = await response.json();
      const ok = data.status === 'ok';
      this.setServerStatus(ok ? 'Gateway online' : 'Gateway issue', ok ? 'ok' : 'warn');
      return ok;
    } catch (err) {
      console.warn('Gateway health check failed:', err);
      this.setServerStatus('Gateway offline — run start-all.ps1 on your PC', 'error');
      return false;
    }
  },

  async loadConfig() {
    try {
      const response = await gatewayFetch('/config', { signal: AbortSignal.timeout(8000) });
      this.config = await response.json();
      const authNote = Auth.requiresAuth() ? 'Grudge ID + username' : 'Local dev mode';
      this.configMetaEl.innerHTML = [
        `Pipeline: <strong>${this.config.pipelineUrl}</strong>`,
        `Realm: <strong>${this.config.realm}</strong>`,
        `Version: <strong>${this.config.clientVersion}</strong>`,
        `Access: <strong>${authNote}</strong>`,
      ].join('<br>');
    } catch {
      this.configMetaEl.textContent = 'Could not load Wowser config from gateway.';
    }
  },

  async startSession() {
    if (this.launchInProgress) return;
    if (!(await this.ensureCanPlay())) return;

    this.launchInProgress = true;
    this.setLaunchButtonsDisabled(true);
    this.showOverlay('Provisioning your AzerothCore account…');
    this.setSessionStatus('Starting session…', 'warn');

    try {
      const healthy = await this.checkHealth();
      if (!healthy) {
        throw new Error('Gateway is offline. Run start-all.ps1 on your PC first.');
      }

      const response = await gatewayFetch('/play/direct', {
        method: 'POST',
        ...Auth.fetchOptions({}),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          Auth.signOut();
          this.player = null;
          this.refreshAuthUi();
          throw new Error('Session expired. Sign in again with your Grudge ID.');
        }
        if (response.status === 409 && payload.needsUsernameSetup) {
          this.player = { ...this.player, needsUsernameSetup: true };
          this.showUsernameOverlay(this.player);
          throw new Error('Choose or accept your Grudge username first.');
        }
        throw new Error(payload.error || 'Unable to start Wowser session.');
      }

      if (payload.wowAccount) {
        sessionStorage.setItem('wow_launch_creds', JSON.stringify({
          login: payload.wowAccount.login,
          password: payload.wowAccount.password,
          grudgeUsername: payload.grudgeUsername,
        }));
      }

      if (payload.characters) this.characters = payload.characters;
      if (this.player) {
        this.player = { ...this.player, wowAccountReady: true, wowLogin: payload.wowAccount?.login };
      }
      this.launchClient(this.config || payload, payload);
    } catch (error) {
      const msg = error?.message || String(error);
      console.error('Wowser launch failed:', msg);
      if (!this.player?.needsUsernameSetup) {
        const hint = /502|Gateway unreachable|offline/i.test(msg)
          ? `${msg} The game server on grudgestudio may be down — restart debian-wow-up and cloudflared.`
          : msg;
        this.showOverlay(hint);
      }
      this.setSessionStatus('Launch failed', 'error');
    } finally {
      this.launchInProgress = false;
      this.refreshAuthUi();
    }
  },

  resolveClientUrl(config, payload) {
    const local = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (local) {
      return 'http://127.0.0.1:5173/';
    }

    const params = new URLSearchParams();
    if (payload.pipelineUrl || config.pipelineUrl) {
      params.set('pipeline', payload.pipelineUrl || config.pipelineUrl);
    }
    if (payload.authWsUrl || config.authWsUrl) {
      params.set('auth', payload.authWsUrl || config.authWsUrl);
    }
    if (payload.worldWsUrl || config.worldWsUrl) {
      params.set('world', payload.worldWsUrl || config.worldWsUrl);
    }
    if (payload.realm || config.realm) {
      params.set('realm', payload.realm || config.realm);
    }
    // Credentials stay in sessionStorage (wow_launch_creds) — not in URL
    if (payload.grudgeUsername) {
      params.set('grudgeUsername', payload.grudgeUsername);
    }

    const qs = params.toString();
    return qs ? `/client/index.html?${qs}` : '/client/index.html';
  },

  async disconnect() {
    this.frameEl.src = 'about:blank';
    sessionStorage.removeItem('wow_launch_creds');
    fetch(`${API}/play/disconnect`, {
      method: 'POST',
      ...Auth.fetchOptions({ accountId: Auth.getGrudgeId() || 'wowser-direct' }),
    }).catch(() => {});
    await this.loadCharacters(true);
    this.showOverlay(this.player?.grudgeUsername
      ? `Disconnected, ${this.player.grudgeUsername}. Press Launch Wowser to reconnect.`
      : 'Sign in with your Grudge ID to play.');
    this.setSessionStatus('Disconnected', 'warn');
  },

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.canvasEl.requestFullscreen().catch(() => {});
      return;
    }
    document.exitFullscreen().catch(() => {});
  },
};

document.addEventListener('DOMContentLoaded', () => { App.init().catch((err) => console.error(err)); });
window.App = App;