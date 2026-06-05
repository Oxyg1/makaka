export interface Cat {
  id: number;
  name: string;
  breed: string | null;
  age: number | null;
  description: string | null;
  photo_url: string;
  owner_name: string;
}

export interface CatWithStats extends Cat {
  avg_score: number;
  vote_count: number;
}

export interface CatLeaderboardEntry {
  id: number;
  name: string;
  breed: string | null;
  photo_url: string;
  avg_score: number;
  vote_count: number;
  owner_name: string;
}

export interface User {
  id: number;
  telegram_id: string;
  username: string | null;
  first_name: string;
  created_at: string;
}
