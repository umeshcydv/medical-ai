import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config.js';
import usersRouter from './routes/users.js';
import appointmentsRouter from './routes/appointments.js';
import intakeRouter from './routes/intake.js';
import visitsRouter from './routes/visits.js';
import messagesRouter from './routes/messages.js';
import patientsRouter from './routes/patients.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/users', usersRouter);
app.use('/appointments', appointmentsRouter);
app.use('/intake', intakeRouter);
app.use('/visits', visitsRouter);
app.use('/messages', messagesRouter);
app.use('/patients', patientsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'internal_server_error' });
});

const server = http.createServer(app);

// Socket.io for live updates (e.g. notify doctor when intake completes, patient when prescription arrives).
const io = new SocketIOServer(server, { cors: { origin: '*' } });
io.on('connection', (socket) => {
  const userId = socket.handshake.auth?.userId as string | undefined;
  if (userId) socket.join(`user:${userId}`);
});

export function emitToUser(userId: string, event: string, payload: unknown): void {
  io.to(`user:${userId}`).emit(event, payload);
}

server.listen(config.port, () => {
  console.log(`Backend listening on :${config.port}`);
});
