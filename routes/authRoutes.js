// routes/authRoutes.js
const express = require('express');
const { register, login } = require('../controllers/authController');
const { check } = require('express-validator');

const router = express.Router();

router.post(
    '/register',
    [
      check('username', 'Username is required').notEmpty(),
      check('username', 'Username must be 3+ characters').isLength({ min: 3 }),
      check('password', 'Password is required').notEmpty(),
      check('password', 'Password must be 6+ characters').isLength({ min: 6 }),
    ],
    register
  );
  
  router.post(
    '/login',
    [
      check('username', 'Username is required').notEmpty(),
      check('password', 'Password is required').notEmpty(),
    ],
    login
  );
module.exports = router;
