import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { NFA, MatchResult, MatchStep, MatchSegment, RegexTemplate, ASTNode } from '../types'

const GROUP_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']
const MAX_MATCHES = 200      // 命中片段上限,超出则截断并标记
const MAX_STEPS = 20000      // 步骤记录上限,防止长文本下卡顿
const LONG_TEXT_THRESHOLD = 2000 // 超过该长度视为长文本,仅提示不修改输入

export const TEMPLATES: RegexTemplate[] = [
  { name: '邮箱地址', pattern: '^([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+)\\.([a-zA-Z]{2,})$', description: '匹配标准邮箱格式：用户名@域名.顶级域', testString: 'user@example.com admin@mail.org test.user+tag@sub.domain.co.uk', category: '常用' },
  { name: 'URL链接', pattern: '^(https?)://([^/:]+)(?::(\\d+))?(.*)$', description: '匹配HTTP/HTTPS URL：协议://主机:端口/路径', testString: 'https://www.example.com:8080/path/to/page http://localhost:3000/api', category: '常用' },
  { name: 'IPv4地址', pattern: '^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$', description: '匹配IPv4地址四段数字', testString: '192.168.1.1 10.0.0.1 255.255.255.0', category: '常用' },
  { name: '日期格式', pattern: '^(\\d{4})-(\\d{2})-(\\d{2})$', description: '匹配YYYY-MM-DD日期', testString: '2024-01-15 1999-12-31 2025-06-06', category: '常用' },
  { name: '手机号码', pattern: '^1[3-9]\\d{9}$', description: '匹配中国大陆手机号', testString: '13800138000 15912345678 18600000000', category: '常用' },
  { name: '身份证号', pattern: '^(\\d{6})(\\d{4})(\\d{2})(\\d{2})(\\d{3})([0-9Xx])$', description: '18位身份证：地区码+出生日期+顺序码+校验码', testString: '11010119900101001X 440304200512120039', category: '常用' },
  { name: '十六进制颜色', pattern: '^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$', description: '匹配#RGB或#RRGGBB格式', testString: '#FF5733 #abc #1A2B3C ff0000', category: '前端' },
  { name: '邮政编码', pattern: '^\\d{6}$', description: '6位中国邮编', testString: '100000 518000 200120', category: '常用' },
  { name: '浮点数', pattern: '^-?\\d+\\.\\d+$', description: '匹配带小数点的数字', testString: '3.14 -0.5 100.0', category: '数字' },
  { name: '科学计数法', pattern: '^-?\\d+(\\.\\d+)?[eE][+-]?\\d+$', description: '匹配科学计数法数字', testString: '1.5e10 -2.3E-4 6.022e23', category: '数字' },
  { name: 'MAC地址', pattern: '^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$', description: '匹配MAC地址XX:XX:XX:XX:XX:XX', testString: '00:1A:2B:3C:4D:5E AA-BB-CC-DD-EE-FF', category: '网络' },
  { name: 'UUID', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', description: '标准UUID格式', testString: '550e8400-e29b-41d4-a716-446655440000', category: '网络' },
  { name: 'QQ号', pattern: '^[1-9]\\d{4,10}$', description: '5-11位QQ号', testString: '12345 10000 1234567890', category: '常用' },
  { name: '密码强度', pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$', description: '至少8位含大小写字母数字特殊字符', testString: 'Passw0rd! Str0ng@Pass', category: '安全' },
  { name: '中文姓名', pattern: '^[\\u4e00-\\u9fa5]{2,4}$', description: '2-4位中文字符', testString: '张三 李世明 王小明', category: '常用' },
  { name: '车牌号', pattern: '^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤川青藏琼宁][A-Z][A-HJ-NP-Z0-9]{5}$', description: '中国车牌格式', testString: '京A12345 沪B6789X', category: '常用' },
  { name: 'HTML标签', pattern: '<(\\w+)(\\s[^>]*)?>(.*?)</\\1>', description: '匹配HTML开闭标签对', testString: '<div class="x">content</div> <span>text</span>', category: '前端' },
  { name: '文件扩展名', pattern: '^.+\\.(\\w+)$', description: '提取文件扩展名', testString: 'image.png doc.pdf index.html', category: '前端' },
  { name: '经纬度', pattern: '^(\\-?\\d{1,3}\\.\\d+)\\s*,\\s*(\\-?\\d{1,3}\\.\\d+)$', description: '匹配经纬度坐标', testString: '116.404,39.915 -73.9857,40.7484', category: '地理' },
  { name: '版本号', pattern: '^(\\d+)\\.(\\d+)\\.(\\d+)(?:-(\\w+))?$', description: '语义化版本号x.y.z-tag', testString: '1.0.0 2.3.1-beta 10.20.30', category: '常用' },
  { name: '时间格式', pattern: '^([01]?\\d|2[0-3]):([0-5]\\d)(?::([0-5]\\d))?$', description: 'HH:MM或HH:MM:SS', testString: '14:30 23:59:59 00:00', category: '常用' }
]

interface StateNode {
  id: number
  isAccept: boolean
  transitions: Map<string, number[]>
  epsilonTransitions: number[]
}

function buildNFA(pattern: string): { states: StateNode[]; startState: number; acceptStates: number[] } {
  const states: StateNode[] = []
  let stateCounter = 0
  let pos = 0
  let groupCount = 0

  function newState(): number {
    const id = stateCounter++
    states.push({ id, isAccept: false, transitions: new Map(), epsilonTransitions: [] })
    return id
  }

  function addTransition(from: number, symbol: string, to: number) {
    if (!states[from].transitions.has(symbol)) {
      states[from].transitions.set(symbol, [])
    }
    states[from].transitions.get(symbol)!.push(to)
  }

  function addEpsilon(from: number, to: number) {
    states[from].epsilonTransitions.push(to)
  }

  // 克隆 [segStart, segEnd] 区间内的状态与内部转移,用于 {n,m} 量词展开
  function cloneSegment(segStart: number, segEnd: number): [number, number] {
    const idMap = new Map<number, number>()
    for (let i = segStart; i <= segEnd; i++) idMap.set(i, newState())
    for (let i = segStart; i <= segEnd; i++) {
      const src = states[i]
      const dst = idMap.get(i)!
      src.transitions.forEach((targets, sym) => {
        for (const t of targets) {
          const nt = idMap.get(t)
          if (nt !== undefined) addTransition(dst, sym, nt)
        }
      })
      for (const t of src.epsilonTransitions) {
        const nt = idMap.get(t)
        if (nt !== undefined) addEpsilon(dst, nt)
      }
      if ((src as any)._matcher) (states[dst] as any)._matcher = (src as any)._matcher
    }
    return [idMap.get(segStart)!, idMap.get(segEnd)!]
  }

  function parseCharClass(): (ch: string) => boolean {
    const negative = pattern[pos] === '^'
    if (negative) pos++
    const ranges: [string, string][] = []
    const chars: string[] = []
    while (pos < pattern.length && pattern[pos] !== ']') {
      if (pattern[pos + 1] === '-' && pattern[pos + 2] && pattern[pos + 2] !== ']') {
        ranges.push([pattern[pos], pattern[pos + 2]])
        pos += 3
      } else {
        chars.push(pattern[pos])
        pos++
      }
    }
    pos++ // skip ]
    return (ch: string) => {
      if (negative) {
        return !chars.includes(ch) && !ranges.some(([s, e]) => ch >= s && ch <= e)
      }
      return chars.includes(ch) || ranges.some(([s, e]) => ch >= s && ch <= e)
    }
  }

  function parseConcat(): [number, number] {
    let start = newState()
    let end = start
    while (pos < pattern.length && !['|', ')'].includes(pattern[pos])) {
      let segStart: number, segEnd: number
      const ch = pattern[pos]
      if (ch === '(') {
        pos++
        groupCount++
        if (pattern[pos] === '?') {
          pos++
          if (pattern[pos] === ':') { pos++; }
          const [s, e] = parseOr()
          segStart = s; segEnd = e
        } else {
          const [s, e] = parseOr()
          segStart = s; segEnd = e
        }
        pos++ // skip )
      } else if (ch === '[') {
        pos++
        segStart = newState()
        segEnd = newState()
        const matcher = parseCharClass()
        addTransition(segStart, '__class_' + segStart, segEnd)
        ;(states[segStart] as any)._matcher = matcher
      } else if (ch === '.') {
        segStart = newState()
        segEnd = newState()
        addTransition(segStart, '__dot', segEnd)
        pos++
      } else if (ch === '\\') {
        pos++
        const escaped = pattern[pos]
        segStart = newState()
        segEnd = newState()
        if (escaped === 'd') addTransition(segStart, '__digit', segEnd)
        else if (escaped === 'w') addTransition(segStart, '__word', segEnd)
        else if (escaped === 's') addTransition(segStart, '__space', segEnd)
        else addTransition(segStart, escaped, segEnd)
        pos++
      } else if (ch === '^' || ch === '$') {
        segStart = newState()
        segEnd = segStart
        pos++
      } else {
        segStart = newState()
        segEnd = newState()
        addTransition(segStart, ch, segEnd)
        pos++
      }

      // Handle quantifiers
      while (pos < pattern.length && ['*', '+', '?', '{'].includes(pattern[pos])) {
        const q = pattern[pos]
        if (q === '{') {
          // 解析 {n} {n,} {n,m},通过克隆片段展开重复
          let spec = ''
          pos++
          while (pos < pattern.length && pattern[pos] !== '}') spec += pattern[pos++]
          pos++
          const mm = spec.match(/^(\d+)(?:,(\d*))?$/)
          if (mm) {
            const min = parseInt(mm[1], 10)
            const max = mm[2] === undefined ? min : (mm[2] === '' ? Infinity : parseInt(mm[2], 10))
            const baseStart = segStart, baseEnd = segEnd
            if (max === 0) {
              // {0}:匹配空串
              segStart = newState(); segEnd = segStart
            } else {
              if (min === 0) {
                // 原片段整体可选
                const optStart = newState(), optEnd = newState()
                addEpsilon(optStart, segStart); addEpsilon(optStart, optEnd)
                addEpsilon(segEnd, optEnd)
                segStart = optStart; segEnd = optEnd
              }
              // 必需的后续副本(原片段计为第1份)
              for (let k = Math.max(min, 1); k > 1; k--) {
                const [cs, ce] = cloneSegment(baseStart, baseEnd)
                addEpsilon(segEnd, cs)
                segEnd = ce
              }
              if (max === Infinity) {
                // 尾部任意次重复:克隆一份并成环
                const [cs, ce] = cloneSegment(baseStart, baseEnd)
                const loopEnd = newState()
                addEpsilon(segEnd, cs); addEpsilon(segEnd, loopEnd)
                addEpsilon(ce, cs); addEpsilon(ce, loopEnd)
                segEnd = loopEnd
              } else {
                // 可选副本:每份均可跳过
                const optEnd = newState()
                for (let k = Math.max(min, 1); k < max; k++) {
                  const [cs, ce] = cloneSegment(baseStart, baseEnd)
                  addEpsilon(segEnd, cs); addEpsilon(segEnd, optEnd)
                  segEnd = ce
                }
                addEpsilon(segEnd, optEnd)
                segEnd = optEnd
              }
            }
          }
          if (pos < pattern.length && pattern[pos] === '?') pos++ // lazy
          continue
        }
        pos++
        const qStart = newState()
        const qEnd = newState()
        addEpsilon(qStart, segStart)
        if (q === '*') { addEpsilon(qStart, qEnd); addEpsilon(segEnd, qEnd); addEpsilon(segEnd, segStart) }
        else if (q === '+') { addEpsilon(segEnd, qEnd); addEpsilon(segEnd, segStart) }
        else if (q === '?') { addEpsilon(qStart, qEnd); addEpsilon(segEnd, qEnd) }
        segStart = qStart; segEnd = qEnd
        if (pos < pattern.length && pattern[pos] === '?') pos++ // lazy
      }

      if (end !== segStart) addEpsilon(end, segStart)
      end = segEnd
    }
    return [start, end]
  }

  function parseOr(): [number, number] {
    const [s1, e1] = parseConcat()
    let start = s1, end = e1
    while (pos < pattern.length && pattern[pos] === '|') {
      pos++
      const [s2, e2] = parseConcat()
      const ns = newState(), ne = newState()
      addEpsilon(ns, start); addEpsilon(ns, s2)
      addEpsilon(end, ne); addEpsilon(e2, ne)
      start = ns; end = ne
    }
    return [start, end]
  }

  const [startState, acceptState] = parseOr()
  states[acceptState].isAccept = true
  return { states, startState, acceptStates: [acceptState] }
}

function epsilonClosure(states: StateNode[], stateId: number): Set<number> {
  const closure = new Set<number>([stateId])
  const stack = [stateId]
  while (stack.length) {
    const s = stack.pop()!
    for (const next of states[s].epsilonTransitions) {
      if (!closure.has(next)) {
        closure.add(next)
        stack.push(next)
      }
    }
  }
  return closure
}

function matchTransition(state: StateNode, symbol: string): number[] {
  const results: number[] = []
  for (const [sym, targets] of state.transitions) {
    if (sym === symbol) { results.push(...targets); continue }
    if (sym === '__dot' && symbol !== '\n') { results.push(...targets); continue }
    if (sym === '__digit' && /\d/.test(symbol)) { results.push(...targets); continue }
    if (sym === '__word' && /\w/.test(symbol)) { results.push(...targets); continue }
    if (sym === '__space' && /\s/.test(symbol)) { results.push(...targets); continue }
    if (sym.startsWith('__class_')) {
      const matcher = (state as any)._matcher
      if (matcher && matcher(symbol)) results.push(...targets)
    }
  }
  return results
}

function runMatch(states: StateNode[], startState: number, input: string): MatchResult {
  const steps: MatchStep[] = []
  const matches: MatchSegment[] = []
  let backtracks = 0
  let stepIndex = 0
  let truncated = false
  const startTime = performance.now()

  // 从 startPos 开始寻找最左最长命中,返回命中结束位置;未命中返回 -1
  function matchFrom(startPos: number): number {
    let currentStates = Array.from(epsilonClosure(states, startState))
    let matched = currentStates.some(s => states[s].isAccept)
    let matchEnd = startPos

    for (let i = startPos; i < input.length; i++) {
      const char = input[i]
      const nextStates: number[] = []
      const seen = new Set<number>()

      for (const s of currentStates) {
        const targets = matchTransition(states[s], char)
        for (const t of targets) {
          const closure = epsilonClosure(states, t)
          for (const c of closure) {
            if (!seen.has(c)) {
              seen.add(c)
              nextStates.push(c)
              if (stepIndex < MAX_STEPS) {
                steps.push({
                  stepIndex: stepIndex,
                  charIndex: i,
                  char,
                  currentState: s,
                  nextState: c,
                  transition: char,
                  isBacktrack: false,
                  isMatch: true
                })
              }
              stepIndex++
            }
          }
        }
      }

      if (nextStates.length === 0) {
        if (!matched) {
          backtracks++
          if (stepIndex < MAX_STEPS) {
            steps.push({
              stepIndex: stepIndex,
              charIndex: i,
              char,
              currentState: currentStates[0] || -1,
              nextState: -1,
              transition: 'FAIL',
              isBacktrack: true,
              isMatch: false
            })
          }
          stepIndex++
        }
        break
      }
      currentStates = nextStates
      if (currentStates.some(s => states[s].isAccept)) { matched = true; matchEnd = i + 1 }
    }

    return matched ? matchEnd : -1
  }

  // 全局扫描:逐段收集所有命中(非重叠),空命中前进一位避免死循环
  let searchPos = 0
  while (searchPos <= input.length) {
    if (matches.length >= MAX_MATCHES) { truncated = true; break }
    let foundStart = -1
    let foundEnd = -1
    for (let startPos = searchPos; startPos <= input.length; startPos++) {
      const end = matchFrom(startPos)
      if (end !== -1) { foundStart = startPos; foundEnd = end; break }
    }
    if (foundStart === -1) break

    const text = input.substring(foundStart, foundEnd)
    const prev = matches[matches.length - 1]
    matches.push({
      index: matches.length,
      start: foundStart,
      end: foundEnd,
      text,
      groups: [text],
      isEmpty: foundEnd === foundStart,
      overlapped: prev ? foundStart < prev.end : false
    })
    // 空命中前进一位,否则从下一段继续;保证片段不错位、不重叠
    searchPos = foundEnd > foundStart ? foundEnd : foundEnd + 1
  }

  if (stepIndex >= MAX_STEPS) truncated = true

  const duration = performance.now() - startTime
  const first = matches[0]
  return {
    matched: matches.length > 0,
    matchText: first ? first.text : '',
    groups: first ? first.groups : [],
    matches,
    truncated,
    steps,
    backtracks,
    totalSteps: stepIndex,
    duration: Math.round(duration * 100) / 100
  }
}

export function computeNFA(nfaResult: ReturnType<typeof buildNFA>): NFA {
  const nodes = nfaResult.states.map((s, i) => ({
    id: s.id,
    isStart: i === nfaResult.startState,
    isAccept: nfaResult.acceptStates.includes(s.id),
    x: 0, y: 0
  }))

  // Layout: circular
  const cx = 400, cy = 300, radius = 200
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2
    n.x = cx + Math.cos(angle) * radius
    n.y = cy + Math.sin(angle) * radius
  })

  const transitions: any[] = []
  nfaResult.states.forEach(s => {
    s.transitions.forEach((targets, symbol) => {
      targets.forEach(t => {
        transitions.push({ from: s.id, to: t, symbol: symbol.startsWith('__') ? symbol.replace('__', '') : symbol, label: symbol.startsWith('__') ? symbol.replace('__', '') : symbol })
      })
    })
    s.epsilonTransitions.forEach(t => {
      transitions.push({ from: s.id, to: t, symbol: null, label: 'ε' })
    })
  })

  return { states: nodes, transitions, startState: nfaResult.startState, acceptStates: nfaResult.acceptStates }
}

