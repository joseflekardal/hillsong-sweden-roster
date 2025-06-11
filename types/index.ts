export interface Auth {
  username: string;
  password: string;
}

export type PlansResponse = {
  data: {
    attributes: {
      short_dates: string;
    };
    links: { self: string };
  }[];
};

export type TeamMemberResponse = {
  data: {
    id: string;
    attributes: {
      name: string;
      status: Status;
      photo_thumbnail: string;
      team_position_name: string;
    };
    relationships: {
      team: {
        data: {
          id: string;
        };
      };
    };
  }[];
  included: {}[];
};

export type NeededPositionResponse = { included: {}[] };

export type TeamResponse = {
  data: {
    id: string;
    attributes: {
      name: string;
    };
    relationships: {
      team_positions: {
        data: { id: string }[];
      };
    };
  }[];
  included: {
    id: string;
    attributes: {
      name: string;
      sequence: number | null;
    };
  }[];
};

export type Status = "D" | "C" | "U";

export interface PersonSlim {
  name: string;
  status: Status;
  avatar: string;
}

export type FormattedTeams = Record<
  string,
  {
    teamName: string;
    positions: Record<string, PersonSlim[]>;
  }
>;

export interface TeamPosition {
  positionName: string;
  sequence: number | null;
  roster: PersonSlim[][];
}

export interface Team {
  teamName: string;
  positions: TeamPosition[];
}

export type PositionsByName = Record<string, PersonSlim[]>;
