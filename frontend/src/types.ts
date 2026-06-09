export interface Cat {
  id: number; name: string; breed: string | null; age: number | null;
  description: string | null; photo_url: string; owner_name: string;
  owner_id?: number;
}

export interface CatWithStats extends Cat {
  avg_score: number; vote_count: number;
  likes_count: number; liked_by_me: boolean;
  extra_photos?: string[];
}

export interface CatLeaderboardEntry {
  id: number; name: string; breed: string | null; age: number | null;
  description: string | null; photo_url: string;
  avg_score: number; vote_count: number;
  owner_name: string; owner_id: number;
  likes_count?: number; liked_by_me?: boolean;
  extra_photos?: string[];
}

export interface User {
  id: number; telegram_id: string; username: string | null;
  first_name: string; photo_url: string | null; created_at: string;
}

export interface UserProfile {
  id: number; first_name: string; username: string | null;
  photo_url: string | null; created_at: string;
  total_rated: number; total_skipped: number;
  streak_days: number; cat_count: number; post_count: number;
}

export interface UserStats {
  total_rated: number; total_skipped: number; streak_days: number;
}

export interface Post {
  id: number; user_id: number; photo_url: string; caption: string | null;
  created_at: string; author_name: string; author_username: string | null;
  author_photo_url: string | null;
  likes_count: number; liked_by_me: boolean; comments_count: number;
}

export interface Comment {
  id: number; post_id: number; user_id: number; text: string;
  created_at: string; author_name: string; author_username: string | null;
  author_photo_url: string | null;
}

export interface Notification {
  id: number; user_id: number; actor_id: number;
  type: 'like' | 'comment' | 'rating';
  entity_type: string | null; entity_id: number | null;
  text: string | null; read: number;
  created_at: string; actor_name: string; actor_photo_url: string | null;
}
