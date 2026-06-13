export interface Wallpaper {
  title?: string;
  copyright?: string;
  full_url?: string;
  thumb_url?: string;
  image_url?: string;
  page_url?: string;
  date?: string;
  uhd_url?: string;
}

export interface AppSettings {
  source: string;
  country: string;
  interval_minutes: number;
  auto_refresh: boolean;
  fetch_count: number;
}
