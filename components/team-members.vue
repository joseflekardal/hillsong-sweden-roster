<script lang="ts" setup>
import type { PersonSlim } from "~/types"
defineProps<{
  teamMembers: PersonSlim[]
}>()
</script>

<template>
  <div class="space-y-1">
    <p v-for="teamMember in teamMembers" class="flex items-center gap-2" :class="{
      'text-red-500 line-through': teamMember.status === 'D',
      'text-yellow-500 italic': teamMember.status === 'U',
    }">
      <img :src="teamMember.avatar" :alt="teamMember.name + ' thumbnail'"
        class="w-6 h-6 rounded-full border-2 hidden md:inline" :class="{
          'border-red-500': teamMember.status === 'D',
          'border-green-500': teamMember.status === 'C',
          'border-yellow-500': teamMember.status === 'U',
        }">
      {{ teamMember.name }}
    </p>
  </div>
</template>