export function parseAST(pattern: string): ASTNode {
  let pos = 0
  let groupIdx = 0

  function parseAtom(): ASTNode {
    const ch = pattern[pos]
    if (ch === '(') {
      pos++
      if (pattern[pos] === '?') { pos++; if (pattern[pos] === ':') pos++ }
      else groupIdx++
      const node = parseOr()
      if (pattern[pos] === ')') pos++
      return { type: 'group', children: [node], groupIndex: groupIdx }
    }
    if (ch === '[') {
      pos++
      let cls = ''
      while (pos < pattern.length && pattern[pos] !== ']') { cls += pattern[pos]; pos++ }
      pos++
      return { type: 'charclass', value: cls }
    }
    if (ch === '.') { pos++; return { type: 'dot' } }
    if (ch === '\\') {
      pos++
      const e = pattern[pos]; pos++
      if (e === 'd') return { type: 'digit' }
      if (e === 'w') return { type: 'word' }
      if (e === 's') return { type: 'space' }
      return { type: 'char', value: e }
    }
    if (ch === '^' || ch === '$') { pos++; return { type: 'anchor', value: ch } }
    pos++
    return { type: 'char', value: ch }
  }

  function parseQuantifier(): ASTNode {
    let node = parseAtom()
    while (pos < pattern.length && ['*', '+', '?', '{'].includes(pattern[pos])) {
      const q = pattern[pos]
      if (q === '{') {
        while (pos < pattern.length && pattern[pos] !== '}') pos++
        pos++
      } else {
        pos++
      }
      const type = q === '*' ? 'star' : q === '+' ? 'plus' : 'question'
      node = { type, children: [node] }
      if (pos < pattern.length && pattern[pos] === '?') pos++
    }
    return node
  }

  function parseConcat(): ASTNode {
    const nodes: ASTNode[] = []
    while (pos < pattern.length && !['|', ')'].includes(pattern[pos])) {
      nodes.push(parseQuantifier())
    }
    if (nodes.length === 1) return nodes[0]
    return { type: 'concat', children: nodes }
  }

  function parseOr(): ASTNode {
    let left = parseConcat()
    while (pos < pattern.length && pattern[pos] === '|') {
      pos++
      const right = parseConcat()
      left = { type: 'or', children: [left, right] }
    }
    return left
  }

  return parseOr()
}

