import { UserProfile } from '../core/types';

export const GOOGLE_CONFIG = {
  projectId: 'finance-app-507601',
  androidClientId: '892248256656-2q2ot57hsc5ur5ug88b0s3i4urkd88mo.apps.googleusercontent.com',
  webClientId: '892248256656-hkukp5brj728mb2vuru01ukoci3irtoq.apps.googleusercontent.com',
  scopes: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile openid',
};

const STORAGE_KEY_GOOGLE_USER = 'finance_google_user_v1';
const STORAGE_KEY_GOOGLE_TOKEN = 'finance_google_token_v1';
const STORAGE_KEY_GOOGLE_TOKEN_EXPIRY = 'finance_google_token_expiry_v1';

declare global {
  interface Window {
    google?: any;
  }
}

export class GoogleAuthService {
  /**
   * Load Google Identity Services (GIS) library dynamically
   */
  static async loadGoogleIdentityScript(): Promise<boolean> {
    if (window.google?.accounts?.oauth2) {
      return true;
    }

    return new Promise((resolve) => {
      const existingScript = document.getElementById('google-identity-services-sdk');
      if (existingScript) {
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if (window.google?.accounts?.oauth2) {
            clearInterval(interval);
            resolve(true);
          } else if (attempts > 30) {
            clearInterval(interval);
            resolve(false);
          }
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-identity-services-sdk';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        let attempts = 0;
        const checkReady = setInterval(() => {
          attempts++;
          if (window.google?.accounts?.oauth2) {
            clearInterval(checkReady);
            resolve(true);
          } else if (attempts > 30) {
            clearInterval(checkReady);
            resolve(false);
          }
        }, 100);
      };
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  /**
   * Get current signed-in Google user profile
   */
  static getCurrentUser(): UserProfile | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_GOOGLE_USER);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to parse Google user session', e);
    }
    return null;
  }

  /**
   * Get Google OAuth access token if available and valid
   */
  static getAccessToken(): string | null {
    const token = localStorage.getItem(STORAGE_KEY_GOOGLE_TOKEN);
    if (!token) return null;

    const expiry = localStorage.getItem(STORAGE_KEY_GOOGLE_TOKEN_EXPIRY);
    if (expiry && Date.now() > parseInt(expiry, 10)) {
      // Token expired
      localStorage.removeItem(STORAGE_KEY_GOOGLE_TOKEN);
      localStorage.removeItem(STORAGE_KEY_GOOGLE_TOKEN_EXPIRY);
      return null;
    }

    return token;
  }

