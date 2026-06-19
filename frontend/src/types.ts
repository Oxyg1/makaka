export interface User {
  id: number;
  telegram_id: string;
  username: string | null;
  first_name: string;
  photo_url: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface Frog {
  id: number;
  gift_id: string;
  slug: string;
  number: number;
  model: string;
  backdrop: string;
  pattern: string;
  model_rarity: number | null;
  backdrop_rarity: number | null;
  pattern_rarity: number | null;
  image_url: string | null;
  lottie_url: string | null;
  owner_id: number | null;
  owner_username: string | null;
  owner_telegram_id: string | null;
  owner_name?: string | null;
  owner_un?: string | null;
  owner_photo?: string | null;
  active_order_id?: number | null;
  owner_is_market?: number;
  owner_market_name?: string | null;
}

export interface Order {
  id: number;
  frog_id: number;
  user_id: number;
  wants_models: string | null;
  wants_backdrops: string | null;
  wants_patterns: string | null;
  note: string;
  status: 'open' | 'closed';
  created_at: string;
}

export interface MarketEntry {
  id: number;          // order id
  frog_id: number;
  slug: string;
  number: number;
  model: string;
  backdrop: string;
  pattern: string;
  model_rarity: number | null;
  backdrop_rarity: number | null;
  pattern_rarity: number | null;
  image_url: string | null;
  wants_models: string | null;
  wants_backdrops: string | null;
  wants_patterns: string | null;
  note: string;
  status: string;
  created_at: string;
  user_id: number;
  user_name: string;
  user_username: string | null;
  user_photo: string | null;
}

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface OfferDirection {
  id: number;
  order_id: number | null;
  from_user_id: number;
  to_user_id: number;
  from_frog_id: number;
  to_frog_id: number;
  message: string;
  status: OfferStatus;
  accepted_at: string | null;
  created_at: string;

  from_slug: string;
  from_number: number;
  from_model: string;
  from_backdrop: string;
  from_pattern: string;

  to_slug: string;
  to_number: number;
  to_model: string;
  to_backdrop: string;
  to_pattern: string;

  from_name: string;
  from_username: string | null;
  from_photo: string | null;
  to_name: string;
  to_username: string | null;
  to_photo: string | null;
}

export interface Notification {
  id: number;
  user_id: number;
  actor_id: number | null;
  type: string;
  entity_type: string | null;
  entity_id: number | null;
  text: string | null;
  read: number;
  created_at: string;
  actor_name: string | null;
  actor_username: string | null;
  actor_photo: string | null;
}

export interface Attributes {
  models: { v: string; c: number }[];
  backdrops: { v: string; c: number }[];
  patterns: { v: string; c: number }[];
}

export interface AppConfig {
  escrow_username: string;
  poso_base: string;
}

export interface Whale {
  id: string;
  telegram_id?: string;
  username?: string;
  name?: string;
  photo_url?: string;
  gifts_count: number;
}
