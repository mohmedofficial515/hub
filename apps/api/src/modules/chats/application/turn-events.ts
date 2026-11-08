/**
 * @file What other modules hear about turns, in this process (docs/16 §9). The queue listens, so a run knows when its turn waits and when it ended.
 * @description Plain listeners, called after the event is written and committed. A listener that throws is logged and never stops the turn or the others.
 */
import type { ChangedFile, TurnFailure, TurnLimit, TurnStatus } from '@hub/contracts';
import { Injectable, Logger } from '@nestjs/common';

export interface TurnEndedFact {
  readonly workspaceId: string;
  readonly userId: string;
  readonly chatId: string;
  readonly messageId: string;
  readonly status: Exclude<TurnStatus, 'running'>;
  readonly failure: TurnFailure | null;
  /** Seconds since the epoch, as the engine reports it. */
  readonly resetsAt: number | null;
  readonly changedFiles: readonly ChangedFile[];
}

export interface TurnWaitingFact {
  readonly workspaceId: string;
  readonly userId: string;
  readonly chatId: string;
  readonly messageId: string;
  readonly approvalId: string;
  readonly kind: 'approval' | 'question';
  readonly command: string;
}

export interface TurnLimitFact {
  readonly workspaceId: string;
  readonly userId: string;
  readonly chatId: string;
  readonly limit: TurnLimit;
}

type Listener<T> = (fact: T) => void | Promise<void>;

@Injectable()
export class ChatTurnEvents {
  private readonly logger = new Logger(ChatTurnEvents.name);
  private readonly endedListeners: Listener<TurnEndedFact>[] = [];
  private readonly waitingListeners: Listener<TurnWaitingFact>[] = [];
  private readonly limitListeners: Listener<TurnLimitFact>[] = [];

  onEnded(listener: Listener<TurnEndedFact>): void {
    this.endedListeners.push(listener);
  }

  onWaiting(listener: Listener<TurnWaitingFact>): void {
    this.waitingListeners.push(listener);
  }

  onLimit(listener: Listener<TurnLimitFact>): void {
    this.limitListeners.push(listener);
  }

  async ended(fact: TurnEndedFact): Promise<void> {
    await this.call(this.endedListeners, fact);
  }

  async waiting(fact: TurnWaitingFact): Promise<void> {
    await this.call(this.waitingListeners, fact);
  }

  async limit(fact: TurnLimitFact): Promise<void> {
    await this.call(this.limitListeners, fact);
  }

  private async call<T>(listeners: readonly Listener<T>[], fact: T): Promise<void> {
    for (const listener of listeners) {
      try {
        await listener(fact);
      } catch (error) {
        this.logger.warn(`A turn listener failed: ${String(error)}`);
      }
    }
  }
}
