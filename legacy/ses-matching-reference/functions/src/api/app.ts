import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { ApiError } from './asyncHandler';
import { requireAuth } from './middleware/auth';
import { engineersRouter } from './routes/engineers';
import { feedbackRouter } from './routes/feedback';
import { matchesRouter } from './routes/matches';
import { projectsRouter } from './routes/projects';
import { weightsRouter } from './routes/weights';

export const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/projects', requireAuth, projectsRouter);
app.use('/engineers', requireAuth, engineersRouter);
app.use('/matches', requireAuth, matchesRouter);
app.use('/feedback', requireAuth, feedbackRouter);
app.use('/weights', requireAuth, weightsRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'not found' });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});
