import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// All money is BigInt paise, and JSON.stringify throws on BigInt by default.
// Serialise as a string so amounts survive the wire without float rounding.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (
  this: bigint,
) {
  return this.toString();
};

async function bootstrap(): Promise<void> {
  // rawBody is required to verify Razorpay webhook signatures, which are an
  // HMAC over the exact bytes received — re-serialising the parsed JSON would
  // not reproduce them.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors();
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}`);
}

void bootstrap();
