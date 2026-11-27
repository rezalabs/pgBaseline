import { formatMemory, formatNumber } from './format';
import { DB_SIZE_LABELS, OS_LABELS, STORAGE_LABELS, WORKLOAD_LABELS } from './labels';
import type { TuningResult, TuningSetting, WarningItem, WarningLevel } from './types';

export type ConfigFormat = 'conf' | 'alter';
type ConfigToken = 'comment' | 'keyword' | 'name' | 'value' | 'note';

interface ConfigSegment {
  text: string;
  token?: ConfigToken;
}

type ConfigLine = ConfigSegment[];

export interface ConfigBuild {
  lines: ConfigLine[];
  displayText: string;
  copyText: string;
}

const WARNING_GROUP_ORDER: readonly WarningLevel[] = ['startup', 'memory', 'note'];

export const WARNING_GROUP_TITLES: Record<WarningLevel, { title: string; comment: string }> = {
  startup: { title: 'May prevent startup', comment: 'WARNING (may prevent startup)' },
  memory: { title: 'Memory risk', comment: 'WARNING (memory risk)' },
  note: { title: 'Note', comment: 'NOTE' },
};

export function groupWarnings(
  warnings: readonly WarningItem[],
): { level: WarningLevel; warnings: WarningItem[] }[] {
  return WARNING_GROUP_ORDER.map((level) => ({
    level,
    warnings: warnings.filter((warning) => warning.level === level),
  })).filter((group) => group.warnings.length > 0);
}

export function formatSettingValue(setting: TuningSetting): string {
  return setting.unit === 'memory' && typeof setting.value === 'number'
    ? formatMemory(setting.value)
    : String(setting.value);
}

const prefix = (format: ConfigFormat): string => (format === 'alter' ? '--' : '#');

const plain = (text: string): ConfigSegment => ({ text });

const comment = (text: string): ConfigSegment => ({ text, token: 'comment' });

const segmentsLength = (segments: readonly ConfigSegment[]): number =>
  segments.reduce((length, segment) => length + segment.text.length, 0);

const linesText = (lines: readonly ConfigLine[]): string =>
  lines.map((line) => line.map((segment) => segment.text).join('')).join('\n');

function hardwareLines(result: TuningResult, format: ConfigFormat): ConfigLine[] {
  const { input, connections, connectionsAssumed } = result;
  const cpuText = input.cpus ? `${formatNumber(input.cpus)} vCPU` : 'CPU count not provided';
  const values = [
    `${formatNumber(input.version)} on ${OS_LABELS[input.os]}, ${cpuText}, ${formatMemory(input.ramMb)} RAM`,
    `Workload: ${WORKLOAD_LABELS[input.workload]}`,
    `Database: ${DB_SIZE_LABELS[input.dbSize]}; storage: ${STORAGE_LABELS[input.storage]}`,
    `Connections: ${formatNumber(connections)} (${connectionsAssumed ? 'assumed' : 'provided'})`,
  ];

  return [
    [comment(`${prefix(format)} pgBaseline starting configuration`)],
    ...values.map((value) => [comment(`${prefix(format)} ${value}`)]),
  ];
}

function settingNote(key: TuningSetting['key'], restart: boolean): string | null {
  if (restart) {
    return 'restart required';
  }
  if (key === 'max_wal_size') {
    return 'needs free disk space';
  }
  return null;
}

function settingLines(settings: readonly TuningSetting[], format: ConfigFormat): ConfigLine[] {
  const bases = settings.map((setting) => {
    const value = formatSettingValue(setting);
    const segments: ConfigSegment[] =
      format === 'alter'
        ? [
            { text: 'ALTER SYSTEM SET', token: 'keyword' },
            plain(' '),
            { text: setting.key, token: 'name' },
            plain(" = '"),
            { text: value, token: 'value' },
            plain("';"),
          ]
        : [{ text: setting.key, token: 'name' }, plain(' = '), { text: value, token: 'value' }];
    return { segments, note: settingNote(setting.key, setting.restart) };
  });

  const width = Math.max(...bases.map(({ segments }) => segmentsLength(segments)));

  return bases.map(({ segments, note }) => {
    if (!note) {
      return segments;
    }
    return [
      ...segments,
      plain(' '.repeat(width - segmentsLength(segments) + 1)),
      { text: `${prefix(format)} ${note}`, token: 'note' },
    ];
  });
}

function warningLines(warnings: readonly WarningItem[], format: ConfigFormat): ConfigLine[] {
  const lines: ConfigLine[] = [];
  for (const group of groupWarnings(warnings)) {
    if (lines.length > 0) {
      lines.push([comment(prefix(format))]);
    }
    lines.push([comment(`${prefix(format)} ${WARNING_GROUP_TITLES[group.level].comment}`)]);
    for (const warning of group.warnings) {
      lines.push([comment(`${prefix(format)} ${warning.text}`)]);
      if (warning.code) {
        lines.push([comment(`${prefix(format)}   ${warning.code}`)]);
      }
    }
  }
  return lines;
}

export function buildConfiguration(
  result: TuningResult,
  { format, includeWarnings }: { format: ConfigFormat; includeWarnings: boolean },
): ConfigBuild {
  const header = hardwareLines(result, format);
  const body = settingLines(result.settings, format);
  const lines: ConfigLine[] = [...header, [], ...body];
  const displayText = linesText(lines);
  const warnings = includeWarnings ? warningLines(result.warnings, format) : [];
  const copyText = warnings.length > 0 ? `${linesText(warnings)}\n\n${displayText}` : displayText;
  return { lines, displayText, copyText };
}
