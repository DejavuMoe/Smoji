import { describe, expect, it } from 'vitest'
import { HistoryStack } from './history'

describe('HistoryStack', () => {
  it('pushes and performs multi-level undo and redo', () => {
    const history = new HistoryStack(5)
    let state = 0

    const makeCommand = (prev: number, next: number) => ({
      description: `change ${prev} to ${next}`,
      undo: () => {
        state = prev
      },
      redo: () => {
        state = next
      },
    })

    state = 1
    history.push(makeCommand(0, 1))
    state = 2
    history.push(makeCommand(1, 2))
    state = 3
    history.push(makeCommand(2, 3))

    expect(history.undoCount).toBe(3)
    expect(history.redoCount).toBe(0)
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)

    // Undo 3 -> 2
    const undone1 = history.undo()
    expect(undone1?.description).toBe('change 2 to 3')
    expect(state).toBe(2)
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(true)

    // Undo 2 -> 1
    const undone2 = history.undo()
    expect(undone2?.description).toBe('change 1 to 2')
    expect(state).toBe(1)

    // Redo 1 -> 2
    const redone1 = history.redo()
    expect(redone1?.description).toBe('change 1 to 2')
    expect(state).toBe(2)

    // Redo 2 -> 3
    const redone2 = history.redo()
    expect(redone2?.description).toBe('change 2 to 3')
    expect(state).toBe(3)
    expect(history.canRedo).toBe(false)
  })

  it('clears redo stack when a new command is pushed', () => {
    const history = new HistoryStack(5)
    let text = 'A'

    history.push({
      description: 'init',
      undo: () => {
        text = ''
      },
      redo: () => {
        text = 'A'
      },
    })

    history.undo()
    expect(text).toBe('')
    expect(history.canRedo).toBe(true)

    history.push({
      description: 'branch B',
      undo: () => {
        text = ''
      },
      redo: () => {
        text = 'B'
      },
    })
    expect(history.canRedo).toBe(false)
  })

  it('respects max depth bounds and clears correctly', () => {
    const history = new HistoryStack(2)
    history.push({ description: '1', undo: () => {}, redo: () => {} })
    history.push({ description: '2', undo: () => {}, redo: () => {} })
    history.push({ description: '3', undo: () => {}, redo: () => {} })

    expect(history.undoCount).toBe(2)
    history.clear()
    expect(history.undoCount).toBe(0)
    expect(history.redoCount).toBe(0)
    expect(history.undo()).toBeNull()
    expect(history.redo()).toBeNull()
  })
})
