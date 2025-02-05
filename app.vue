<template>
  <div>
    <h1>Sunday roster</h1>

    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="team in data.formattedTeams" :key="team.id">
          <tr style="background: black; color: white">
            <td colspan="2">{{ team.teamName }}</td>
          </tr>
          <tr v-for="position of team.positions">
            <td>{{ position.id }}</td>
            <td>{{ position.positionName }}</td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
const response = await useFetch("/api");

const data = response.data;
</script>
