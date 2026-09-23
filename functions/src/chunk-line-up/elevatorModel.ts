import type {
  ChunkLineUpElevatorCarState,
  ChunkLineUpElevatorId,
  ChunkLineUpElevatorRider,
  ChunkLineUpElevatorState,
} from "./types.js";

export const CHUNK_LINE_UP_ELEVATOR_CAPACITY = 3;
export const CHUNK_LINE_UP_ELEVATOR_OPEN_DWELL_MS = 1_250;
export const CHUNK_LINE_UP_ELEVATOR_DOOR_MS = 360;
export const CHUNK_LINE_UP_ELEVATOR_DESTINATION_GRACE_MS = 8_000;
const TRAVEL_BASE_MS = 420;
const TRAVEL_PER_FLOOR_MS = 520;

function otherElevator(id: ChunkLineUpElevatorId): ChunkLineUpElevatorId {
  return id === "left" ? "right" : "left";
}

function uniqueQueue(values: readonly number[]): number[] {
  return [...new Set(values)];
}

function referencedQueue(seats: readonly ChunkLineUpElevatorRider[], queue: readonly number[]): number[] {
  const destinations = new Set(seats.flatMap((seat) => seat.destinationFloor === null ? [] : [seat.destinationFloor]));
  return queue.filter((floor) => destinations.has(floor));
}

export function chunkLineUpElevatorTravelMs(fromFloor: number, toFloor: number): number {
  return TRAVEL_BASE_MS + Math.max(1, Math.abs(fromFloor - toFloor)) * TRAVEL_PER_FLOOR_MS;
}

export function createChunkLineUpElevatorCar(
  id: ChunkLineUpElevatorId,
  floorCount: number,
  nowMs: number,
): ChunkLineUpElevatorCarState {
  return {
    id,
    phase: "open",
    floor: floorCount,
    targetFloor: null,
    phaseStartedAtMs: nowMs,
    seats: [],
    queue: [],
  };
}

export function createChunkLineUpElevatorState(floorCount: number, nowMs: number): ChunkLineUpElevatorState {
  return {
    revision: 1,
    lobbyFloor: floorCount,
    left: createChunkLineUpElevatorCar("left", floorCount, nowMs),
    right: createChunkLineUpElevatorCar("right", floorCount, nowMs),
  };
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
  if (car.phase === "closing") {
    return { ...car, phase: "moving", phaseStartedAtMs: transitionAtMs };
  }
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

function playerInState(state: ChunkLineUpElevatorState, playerId: string): boolean {
  return state.left.seats.some((seat) => seat.playerId === playerId)
    || state.right.seats.some((seat) => seat.playerId === playerId);
}

export function boardChunkLineUpElevator(
  input: ChunkLineUpElevatorState,
  elevatorId: ChunkLineUpElevatorId,
  playerId: string,
  floor: number,
  nowMs: number,
): { readonly accepted: boolean; readonly state: ChunkLineUpElevatorState } {
  const state = resolveChunkLineUpElevatorState(input, nowMs);
  const car = state[elevatorId];
  if (playerInState(state, playerId)) return { accepted: car.seats.some((seat) => seat.playerId === playerId), state };
  if (car.phase !== "open" || car.floor !== floor || car.seats.length >= CHUNK_LINE_UP_ELEVATOR_CAPACITY) {
    return { accepted: false, state };
  }
  const nextCar: ChunkLineUpElevatorCarState = {
    ...car,
    phaseStartedAtMs: nowMs,
    seats: [...car.seats, { playerId, destinationFloor: null }],
  };
  return { accepted: true, state: { ...state, [elevatorId]: nextCar } };
}

export function chooseChunkLineUpElevatorDestination(
  input: ChunkLineUpElevatorState,
  elevatorId: ChunkLineUpElevatorId,
  playerId: string,
  destinationFloor: number,
  floorCount: number,
  nowMs: number,
): { readonly accepted: boolean; readonly state: ChunkLineUpElevatorState } {
  const state = resolveChunkLineUpElevatorState(input, nowMs);
  const car = state[elevatorId];
  if (destinationFloor < 0 || destinationFloor >= floorCount || destinationFloor === car.floor) {
    return { accepted: false, state };
  }
  const seatIndex = car.seats.findIndex((seat) => seat.playerId === playerId);
  if (seatIndex < 0) return { accepted: false, state };
  const currentRider = car.seats[seatIndex];
  if (!currentRider) return { accepted: false, state };
  if (currentRider.destinationFloor !== null) {
    return { accepted: currentRider.destinationFloor === destinationFloor, state };
  }
  if (car.phase !== "open") return { accepted: false, state };
  const hadUnselectedRider = car.seats.some((seat) => seat.destinationFloor === null);
  const seats = car.seats.map((seat, index) => index === seatIndex ? { ...seat, destinationFloor } : seat);
  const retainedQueue = referencedQueue(seats, car.queue);
  const queue = retainedQueue.includes(destinationFloor) ? retainedQueue : uniqueQueue([...retainedQueue, destinationFloor]);
  const selectionComplete = seats.every((seat) => seat.destinationFloor !== null);
  const nextCar: ChunkLineUpElevatorCarState = {
    ...car,
    phaseStartedAtMs: hadUnselectedRider && selectionComplete ? nowMs : car.phaseStartedAtMs,
    seats,
    queue,
  };
  return { accepted: true, state: { ...state, [elevatorId]: nextCar } };
}

export function boardChunkLineUpElevatorRide(
  input: ChunkLineUpElevatorState,
  elevatorId: ChunkLineUpElevatorId,
  playerId: string,
  floor: number,
  destinationFloor: number,
  floorCount: number,
  nowMs: number,
): { readonly accepted: boolean; readonly state: ChunkLineUpElevatorState } {
  const boarded = boardChunkLineUpElevator(input, elevatorId, playerId, floor, nowMs);
  if (!boarded.accepted) return boarded;
  const routed = chooseChunkLineUpElevatorDestination(
    boarded.state,
    elevatorId,
    playerId,
    destinationFloor,
    floorCount,
    nowMs,
  );
  return routed.accepted ? routed : { accepted: false, state: resolveChunkLineUpElevatorState(input, nowMs) };
}

export function otherChunkLineUpElevatorId(id: ChunkLineUpElevatorId): ChunkLineUpElevatorId {
  return otherElevator(id);
}
