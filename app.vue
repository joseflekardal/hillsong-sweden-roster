<template>
  <div>
    <h1>Sunday roster</h1>

    <table>
      <thead>
        <tr>
          <th>Team</th>
          <th>Campus 1</th>
          <th>Campus 2</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="team in data" :key="team.teamName">
          <tr>
            <td colspan="100">{{ team.teamName }}</td>
          </tr>
          <tr v-for="position of team.positions" :key="team.teamName">
            <td>{{ position.positionName }}</td>
            <td v-for="campusRoster in position.roster">
              <template v-if="campusRoster.length">
                <p v-for="teamMember in campusRoster" class="team-member" :class="statusMap[teamMember.status]">
                  <img :src="teamMember.avatar" :alt="teamMember.name + ' thumbnail'">
                  {{ teamMember.name }}
                </p>
              </template>
              <p v-else class="team-member not-available">N/A</p>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { Team } from './types';
const response = await useFetch<Team[]>("/api");

const data = response.data;

const statusMap = {
  C: 'confirmed',
  D: 'declined',
  U: 'unconfirmed'
}
</script>


<style scoped>
* {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
  font-size: 14px;
  --table-header-height: 25px;
}

p {
  margin: 0;
}

td {
  vertical-align: top;
  padding: .25rem;
}

td,
th {
  text-align: left;
}

tr:has(td[colspan="100"]) {
  background: black;
  text-transform: uppercase;
  font-weight: bold;
  color: white;
  position: sticky;
  top: var(--table-header-height);
  z-index: 1;
}

td {
  border-bottom: 1px solid rgb(229, 231, 235);

  &:first-child {
    text-transform: uppercase;
    ;
  }
}

td p {
  display: flex;
  align-items: center;
  gap: .25rem;
}

td p:not(:last-child) {
  margin-bottom: .25rem;
}

td img {
  width: 20px;
  height: 20px;
  object-fit: cover;
  border-radius: 20px;
  border: 2px solid;
}

table {
  border-collapse: collapse;
}

th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: white;
  height: var(--table-header-height);
}

.team-member {
  color: var(--status-color);

  img {
    border-color: var(--status-color);
  }
}

.confirmed {
  --status-color: rgb(34, 197, 94);
  color: black;
}

.declined {
  --status-color: red;
  text-decoration: line-through;
}

.unconfirmed {
  --status-color: orange;
  font-style: italic;
}

td:has(.not-available) {
  background: rgb(254 249 195);
}
</style>