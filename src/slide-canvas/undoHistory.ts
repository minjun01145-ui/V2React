/** Linear undo/redo over snapshots of the slide; a new edit after undoing drops the redo branch. */
export class UndoHistory<T> {
  private readonly limit: number;
  private entries: T[] = [];
  private index = -1;

  constructor(limit = 60) {
    this.limit = limit;
  }

  /** Starts over from `snapshot` (e.g. when another slide is opened). */
  reset(snapshot: T): void {
    this.entries = [snapshot];
    this.index = 0;
  }

  /** Records the state after an edit. Repeating the current state is ignored. */
  push(snapshot: T): void {
    if (this.entries[this.index] === snapshot) return;
    this.entries = [...this.entries.slice(0, this.index + 1), snapshot].slice(-this.limit);
    this.index = this.entries.length - 1;
  }

  undo(): T | null {
    if (this.index <= 0) return null;
    this.index -= 1;
    return this.entries[this.index]!;
  }

  redo(): T | null {
    if (this.index >= this.entries.length - 1) return null;
    this.index += 1;
    return this.entries[this.index]!;
  }
}
