import {
  AccountsResponse,
  type CodeRequest,
  CodeResponse,
  DevicesResponse,
  SessionResponse,
} from '@/contract/index.ts';
import type { AccountService, PairingCode, Session } from '../Remote.ts';
import { type HalClient, ProblemError } from './hal.ts';

const toSession = (body: SessionResponse): Session => ({
  accountId: body.account.id,
  username: body.account.username,
  role: body.account.role,
  deviceId: body.device.id,
  deviceName: body.device.name,
});

/**
 * `AccountService` over the Self-hosted Server's HAL API (ADR 0018). The session
 * is an `HttpOnly` cookie the browser keeps, so nothing here stores a secret.
 */
export function createHalAccountService(hal: HalClient): AccountService {
  const openSession = async (rel: 'session' | 'accounts', body: object) =>
    toSession(await hal.json(SessionResponse, await hal.link(rel), { method: 'POST', body }));

  const mint = async (kind: CodeRequest['kind']): Promise<PairingCode> => {
    const { code, expiresAt } = await hal.json(CodeResponse, await hal.link('codes'), {
      method: 'POST',
      body: { kind },
    });
    return { code, expiresAt };
  };

  return {
    async session() {
      try {
        return toSession(await hal.json(SessionResponse, await hal.link('session')));
      } catch (error) {
        if (error instanceof ProblemError && error.status === 401) return null;
        throw error;
      }
    },
    signIn: (username, password, deviceName) =>
      openSession('session', { username, password, deviceName }),
    async signOut() {
      await hal.send(await hal.link('session'), { method: 'DELETE' });
    },
    async devices() {
      const body = await hal.json(DevicesResponse, await hal.link('devices'));
      return body._embedded.devices.map(({ id, name, lastSeenAt, current }) => ({
        id,
        name,
        lastSeenAt,
        current,
      }));
    },
    async revokeDevice(id) {
      // The Device's own `self` link, so the route is the server's to name.
      const body = await hal.json(DevicesResponse, await hal.link('devices'));
      const device = body._embedded.devices.find((d) => d.id === id);
      if (!device) throw new ProblemError(404, 'No such Device');
      await hal.send(device._links.self.href, { method: 'DELETE' });
    },
    createInvite: () => mint('invite'),
    createDeviceCode: () => mint('device'),
    async setupNeeded() {
      return (await hal.root())._links.setup !== undefined;
    },
    async setup(code, username, password, deviceName) {
      const setup = (await hal.root())._links.setup;
      if (!setup) throw new ProblemError(404, 'This server already has an Owner');
      return toSession(
        await hal.json(SessionResponse, setup.href, {
          method: 'POST',
          body: { code, username, password, deviceName },
        })
      );
    },
    pair: (code, deviceName) => openSession('session', { code, deviceName }),
    join: (code, username, password, deviceName) =>
      openSession('accounts', { code, username, password, deviceName }),
    async accounts() {
      const body = await hal.json(AccountsResponse, await hal.link('accounts'));
      return body._embedded.accounts.map(({ id, username, role, createdAt }) => ({
        id,
        username,
        role,
        createdAt,
      }));
    },
    async resetPassword(accountId, password) {
      // The Account's own `password` link, so the route is the server's to name.
      const body = await hal.json(AccountsResponse, await hal.link('accounts'));
      const account = body._embedded.accounts.find((a) => a.id === accountId);
      if (!account) throw new ProblemError(404, 'No such Account');
      await hal.send(account._links.password.href, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
    },
  };
}
