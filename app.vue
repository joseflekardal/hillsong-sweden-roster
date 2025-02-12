<template>
  <div class="p-4">
    <h1 class="mb-4 text-xl font-black">
      <span v-if="status === 'pending'">Loading...</span>
      <span v-else-if="data"> {{ data.date }} 🗓️ </span>
    </h1>

    <div class="flex gap-3">
      <btn-link to="/" :disabled="!route.query.offset">This sunday</btn-link>
      <btn-link :to="nextOffset">Next sunday</btn-link>
    </div>

    <div v-if="data">
      <table class="text-xs border-collapse">
        <thead>
          <tr class="text-left uppercase h-6">
            <table-header class="sticky left-0 bg-white z-20">Team</table-header>
            <table-header v-for="service in data.services">{{
              service.name
              }}</table-header>
          </tr>
        </thead>
        <tbody>
          <template v-for="team in data.teams" :key="team.teamName">
            <tr class="bg-black text-white uppercase font-bold h-6 top-6 sticky z-20">
              <table-cell class="sticky left-0 z-10">{{ team.teamName }}</table-cell>
              <table-cell colspan="100" />
            </tr>
            <tr v-for="position of team.positions" :key="team.teamName">
              <table-cell class="sticky left-0 bg-white z-10 uppercase">{{
                position.positionName
                }}</table-cell>
              <table-cell v-for="campusRoster in position.roster" class="has-[i]:bg-yellow-100">
                <team-members v-if="campusRoster.length" :team-members="campusRoster" class="space-y-1" />
                <i v-else>N/A</i>
              </table-cell>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Team } from "./types";

const route = useRoute();
const query = computed(() => ({ ...route.query }));

const nextOffset = computed(() => {
  const currentOffset = Number(route.query.offset) || 0;

  return `/?offset=${currentOffset + 1}`;
});

const { status, data, refresh } = await useFetch<{
  teams: Team[];
  date: string;
  services: { id: string; name: string }[];
}>(() => "/api", { query });

watch(() => route.query, refresh, {
  deep: true,
});
</script>
