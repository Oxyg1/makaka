import fs from 'fs';
import path from 'path';

const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmt(level: string, msg: string, data?: unknown): string {
  const ts = new Date().toISOString();
  const extra = data !== undefined ? ' ' + JSON.stringify(data, null, 0) : '';
  return `${ts} [${level}] ${msg}${extra}\n`;
}

function append(file: string, line: string) {
  fs.appendFile(path.join(logsDir, file), line, () => {});
}

function write(level: 'INFO' | 'WARN' | 'ERROR', msg: string, data?: unknown) {
  const line = fmt(level, msg, data);
  (level === 'ERROR' ? process.stderr : process.stdout).write(line);
  append(`combined-${today()}.log`, line);
  if (level === 'ERROR') append(`error-${today()}.log`, line);
}

export const logger = {
  info: (msg: string, data?: unknown) => write('INFO', msg, data),
  warn: (msg: string, data?: unknown) => write('WARN', msg, data),
  error: (msg: string, data?: unknown) => write('ERROR', msg, data),
};
