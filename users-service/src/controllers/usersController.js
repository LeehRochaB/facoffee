const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const keycloak = require('../services/keycloakService')
const rabbit = require('../services/rabbitService')


function formatUser(u) {
  return {
    id: u.id, name: u.name, email: u.email,
    status: u.status, roles: u.roles.split(','),
    createdAt: u.createdAt, updatedAt: u.updatedAt, deactivatedAt: u.deactivatedAt
  }
}


exports.createUser = async (req, res) => {
  try {
    const { name, email, roles = ['PARTICIPANT'] } = req.body;

    if (!name || name.length < 3 || !email) {
      return res.status(400).json({
        status: 400,
        error: 'Bad Request',
        message: 'Campos invalidos.'
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({
        status: 409,
        error: 'Conflict',
        message: 'E-mail ja cadastrado.'
      });
    }

    const user = await prisma.user.create({
      data: { name, email, roles: roles.join(','), status: 'ACTIVE' }
    });

    // Keycloak e RabbitMQ não derrubam o cadastro se falharem
    try { await keycloak.createUser({ id: user.id, name, email, roles }); }
    catch (err) { console.warn('[Keycloak] Falha:', err.message); }

    try { await rabbit.publish('user.created', formatUser(user)); }
    catch (err) { console.warn('[RabbitMQ] Falha:', err.message); }

    return res.status(201).json(formatUser(user));
  } catch (e) {
    return res.status(500).json({
      status: 500,
      error: 'Internal Server Error',
      message: e.message
    });
  }
};


exports.listUsers = async (req, res) => {
  const { status, role, page = 0, size = 20 } = req.query
  const where = {}
  if (status) where.status = status
  if (role) where.roles = { contains: role }
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, skip: +page * +size, take: +size }),
    prisma.user.count({ where })
  ])
  return res.json({ items: items.map(formatUser), page: { page: +page, size: +size, totalElements: total, totalPages: Math.ceil(total / size) } })
}


exports.getUserById = async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.userId } })
  if (!user) return res.status(404).json({ status: 404, error: 'Not Found', message: 'Usuario nao encontrado.' })
  return res.json(formatUser(user))
}


exports.updateUser = async (req, res) => {
  const { name } = req.body
  const user = await prisma.user.findUnique({ where: { id: req.params.userId } })
  if (!user) return res.status(404).json({ status: 404, error: 'Not Found', message: 'Usuario nao encontrado.' })
  const updated = await prisma.user.update({ where: { id: req.params.userId }, data: { name } })
  return res.json(formatUser(updated))
}


exports.deactivateUser = async (req, res) => {
  const { reason } = req.body
  if (!reason || reason.length < 3)
    return res.status(400).json({ status: 400, error: 'Bad Request', message: 'Motivo obrigatorio.' })
  const user = await prisma.user.findUnique({ where: { id: req.params.userId } })
  if (!user) return res.status(404).json({ status: 404, error: 'Not Found', message: 'Usuario nao encontrado.' })
  const updated = await prisma.user.update({
    where: { id: req.params.userId },
    data: { status: 'INACTIVE', deactivatedAt: new Date() }
  })
  await rabbit.publish('user.deactivated', { ...formatUser(updated), reason })
  return res.json(formatUser(updated))
}


exports.replaceUserRoles = async (req, res) => {
  const { roles } = req.body
  if (!roles || roles.length === 0)
    return res.status(400).json({ status: 400, error: 'Bad Request', message: 'Roles obrigatorias.' })
  const user = await prisma.user.findUnique({ where: { id: req.params.userId } })
  if (!user) return res.status(404).json({ status: 404, error: 'Not Found', message: 'Usuario nao encontrado.' })
  const updated = await prisma.user.update({ where: { id: req.params.userId }, data: { roles: roles.join(',') } })
  await keycloak.updateUserRoles(req.params.userId, roles)
  await rabbit.publish('user.roles.replaced', formatUser(updated))
  return res.json(formatUser(updated))
}
