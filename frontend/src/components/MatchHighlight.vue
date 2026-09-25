<template>
  <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
    <h3 class="text-sm font-bold text-slate-400 mb-3">匹配结果高亮</h3>
    <div v-if="store.error" class="text-red-400 text-sm">解析错误</div>
    <div v-else-if="store.matchResult && store.matches.length > 0" class="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto whitespace-pre-wrap break-all">
      <template v-for="(part, i) in store.highlightSegments" :key="i">
        <span v-if="part.isMatch"
          :ref="el => setMatchRef(el, part.matchIndex)"
          :class="part.matchIndex === store.currentMatchIndex
            ? 'bg-green-600 text-white px-1 rounded ring-2 ring-green-300'
            : 'bg-green-900/60 text-green-200 px-1 rounded cursor-pointer hover:bg-green-800'"
          @click="store.selectMatch(part.matchIndex)">{{ part.text || '∅' }}</span>
        <span v-else class="text-slate-500">{{ part.text }}</span>
      </template>
    </div>
    <div v-else-if="store.matchResult && !store.matchResult.matched" class="text-red-400 text-sm">未匹配到结果</div>
    <div v-else class="text-slate-500 text-sm">等待执行...</div>

    <div v-if="store.currentMatch" class="mt-4">
      <h4 class="text-xs font-bold text-slate-500 mb-2">
        当前片段 #{{ store.currentMatch.index + 1 }} 分组捕获 ({{ store.currentMatch.groups.length }})
        <span class="font-mono font-normal">[{{ store.currentMatch.start }}, {{ store.currentMatch.end }})</span>
      </h4>
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
import { computed, watch, nextTick } from 'vue'
import { useRegexStore } from '../store/regex'

const store = useRegexStore()
const recentSteps = computed(() => {
  if (!store.matchResult) return []
  const end = store.currentStep + 1
  return store.matchResult.steps.slice(Math.max(0, end - 5), end)
})

// 记录每个命中片段的 DOM,选中片段变化时滚动到可视区域,保持高亮位置同步
const matchEls = new Map<number, Element>()
function setMatchRef(el: any, matchIndex: number) {
  if (el) matchEls.set(matchIndex, el)
  else matchEls.delete(matchIndex)
}

watch(() => store.currentMatchIndex, async (i) => {
  await nextTick()
  matchEls.get(i)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
})
</script>
