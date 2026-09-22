import type {
  ChunkLineUpElevatorCarState,
  ChunkLineUpElevatorId,
  ChunkLineUpElevatorRider,
  ChunkLineUpElevatorState,
} from "../../multiplayer/chunk-line-up/types.ts";

export const CHUNK_LINE_UP_ELEVATOR_CAPACITY = 3;
export const CHUNK_LINE_UP_ELEVATOR_OPEN_DWELL_MS = 1_250;
export const CHUNK_LINE_UP_ELEVATOR_DOOR_MS = 360;
export const CHUNK_LINE_UP_ELEVATOR_DESTINATION_GRACE_MS = 8_000;
const TRAVEL_BASE_MS = 420;
const TRAVEL_PER_FLOOR_MS = 520;

export function chunkLineUpElevatorTravelMs(fromFloor: number, toFloor: number): number {
  return TRAVEL_BASE_MS + Math.max(1, Math.abs(fromFloor - toFloor)) * TRAVEL_PER_FLOOR_MS;
}

function referencedQueue(seats: readonly ChunkLineUpElevatorRider[], queue: readonly number[]): number[] {
  const destinations = new Set(seats.flatMap((seat) => seat.destinationFloor === null ? [] : [seat.destinationFloor]));
  return queue.filter((floor) => destinations.has(floor));
}

function phaseDuration(car: ChunkLineUpElevatorCarState, lobbyFloor: number): number | null {
  if (car.phase === "open") {
    if (car.seats.some((seat) => seat.destinationFloor === null)) return CHUNK_LINE_UP_ELEVATOR_DESTINATION_GRACE_MS;
    if (car.queue.length > 0) return CHUNK_LINE_UP_ELEVATOR_OPEN_DWELL_MS;
    if (car.seats.length === 0 && car.floor !== lobbyFloor) return CHUNK_LINE_UP_ELEVATOR_OPEN_DWELL_MS;
    return null;
  }
  if (car.phase === "closing" || car.phase === "opening") return CHUNK_LINE_UP_ELEVATOR_DOOR_MS;
  if (car.targetFloor === null) return 0;
  return chunkLineUpElevatorTravelMs(car.floor, car.targetFloor);
}

function advanceCar(car: ChunkLineUpElevatorCarState, transitionAtMs: number, lobbyFloor: number): ChunkLineUpElevatorCarState {
  if (car.phase === "open") {
    const seats = car.seats.filter((seat) => seat.destinationFloor !== null);
    const queue = referencedQueue(seats, car.queue);
    const targetFloor = queue[0] ?? (seats.length === 0 && car.floor !== lobbyFloor ? lobbyFloor : null);
    if (targetFloor === null) return { ...car, seats: [], queue: [], phaseStartedAtMs: transitionAtMs };
    return { ...car, phase: "closing", targetFloor, seats, queue, phaseStartedAtMs: transitionAtMs };
  }
  if (car.phase === "closing") return { ...car, phase: "moving", phaseStartedAtMs: transitionAtMs };
  if (car.phase === "moving") {
    const arrivedFloor = car.targetFloor ?? car.floor;
    return {
      ...car,
      phase: "opening",
      floor: arrivedFloor,
      phaseStartedAtMs: transitionAtMs,
    };
  }
  const arrivedFloor = car.targetFloor ?? car.floor;
  const seats = car.seats.filter((seat) => seat.destinationFloor !== arrivedFloor);
  const queue = referencedQueue(seats, car.queue.filter((floor) => floor !== arrivedFloor));
  return {
    ...car,
    phase: "open",
    targetFloor: null,
    phaseStartedAtMs: transitionAtMs,
    seats,
    queue,
  };
}

export function resolveChunkLineUpElevatorCar(
  input: ChunkLineUpElevatorCarState,
  nowMs: number,
  lobbyFloor: number,
): ChunkLineUpElevatorCarState {
  let car: ChunkLineUpElevatorCarState = { ...input, seats: [...input.seats], queue: [...input.queue] };
  for (let step = 0; step < 24; step += 1) {
    const duration = phaseDuration(car, lobbyFloor);
    if (duration === null || nowMs < car.phaseStartedAtMs + duration) break;
    car = advanceCar(car, car.phaseStartedAtMs + duration, lobbyFloor);
  }
  return car;
}

export function resolveChunkLineUpElevatorState(
  input: ChunkLineUpElevatorState,
  nowMs: number,
): ChunkLineUpElevatorState {
  return {
    revision: input.revision,
    lobbyFloor: input.lobbyFloor,
    left: resolveChunkLineUpElevatorCar(input.left, nowMs, input.lobbyFloor),
    right: resolveChunkLineUpElevatorCar(input.right, nowMs, input.lobbyFloor),
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

export function findChunkLineUpPlayerElevator(
  state: ChunkLineUpElevatorState,
  playerId: string,
): { readonly elevatorId: ChunkLineUpElevatorId; readonly car: ChunkLineUpElevatorCarState; readonly rider: ChunkLineUpElevatorRider } | null {
  for (const elevatorId of ["left", "right"] as const) {
    const car = state[elevatorId];
    const rider = car.seats.find((seat) => seat.playerId === playerId);
    if (rider) return { elevatorId, car, rider };
  }
  return null;
}
