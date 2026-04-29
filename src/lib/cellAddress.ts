export function colIndexToLetter(index: number): string {
  let result = ''
  let n = index + 1
  while (n > 0) {
    const remainder = (n - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}

export function letterToColIndex(letter: string): number {
  let result = 0
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + letter.charCodeAt(i) - 64
  }
  return result - 1
}

export function toCellNotation(row: number, col: number): string {
  return `${colIndexToLetter(col)}${row + 1}`
}

export function fromCellNotation(notation: string): { row: number; col: number } {
  const match = notation.match(/^([A-Z]+)(\d+)$/)
  if (!match) throw new Error(`Invalid cell notation: ${notation}`)
  const [, letters, digits] = match
  if (!letters || !digits) throw new Error(`Invalid cell notation: ${notation}`)
  const col = letterToColIndex(letters)
  const row = parseInt(digits) - 1
  return { row, col }
}