  /**
   * Real Google OAuth 2.0 Sign-In via Google Identity Services
   */
  static async signInWithGoogle(): Promise<{
    success: boolean;
    user?: UserProfile;
    token?: string;
    message?: string;
  }> {
    try {
      const loaded = await this.loadGoogleIdentityScript();

      if (!loaded || !window.google?.accounts?.oauth2) {
        // Fallback: Direct OAuth 2.0 popup
        return this.signInWithOAuthPopup();
      }

      return new Promise((resolve) => {
        try {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CONFIG.webClientId,
            scope: GOOGLE_CONFIG.scopes,
            callback: async (tokenResponse: any) => {
              if (tokenResponse.error) {
                resolve({
                  success: false,
                  message: tokenResponse.error_description || tokenResponse.error || 'Google Sign-In canceled',
                });
                return;
              }

              const accessToken = tokenResponse.access_token;
              const expiresIn = tokenResponse.expires_in ? parseInt(tokenResponse.expires_in, 10) : 3600;
              const expiryTimestamp = Date.now() + expiresIn * 1000;

              localStorage.setItem(STORAGE_KEY_GOOGLE_TOKEN, accessToken);
              localStorage.setItem(STORAGE_KEY_GOOGLE_TOKEN_EXPIRY, expiryTimestamp.toString());

              // Fetch official user profile from Google UserInfo endpoint
              try {
                const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${accessToken}` },
                });

                if (infoRes.ok) {
                  const data = await infoRes.json();
                  const profile: UserProfile = {
                    id: data.sub,
                    email: data.email,
                    username: data.name || data.email.split('@')[0],
                    displayName: data.name,
                    photoUrl: data.picture,
                    provider: 'google',
                    createdAt: new Date().toISOString(),
                  };

                  localStorage.setItem(STORAGE_KEY_GOOGLE_USER, JSON.stringify(profile));
                  resolve({ success: true, user: profile, token: accessToken });
                  return;
                }
              } catch (fetchErr) {
                console.warn('Could not fetch userinfo from Google, using basic profile', fetchErr);
              }

              // Fallback profile if userinfo API times out
              const basicUser: UserProfile = {
                id: `google-user-${Date.now()}`,
                email: 'google.account@gmail.com',
                username: 'Google User',
                displayName: 'Google Account',
                provider: 'google',
                createdAt: new Date().toISOString(),
              };
              localStorage.setItem(STORAGE_KEY_GOOGLE_USER, JSON.stringify(basicUser));
              resolve({ success: true, user: basicUser, token: accessToken });
            },
          });

          client.requestAccessToken({ prompt: 'consent' });
        } catch (initErr: unknown) {
          const msg = initErr instanceof Error ? initErr.message : 'Google OAuth initialization failed';
          resolve({ success: false, message: msg });
        }
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Google sign-in failed';
      return { success: false, message: errorMsg };
    }
  }

  /**
   * OAuth 2.0 Web Popup Fallback
   */
  private static async signInWithOAuthPopup(): Promise<{
    success: boolean;
    user?: UserProfile;
    token?: string;
    message?: string;
  }> {
    return new Promise((resolve) => {
      const redirectUri = window.location.origin;
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
        GOOGLE_CONFIG.webClientId
      )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(
        GOOGLE_CONFIG.scopes
      )}&prompt=consent`;

      const width = 500;
      const height = 620;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'GoogleSignInPopup',
        `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no`
      );

      if (!popup) {
        resolve({
          success: false,
          message: 'Popup blocked by browser. Please allow popups to sign in with Google.',
        });
        return;
      }

      // Check popup location for token in URL hash
      const pollTimer = setInterval(async () => {
        try {
          if (popup.closed) {
            clearInterval(pollTimer);
            resolve({ success: false, message: 'Google Sign-In window closed.' });
            return;
          }

          if (popup.location && popup.location.href.includes(redirectUri)) {
            const hash = popup.location.hash;
            if (hash && hash.includes('access_token=')) {
              clearInterval(pollTimer);
              popup.close();

              const params = new URLSearchParams(hash.replace('#', ''));
              const accessToken = params.get('access_token');
              const expiresIn = params.get('expires_in');

              if (accessToken) {
                const expiryTimestamp = Date.now() + (expiresIn ? parseInt(expiresIn, 10) : 3600) * 1000;
                localStorage.setItem(STORAGE_KEY_GOOGLE_TOKEN, accessToken);
                localStorage.setItem(STORAGE_KEY_GOOGLE_TOKEN_EXPIRY, expiryTimestamp.toString());

                // Fetch Google profile
                try {
                  const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${accessToken}` },
                  });
                  if (infoRes.ok) {
                    const data = await infoRes.json();
                    const profile: UserProfile = {
                      id: data.sub,
                      email: data.email,
                      username: data.name || data.email.split('@')[0],
                      displayName: data.name,
                      photoUrl: data.picture,
                      provider: 'google',
                      createdAt: new Date().toISOString(),
                    };
                    localStorage.setItem(STORAGE_KEY_GOOGLE_USER, JSON.stringify(profile));
                    resolve({ success: true, user: profile, token: accessToken });
                    return;
                  }
                } catch {
                  // Ignore
                }

                const basicUser: UserProfile = {
                  id: `google-user-${Date.now()}`,
                  email: 'google.account@gmail.com',
                  username: 'Google User',
                  displayName: 'Google Account',
                  provider: 'google',
                  createdAt: new Date().toISOString(),
                };
                localStorage.setItem(STORAGE_KEY_GOOGLE_USER, JSON.stringify(basicUser));
                resolve({ success: true, user: basicUser, token: accessToken });
                return;
              }
            }
          }
        } catch {
          // Cross-origin access might throw while user is on accounts.google.com; ignore until redirected
        }
      }, 500);
    });
  }

  /**
   * Sign out Google account
   */
  static signOut(): void {
    const token = localStorage.getItem(STORAGE_KEY_GOOGLE_TOKEN);
    if (token && window.google?.accounts?.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(token, () => {});
      } catch (e) {
        console.warn('Error revoking Google token', e);
      }
    }
    localStorage.removeItem(STORAGE_KEY_GOOGLE_USER);
    localStorage.removeItem(STORAGE_KEY_GOOGLE_TOKEN);
    localStorage.removeItem(STORAGE_KEY_GOOGLE_TOKEN_EXPIRY);
  }
}
