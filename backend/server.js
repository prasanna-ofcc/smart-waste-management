require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');

const { createRealtime } = require('./realtime/socket');
const { startBinFillSimulation } = require('./services/simulationService');
const { AppError } = require('./utils/errors');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const binRoutes = require('./routes/bins');
const workerRoutes = require('./routes/workers');
const requestRoutes = require('./routes/requests');
const analyticsRoutes = require('./routes/analytics');
const profileRoutes = require('./routes/profile');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: '*' }));
app.use(express.json());

const realtime = createRealtime(server);
app.locals.broadcast = realtime.broadcast;

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bins', binRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/profile', profileRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), database: 'supabase' });
});

const frontendBuildPath = path.resolve(__dirname, '../frontend/build');
app.use(express.static(frontendBuildPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  return res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

app.use((_req, _res, next) => {
  next(new AppError('Route not found.', 404));
});

app.use((err, _req, res, _next) => {
  const status = err.statusCode || 500;
  const message = err.message || 'Internal server error.';
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({ message });
});

server.listen(PORT, () => {
  console.log(`Smart Waste backend listening on ${PORT}`);
  console.log(`REST: http://localhost:${PORT}/api`);
  console.log(`WS: ws://localhost:${PORT}`);

  startBinFillSimulation({ broadcast: realtime.broadcast });
});
