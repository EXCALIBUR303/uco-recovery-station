import { createApp } from './bootstrap';

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}`);
}

void bootstrap();
