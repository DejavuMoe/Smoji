export interface HistoryCommand {
  readonly description: string
  undo(): void
  redo(): void
}

/**
 * Multi-level Undo/Redo history manager.
 * Preserves a bounded timeline of reversible workbench operations.
 */
export class HistoryStack {
  private readonly undoStack: HistoryCommand[] = []
  private readonly redoStack: HistoryCommand[] = []
  private readonly maxDepth: number

  constructor(maxDepth = 50) {
    this.maxDepth = Math.max(1, maxDepth)
  }

  /** Push a new command and clear redo history. */
  push(command: HistoryCommand): void {
    this.undoStack.push(command)
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift()
    }
    this.redoStack.length = 0
  }

  /** Undo the most recent command, moving it to the redo stack. */
  undo(): HistoryCommand | null {
    const cmd = this.undoStack.pop()
    if (!cmd) return null
    cmd.undo()
    this.redoStack.push(cmd)
    return cmd
  }

  /** Redo the previously undone command, moving it back to undo stack. */
  redo(): HistoryCommand | null {
    const cmd = this.redoStack.pop()
    if (!cmd) return null
    cmd.redo()
    this.undoStack.push(cmd)
    return cmd
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  get undoCount(): number {
    return this.undoStack.length
  }

  get redoCount(): number {
    return this.redoStack.length
  }

  clear(): void {
    this.undoStack.length = 0
    this.redoStack.length = 0
  }
}