export const useRegexStore = defineStore('regex', () => {
  const pattern = ref('^([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+)\\.([a-zA-Z]{2,})$')
  const testString = ref('user@example.com admin@mail.org invalid-email')
  const currentStep = ref(0)
  const currentMatchIndex = ref(0)
  const isPlaying = ref(false)
  const nfa = ref<NFA | null>(null)
  const matchResult = ref<MatchResult | null>(null)
  const ast = ref<ASTNode | null>(null)
  const error = ref('')
  const selectedTemplate = ref<string>('')

  const groupColors = GROUP_COLORS

  const matches = computed<MatchSegment[]>(() => matchResult.value?.matches ?? [])

  const currentMatch = computed<MatchSegment | null>(() => {
    const list = matches.value
    if (list.length === 0) return null
    // 索引 clamp,保证重新执行/切换后选中片段不错位
    const i = Math.min(Math.max(currentMatchIndex.value, 0), list.length - 1)
    return list[i]
  })

  const isLongText = computed(() => testString.value.length > LONG_TEXT_THRESHOLD)

  const hasOverlap = computed(() => matches.value.some(m => m.overlapped))

  // 基于当前选中片段的索引位置切分文本,不用 indexOf,避免相同文本多段命中时错位
  const matchHighlight = computed(() => {
    const seg = currentMatch.value
    if (!seg) return null
    return {
      before: testString.value.substring(0, seg.start),
      match: testString.value.substring(seg.start, seg.end),
      after: testString.value.substring(seg.end)
    }
  })

  // 将整段文本按所有命中切分为有序片段,用于整文高亮渲染
  const highlightSegments = computed(() => {
    const text = testString.value
    const list = matches.value
    if (list.length === 0) return [{ text, isMatch: false, matchIndex: -1 }]
    const parts: { text: string; isMatch: boolean; matchIndex: number }[] = []
    let cursor = 0
    for (const m of list) {
      if (m.start > cursor) parts.push({ text: text.substring(cursor, m.start), isMatch: false, matchIndex: -1 })
      parts.push({ text: text.substring(m.start, m.end), isMatch: true, matchIndex: m.index })
      cursor = Math.max(cursor, m.end)
    }
    if (cursor < text.length) parts.push({ text: text.substring(cursor), isMatch: false, matchIndex: -1 })
    return parts
  })

  function execute() {
    error.value = ''
    try {
      const built = buildNFA(pattern.value)
      nfa.value = computeNFA(built)
      matchResult.value = runMatch(built.states, built.startState, testString.value)
      ast.value = parseAST(pattern.value)
      currentStep.value = 0
      currentMatchIndex.value = 0 // 重新执行后回到第一段,避免越界错位
    } catch (e: any) {
      error.value = e.message || '正则表达式解析错误'
      nfa.value = null
      matchResult.value = null
      ast.value = null
      currentMatchIndex.value = 0
    }
  }

  function setPattern(p: string) {
    pattern.value = p
    execute()
  }

  function setTestString(s: string) {
    testString.value = s
    execute()
  }

  function applyTemplate(t: RegexTemplate) {
    pattern.value = t.pattern
    testString.value = t.testString
    selectedTemplate.value = t.name
    execute()
  }

  function stepForward() {
    if (matchResult.value && currentStep.value < matchResult.value.steps.length - 1) {
      currentStep.value++
    }
  }

  function stepBackward() {
    if (currentStep.value > 0) currentStep.value--
  }

  function resetStep() {
    currentStep.value = 0
  }

  // 多段命中导航:越界时 clamp,保证选中片段始终有效
  function selectMatch(i: number) {
    const len = matches.value.length
    if (len === 0) { currentMatchIndex.value = 0; return }
    currentMatchIndex.value = Math.min(Math.max(i, 0), len - 1)
  }

  function nextMatch() {
    selectMatch(currentMatchIndex.value + 1)
  }

  function prevMatch() {
    selectMatch(currentMatchIndex.value - 1)
  }

  function play() {
    isPlaying.value = true
    const interval = setInterval(() => {
      if (matchResult.value && currentStep.value < matchResult.value.steps.length - 1) {
        currentStep.value++
      } else {
        isPlaying.value = false
        clearInterval(interval)
      }
    }, 200)
  }

  function stop() {
    isPlaying.value = false
  }

  return {
    pattern, testString, currentStep, currentMatchIndex, isPlaying, nfa, matchResult, ast, error,
    selectedTemplate, groupColors, matches, currentMatch, isLongText, hasOverlap,
    matchHighlight, highlightSegments,
    execute, setPattern, setTestString, applyTemplate,
    stepForward, stepBackward, resetStep, selectMatch, nextMatch, prevMatch, play, stop
  }
})
