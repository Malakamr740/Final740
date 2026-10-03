export interface TextBlock {
  type: 'text'
  value: string
}

export interface MathBlock {
  type: 'math'
  latex: string
}

export interface ImageBlock {
  type: 'image'
  url: string
  alt?: string
  caption?: string
}

export interface TableBlock {
  type: 'table'
  rows: string[][]
}

export interface BreakBlock {
  type: 'break'
}

export type ContentBlock = TextBlock | MathBlock | ImageBlock | TableBlock | BreakBlock

export type EditorItem =
  | { id: string; kind: 'text'; text: string }
  | { id: string; kind: 'image'; url: string; caption?: string }
  | { id: string; kind: 'table'; rows: string[][] }

export type TextEditorItem = Extract<EditorItem, { kind: 'text' }>

/**
 * Parses inline math delimited by $...$ within a single string into ContentBlock[]
 */
export function parseContentText(input: string): ContentBlock[] {
  if (!input) return []
  const blocks: ContentBlock[] = []
  const parts = input.split(/(\$[^$]+\$)/g)

  for (const part of parts) {
    if (!part) continue
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      blocks.push({
        type: 'math',
        latex: part.slice(1, -1).trim(),
      })
    } else {
      // Split on newlines inside plain text to insert breaks
      const lines = part.split('\n')
      lines.forEach((line, index) => {
        if (line) blocks.push({ type: 'text', value: line })
        if (index < lines.length - 1) blocks.push({ type: 'break' })
      })
    }
  }

  return blocks
}

/**
 * Parses multi-line choices text (one choice per line, with math wrapped in $...$)
 */
export function parseChoicesText(raw: string): ContentBlock[][] {
  const lines = raw.split('\n').filter((l) => l.trim().length > 0)
  return lines.map((line) => parseContentText(line.trim()))
}

/**
 * Converts choice content blocks back into editor text (one choice per line)
 */
export function choicesToText(choiceBlocks: ContentBlock[][]): string {
  return choiceBlocks
    .map((blocks) =>
      blocks
        .map((b) => {
          if (b.type === 'text') return b.value
          if (b.type === 'math') return `$${b.latex}$`
          return ''
        })
        .join('')
    )
    .join('\n')
}

/**
 * Converts database content blocks to editor items
 */
export function blocksToEditorItems(blocks: ContentBlock[]): EditorItem[] {
  if (!blocks || blocks.length === 0) {
    return [{ id: crypto.randomUUID(), kind: 'text', text: '' }]
  }

  const items: EditorItem[] = []
  let textBuffer = ''

  for (const block of blocks) {
    if (block.type === 'text') {
      textBuffer += block.value
    } else if (block.type === 'math') {
      textBuffer += `$${block.latex}$`
    } else if (block.type === 'break') {
      textBuffer += '\n'
    } else if (block.type === 'image') {
      if (textBuffer) {
        items.push({ id: crypto.randomUUID(), kind: 'text', text: textBuffer })
        textBuffer = ''
      }
      items.push({
        id: crypto.randomUUID(),
        kind: 'image',
        url: block.url,
        caption: block.caption,
      })
    } else if (block.type === 'table') {
      if (textBuffer) {
        items.push({ id: crypto.randomUUID(), kind: 'text', text: textBuffer })
        textBuffer = ''
      }
      items.push({
        id: crypto.randomUUID(),
        kind: 'table',
        rows: block.rows,
      })
    }
  }

  if (textBuffer) {
    items.push({ id: crypto.randomUUID(), kind: 'text', text: textBuffer })
  }

  return items.length > 0 ? items : [{ id: crypto.randomUUID(), kind: 'text', text: '' }]
}

/**
 * Converts editor items back to structured ContentBlock[]
 */
export function editorItemsToBlocks(items: EditorItem[]): ContentBlock[] {
  const result: ContentBlock[] = []

  for (const item of items) {
    if (item.kind === 'text') {
      result.push(...parseContentText(item.text))
    } else if (item.kind === 'image') {
      result.push({
        type: 'image',
        url: item.url,
        caption: item.caption,
      })
    } else if (item.kind === 'table') {
      result.push({
        type: 'table',
        rows: item.rows,
      })
    }
  }

  return result
}