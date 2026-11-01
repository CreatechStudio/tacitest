export type RoomStatus = "lobby" | "playing" | "finished" | "expired";
export type RoundPhase = "input" | "reveal";

export type RoomSettings = {
  maxWordLength: number;
  roundSeconds: number;
  ignoreCase: boolean;
};

export type RoomRole = "player" | "spectator";

export type RoomMember = {
  id: string;
  name: string;
  isHost: boolean;
  role: RoomRole;
  isPresent: boolean;
  hasSubmitted: boolean;
};

export type RoundEntry = {
  memberId: string;
  memberName: string;
  word: string | null;
};

export type RoundRecord = {
  round: number;
  entries: RoundEntry[];
  completedAt: number;
};

export type RoomSnapshot = {
  code: string;
  status: RoomStatus;
  phase: RoundPhase;
  settings: RoomSettings;
  hostId: string;
  currentUserId: string;
  viewerRole: RoomRole;
  members: RoomMember[];
  roundNumber: number;
  deadlineAt: number | null;
  transitionAt: number | null;
  terminationAt: number | null;
  latestRound: RoundRecord | null;
  previousRound: RoundRecord | null;
  liveEntries: RoundEntry[];
  rounds: RoundRecord[];
  winningWord: string | null;
  createdAt: number;
};

export type AdminRoomMember = {
  id: string;
  name: string;
  isHost: boolean;
  isPresent: boolean;
};

export type AdminRoomSummary = {
  code: string;
  status: RoomStatus;
  phase: RoundPhase;
  roundNumber: number;
  createdAt: number;
  members: AdminRoomMember[];
};

export type ApiError = {
  error: {
    code: string;
    message: string;
  };
};

export type ApiResult<T> = { data: T } | ApiError;
