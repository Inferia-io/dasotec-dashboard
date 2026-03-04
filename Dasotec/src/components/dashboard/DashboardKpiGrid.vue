<script setup>
import { computed } from 'vue'

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
})

const gridClass = computed(() => {
  if (props.items.length <= 2) {
    return 'grid-cols-1 sm:grid-cols-2'
  }

  if (props.items.length === 3) {
    return 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
  }

  return 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
})
</script>

<template>
  <section class="grid gap-3" :class="gridClass">
    <article
      v-for="item in items"
      :key="item.label"
      class="flex h-full items-start gap-3 rounded-xl border border-slate-300/90 bg-white/85 p-3 shadow-sm"
      :class="item.wide ? 'md:col-span-3 xl:col-span-2' : ''"
    >
      <div
        class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        :style="{ color: item.accent, backgroundColor: `${item.accent}1a` }"
      >
        <component :is="item.icon" :size="16" />
      </div>

      <div class="min-w-0">
        <p class="text-xs text-slate-500">{{ item.label }}</p>
        <strong class="mt-1 block text-xl leading-tight text-slate-800 sm:text-2xl">{{ item.value }}</strong>
        <p v-if="item.hint" class="mt-1 text-[11px] leading-tight text-slate-500">{{ item.hint }}</p>
      </div>
    </article>
  </section>
</template>
