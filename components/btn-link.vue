<script lang="ts" setup>
type Props = {
  disabled?: boolean, to: string
}

const { disabled = false, to } = defineProps<Props>()
</script>

<template>
  <nuxt-link :to="to"
    class="px-2 py-1 mb-4 text-white transition duration-200 bg-blue-800 rounded-md shadow-md cursor-pointer hover:bg-blue-900 text-sm"
    :class="{
      'pointer-events-none cursor-not-allowed opacity-50': disabled
    }">
    <slot />
  </nuxt-link>
</template>