import type {
  Auth,
  FormattedTeams,
  Team,
  PlansResponse,
  TeamMemberResponse,
  TeamResponse,
  PositionsByName,
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

  const cache = await CACHE.get(event.path, {
    type: "json",
  });

  if (cache) {
    console.log("CACHE HIT");
    return cache;
  }

  console.log("CACHE MISS");

  const services = [
    { id: "1134523", name: "Norra" },
    { id: "1155896", name: "City AM" },
    { id: "1155898", name: "City PM" },
    // { id: "1073502", name: "GBG 10:30" },
    // { id: "1063681", name: "GBG 12:30" },
    // { id: "1063677", name: "GBG 18:00" },
  ];

  const basicAuth = getBasicAuth({
    username: PCO_APP_ID,
    password: PCO_APP_SECRET,
  });

  const headers = { Authorization: `Basic ${basicAuth}` };

  const serviceTypes = await Promise.all(
    services.map(async (serviceType) => {
      const plans = await $fetch<PlansResponse>(
        `https://api.planningcenteronline.com/services/v2/service_types/${serviceType.id}/plans`,
        {
          headers,
          query: {
            ...getQuery(event),
            per_page: 1,
            "fields[Plan]": "short_dates",
            filter: "future",
          },
        },
      );

      const planUrl = getPlanUrl(plans);

      const [teamMembers, teams] = await Promise.all([
        $fetch<TeamMemberResponse>(planUrl + "/team_members", {
          headers,
          query: {
            per_page: 100,
            "fields[PlanPerson]":
              "name,status,photo_thumbnail,team_position_name,team",
          },
        }),
        $fetch<TeamResponse>(
          `https://api.planningcenteronline.com/services/v2/service_types/${serviceType.id}/teams`,
          {
            headers,
            query: {
              include: "team_positions",
              "fields[Team]": "name,team_positions",
              "fields[TeamPosition]": "name,sequence",
            },
          },
        ),
      ]);
      return {
        teams,
        teamMembers,
        plans,
      };
    }),
  );

  const allPositionsByTeamName = new Map<string, Map<string, number | null>>();

  const formattedServiceTypes: FormattedTeams[] = [];
  for (const serviceType of serviceTypes) {
    const { teamMembers, teams } = serviceType;

    const teamPositionById = teams.included.reduce<
      Record<string, { name: string; sequence: number | null }>
    >((acc, cur) => {
      acc[cur.id] = {
        name: cur.attributes.name.toUpperCase(),
        sequence: cur.attributes.sequence,
      };
      return acc;
    }, {});

    const teamsById: FormattedTeams = {};
    const teamsByName: FormattedTeams = {};
    for (const team of teams.data) {
      const teamName = team.attributes.name;

      const formattedTeam = {
        teamName,
        positions:
          team.relationships.team_positions.data.reduce<PositionsByName>(
            (acc, teamPosition) => {
              const position = teamPositionById[teamPosition.id];

              const positionMap =
                allPositionsByTeamName.get(teamName) ||
                new Map<string, number | null>();

              positionMap.set(position.name, position.sequence);
              allPositionsByTeamName.set(teamName, positionMap);

              acc[position.name] = [];
              return acc;
            },
            {},
          ),
      };

      teamsById[team.id] = formattedTeam;
      teamsByName[teamName] = formattedTeam;
    }

    for (const teamMember of teamMembers.data) {
      const teamId = teamMember.relationships.team.data.id;
      const positionName =
        teamMember.attributes.team_position_name.toUpperCase();
      const teamPosition = teamsById[teamId].positions[positionName];

      if (!teamPosition) {
        // maybe this team is removed or renamed? skip it
        continue;
      }

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
  allPositionsByTeamName.forEach((positionSet, teamName) => {
    const positions: Team["positions"] = [];

    positionSet.forEach((sequence, positionName) => {
      let hasPeople = false;
      const position = {
        sequence: sequence,
        positionName: positionName,
        roster: formattedServiceTypes.map((serviceType) => {
          const serviceTeam = serviceType[teamName];

          if (!serviceTeam) {
            return [];
          }

          const output = serviceTeam.positions[positionName] || [];

          if (output.length) {
            hasPeople = true;
          }

          return output;
        }),
      };

      if (hasPeople) {
        positions.push(position);
      }
    });

    const team = {
      teamName: teamName,
      positions: positions.sort((a, b) => {
        return (a.sequence || a.positionName) > (b.sequence || a.positionName)
          ? 1
          : -1;
      }),
    };

    if (positions.length) {
      teams.push(team);
    }
  });

  const response = {
    teams,
    date: serviceTypes[0].plans.data[0].attributes.short_dates,
    services,
  };

  let cacheTtl = Number(CACHE_TTL);
  if (Number.isNaN(cacheTtl)) {
    cacheTtl = 10;
  }

  const cachePayload = JSON.stringify(response);

  await CACHE.put(event.path, cachePayload, {
    expirationTtl: cacheTtl * 60,
  });

  return response;
});
