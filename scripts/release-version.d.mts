export function readHistory(source: string): {
  version: string;
  releases: { version: string; kind: string; date: string; message: string }[];
};
