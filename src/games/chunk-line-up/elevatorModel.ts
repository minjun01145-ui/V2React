import type {
  ChunkLineUpElevatorCarState,
  ChunkLineUpElevatorId,
  ChunkLineUpElevatorRider,
  ChunkLineUpElevatorState,
} from "../../multiplayer/chunk-line-up/types.ts";

/**
 * Client mirror of functions/src/chunk-line-up/elevatorModel.ts (keep the two
 * in sync): destination-dispatch cars resolved from a stored state and the
 * shared clock, so the client animates exactly what the server decided.
 */

export const CHUNK_LINE_UP_ELEVATOR_CAPACITY = 3;
export const CHUNK_LINE_UP_ELEVATOR_OPEN_DWELL_MS = 1_500;
export const CHUNK_LINE_UP_ELEVATOR_DOOR_MS = 360;
const PREDICTION_HOLD_MS = 10_000;
const TRAVEL_BASE_MS = 420;
const TRAVEL_PER_FLOOR_MS = 520;

export function chunkLineUpElevatorTravelMs(fromFloor: number, toFloor: number): number {
  return TRAVEL_BASE_MS + Math.max(1, Math.abs(fromFloor - toFloor)) * TRAVEL_PER_FLOOR_MS;
}

export function createChunkLineUpElevatorState(floorCount: number, nowMs: number): ChunkLineUpElevatorState {
  const car = (id: ChunkLineUpElevatorId): ChunkLineUpElevatorCarState => ({
    id, phase: "open", floor: floorCount, targetFloor: null, direction: 0, phaseStartedAtMs: nowMs, seats: [],
  });
  return { revision: 1, lobbyFloor: floorCount, left: car("left"), right: car("right") };
}

export function chunkLineUpElevatorStops(car: ChunkLineUpElevatorCarState): number[] {
  return [...new Set(car.seats.map((seat) => seat.boarded ? seat.destinationFloor : seat.originFloor))];
}

function nextStop(car: ChunkLineUpElevatorCarState): { readonly floor: number; readonly direction: -1 | 1 } | null {
  const stops = chunkLineUpElevatorStops(car).filter((floor) => floor !== car.floor);
  if (stops.length === 0) return null;
  const ahead = car.direction === 0 ? [] : stops.filter((floor) => Math.sign(floor - car.floor) === car.direction);
  const pool = ahead.length > 0 ? ahead : stops;
  const floor = pool.reduce((best, candidate) => Math.abs(candidate - car.floor) < Math.abs(best - car.floor) ? candidate : best);
  return { floor, direction: floor < car.floor ? -1 : 1 };
}

function exchangeRiders(car: ChunkLineUpElevatorCarState): ChunkLineUpElevatorRider[] {
  return car.seats
    .filter((seat) => !(seat.boarded && seat.destinationFloor === car.floor))
    .map((seat) => !seat.boarded && seat.originFloor === car.floor ? { ...seat, boarded: true } : seat);
}

function phaseDuration(car: ChunkLineUpElevatorCarState): number | null {
  if (car.phase === "open") return chunkLineUpElevatorStops(car).some((floor) => floor !== car.floor) ? CHUNK_LINE_UP_ELEVATOR_OPEN_DWELL_MS : null;
  if (car.phase === "closing" || car.phase === "opening") return CHUNK_LINE_UP_ELEVATOR_DOOR_MS;
  return car.targetFloor === null ? 0 : chunkLineUpElevatorTravelMs(car.floor, car.targetFloor);
}

function advanceCar(car: ChunkLineUpElevatorCarState, at: number): ChunkLineUpElevatorCarState {
  if (car.phase === "open") {
    const stop = nextStop(car);
    if (!stop) return { ...car, direction: 0, phaseStartedAtMs: at };
    return { ...car, phase: "closing", targetFloor: stop.floor, direction: stop.direction, phaseStartedAtMs: at };
  }
  if (car.phase === "closing") return { ...car, phase: "moving", phaseStartedAtMs: at };
  if (car.phase === "moving") return { ...car, phase: "opening", floor: car.targetFloor ?? car.floor, phaseStartedAtMs: at };
  const arrived = { ...car, phase: "open" as const, targetFloor: null, phaseStartedAtMs: at };
  return { ...arrived, seats: exchangeRiders(arrived) };
}

