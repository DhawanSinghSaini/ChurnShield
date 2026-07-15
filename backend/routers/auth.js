const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET;

// 1. POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const result = await db.query(
      `SELECT u.id, u.business_id, u.name, u.email, u.hashed_password, u.role, b.name as business_name 
       FROM business_users u
       JOIN businesses b ON u.business_id = b.id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.hashed_password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        business_id: user.business_id, 
        role: user.role,
        name: user.name, 
        email: user.email,
        business_name: user.business_name
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      access_token: token,
      token_type: 'bearer',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      business: { id: user.business_id, name: user.business_name }
    });

  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// 3. GET /api/users - List team members of this tenant
router.get('/users', requireAuth, async (req, res) => {
  try {
    const businessId = req.user.business_id;
    const result = await db.query(
      'SELECT id, name, email, role, created_at FROM business_users WHERE business_id = $1 ORDER BY role ASC, name ASC',
      [businessId]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Error listing business users:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 4. POST /api/users - Create new user (ADMIN only)
router.post('/users', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const businessId = req.user.business_id;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields (name, email, password, role) are required.' });
    }

    const roleUpper = role.toUpperCase();
    if (!['ADMIN', 'VIEWER'].includes(roleUpper)) {
      return res.status(400).json({ error: 'Invalid role. Must be ADMIN or VIEWER.' });
    }

    const checkEmail = await db.query('SELECT id FROM business_users WHERE email = $1', [email]);
    if (checkEmail.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO business_users (business_id, name, email, hashed_password, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, created_at`,
      [businessId, name, email, hashedPassword, roleUpper]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating business user:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
