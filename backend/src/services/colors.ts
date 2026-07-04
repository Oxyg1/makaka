// Подмешиваем цвета фона (из таблицы backdrops, наполняется парсером) прямо
// в строки лягушек — чтобы карточка получала палитру из данных, без зависимости
// от changes.tg / preload / localStorage-кэша.

import { db } from '../db';

interface ColorRow {
  name: string;
  center_color: string | null;
  edge_color: string | null;
  pattern_color: string | null;
}

function colorMap(): Map<string, ColorRow> {
  const map = new Map<string, ColorRow>();
  const rows = db.prepare(`SELECT name, center_color, edge_color, pattern_color FROM backdrops`).all() as ColorRow[];
  for (const r of rows) if (r.name) map.set(r.name.toLowerCase(), r);
  return map;
}

export function attachColors<T extends Record<string, unknown>>(rows: T[]): T[] {
  if (!rows.length) return rows;
  const map = colorMap();
  for (const row of rows) {
    const b = row.backdrop;
    const c = typeof b === 'string' ? map.get(b.toLowerCase()) : undefined;
    if (c) {
      const r = row as Record<string, unknown>;
      r.center_color = c.center_color;
      r.edge_color = c.edge_color;
      r.pattern_color = c.pattern_color;
    }
  }
  return rows;
}

export function attachColorsOne<T extends Record<string, unknown> | undefined>(row: T): T {
  if (row) attachColors([row as Record<string, unknown>]);
  return row;
}
