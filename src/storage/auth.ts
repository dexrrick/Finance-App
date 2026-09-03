import { AuthResponse, UserProfile } from '../core/types';

const STORAGE_KEY_AUTH_USER = 'agy_auth_current_user_v1';
const STORAGE_KEY_AUTH_TOKEN = 'agy_auth_session_token_v1';
const STORAGE_KEY_LOCAL_USERS = 'agy_auth_local_vault_users_v1';

export class AuthService {
  /**
   * Cryptographic SHA-256 Hash using browser Web Crypto API
   */
  static async hashPassword(password: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + '::salt::' + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Create account / Sign up
   * Checks Cloudflare backend first; falls back to local secure vault if offline
   */
  static async signup(
    email: string,
    username: string,
    password: string,
    workerUrl?: string
  ): Promise<AuthResponse> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim() || cleanEmail.split('@')[0];

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Please enter a valid email address.' };
    }
    if (password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters long.' };
    }

    // Attempt Cloudflare Pages Functions backend signup
    const baseUrl = (workerUrl || '').replace(/\/+$/, '');
    const apiUrl = baseUrl ? `${baseUrl}/api/auth/signup` : '/api/auth/signup';

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, username: cleanUsername, password }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await response.json();
        if (response.ok && json.success) {
          this.persistSession(json.user, json.token);
          return json;
        } else if (!response.ok) {
          return { success: false, message: json.error || json.message || 'Signup failed' };
        }
      }
    } catch {
      // Backend not reached or offline; proceed with client-side secure vault
    }

    // Local-First Cryptographic Vault Signup
    try {
      const localUsersRaw = localStorage.getItem(STORAGE_KEY_LOCAL_USERS);
      const localUsers = localUsersRaw ? JSON.parse(localUsersRaw) : {};

      if (localUsers[cleanEmail]) {
        return { success: false, message: 'An account with this email already exists.' };
      }

      const salt = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      const passwordHash = await this.hashPassword(password, salt);
      const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

      const user: UserProfile = {
        id: userId,
        email: cleanEmail,
        username: cleanUsername,
        createdAt: new Date().toISOString(),
      };

      localUsers[cleanEmail] = {
        user,
        salt,
        passwordHash,
      };

      localStorage.setItem(STORAGE_KEY_LOCAL_USERS, JSON.stringify(localUsers));
      const token = 'token_' + btoa(userId + ':' + Date.now());
      this.persistSession(user, token);

      return {
        success: true,
        message: 'Account created securely!',
        user,
        token,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Failed to create account: ${msg}` };
    }
  }

  /**
   * Log In / Authenticate
   */
  static async login(
    email: string,
    password: string,
    workerUrl?: string
  ): Promise<AuthResponse> {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      return { success: false, message: 'Email and password are required.' };
    }

    // Try Cloudflare backend
    const baseUrl = (workerUrl || '').replace(/\/+$/, '');
    const apiUrl = baseUrl ? `${baseUrl}/api/auth/login` : '/api/auth/login';

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await response.json();
        if (response.ok && json.success) {
          this.persistSession(json.user, json.token);
          return json;
        } else if (!response.ok) {
          return { success: false, message: json.error || json.message || 'Invalid credentials' };
        }
      }
    } catch {
      // Backend not reached; fall back to local vault check
    }

    // Local Vault Authentication
    try {
      const localUsersRaw = localStorage.getItem(STORAGE_KEY_LOCAL_USERS);
      const localUsers = localUsersRaw ? JSON.parse(localUsersRaw) : {};
      const record = localUsers[cleanEmail];

      if (!record) {
        return { success: false, message: 'Account not found. Please create an account first.' };
      }

      const computedHash = await this.hashPassword(password, record.salt);
      if (computedHash !== record.passwordHash) {
        return { success: false, message: 'Incorrect password. Please try again.' };
      }

      const token = 'token_' + btoa(record.user.id + ':' + Date.now());
      this.persistSession(record.user, token);

      return {
        success: true,
        message: 'Login successful!',
        user: record.user,
        token,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Login error: ${msg}` };
    }
  }

  /**
   * Get Current Session
   */
  static getCurrentSession(): { user: UserProfile | null; token: string | null } {
    try {
      const userRaw = localStorage.getItem(STORAGE_KEY_AUTH_USER);
      const token = localStorage.getItem(STORAGE_KEY_AUTH_TOKEN);
      if (userRaw && token) {
        return { user: JSON.parse(userRaw), token };
      }
    } catch (e) {
      console.error('Failed to parse user session', e);
    }
    return { user: null, token: null };
  }

  /**
   * Persist session
   */
  static persistSession(user: UserProfile, token: string): void {
    localStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(user));
    localStorage.setItem(STORAGE_KEY_AUTH_TOKEN, token);
  }

  /**
   * Log out
   */
  static logout(): void {
    localStorage.removeItem(STORAGE_KEY_AUTH_USER);
    localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
  }
}
