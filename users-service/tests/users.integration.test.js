/**
 * Testes de integração — endpoints HTTP com supertest
 */

jest.mock('@prisma/client', () => {
  const mUser = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  };
  return { PrismaClient: jest.fn(() => ({ user: mUser })) };
});

jest.mock('../src/services/keycloakService', () => ({
  createUser: jest.fn().mockResolvedValue(undefined),
  updateUserRoles: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../src/services/rabbitService', () => ({
  publish: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn((token, getKey, opts, callback) => {
    if (token === 'token-manager') {
      callback(null, { sub: 'usr_manager', roles: ['MANAGER'], realm_access: { roles: ['MANAGER'] } });
    } else if (token === 'token-participant') {
      callback(null, { sub: 'usr_participant', roles: ['PARTICIPANT'], realm_access: { roles: ['PARTICIPANT'] } });
    } else {
      callback(new Error('Token inválido'));
    }
  })
}));

jest.mock('jwks-rsa', () => jest.fn(() => ({
  getSigningKey: jest.fn((kid, cb) => cb(null, { getPublicKey: () => 'chave-publica' }))
})));

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const app = require('../src/app');

const userDB = {
  id: 'usr_123', name: 'Maria Silva', email: 'maria@teste.com',
  status: 'ACTIVE', roles: 'PARTICIPANT',
  createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'), deactivatedAt: null
};

beforeEach(() => jest.clearAllMocks());

describe('POST /users', () => {
  it('cria usuário e retorna 201', async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue(userDB);
    const res = await request(app).post('/users').send({ name: 'Maria Silva', email: 'maria@teste.com' });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('maria@teste.com');
  });

  it('retorna 400 para nome inválido', async () => {
    const res = await request(app).post('/users').send({ name: 'Ab', email: 'maria@teste.com' });
    expect(res.status).toBe(400);
  });

  it('retorna 400 para email ausente', async () => {
    const res = await request(app).post('/users').send({ name: 'Maria Silva' });
    expect(res.status).toBe(400);
  });

  it('retorna 409 — conflito de e-mail', async () => {
    db.user.findUnique.mockResolvedValue(userDB);
    const res = await request(app).post('/users').send({ name: 'Maria Silva', email: 'maria@teste.com' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conflict');
  });
});

describe('GET /users', () => {
  it('MANAGER tem acesso e recebe lista paginada', async () => {
    db.user.findMany.mockResolvedValue([userDB]);
    db.user.count.mockResolvedValue(1);
    const res = await request(app).get('/users').set('Authorization', 'Bearer token-manager');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it('PARTICIPANT é barrado com 403', async () => {
    const res = await request(app).get('/users').set('Authorization', 'Bearer token-participant');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('retorna 401 sem token', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(401);
  });
});

describe('GET /users/:userId', () => {
  it('MANAGER pode consultar qualquer usuário', async () => {
    db.user.findUnique.mockResolvedValue(userDB);
    const res = await request(app).get('/users/usr_123').set('Authorization', 'Bearer token-manager');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('usr_123');
  });

  it('PARTICIPANT pode consultar o próprio usuário', async () => {
    db.user.findUnique.mockResolvedValue({ ...userDB, id: 'usr_participant' });
    const res = await request(app).get('/users/usr_participant').set('Authorization', 'Bearer token-participant');
    expect(res.status).toBe(200);
  });

  it('PARTICIPANT é barrado ao consultar outro usuário', async () => {
    const res = await request(app).get('/users/usr_outro').set('Authorization', 'Bearer token-participant');
    expect(res.status).toBe(403);
  });

  it('retorna 404 para usuário inexistente', async () => {
    db.user.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/users/nao_existe').set('Authorization', 'Bearer token-manager');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /users/:userId', () => {
  it('MANAGER atualiza qualquer usuário', async () => {
    db.user.findUnique.mockResolvedValue(userDB);
    db.user.update.mockResolvedValue({ ...userDB, name: 'Maria Souza' });
    const res = await request(app).patch('/users/usr_123').set('Authorization', 'Bearer token-manager').send({ name: 'Maria Souza' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Maria Souza');
  });

  it('PARTICIPANT é barrado ao atualizar outro usuário', async () => {
    const res = await request(app).patch('/users/usr_outro').set('Authorization', 'Bearer token-participant').send({ name: 'Novo Nome' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /users/:userId', () => {
  it('desativa usuário e retorna INACTIVE', async () => {
    db.user.findUnique.mockResolvedValue(userDB);
    db.user.update.mockResolvedValue({ ...userDB, status: 'INACTIVE', deactivatedAt: new Date() });
    const res = await request(app).delete('/users/usr_123').set('Authorization', 'Bearer token-manager').send({ reason: 'Não participa mais da copa' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('INACTIVE');
  });

  it('retorna 400 quando motivo está ausente', async () => {
    const res = await request(app).delete('/users/usr_123').set('Authorization', 'Bearer token-manager').send({});
    expect(res.status).toBe(400);
  });

  it('PARTICIPANT é barrado ao desativar outro usuário', async () => {
    const res = await request(app).delete('/users/usr_outro').set('Authorization', 'Bearer token-participant').send({ reason: 'Motivo' });
    expect(res.status).toBe(403);
  });
});

describe('PUT /users/:userId/roles', () => {
  it('MANAGER substitui roles com sucesso', async () => {
    db.user.findUnique.mockResolvedValue(userDB);
    db.user.update.mockResolvedValue({ ...userDB, roles: 'MANAGER' });
    const res = await request(app).put('/users/usr_123/roles').set('Authorization', 'Bearer token-manager').send({ roles: ['MANAGER'] });
    expect(res.status).toBe(200);
    expect(res.body.roles).toContain('MANAGER');
  });

  it('retorna 400 para roles vazio', async () => {
    const res = await request(app).put('/users/usr_123/roles').set('Authorization', 'Bearer token-manager').send({ roles: [] });
    expect(res.status).toBe(400);
  });

  it('PARTICIPANT é barrado com 403', async () => {
    const res = await request(app).put('/users/usr_123/roles').set('Authorization', 'Bearer token-participant').send({ roles: ['MANAGER'] });
    expect(res.status).toBe(403);
  });
});
