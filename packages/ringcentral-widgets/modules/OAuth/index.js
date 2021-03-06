import background from 'ringcentral-integration/lib/background';
import { Module } from 'ringcentral-integration/lib/di';
import proxify from 'ringcentral-integration/lib/proxy/proxify';
import ensureExist from 'ringcentral-integration/lib/ensureExist';
import uuid from 'uuid';

import popWindow from '../../lib/popWindow';

import OAuthBase from '../../lib/OAuthBase';

@Module({
  name: 'OAuth',
  deps: ['RouterInteraction', { dep: 'OAuthOptions', optional: true }],
})
export default class OAuth extends OAuthBase {
  constructor({
    loginPath = '/',
    redirectUri = './redirect.html',
    routerInteraction,
    ...options
  }) {
    super({
      redirectUri,
      ...options,
    });
    this._routerInteraction = ensureExist(
      routerInteraction,
      'routerInteraction',
    );
    this._loginPath = loginPath;
    this._loginWindow = null;
    this._redirectCheckTimeout = null;
    this._uuid = uuid.v4();
  }

  initialize() {
    super.initialize();
    // close login window when unload and login window exist
    window.addEventListener('beforeunload', () => {
      if (this._loginWindow) {
        try {
          this._loginWindow.close();
        } catch (error) {
          /* ignore error */
        }
      }
    });
    // listen callback uri from redirect page, works with coss origin redirect page
    window.addEventListener('message', ({ data = {} }) => {
      if (!data) {
        return;
      }
      const { callbackUri } = data;
      if (callbackUri) {
        this._clearRedirectCheckTimeout();
        this._handleCallbackUri(callbackUri);
      }
    });
    // listen callback uri from storage, works only with same origin
    window.addEventListener('storage', (e) => {
      if (
        e.key === this.callbackUriStorageKey &&
        e.newValue &&
        e.newValue !== ''
      ) {
        const callbackUri = e.newValue;
        localStorage.removeItem(this.callbackUriStorageKey);
        this._clearRedirectCheckTimeout();
        this._handleCallbackUri(callbackUri);
      }
    });
  }

  _onStateChange() {
    super._onStateChange();
    if (
      this.ready &&
      !this._auth.loggedIn &&
      this._routerInteraction.currentPath === this._loginPath &&
      !this.oAuthReady
    ) {
      this.setupOAuth();
    }
    if (
      this._auth.loggedIn ||
      this._routerInteraction.currentPath !== this._loginPath
    ) {
      this.destroyOAuth();
    }
  }

  get name() {
    return 'OAuth';
  }

  @background
  async setupOAuth() {
    if (!this.oAuthReady) {
      window.oAuthCallback = (callbackUri) => {
        this._clearRedirectCheckTimeout();
        this._handleCallbackUri(callbackUri);
      };
      this.store.dispatch({
        type: this.actionTypes.setupOAuth,
      });
    }
  }

  @background
  async destroyOAuth() {
    if (this.oAuthReady) {
      window.oAuthCallback = null;
      this.store.dispatch({
        type: this.actionTypes.destroyOAuth,
      });
    }
  }

  @proxify
  openOAuthPage() {
    if (this.oAuthReady) {
      this._loginWindow = popWindow(this.oAuthUri, 'rc-oauth', 600, 600);
      if (this.isRedirectUriSameOrigin) {
        this._setupRedirectCheckTimeout();
      }
    }
  }

  _clearRedirectCheckTimeout() {
    if (this._redirectCheckTimeout === null) {
      return;
    }
    clearTimeout(this._redirectCheckTimeout);
  }

  _setupRedirectCheckTimeout() {
    this._clearRedirectCheckTimeout();
    this._redirectCheckTimeout = setTimeout(() => {
      this._redirectCheckTimeout = null;
      if (
        !this._loginWindow ||
        !this._loginWindow.window ||
        this._loginWindow.closed
      ) {
        this._loginWindow = null;
        return;
      }
      try {
        const callbackUri = this._loginWindow.location.href;
        if (callbackUri.indexOf(this.redirectUri) !== -1) {
          this._loginWindow.close();
          this._loginWindow = null;
          this._handleCallbackUri(callbackUri);
          return;
        }
      } catch (e) {
        // ignore e
        // console.log('checking redirect uri');
      }
      this._setupRedirectCheckTimeout();
    }, 1000);
  }

  get isRedirectUriSameOrigin() {
    return this.redirectUri.indexOf(window.origin) === 0;
  }

  get authState() {
    return `${btoa(Date.now())}-${this.prefix}-${encodeURIComponent(
      btoa(this._uuid),
    )}`;
  }

  get callbackUriStorageKey() {
    return `${this.prefix}-${encodeURIComponent(btoa(this._uuid))}-callbackUri`;
  }
}
