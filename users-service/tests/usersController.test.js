/**
 * Testes unitários — usersController.js
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

const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const ctrl = require('../src/controllers/usersController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides = {}) {
  return { body: {}, params: {}, query: {}, user: { sub: 'usr_test' }, userRoles: ['MANAGER'], ...overrides };
}

const userDB = {
  id: 'usr_123', name: 'Maria Silva', email: 'maria@teste.com',
  status: 'ACTIVE', roles: 'PARTICIPANT',
  createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'), deactivatedAt: null
};

beforeEach(() => jest.clearAllMocks());

describe('createUser', () => {
  it('cria usuário com sucesso e retorna 201', async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue(userDB);
    const res = mockRes();
    await ctrl.createUser(mockReq({ body: { name: 'Maria Silva', email: 'maria@teste.com' } }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ email: 'maria@teste.com', status: 'ACTIVE' }));
  });

  it('retorna 400 quando nome tem menos de 3 caracteres', async () => {
    const res = mockRes();
    await ctrl.createUser(mockReq({ body: { name: 'Ab', email: 'x@y.com' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna 400 quando email está ausente', async () => {
    const res = mockRes();
    await ctrl.createUser(mockReq({ body: { name: 'Maria Silva' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna 409 quando email já está cadastrado', async () => {
    db.user.findUnique.mockResolvedValue(userDB);
    const res = mockRes();
    await ctrl.createUser(mockReq({ body: { name: 'Maria Silva', email: 'maria@teste.com' } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Conflict' }));
  });

  it('usa PARTICIPANT como role padrão', async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue(userDB);
    const res = mockRes();
    await ctrl.createUser(mockReq({ body: { name: 'Maria Silva', email: 'maria@teste.com' } }), res);
    expect(db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ roles: 'PARTICIPANT' }) })
    );
  });
});

describe('listUsers', () => {
  it('retorna lista paginada', async () => {
    db.user.findMany.mockResolvedValue([userDB]);
    db.user.count.mockResolvedValue(1);
    const res = mockRes();
    await ctrl.listUsers(mockReq({ query: { page: '0', size: '20' } }), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      items: expect.any(Array),
      page: expect.objectContaining({ totalElements: 1 })
    }));
  });

  it('filtra por status', async () => {
    db.user.findMany.mockResolvedValue([]);
    db.user.count.mockResolvedValue(0);
    const res = mockRes();
    await ctrl.listUsers(mockReq({ query: { status: 'INACTIVE' } }), res);
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'INACTIVE' }) })
    );
  });
});

describe('getUserById', () => {
  it('retorna usuário existente', async () => {
    db.user.findUnique.mockResolvedValue(userDB);
    const res = mockRes();
    await ctrl.getUserById(mockReq({ params: { userId: 'usr_123' } }), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 'usr_123' }));
  });

  it('retorna 404 quando não existe', async () => {
    db.user.findUnique.mockResolvedValue(null);
    const res = mockRes();
    await ctrl.getUserById(mockReq({ params: { userId: 'nao_existe' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('updateUser', () => {
  it('atualiza nome e retorna 200', async () => {
    db.user.findUnique.mockResolvedValue(userDB);
    db.user.update.mockResolvedValue({ ...userDB, name: 'Maria Souza' });
    const res = mockRes();
    await ctrl.updateUser(mockReq({ params: { userId: 'usr_123' }, body: { name: 'Maria Souza' } }), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ name: 'Maria Souza' }));
  });

  it('retorna 404 para usuário inexistente', async () => {
    db.user.findUnique.mockResolvedValue(null);
    const res = mockRes();
    await ctrl.updateUser(mockReq({ params: { userId: 'nao_existe' }, body: { name: 'X' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('deactivateUser', () => {
  it('desativa usuário e retorna INACTIVE', async () => {
    db.user.findUnique.mockResolvedValue(userDB);
    db.user.update.mockResolvedValue({ ...userDB, status: 'INACTIVE', deactivatedAt: new Date() });
    const res = mockRes();
    await ctrl.deactivateUser(mockReq({ params: { userId: 'usr_123' }, body: { reason: 'Não participa mais' } }), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'INACTIVE' }));
  });

  it('retorna 400 quando motivo está ausente', async () => {
    const res = mockRes();
    await ctrl.deactivateUser(mockReq({ params: { userId: 'usr_123' }, body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna 400 quando motivo tem menos de 3 caracteres', async () => {
    const res = mockRes();
    await ctrl.deactivateUser(mockReq({ params: { userId: 'usr_123' }, body: { reason: 'Ab' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna 404 quando usuário não existe', async () => {
    db.user.findUnique.mockResolvedValue(null);
    const res = mockRes();
    await ctrl.deactivateUser(mockReq({ params: { userId: 'nao_existe' }, body: { reason: 'Motivo válido' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('replaceUserRoles', () => {
  it('substitui roles e retorna 200', async () => {
    db.user.findUnique.mockResolvedValue(userDB);
    db.user.update.mockResolvedValue({ ...userDB, roles: 'MANAGER' });
    const res = mockRes();
    await ctrl.replaceUserRoles(mockReq({ params: { userId: 'usr_123' }, body: { roles: ['MANAGER'] } }), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ roles: ['MANAGER'] }));
  });

  it('retorna 400 quando roles está vazio', async () => {
    const res = mockRes();
    await ctrl.replaceUserRoles(mockReq({ params: { userId: 'usr_123' }, body: { roles: [] } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna 404 quando usuário não existe', async () => {
    db.user.findUnique.mockResolvedValue(null);
    const res = mockRes();
    await ctrl.replaceUserRoles(mockReq({ params: { userId: 'nao_existe' }, body: { roles: ['MANAGER'] } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
