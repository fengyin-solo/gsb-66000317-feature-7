<template>
  <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-bold text-slate-400">多段匹配看板</h3>
      <div v-if="store.matches.length > 0" class="flex items-center gap-2">
        <button @click="store.prevMatch" :disabled="store.currentMatchIndex === 0"
          class="px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded text-xs">◀ 上一段</button>
        <span class="text-xs text-slate-400 font-mono">第 {{ store.currentMatchIndex + 1 }} / {{ store.matches.length }} 段</span>
        <button @click="store.nextMatch" :disabled="store.currentMatchIndex >= store.matches.length - 1"
          class="px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded text-xs">下一段 ▶</button>
      </div>
    </div>

    <!-- 状态说明:保持原输入,仅提示当前状态 -->
    <div v-if="store.error" class="text-red-400 text-sm">解析错误,已保留原输入</div>
    <div v-else-if="!store.matchResult" class="text-slate-500 text-sm">等待执行...</div>
    <div v-else-if="store.matches.length === 0" class="text-slate-500 text-sm">当前无命中片段,已保留原输入</div>
    <template v-else>
      <div class="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs">
        <span v-if="store.isLongText" class="text-yellow-400">⚠ 文本较长({{ store.testString.length }} 字符),已保留原输入,仅展示命中概览</span>
        <span v-if="store.matchResult.truncated" class="text-orange-400">⚠ 命中/步骤过多,结果已截断,仅展示前 {{ store.matches.length }} 段</span>
        <span v-if="store.hasOverlap" class="text-purple-400">⚠ 存在重叠命中(零宽匹配),已按顺序展开</span>
      </div>

      <!-- 看板:每段命中一张卡片,点击切换选中 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
        <div v-for="m in store.matches" :key="m.index"
          @click="store.selectMatch(m.index)"
          :class="['cursor-pointer rounded-lg border p-2 transition-all',
            m.index === store.currentMatchIndex
              ? 'border-cyan-500 bg-cyan-900/30 ring-1 ring-cyan-500'
              : 'border-slate-700 bg-slate-900 hover:border-slate-500']">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold" :class="m.index === store.currentMatchIndex ? 'text-cyan-300' : 'text-slate-400'">#{{ m.index + 1 }}</span>
            <span class="text-xs font-mono text-slate-500">[{{ m.start }}, {{ m.end }})</span>
          </div>
          <div class="mt-1 font-mono text-sm truncate" :class="m.isEmpty ? 'text-slate-500 italic' : 'text-slate-200'">{{ m.isEmpty ? '(空命中)' : m.text }}</div>
          <div class="mt-1 flex items-center gap-1">
            <span v-for="(g, gi) in m.groups" :key="gi" class="inline-block w-3 h-3 rounded-sm"
              :style="{ backgroundColor: store.groupColors[gi % store.groupColors.length] }" :title="`Group ${gi}: ${g}`"></span>
            <span v-if="m.overlapped" class="text-xs text-purple-400 ml-1">重叠</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useRegexStore } from '../store/regex'

const store = useRegexStore()
</script>
