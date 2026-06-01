const router = require('express').Router();

const ctrl = require('../controllers/usersController');
const {
  authenticate,
  requireRole,
  requireSelfOrManager
} = require('../middlewares/auth');

router.post(
  '/',
  ctrl.createUser
);

router.get(
  '/',
  authenticate,
  requireRole('MANAGER'),
  ctrl.listUsers
);

router.get(
  '/:userId',
  authenticate,
  requireSelfOrManager,
  ctrl.getUserById
);

router.patch(
  '/:userId',
  authenticate,
  requireSelfOrManager,
  ctrl.updateUser
);

router.delete(
  '/:userId',
  authenticate,
  requireSelfOrManager,
  ctrl.deactivateUser
);

router.put(
  '/:userId/roles',
  authenticate,
  requireRole('MANAGER'),
  ctrl.replaceUserRoles
);

module.exports = router;