import express from 'express';
import cors from 'cors';
import { config } from '../config';
import { statsRouter } from './routes/stats';

export function startApiServer(): void {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok', bot: 'Archix Bot' }));
  app.use('/api/stats', statsRouter);

  function listen(port: number): void {
    const server = app.listen(port, () => {
      console.log(`🌐 API server running on port ${port}`);
    });
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`⚠️  Port ${port} in use, trying ${port + 1}…`);
        listen(port + 1);
      } else {
        throw err;
      }
    });
  }

  listen(config.PORT);
}
