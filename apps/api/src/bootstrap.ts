import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// All money is BigInt paise, and JSON.stringify throws on BigInt by default.
// Serialise as a string so amounts survive the wire without float rounding.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (
  this: bigint,
) {
  return this.toString();
};

/**
 * Shared Nest app construction for both the long-running process (main.ts)
 * and the serverless entrypoint (api/index.js) — same app, different host.
 */
export async function createApp(): Promise<INestApplication> {
  // rawBody is required to verify Razorpay webhook signatures, which are an
  // HMAC over the exact bytes received — re-serialising the parsed JSON would
  // not reproduce them.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors();
  return app;
}
