import { describe, expect, it } from 'vitest';
import { createFakeServer } from '@/test/fakeServer.ts';
import { createHalAccountService } from './HalAccountService.ts';
import { createHalClient, ProblemError } from './hal.ts';

function setup() {
  const server = createFakeServer();
  const service = createHalAccountService(createHalClient(server.fetch));
  return { server, service };
}

describe('HalAccountService', () => {
  it('first run: setup is needed until the printed code makes an Owner', async () => {
    const { service } = setup();
    expect(await service.session()).toBeNull();
    expect(await service.setupNeeded()).toBe(true);

    const session = await service.setup('setup-code', 'ada', 'correct horse', 'Phone');
    expect(session).toMatchObject({ username: 'ada', role: 'owner', deviceName: 'Phone' });
    expect(await service.setupNeeded()).toBe(false);
    expect(await service.session()).toEqual(session);
    await expect(service.setup('setup-code', 'eve', 'password1', 'X')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('signs in with a password, and a wrong one is a 401 ProblemError', async () => {
    const { server, service } = setup();
    server.seedOwner('ada', 'correct horse');
    await expect(service.signIn('ada', 'wrong password', 'Phone')).rejects.toBeInstanceOf(
      ProblemError
    );
    const session = await service.signIn('ada', 'correct horse', 'Phone');
    expect(session.username).toBe('ada');
  });

  it('pairs a Device with a device code, once', async () => {
    const { server, service } = setup();
    const owner = server.seedOwner();
    const code = server.mintCode('device', owner.id);

    const session = await service.pair(code, 'Chrome on Android');
    expect(session).toMatchObject({ accountId: owner.id, deviceName: 'Chrome on Android' });
    await service.signOut();
    await expect(service.pair(code, 'Again')).rejects.toMatchObject({ status: 401 });
  });

  it('an Invite is refused as a device code without being spent, then joins', async () => {
    const { server, service } = setup();
    const owner = server.seedOwner();
    const invite = server.mintCode('invite', owner.id);

    await expect(service.pair(invite, 'Phone')).rejects.toMatchObject({ status: 401 });
    server.seedMember('bob');
    await expect(service.join(invite, 'bob', 'password1', 'Phone')).rejects.toMatchObject({
      status: 409,
      message: 'That username is taken',
    });
    const session = await service.join(invite, 'cleo', 'password1', 'Phone');
    expect(session).toMatchObject({ username: 'cleo', role: 'member' });
  });

  it('lists, revokes and mints for the signed-in Account', async () => {
    const { server, service } = setup();
    server.seedOwner('ada', 'correct horse');
    await service.signIn('ada', 'correct horse', 'Phone');

    const devices = await service.devices();
    expect(devices.map((d) => [d.name, d.current])).toEqual([
      ['Laptop', false],
      ['Phone', true],
    ]);
    await service.revokeDevice(devices[0]!.id);
    expect((await service.devices()).map((d) => d.name)).toEqual(['Phone']);

    expect(await service.createDeviceCode()).toEqual({
      code: expect.stringContaining('device'),
      expiresAt: expect.any(String),
    });
    expect((await service.createInvite()).code).toContain('invite');
  });

  it('a member cannot invite or list Accounts; the Owner lists them and resets a password', async () => {
    const { server, service } = setup();
    server.seedOwner('ada', 'correct horse');
    const bob = server.seedMember('bob', 'battery staple');

    await service.signIn('bob', 'battery staple', 'Phone');
    await expect(service.createInvite()).rejects.toMatchObject({ status: 403 });

    await expect(service.accounts()).rejects.toMatchObject({ status: 403 });
    await service.signOut();

    await service.signIn('ada', 'correct horse', 'Laptop');
    expect((await service.accounts()).map((a) => [a.username, a.role])).toEqual([
      ['ada', 'owner'],
      ['bob', 'member'],
    ]);
    await service.resetPassword(bob.id, 'new password');
    expect(bob.password).toBe('new password');
    await expect(service.resetPassword(crypto.randomUUID(), 'x')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('a body the contract rejects throws instead of reaching the app', async () => {
    const client = createHalClient(
      async () => new Response(JSON.stringify({ _links: {} }), { status: 200 })
    );
    await expect(createHalAccountService(client).session()).rejects.toThrow();
  });
});
