require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

function validateEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production';
  const missing = [];

  if (isProduction && !process.env.ADMIN_PASSWORD) {
    missing.push('ADMIN_PASSWORD');
  }

  if (isProduction && !process.env.COOKIE_SECRET) {
    missing.push('COOKIE_SECRET');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
}

validateEnvironment();

const scanRoutes = require('./routes/scan');
const workersRoutes = require('./routes/workers');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'school-attendance-secret-key-2026';

app.disable('x-powered-by');
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(cookieParser(COOKIE_SECRET));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Enable CORS for frontend during local development
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.CLIENT_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in dev, cookie is still secured
  },
  credentials: true
}));

// API Routes
app.use('/api/scan', scanRoutes);
app.use('/api/workers', workersRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Production: Serve React client build
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  // SPA fallback for /scan, /admin, and all other non-API routes (Express 4 & 5 compatible)
  app.use((req, res) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      res.sendFile('index.html', { root: clientDistPath });
    } else {
      res.status(404).json({ error: 'Endpoint not found' });
    }
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 School Attendance Server running on http://localhost:${PORT}`);
    console.log(`🔒 Admin Password configured: ${process.env.ADMIN_PASSWORD ? 'Yes' : 'Using default (12345Admin)'}`);
  });
}

module.exports = app;
module.exports.validateEnvironment = validateEnvironment;
