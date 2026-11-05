/**
 * @file Clock token, so reminders and tests control time (docs/11 §1.1).
 */
import { Global, Module } from '@nestjs/common';

export const CLOCK = Symbol('CLOCK');

export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** Test double. Lives here because e2e tests and later modules' specs both need it. */
export class FakeClock implements Clock {
  constructor(private current: Date = new Date('2026-11-05T09:00:00.000Z')) {}

  now(): Date {
    return new Date(this.current);
  }

  set(date: Date): void {
    this.current = date;
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

@Global()
@Module({
  providers: [{ provide: CLOCK, useClass: SystemClock }],
  exports: [CLOCK],
})
export class ClockModule {}
