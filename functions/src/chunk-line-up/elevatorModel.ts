import type {
  ChunkLineUpElevatorCarState,
  ChunkLineUpElevatorId,
  ChunkLineUpElevatorRider,
  ChunkLineUpElevatorState,
} from "./types.js";

/**
 * Destination-dispatch elevators, resolved purely from a stored state and the
 * clock so every client animates the same car the server reasons about.
 *
 * - A player at any floor picks a destination; that books one of three seats.
 * - The car sweeps in one direction, stopping at every pickup and drop-off on
 *   the way, then turns around (SCAN), like a real elevator.
 * - At each stop riders for that floor get off and riders waiting there get on.
 * - With nothing to do the car idles at its floor with the doors open.
 *
 * Mirrored in src/games/chunk-line-up/elevatorModel.ts for client prediction.
 */

export const CHUNK_LINE_UP_ELEVATOR_CAPACITY = 3;
export const CHUNK_LINE_UP_ELEVATOR_OPEN_DWELL_MS = 1_500;
export const CHUNK_LINE_UP_ELEVATOR_DOOR_MS = 360;
const TRAVEL_BASE_MS = 420;
const TRAVEL_PER_FLOOR_MS = 520;

export function chunkLineUpElevatorTravelMs(fromFloor: number, toFloor: number): number {
  return TRAVEL_BASE_MS + Math.max(1, Math.abs(fromFloor - toFloor)) * TRAVEL_PER_FLOOR_MS;
}

export function createChunkLineUpElevatorCar(
  id: ChunkLineUpElevatorId,
  floorCount: number,
  nowMs: number,
): ChunkLineUpElevatorCarState {
  return { id, phase: "open", floor: floorCount, targetFloor: null, direction: 0, phaseStartedAtMs: nowMs, seats: [] };
}

export function createChunkLineUpElevatorState(floorCount: number, nowMs: number): ChunkLineUpElevatorState {
  return {
    revision: 1,
    lobbyFloor: floorCount,
    left: createChunkLineUpElevatorCar("left", floorCount, nowMs),
    right: createChunkLineUpElevatorCar("right", floorCount, nowMs),
  };
}

/** Floors the car still has to visit: pickups for waiting riders, drop-offs for riders on board. */
export function chunkLineUpElevatorStops(car: ChunkLineUpElevatorCarState): number[] {
  return [...new Set(car.seats.map((seat) => seat.boarded ? seat.destinationFloor : seat.originFloor))];
}

/** SCAN: nearest stop ahead in the current direction, otherwise the nearest stop behind. */
function nextStop(car: ChunkLineUpElevatorCarState): { readonly floor: number; readonly direction: -1 | 1 } | null {
  const stops = chunkLineUpElevatorStops(car).filter((floor) => floor !== car.floor);
  if (stops.length === 0) return null;
  const ahead = car.direction === 0 ? [] : stops.filter((floor) => Math.sign(floor - car.floor) === car.direction);
  const pool = ahead.length > 0 ? ahead : stops;
  const floor = pool.reduce((best, candidate) => Math.abs(candidate - car.floor) < Math.abs(best - car.floor) ? candidate : best);
  return { floor, direction: floor < car.floor ? -1 : 1 };
}

/** Doors finished opening at `car.floor`: riders for this floor leave, riders waiting here board. */
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

function riderIn(state: ChunkLineUpElevatorState, playerId: string): { readonly id: ChunkLineUpElevatorId; readonly rider: ChunkLineUpElevatorRider } | null {
  for (const id of ["left", "right"] as const) {
    const rider = state[id].seats.find((seat) => seat.playerId === playerId);
    if (rider) return { id, rider };
  }
  return null;
}

/**
 * Books a ride from `originFloor` to `destinationFloor`. If the car is open at
 * the origin the player steps straight in; otherwise the car comes to fetch them.
 */
export function boardChunkLineUpElevatorRide(
  input: ChunkLineUpElevatorState,
  elevatorId: ChunkLineUpElevatorId,
  playerId: string,
  originFloor: number,
  destinationFloor: number,
  floorCount: number,
  nowMs: number,
): { readonly accepted: boolean; readonly state: ChunkLineUpElevatorState } {
  const state = resolveChunkLineUpElevatorState(input, nowMs);
  const existing = riderIn(state, playerId);
  if (existing) {
    // Replays of the same booking are idempotent; a second booking is refused.
    return { accepted: existing.id === elevatorId && existing.rider.destinationFloor === destinationFloor, state };
  }
  const car = state[elevatorId];
  if (originFloor < 0 || originFloor > floorCount || destinationFloor < 0 || destinationFloor >= floorCount
    || destinationFloor === originFloor || car.seats.length >= CHUNK_LINE_UP_ELEVATOR_CAPACITY) {
    return { accepted: false, state };
  }
  const here = car.phase === "open" && car.floor === originFloor;
  const idle = car.phase === "open" && chunkLineUpElevatorStops(car).every((floor) => floor === car.floor);
  const booked: ChunkLineUpElevatorCarState = {
    ...car,
    seats: [...car.seats, { playerId, originFloor, destinationFloor, boarded: here }],
    // A fresh dwell lets the new rider in (or starts an idle car) instead of closing at once.
    phaseStartedAtMs: here || idle ? nowMs : car.phaseStartedAtMs,
  };
  return { accepted: true, state: { ...state, [elevatorId]: here ? booked : stopOnTheWay(booked, originFloor, nowMs) } };
}

/**
 * A moving car that is about to pass the caller's floor stops there first,
 * continuing from where it is now (the original stop stays booked).
 */
function stopOnTheWay(car: ChunkLineUpElevatorCarState, floor: number, nowMs: number): ChunkLineUpElevatorCarState {
  if (car.phase !== "moving" || car.targetFloor === null) return car;
  const position = chunkLineUpElevatorFloorPosition(car, nowMs);
  const direction = Math.sign(car.targetFloor - car.floor);
  const ahead = (floor - position) * direction;
  const beforeTarget = (car.targetFloor - floor) * direction;
  if (ahead < 0.25 || beforeTarget <= 0) return car;
  const travelled = (position - car.floor) / (floor - car.floor);
  return {
    ...car,
    targetFloor: floor,
    phaseStartedAtMs: nowMs - travelled * chunkLineUpElevatorTravelMs(car.floor, floor),
  };
}

export function chunkLineUpElevatorFloorPosition(car: ChunkLineUpElevatorCarState, nowMs: number): number {
  if (car.phase !== "moving" || car.targetFloor === null) return car.floor;
  const duration = chunkLineUpElevatorTravelMs(car.floor, car.targetFloor);
  const ratio = Math.max(0, Math.min(1, (nowMs - car.phaseStartedAtMs) / duration));
  return car.floor + (car.targetFloor - car.floor) * ratio;
}
