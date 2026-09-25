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
  index: number      // 命中序号(从0开始)
  start: number      // 在测试字符串中的起始索引
  end: number        // 结束索引(不含)
  text: string       // 命中文本
  groups: string[]   // 该命中的分组捕获
  isEmpty: boolean   // 是否为空命中(零宽)
  overlapped: boolean // 是否与上一段命中范围重叠
}

export interface MatchResult {
  matched: boolean
  matchText: string
  groups: string[]
  matches: MatchSegment[] // 全部命中片段
  truncated: boolean      // 命中过多或文本过长,结果被截断
  steps: MatchStep[]
  backtracks: number
  totalSteps: number
  duration: number
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
