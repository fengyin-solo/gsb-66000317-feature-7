<template>
  <div ref="rootRef" class="bg-slate-800 rounded-lg p-4 border border-slate-700">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-bold text-slate-400">匹配结果高亮</h3>
      <div class="flex items-center gap-2">
        <span v-if="store.matchResult?.matched" class="text-xs px-2 py-0.5 rounded bg-green-900/60 text-green-300">{{ store.matches.length }} 处命中</span>
        <div v-if="store.matches.length" class="flex rounded overflow-hidden border border-slate-600 text-xs">
          <button @click="viewMode = 'board'" :class="viewMode === 'board' ? 'bg-cyan-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'" class="px-2 py-0.5">看板</button>
          <button @click="viewMode = 'detail'" :class="viewMode === 'detail' ? 'bg-cyan-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'" class="px-2 py-0.5">详情</button>
        </div>
      </div>
    </div>

    <!-- 状态说明：无命中 / 零宽重叠 / 命中截断 / 长文本，均保持原输入不变 -->
    <div v-if="store.error" class="text-red-400 text-sm">解析错误</div>
    <template v-else-if="store.matchResult">
      <div v-if="!store.matchResult.matched" class="text-red-400 text-sm mb-2">未匹配到结果，已保留原始输入文本。</div>
      <div v-else class="space-y-1 mb-2">
        <div v-if="store.zeroWidthCount > 0" class="text-xs text-orange-300 bg-orange-900/40 rounded px-2 py-1">⚠ 包含 {{ store.zeroWidthCount }} 个零宽命中，已按非重叠规则自动推进，避免命中重叠。</div>
        <div v-if="store.matchesTruncated" class="text-xs text-yellow-300 bg-yellow-900/40 rounded px-2 py-1">⚠ 命中数量过多，仅展示前 {{ store.matches.length }} 条。</div>
        <div v-if="isLongText" class="text-xs text-blue-300 bg-blue-900/40 rounded px-2 py-1">ℹ 文本较长（{{ store.testString.length }} 字符），以下按命中片段的上下文窗口展示，原始输入保持不变。</div>
      </div>
    </template>
    <div v-else class="text-slate-500 text-sm">等待执行...</div>

    <!-- 高亮文本：全部命中高亮，当前片段强调并同步滚动 -->
    <div v-if="!store.error && store.matchResult" class="bg-slate-900 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap break-all max-h-64 overflow-auto">
      <template v-for="(item, i) in displayItems" :key="i">
        <span v-if="item.type === 'gap'" class="text-slate-600 text-xs"> … 省略 {{ item.count }} 字符 … </span>
        <span v-else-if="!item.match" class="text-slate-500">{{ item.text }}</span>
        <span v-else
          :data-match-index="item.match.index"
          :title="item.match.zeroWidth ? '零宽命中' : `命中 #${item.match.index + 1} [${item.match.start}, ${item.match.end})`"
          @click="select(item.match.index)"
          class="px-1 rounded cursor-pointer transition-all"
          :class="item.match.index === store.currentMatchIndex
            ? 'bg-cyan-500 text-white ring-2 ring-cyan-300 font-bold'
            : 'bg-green-700/70 text-green-100 hover:bg-green-600'">{{ item.match.zeroWidth ? '∅' : item.text }}</span>
      </template>
    </div>

    <!-- 多段导航：前后切换，当前片段与高亮位置同步 -->
    <div v-if="store.matches.length" class="mt-3 flex items-center gap-2">
      <button @click="store.prevMatch" :disabled="store.currentMatchIndex === 0" class="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded text-sm">◀ 上一个</button>
      <span class="text-sm text-slate-400 font-mono">{{ store.currentMatchIndex + 1 }} / {{ store.matches.length }}</span>
      <button @click="store.nextMatch" :disabled="store.currentMatchIndex >= store.matches.length - 1" class="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded text-sm">下一个 ▶</button>
    </div>

    <!-- 看板视图：浏览全部命中片段 -->
    <div v-if="store.matches.length && viewMode === 'board'" class="mt-4">
      <h4 class="text-xs font-bold text-slate-500 mb-2">命中看板（点击卡片查看详情）</h4>
      <div class="grid grid-cols-2 xl:grid-cols-3 gap-2 max-h-56 overflow-y-auto">
        <button v-for="m in store.matches" :key="m.index" @click="select(m.index, true)"
          class="text-left p-2 rounded-lg border transition-all"
          :class="m.index === store.currentMatchIndex ? 'border-cyan-400 bg-cyan-900/30 ring-1 ring-cyan-400' : 'border-slate-700 bg-slate-900 hover:border-slate-500'">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold" :style="{ color: store.groupColors[m.index % store.groupColors.length] }">#{{ m.index + 1 }}</span>
            <span class="text-[10px] text-slate-500 font-mono">[{{ m.start }}, {{ m.end }})</span>
          </div>
          <div class="text-sm font-mono text-slate-200 truncate mt-1">{{ m.text || '∅ 零宽' }}</div>
          <div class="text-[10px] text-slate-500 mt-1">分组 {{ m.groups.length }} · 长度 {{ m.end - m.start }}</div>
        </button>
      </div>
    </div>

    <!-- 详情视图：当前片段位置与内容，可返回列表 -->
    <div v-if="store.matches.length && viewMode === 'detail' && store.currentMatch" class="mt-4 bg-slate-900 rounded-lg p-3 border border-slate-700">
      <div class="flex items-center justify-between mb-2">
        <h4 class="text-xs font-bold text-slate-500">片段详情 #{{ store.currentMatch.index + 1 }}</h4>
        <button @click="viewMode = 'board'" class="text-xs px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded">← 返回列表</button>
      </div>
      <div class="text-sm space-y-1">
        <div><span class="text-slate-500">内容：</span><span class="font-mono text-cyan-300 break-all">{{ store.currentMatch.text || '∅（零宽命中）' }}</span></div>
        <div><span class="text-slate-500">位置：</span><span class="font-mono text-slate-300">[{{ store.currentMatch.start }}, {{ store.currentMatch.end }}) · 长度 {{ store.currentMatch.end - store.currentMatch.start }}</span></div>
      </div>
    </div>

    <!-- 当前片段分组捕获：颜色与统计面板一致 -->
    <div v-if="store.currentMatch" class="mt-4">
      <h4 class="text-xs font-bold text-slate-500 mb-2">当前片段分组捕获 ({{ store.currentMatch.groups.length }})</h4>
      <div class="space-y-1">
        <div v-for="(group, i) in store.currentMatch.groups" :key="i" class="flex items-center gap-2 text-sm">
          <span class="inline-block w-4 h-4 rounded" :style="{ backgroundColor: store.groupColors[i % store.groupColors.length] }"></span>
          <span class="text-slate-500 w-16">Group {{ i }}</span>
          <span class="text-slate-200 font-mono bg-slate-900 px-2 py-0.5 rounded">{{ group || '∅' }}</span>
        </div>
      </div>
    </div>

    <div v-if="store.matchResult && store.matchResult.steps.length > 0" class="mt-4">
      <h4 class="text-xs font-bold text-slate-500 mb-2">执行步骤 (最近5步)</h4>
      <div class="space-y-1 max-h-32 overflow-y-auto">
        <div v-for="step in recentSteps" :key="step.stepIndex"
          class="text-xs font-mono px-2 py-1 rounded"
          :class="step.isBacktrack ? 'bg-orange-900 text-orange-300' : step.stepIndex === store.currentStep ? 'bg-cyan-900 text-cyan-300' : 'bg-slate-900 text-slate-400'">
          [{{ step.stepIndex }}] '{{ step.char }}' → 状态{{ step.currentState}}→{{ step.nextState }} ({{ step.transition }}){{ step.isBacktrack ? ' ⚠回溯' : '' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useRegexStore } from '../store/regex'
import type { MatchSegment } from '../types'

const store = useRegexStore()
const rootRef = ref<HTMLElement | null>(null)
const viewMode = ref<'board' | 'detail'>('board')

const LONG_TEXT_THRESHOLD = 1500
const CONTEXT_CHARS = 40

const isLongText = computed(() => store.testString.length > LONG_TEXT_THRESHOLD)

interface DisplayItem {
  type: 'part' | 'gap'
  text?: string
  match?: MatchSegment | null
  count?: number
}

// 将原文按命中切分为展示片段；长文本时仅保留命中附近的上下文窗口，原输入不被修改
const displayItems = computed<DisplayItem[]>(() => {
  const text = store.testString
  const ms = store.matches
  if (!ms.length) return [{ type: 'part', text, match: null }]

  if (!isLongText.value) {
    const items: DisplayItem[] = []
    let cursor = 0
    for (const m of ms) {
      if (m.start > cursor) items.push({ type: 'part', text: text.slice(cursor, m.start), match: null })
      items.push({ type: 'part', text: text.slice(m.start, m.end), match: m })
      cursor = m.end
    }
    if (cursor < text.length) items.push({ type: 'part', text: text.slice(cursor), match: null })
    return items
  }

  // 长文本：合并重叠的上下文窗口，窗口外内容以省略标记代替
  const windows: [number, number][] = []
  for (const m of ms) {
    const ws = Math.max(0, m.start - CONTEXT_CHARS)
    const we = Math.min(text.length, m.end + CONTEXT_CHARS)
    const last = windows[windows.length - 1]
    if (last && ws <= last[1]) last[1] = Math.max(last[1], we)
    else windows.push([ws, we])
  }

  const items: DisplayItem[] = []
  let prevEnd = 0
  for (const [ws, we] of windows) {
    if (ws > prevEnd) items.push({ type: 'gap', count: ws - prevEnd })
    let cursor = ws
    for (const m of ms) {
      if (m.end <= ws) continue
      if (m.start >= we) break
      const s = Math.max(m.start, ws)
      const e = Math.min(m.end, we)
      if (s > cursor) items.push({ type: 'part', text: text.slice(cursor, s), match: null })
      items.push({ type: 'part', text: text.slice(s, e), match: m })
      cursor = e
    }
    if (cursor < we) items.push({ type: 'part', text: text.slice(cursor, we), match: null })
    prevEnd = we
  }
  if (prevEnd < text.length) items.push({ type: 'gap', count: text.length - prevEnd })
  return items
})

const recentSteps = computed(() => {
  if (!store.matchResult) return []
  const end = store.currentStep + 1
  return store.matchResult.steps.slice(Math.max(0, end - 5), end)
})

function select(i: number, toDetail = false) {
  store.selectMatch(i)
  if (toDetail) viewMode.value = 'detail'
}

// 当前片段变化时，滚动同步到页面中的高亮位置
watch(() => store.currentMatchIndex, async () => {
  await nextTick()
  const el = rootRef.value?.querySelector(`[data-match-index="${store.currentMatchIndex}"]`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
})
</script>
