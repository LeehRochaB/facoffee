const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const client = jwksClient({
  jwksUri: `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/certs`
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    callback(err, key?.getPublicKey());
  });
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 401,
      error: 'Unauthorized',
      message: 'Token ausente.'
    });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, getKey, {}, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        status: 401,
        error: 'Unauthorized',
        message: 'Token invalido.'
      });
    }

    req.user = decoded;
    req.userRoles = decoded.roles || [];

    next();
  });
}

function requireRole(...roles) {
  return (req, res, next) => {
    const hasRole = roles.some(role =>
      req.userRoles.includes(role)
    );

    if (!hasRole) {
      return res.status(403).json({
        status: 403,
        error: 'Forbidden',
        message: 'Sem permissao.'
      });
    }

    next();
  };
}

function requireSelfOrManager(req, res, next) {
  const isManager = req.userRoles.includes('MANAGER');
  const isSelf = req.user.sub === req.params.userId;

  if (!isManager && !isSelf) {
    return res.status(403).json({
      status: 403,
      error: 'Forbidden',
      message: 'Sem permissao.'
    });
  }

  next();
}

module.exports = {
  authenticate,
  requireRole,
  requireSelfOrManager
};