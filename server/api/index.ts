import type {
  Auth,
  FormattedTeams,
  Team,
  PlansResponse,
  TeamMemberResponse,
  NeededPositionResponse,
  TeamResponse,
  PositionByName,
} from "~/types";

function getBasicAuth(auth: Auth) {
  return Buffer.from(auth.username + ":" + auth.password).toString("base64");
}

function getPlanUrl(plans: PlansResponse): string {
  return plans.data[0]?.links.self;
}

export default defineEventHandler(async (event) => {
  const {
    PCO_APP_ID,
    PCO_APP_SECRET,
    CACHE,
    CACHE_TTL = "10",
  } = event.context.cloudflare.env as {
    PCO_APP_ID: string;
    PCO_APP_SECRET: string;
    CACHE_TTL: string;
    CACHE: KVNamespace;
  };

  console.log({ CACHE_TTL });

  const cache = await CACHE.get(event.path);

  if (cache) {
    const { timestamp, payload } = JSON.parse(cache);

    const ellapsed = new Date().getTime() - new Date(timestamp).getTime();
    const ellapsedMinutes = ellapsed / 1000 / 60;

    if (ellapsedMinutes < Number(CACHE_TTL)) {
      console.log("serving cached data");

      return payload;
    }
  }

  const servicesMap = {
    norraam: "1134523",
    cityam: "1155896",
    citypm: "1155898",
  };

  const basicAuth = getBasicAuth({
    username: PCO_APP_ID,
    password: PCO_APP_SECRET,
  });

  const headers = { headers: { Authorization: `Basic ${basicAuth}` } };

  const serviceTypes = await Promise.all(
    Object.values(servicesMap).map(async (serviceTypeId) => {
      const plans = await $fetch<PlansResponse>(
        `https://api.planningcenteronline.com/services/v2/service_types/${serviceTypeId}/plans?filter=future&per_page=1`,
        headers
      );

      const planUrl = getPlanUrl(plans);

      const [teamMembers, neededPositions, teams] = await Promise.all([
        $fetch<TeamMemberResponse>(
          planUrl + "/team_members?per_page=100`",
          headers
        ),
        $fetch<NeededPositionResponse>(
          planUrl + "/needed_positions?per_page=100",
          headers
        ),
        $fetch<TeamResponse>(
          `https://api.planningcenteronline.com/services/v2/service_types/${serviceTypeId}/teams?include=team_positions`,
          headers
        ),
      ]);

      return {
        teams,
        teamMembers,
        plans,
        neededPositions,
      };
    })
  );

  const allPositionsByTeamName = new Map<string, Set<string>>();

  const formattedServiceTypes: FormattedTeams[] = [];
  for (const serviceType of serviceTypes) {
    const { teamMembers, plans, neededPositions, teams } = serviceType;

    const teamPositionById = teams.included.reduce<Record<string, string>>(
      (acc, cur) => {
        acc[cur.id] = cur.attributes.name;
        return acc;
      },
      {}
    );

    const teamsById: FormattedTeams = {};
    const teamsByName: FormattedTeams = {};
    for (const team of teams.data) {
      const teamName = team.attributes.name;

      const formattedTeam = {
        teamName,
        positions:
          team.relationships.team_positions.data.reduce<PositionByName>(
            (acc, teamPosition) => {
              const positionName = teamPositionById[teamPosition.id];

              const teamSet = allPositionsByTeamName.get(teamName) || new Set();

              teamSet.add(positionName);
              allPositionsByTeamName.set(teamName, teamSet);

              acc[positionName] = [];
              return acc;
            },
            {}
          ),
      };

      teamsById[team.id] = formattedTeam;
      teamsByName[teamName] = formattedTeam;
    }

    for (const teamMember of teamMembers.data) {
      const teamId = teamMember.relationships.team.data.id;
      const positionName = teamMember.attributes.team_position_name;

      const teamPosition = teamsById[teamId].positions[positionName];
      const teamPerson = {
        name: teamMember.attributes.name,
        status: teamMember.attributes.status,
        avatar: teamMember.attributes.photo_thumbnail,
      };

      teamPosition.push(teamPerson);
    }

    formattedServiceTypes.push(teamsByName);
  }

  const teams: Team[] = [];
  allPositionsByTeamName.forEach((positions, teamName) => {
    const team = {
      teamName: teamName,
      positions: Array.from(positions).map((positionName) => {
        return {
          positionName,
          roster: formattedServiceTypes.map((serviceType) => {
            const serviceTeam = serviceType[teamName];

            if (!serviceTeam) {
              return [];
            }

            return serviceTeam.positions[positionName] || [];
          }),
        };
      }),
    };

    teams.push(team);
  });

  const cachePayload = JSON.stringify({
    payload: teams,
    timestamp: new Date().toISOString(),
  });

  await CACHE.put(event.path, cachePayload);

  return teams;
});
