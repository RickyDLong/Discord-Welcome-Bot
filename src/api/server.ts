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

  app.listen(config.PORT, () => {
    console.log(`🌐 API server running on port ${config.PORT}`);
  });
}
