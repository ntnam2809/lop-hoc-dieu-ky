import { schema, t, type SchemaType } from '@colyseus/schema';

// Presence chỉ gồm id + tên (CONSTITUTION §2). Không thêm trường khác.
export const Player = schema(
  {
    id: t.string(),
    displayName: t.string(),
    x: t.float32(),
    y: t.float32(),
    lastSeq: t.uint32(),
  },
  'Player',
);
export type Player = SchemaType<typeof Player>;

export const CampusState = schema(
  {
    players: t.map(Player),
  },
  'CampusState',
);
export type CampusState = SchemaType<typeof CampusState>;
