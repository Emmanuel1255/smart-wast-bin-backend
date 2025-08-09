// src/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { authRoutes } from './routes/auth';
import { binRoutes } from './routes/bins';
import { driverRoutes } from './routes/drivers';
import { truckRoutes } from './routes/trucks';
import { pickupRoutes } from './routes/pickups';
import { analyticsRoutes } from './routes/analytics';
import { RealtimeDriverService } from './services/realtimeDriverService';
import { RealtimeBinService } from './services/realtimeBinService';
import { MQTTService } from './services/mqttService';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] 
    : ['http://localhost:3000', 'http://localhost:3001','http://localhost:5173'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// General middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const server = createServer(app);


// Initialize Socket.io
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://your-frontend-domain.com'] 
      : ['http://localhost:3000', 'http://localhost:3001','http://localhost:5173'],
    methods: ['GET', 'POST']
  }
});

// Initialize real-time services
const realtimeBinService = new RealtimeBinService(io);
realtimeBinService.initialize();

// Initialize MQTT service
const mqttService = new MQTTService(realtimeBinService);

const realtimeDriverService = new RealtimeDriverService(io);
realtimeDriverService.initialize();

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/bins', binRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/trucks', truckRoutes);
app.use('/api/pickups', pickupRoutes);
app.use('/api/analytics', analyticsRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = env.PORT;

app.listen(PORT, () => {
  console.log(`🚀 Smart Waste Backend Server running on port ${PORT}`);
  console.log(`📊 Environment: ${env.NODE_ENV}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

export default app;