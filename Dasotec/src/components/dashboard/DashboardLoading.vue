<script setup>
import { LoaderCircle } from 'lucide-vue-next'
</script>

<template>
  <div
    class="flex h-44 items-center justify-center gap-2.5 rounded-2xl border border-slate-300 bg-slate-50 text-sm font-semibold text-slate-600 sm:h-56 sm:text-base"
  >
    <LoaderCircle :size="20" class="animate-spin" />
    <span>Cargando datos y preparando graficas...</span>
  </div>
</template>
