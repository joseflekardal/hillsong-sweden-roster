import data from "../data.json";
interface Auth {
  username: string;
  password: string;
}

interface PlansResponse {
  data: { links: { self: string } }[];
}

function getBasicAuth(auth: Auth) {
  return Buffer.from(auth.username + ":" + auth.password).toString("base64");
}

function getPlanUrl(plans: PlansResponse): string {
  return plans.data[0]?.links.self;
}

export default defineEventHandler(async (event) => {
  const { PCO_APP_ID, PCO_APP_SECRET } = event.context.cloudflare.env as {
    PCO_APP_ID: string;
    PCO_APP_SECRET: string;
  };

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

  // const plans = await $fetch<PlansResponse>(
  //   `https://api.planningcenteronline.com/services/v2/service_types/${servicesMap.cityam}/plans?filter=future&per_page=1`,
  //   headers
  // );

  // const planUrl = getPlanUrl(plans);
  // const teamMembers = await $fetch<{ included: {}[] }>(
  //   planUrl + "/team_members?per_page=100`",
  //   headers
  // );

  // const neededPositions = await $fetch<{ included: {}[] }>(
  //   planUrl + "/needed_positions?per_page=100",
  //   headers
  // );

  // const teams = await $fetch(
  //   `https://api.planningcenteronline.com/services/v2/service_types/${servicesMap.cityam}/teams?include=team_positions`,
  //   headers
  // );

  const { teamMembers, plans, neededPositions, teams } = data;

  const formattedTeams = [];
  for (const team of teams.data) {
    formattedTeams.push({
      id: team.id,
      teamName: team.attributes.name,
      positions: teams.included
        .filter((include) => {
          return include.relationships.team.data.id === team.id;
        })
        .map((position) => {
          return {
            id: position.id,
            positionName: position.attributes.name,
            teamMembers: teamMembers.data
              .filter((person) => {
                return (
                  person.attributes.team_position_name ===
                    position.attributes.name &&
                  person.relationships.team.data.id === team.id
                );
              })
              .map((person) => {
                // here is the person data
                return person.attributes.name;
              }),
          };
        }),
    });
  }

  return {
    formattedTeams,
    teamMembers,
    neededPositions,
  };
});
