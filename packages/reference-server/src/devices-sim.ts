/**
 * Simulated facility devices for the sandbox: gates that vend after a
 * delay, a pay station that can be forced into fault, device state
 * tracking, and command execution.
 */
import type { Dispatcher } from './events/dispatcher.js';
import type { Store } from './store.js';
import { IDS } from './fixtures.js';

export interface DeviceState {
  device: { id: string; className: 'SupplementalEquipment' };
  deviceState: string;
  lastCommunication: string;
  stateChangedTime: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class DeviceSimulator {
  private readonly states = new Map<string, DeviceState>();
  private readonly pending = new Set<Promise<void>>();

  constructor(
    private readonly store: Store,
    private readonly dispatcher: Dispatcher,
    private readonly actionDelayMs = 500,
    private readonly raiseAlert?: (alert: Record<string, unknown>) => void
  ) {
    for (const device of store.for('SupplementalEquipment').list()) {
      this.states.set(device.id, {
        device: { id: device.id, className: 'SupplementalEquipment' },
        deviceState: 'available',
        lastCommunication: new Date().toISOString(),
        stateChangedTime: new Date().toISOString(),
      });
    }
  }

  list(): DeviceState[] {
    return [...this.states.values()];
  }

  get(deviceId: string): DeviceState | undefined {
    return this.states.get(deviceId);
  }

  setState(deviceId: string, deviceState: string): DeviceState | undefined {
    const state = this.states.get(deviceId);
    if (!state) return undefined;
    state.deviceState = deviceState;
    state.stateChangedTime = new Date().toISOString();
    state.lastCommunication = state.stateChangedTime;
    this.dispatcher.publish(
      this.dispatcher.makeEnvelope('apx.control.device.state.v1', { ...state }, state.device),
      [IDS.place]
    );
    if (deviceState === 'fault' && this.raiseAlert) {
      this.raiseAlert({
        alertType: 'deviceFault',
        severity: 'major',
        source: { device: state.device, place: IDS.place },
        description: `Device ${deviceId} entered fault state (simulated)`,
      });
    }
    return state;
  }

  /**
   * Execute a command against a target device/lane. Resolves with
   * success/failure detail after the simulated action delay.
   */
  execute(
    commandType: string,
    targetId: string,
    parameters: Record<string, unknown>
  ): { promise: Promise<{ ok: boolean; detail: string }> } {
    const run = async (): Promise<{ ok: boolean; detail: string }> => {
      await sleep(this.actionDelayMs);
      // Resolve lane targets to their gate device where applicable.
      const deviceId = this.states.has(targetId) ? targetId : this.gateForLane(targetId);
      const state = deviceId ? this.states.get(deviceId) : undefined;
      if (state && ['fault', 'outOfService'].includes(state.deviceState)) {
        return { ok: false, detail: `device ${deviceId} is ${state.deviceState}` };
      }
      switch (commandType) {
        case 'vendGate': {
          if (!state) return { ok: false, detail: 'no gate at target' };
          this.setState(state.device.id, 'occupied');
          this.setState(state.device.id, 'available');
          return { ok: true, detail: 'gate vended once' };
        }
        case 'holdGateOpen':
        case 'closeLane':
          if (!state) return { ok: false, detail: 'no device at target' };
          this.setState(state.device.id, commandType === 'closeLane' ? 'outOfService' : 'occupied');
          return { ok: true, detail: commandType };
        case 'lostTicket':
          return {
            ok: true,
            detail: `lost ticket issued (method=${parameters.method ?? 'default'})`,
          };
        case 'pushRate': {
          const rate = parameters.rateTable as { id?: string } | undefined;
          if (!rate?.id || !this.storeHasRate(rate.id)) {
            return { ok: false, detail: 'unknown rateTable' };
          }
          return { ok: true, detail: `rate ${rate.id} applied` };
        }
        case 'applyValidation':
          return { ok: true, detail: 'validation applied' };
        case 'setDeviceState': {
          if (!state) return { ok: false, detail: 'no device at target' };
          this.setState(state.device.id, String(parameters.state ?? 'available'));
          return { ok: true, detail: `state=${parameters.state}` };
        }
        case 'displayMessage':
        case 'restartDevice':
          return { ok: true, detail: commandType };
        default:
          return { ok: false, detail: `unsupported commandType ${commandType}` };
      }
    };
    const promise = run();
    const track = promise.then(() => undefined).catch(() => undefined);
    this.pending.add(track);
    void track.finally(() => this.pending.delete(track));
    return { promise };
  }

  private gateForLane(laneId: string): string | undefined {
    for (const device of this.store.for('SupplementalEquipment').list()) {
      const laneRef = device.laneRef as { id?: string } | undefined;
      if (laneRef?.id === laneId) return device.id;
    }
    return undefined;
  }

  private storeHasRate(rateId: string): boolean {
    try {
      this.store.for('RateTable').get(rateId);
      return true;
    } catch {
      return false;
    }
  }

  async idle(): Promise<void> {
    while (this.pending.size > 0) {
      await Promise.all([...this.pending]);
    }
  }
}
