require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const tenantsRoutes = require('./routes/tenants');
const m365Routes = require('./routes/m365');
const auditRoutes = require('./routes/audit');
const oauthCallbackRoutes = require('./routes/oauthCallback');
const riskRoutes = require('./routes/risk');

const app = express();

// CORS must be before helmet
app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(204);
});

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = [process.env.FRONTEND_URL, 'http://localhost:3000'].filter(Boolean);
  if (!origin || allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  next();
});

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false, validate: { xForwardedForHeader: false } });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, validate: { xForwardedForHeader: false } });
app.use('/api/', limiter);
app.use('/api/auth/login', loginLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/microsoft', oauthCallbackRoutes);   // GET /api/auth/microsoft/callback
app.use('/api/users', usersRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/tenants/:tenantId', m365Routes);
app.use('/api/audit', auditRoutes);
app.use('/api/risk', riskRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', port: process.env.PORT, time: new Date() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`✅ M365 Manager Backend running on http://localhost:${PORT}`);
  console.log(`   OAuth callback: ${process.env.AZURE_REDIRECT_URI}`);
});
