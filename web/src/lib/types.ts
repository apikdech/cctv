export type Source = 'official' | 'removed';

export interface Camera {
  id: number;
  title: string;
  url: string;
  lat: number;
  lon: number;
  kecamatan: string;
  kelurahan: string;
  source: Source;
  lastSeen: string | null;
}

export type Liveness = 'checking' | 'alive' | 'dead';

/** Missing id means `'checking'`. */
export type LivenessMap = Record<number, Liveness>;

export interface Toggles {
  official: boolean;
  removed: boolean;
  dead: boolean;
}
