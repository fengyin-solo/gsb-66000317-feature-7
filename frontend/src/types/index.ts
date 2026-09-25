export interface NFAState {
  id: number
  isStart: boolean
  isAccept: boolean
  x: number
  y: number
}

export interface NFATransition {
  from: number
  to: number
  symbol: string | null // null = epsilon
  label: string
}

export interface NFA {
  states: NFAState[]
  transitions: NFATransition[]
  startState: number
  acceptStates: number[]
}

export interface MatchStep {
  stepIndex: number
  charIndex: number
  char: string
  currentState: number
  nextState: number
  transition: string
  isBacktrack: boolean
  isMatch: boolean
}

export interface MatchSegment {
  index: number      // 命中序号（从 0 开始）
  start: number      // 在原文中的起始索引（含）
  end: number        // 在原文中的结束索引（不含）
  text: string       // 命中文本
  groups: string[]   // 分组捕获（group 0 = 整体命中）
  zeroWidth: boolean // 是否零宽命中
}

export interface MatchResult {
  matched: boolean
  matchText: string
  groups: string[]
  steps: MatchStep[]
  backtracks: number
  totalSteps: number
  duration: number
  matches: MatchSegment[]   // 全部命中（非重叠、左起最长）
  zeroWidthCount: number    // 零宽命中数量
  matchesTruncated: boolean // 命中过多被截断
}

export interface RegexTemplate {
  name: string
  pattern: string
  description: string
  testString: string
  category: string
}

export interface ASTNode {
  type: 'char' | 'star' | 'plus' | 'question' | 'or' | 'concat' | 'group' | 'dot' | 'anchor' | 'charclass' | 'digit' | 'word' | 'space'
  value?: string
  children?: ASTNode[]
  groupIndex?: number
}
