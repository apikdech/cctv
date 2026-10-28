export type Dataset = 'kota' | 'prov';
export type Source = 'official' | 'removed';

export interface Camera {
  id: string;
  ref: number;
  dataset: Dataset;
  title: string;
  url: string;
  lat: number;
  lon: number;
  kecamatan: string;
  kelurahan: string;
  owner: string;
  slug: string;
  source: Source;
  lastSeen: string | null;
}

export type Liveness = 'checking' | 'alive' | 'dead';

/** Missing id means `'checking'`. */
export type LivenessMap = Record<string, Liveness>;

export interface Toggles {
  kota: boolean;
  prov: boolean;
  removed: boolean;
  dead: boolean;
}