export function resolveChunkLineUpElevatorCar(input: ChunkLineUpElevatorCarState, nowMs: number): ChunkLineUpElevatorCarState {
  let car: ChunkLineUpElevatorCarState = { ...input, seats: [...input.seats] };
  for (let step = 0; step < 48; step += 1) {
    const duration = phaseDuration(car);
    if (duration === null || nowMs < car.phaseStartedAtMs + duration) break;
    car = advanceCar(car, car.phaseStartedAtMs + duration);
  }
  return car;
}

export function resolveChunkLineUpElevatorState(input: ChunkLineUpElevatorState, nowMs: number): ChunkLineUpElevatorState {
  return {
    revision: input.revision,
    lobbyFloor: input.lobbyFloor,
    left: resolveChunkLineUpElevatorCar(input.left, nowMs),
    right: resolveChunkLineUpElevatorCar(input.right, nowMs),
  };
}

export function chunkLineUpElevatorFloorPosition(car: ChunkLineUpElevatorCarState, nowMs: number): number {
  if (car.phase !== "moving" || car.targetFloor === null) return car.floor;
  const duration = chunkLineUpElevatorTravelMs(car.floor, car.targetFloor);
  const ratio = Math.max(0, Math.min(1, (nowMs - car.phaseStartedAtMs) / duration));
  return car.floor + (car.targetFloor - car.floor) * ratio;
}

export function chunkLineUpElevatorDoorOpenRatio(car: ChunkLineUpElevatorCarState, nowMs: number): number {
  if (car.phase === "open") return 1;
  if (car.phase === "moving") return 0;
  const ratio = Math.max(0, Math.min(1, (nowMs - car.phaseStartedAtMs) / CHUNK_LINE_UP_ELEVATOR_DOOR_MS));
  return car.phase === "opening" ? ratio : 1 - ratio;
}

/** The player's booking (waiting or riding), with its seat index in the car. */
export function findChunkLineUpPlayerElevator(
  state: ChunkLineUpElevatorState,
  playerId: string,
): { readonly elevatorId: ChunkLineUpElevatorId; readonly car: ChunkLineUpElevatorCarState; readonly rider: ChunkLineUpElevatorRider; readonly seatIndex: number } | null {
  for (const elevatorId of ["left", "right"] as const) {
    const car = state[elevatorId];
    const seatIndex = car.seats.findIndex((seat) => seat.playerId === playerId);
    const rider = car.seats[seatIndex];
    if (rider) return { elevatorId, car, rider, seatIndex };
  }
  return null;
}

/**
 * Optimistic booking shown while the server call is in flight. A car the
 * player steps into keeps its doors open until the server's state (with its
 * own departure time) replaces this, so a slow reply cannot re-seat a player
 * who already got off.
 */
export function predictChunkLineUpElevatorRide(
  state: ChunkLineUpElevatorState,
  elevatorId: ChunkLineUpElevatorId,
  playerId: string,
  floor: number,
  destinationFloor: number,
  floorCount: number,
  nowMs: number,
): ChunkLineUpElevatorState | null {
  const current = resolveChunkLineUpElevatorState(state, nowMs);
  const car = current[elevatorId];
  if (findChunkLineUpPlayerElevator(current, playerId)
    || car.seats.length >= CHUNK_LINE_UP_ELEVATOR_CAPACITY
    || floor < 0 || floor > floorCount
    || destinationFloor < 0 || destinationFloor >= floorCount
    || destinationFloor === floor) return null;
  const here = car.phase === "open" && car.floor === floor;
  return {
    ...current,
    revision: state.revision + 1,
    [elevatorId]: {
      ...car,
      seats: [...car.seats, { playerId, originFloor: floor, destinationFloor, boarded: here }],
      phaseStartedAtMs: car.phase === "open" ? nowMs + PREDICTION_HOLD_MS : car.phaseStartedAtMs,
    },
  };
}
