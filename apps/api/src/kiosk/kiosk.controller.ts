import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { KioskService } from './kiosk.service';
import type { SensorReadings } from './sensor-classifier';

@Controller()
export class KioskController {
  constructor(private readonly kiosk: KioskService) {}

  /**
   * Station identity for the idle screen: rate, current state and branding,
   * without creating a session. Lets the kiosk show "₹35/kg · READY" — or
   * "FULL" — before the depositor commits to anything, instead of finding out
   * after picking a language.
   */
  @Get('kiosk/machines/:serialNo')
  info(@Param('serialNo') serialNo: string) {
    return this.kiosk.machineInfo(serialNo);
  }

  /** Kiosk screen 2: start a visit and get the QR payload. */
  @Post('kiosk/machines/:serialNo/sessions')
  start(
    @Param('serialNo') serialNo: string,
    @Body() body: { language?: string },
  ) {
    return this.kiosk.startSession(serialNo, body?.language);
  }

  /** Kiosk polls this while waiting for a scan, and again while processing. */
  @Get('kiosk/sessions/:id')
  get(@Param('id') id: string) {
    return this.kiosk.getSession(id);
  }

  /** Phone side of the QR scan: sign-up or auto-connect. */
  @Post('pair/:pairToken')
  pair(
    @Param('pairToken') pairToken: string,
    @Body() body: { phone?: string; upiId?: string; deviceToken?: string },
  ) {
    return this.kiosk.pair(pairToken, body ?? {});
  }

  /**
   * The pour. Readings come from the ESP32 in production; in build step 2 they
   * come from the kiosk's test panel.
   */
  @Post('kiosk/sessions/:id/deposit')
  deposit(@Param('id') id: string, @Body() body: SensorReadings) {
    return this.kiosk.submitDeposit(id, {
      capacitance: Number(body?.capacitance),
      colorValue: Number(body?.colorValue),
      weightDeltaG: Math.round(Number(body?.weightDeltaG)),
    });
  }
}
