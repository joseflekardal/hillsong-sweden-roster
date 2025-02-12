import type {
  Auth,
  FormattedTeams,
  Team,
  PlansResponse,
  TeamMemberResponse,
  NeededPositionResponse,
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

  console.log({ CACHE_TTL });

  const cache = await CACHE.get(event.path);

  if (cache) {
    const { timestamp, payload } = JSON.parse(cache);

    const ellapsed = new Date().getTime() - new Date(timestamp).getTime();
    const ellapsedMinutes = ellapsed / 1000 / 60;

    console.log({ ellapsedMinutes });

    if (ellapsedMinutes < Number(CACHE_TTL)) {
      console.log("serving cached data");
      setResponseHeader(event, "X-CACHE", "HIT");

      return payload;
    }
  }

  console.log("FRESH DATA");
  setResponseHeader(event, "X-CACHE", "MISS");

  const services = [
    { id: "1134523", name: "Norra" },
    { id: "1155896", name: "City AM" },
    { id: "1155898", name: "City PM" },
  ];

  const basicAuth = getBasicAuth({
    username: PCO_APP_ID,
    password: PCO_APP_SECRET,
  });

  const headers = { headers: { Authorization: `Basic ${basicAuth}` } };

  const serviceTypes = await Promise.all(
    services.map(async (serviceType) => {
      let offset = "";
      const query = getQuery(event);

      if (query.offset) {
        offset = `&offset=${Number(query.offset || "0")}`;
      }

      const plans = await $fetch<PlansResponse>(
        `https://api.planningcenteronline.com/services/v2/service_types/${serviceType.id}/plans?filter=future&per_page=1${offset}`,
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
          `https://api.planningcenteronline.com/services/v2/service_types/${serviceType.id}/teams?include=team_positions`,
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
    const { teamMembers, neededPositions, teams } = serviceType;

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
          team.relationships.team_positions.data.reduce<PositionsByName>(
            (acc, teamPosition) => {
              const positionName = teamPositionById[teamPosition.id];

              const positionSet =
                allPositionsByTeamName.get(teamName) || new Set();

              positionSet.add(positionName);
              allPositionsByTeamName.set(teamName, positionSet);

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
  allPositionsByTeamName.forEach((positionSet, teamName) => {
    const positions: Team["positions"] = [];
    positionSet.forEach((positionName) => {
      let hasPeople = false;
      const position = {
        positionName,
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
      positions,
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

  const cachePayload = JSON.stringify({
    payload: response,
    timestamp: new Date().toISOString(),
  });

  await CACHE.put(event.path, cachePayload);

  return response;
});
