import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const API_BASE = '/api';
const LAST_IP_STORAGE_KEY = 'soundtouch-radio-bridge:last-ip';
const PLAY_STATE = 'PLAYING';
const PAUSE_STATE = 'PAUSED';
const STOP_STATE = 'STOPPED';
const STATUS_REFETCH_INTERVAL_MS = 5000;
const STATUS_STALE_TIME_MS = 3000;
const PRESETS_STALE_TIME_MS = 10000;
const SYNC_AFTER_COMMAND_MS = 1200;
const VOLUME_DEBOUNCE_MS = 400;

type PlayStatus = typeof PLAY_STATE | typeof PAUSE_STATE | typeof STOP_STATE | string;

export type ReplacementPreset = {
  id: number;
  name: string;
  streamUrl: string;
  logoUrl?: string;
  category?: string;
  notes: string;
  enabled: boolean;
  lastPlayedAt?: string;
};

export type RemoteNowPlaying = {
  source: string;
  title: string;
  artist: string;
  playStatus: PlayStatus;
  itemName?: string;
  stationName?: string;
};

export type RemoteSource = {
  source: string | null;
  sourceAccount: string | null;
  status: string | null;
  text: string | null;
};

export type RadioSearchResult = {
  name: string;
  streamUrl: string;
  favicon: string;
  homepage: string;
  country: string;
  language: string;
  tags: string;
  codec: string;
  bitrate: number;
  lastcheckok: boolean;
};

export type StreamCheckResult = {
  ok: boolean;
  potentiallyPlayable?: boolean;
  status?: number;
  mimeType?: string | null;
  finalUrl?: string;
  error?: string;
};

type RemoteStatusResponse = {
  boseIp: string;
  online: boolean;
  deviceName: string;
  nowPlaying: RemoteNowPlaying;
  volume: number;
  sources: RemoteSource[];
  updatedAt: string;
};

type DebugCounters = {
  statusCallsLast60s: number;
  lastStatusAt: string;
};

const emptyNowPlaying: RemoteNowPlaying = {
  source: 'UPNP',
  title: '',
  artist: '',
  playStatus: STOP_STATE,
  itemName: '',
  stationName: ''
};

function getStoredIp() {
  return window.localStorage.getItem(LAST_IP_STORAGE_KEY) ?? '';
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error ?? `HTTP ${response.status}`);
  }
  return payload as T;
}

function normalizePlayStatus(value: string) {
  const normalized = String(value || '').toUpperCase();
  if (normalized.includes('PLAY')) return PLAY_STATE;
  if (normalized.includes('PAUSE')) return PAUSE_STATE;
  if (normalized.includes('BUFFER')) return 'BUFFERING';
  if (normalized.includes('STOP')) return STOP_STATE;
  return normalized || STOP_STATE;
}

function sourceLabel(source: RemoteSource) {
  const value = String(source.source ?? '').toUpperCase();
  if (value === 'AUX') return 'AUX';
  if (value === 'BLUETOOTH') return 'Bluetooth';
  if (value === 'AIRPLAY') return 'AirPlay';
  if (value === 'SPOTIFY') return 'Spotify';
  if (['UPNP', 'LOCAL_INTERNET_RADIO', 'TUNEIN'].includes(value)) return 'UPNP / Radio';
  return source.text || value || 'Sorgente';
}

function selectableSourceXml(source: RemoteSource) {
  const value = String(source.source ?? '').toUpperCase();
  if (value === 'AUX') return '<ContentItem source="AUX" sourceAccount="AUX"></ContentItem>';
  if (value === 'BLUETOOTH') return '<ContentItem source="BLUETOOTH"></ContentItem>';
  return '';
}

export function useSoundTouchRemote() {
  const [boseIp, setBoseIpState] = useState(getStoredIp);
  const [online, setOnline] = useState(false);
  const [deviceName, setDeviceName] = useState('SoundTouch');
  const [nowPlaying, setNowPlaying] = useState<RemoteNowPlaying>(emptyNowPlaying);
  const [volume, setVolumeState] = useState(0);
  const [sources, setSources] = useState<RemoteSource[]>([]);
  const [presets, setPresets] = useState<ReplacementPreset[]>([]);
  const [statusLoading, setStatusLoading] = useState(false);
  const [commandPending, setCommandPending] = useState(false);
  const [lastStartedPreset, setLastStartedPreset] = useState<ReplacementPreset | null>(null);
  const [lastStatusAt, setLastStatusAt] = useState('');
  const [debugCounters, setDebugCounters] = useState<DebugCounters>({ statusCallsLast60s: 0, lastStatusAt: '' });
  const [radioResults, setRadioResults] = useState<RadioSearchResult[]>([]);
  const [radioSearchLoading, setRadioSearchLoading] = useState(false);
  const [streamCheck, setStreamCheck] = useState<StreamCheckResult | null>(null);
  const statusFetchedAtRef = useRef(0);
  const presetsFetchedAtRef = useRef(0);
  const statusCallsRef = useRef<number[]>([]);
  const syncTimerRef = useRef<number | null>(null);
  const volumeTimerRef = useRef<number | null>(null);
  const volumeRef = useRef(0);

  const debugEnabled = typeof window !== 'undefined' && window.localStorage.getItem('debugSoundTouch') === 'true';

  const setBoseIp = useCallback((nextIp: string) => {
    setBoseIpState(nextIp);
    window.localStorage.setItem(LAST_IP_STORAGE_KEY, nextIp);
  }, []);

  const applyStatus = useCallback((status: RemoteStatusResponse) => {
    setOnline(Boolean(status.online));
    setDeviceName(status.deviceName || 'SoundTouch');
    setSources(status.sources ?? []);
    setVolumeState(Number.isFinite(status.volume) ? status.volume : volumeRef.current);
    volumeRef.current = Number.isFinite(status.volume) ? status.volume : volumeRef.current;
    setLastStatusAt(status.updatedAt || new Date().toISOString());
    setNowPlaying((current) => {
      const backendNowPlaying = status.nowPlaying ?? emptyNowPlaying;
      const backendTitle = backendNowPlaying.title || backendNowPlaying.itemName || backendNowPlaying.stationName || '';
      const fallbackPresetTitle = current.source === 'UPNP' && lastStartedPreset?.name ? lastStartedPreset.name : '';
      return {
        source: backendNowPlaying.source || current.source || 'UPNP',
        title: backendTitle || fallbackPresetTitle || current.title,
        artist: backendNowPlaying.artist || current.artist || '',
        playStatus: normalizePlayStatus(backendNowPlaying.playStatus || current.playStatus),
        itemName: backendNowPlaying.itemName || current.itemName,
        stationName: backendNowPlaying.stationName || current.stationName
      };
    });
  }, [lastStartedPreset]);

  const syncStatus = useCallback(async (force = false) => {
    if (!boseIp.trim()) {
      setOnline(false);
      return;
    }
    if (!force && Date.now() - statusFetchedAtRef.current < STATUS_STALE_TIME_MS) {
      return;
    }

    setStatusLoading(true);
    const now = Date.now();
    statusCallsRef.current = [...statusCallsRef.current.filter((timestamp) => now - timestamp < 60000), now];
    try {
      let response = await fetch(`${API_BASE}/status?ip=${encodeURIComponent(boseIp.trim())}`, { cache: 'no-store' });
      if (!response.ok) {
        response = await fetch(`${API_BASE}/status?ip=${encodeURIComponent(boseIp.trim())}`, { cache: 'no-store' });
      }
      const status = await readJson<RemoteStatusResponse>(response);
      statusFetchedAtRef.current = Date.now();
      applyStatus(status);
      setDebugCounters({ statusCallsLast60s: statusCallsRef.current.length, lastStatusAt: status.updatedAt });
    } catch {
      setOnline(false);
    } finally {
      setStatusLoading(false);
    }
  }, [applyStatus, boseIp]);

  const scheduleStatusSync = useCallback(() => {
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      void syncStatus(true);
    }, SYNC_AFTER_COMMAND_MS);
  }, [syncStatus]);

  const loadPresets = useCallback(async (force = false) => {
    if (!force && Date.now() - presetsFetchedAtRef.current < PRESETS_STALE_TIME_MS) return;
    const response = await fetch(`${API_BASE}/replacement-presets`, { cache: 'no-store' });
    const payload = await readJson<ReplacementPreset[]>(response);
    presetsFetchedAtRef.current = Date.now();
    setPresets(payload);
  }, []);

  useEffect(() => {
    void loadPresets(true);
  }, [loadPresets]);

  useEffect(() => {
    void syncStatus(true);
    const interval = window.setInterval(() => void syncStatus(false), STATUS_REFETCH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [syncStatus]);

  useEffect(() => () => {
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    if (volumeTimerRef.current) window.clearTimeout(volumeTimerRef.current);
  }, []);

  const playPreset = useCallback(async (preset: ReplacementPreset) => {
    if (!preset.streamUrl || !boseIp.trim()) return;
    setLastStartedPreset(preset);
    setNowPlaying((current) => ({ ...current, source: 'UPNP', title: preset.name, playStatus: PLAY_STATE }));
    setCommandPending(true);
    try {
      await fetch(`${API_BASE}/replacement-presets/${preset.id}/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boseIp })
      });
    } finally {
      setCommandPending(false);
      scheduleStatusSync();
    }
  }, [boseIp, scheduleStatusSync]);

  const stop = useCallback(async () => {
    if (!boseIp.trim()) return;
    setNowPlaying((current) => ({ ...current, playStatus: STOP_STATE }));
    try {
      await fetch(`${API_BASE}/upnp/${encodeURIComponent(boseIp)}/stop`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    } finally {
      scheduleStatusSync();
    }
  }, [boseIp, scheduleStatusSync]);

  const sendKey = useCallback(async (key: 'PLAY_PAUSE' | 'VOLUME_UP' | 'VOLUME_DOWN') => {
    if (!boseIp.trim()) return;
    await fetch(`${API_BASE}/bose/${encodeURIComponent(boseIp)}/key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
  }, [boseIp]);

  const playPause = useCallback(async () => {
    setNowPlaying((current) => ({
      ...current,
      playStatus: normalizePlayStatus(current.playStatus) === PLAY_STATE ? PAUSE_STATE : PLAY_STATE
    }));
    try {
      await sendKey('PLAY_PAUSE');
    } finally {
      scheduleStatusSync();
    }
  }, [scheduleStatusSync, sendKey]);

  const volumeUp = useCallback(async () => {
    setVolumeState((current) => {
      const next = Math.min(100, current + 5);
      volumeRef.current = next;
      return next;
    });
    try {
      await sendKey('VOLUME_UP');
    } finally {
      scheduleStatusSync();
    }
  }, [scheduleStatusSync, sendKey]);

  const volumeDown = useCallback(async () => {
    setVolumeState((current) => {
      const next = Math.max(0, current - 5);
      volumeRef.current = next;
      return next;
    });
    try {
      await sendKey('VOLUME_DOWN');
    } finally {
      scheduleStatusSync();
    }
  }, [scheduleStatusSync, sendKey]);

  const commitVolume = useCallback(async (nextVolume: number) => {
    if (!boseIp.trim()) return;
    await fetch(`${API_BASE}/bose/${encodeURIComponent(boseIp)}/volume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume: nextVolume })
    });
    scheduleStatusSync();
  }, [boseIp, scheduleStatusSync]);

  const setVolume = useCallback((nextVolume: number) => {
    const normalized = Math.max(0, Math.min(100, Math.round(nextVolume)));
    volumeRef.current = normalized;
    setVolumeState(normalized);
    if (volumeTimerRef.current) window.clearTimeout(volumeTimerRef.current);
    volumeTimerRef.current = window.setTimeout(() => {
      void commitVolume(normalized);
    }, VOLUME_DEBOUNCE_MS);
  }, [commitVolume]);

  const selectSource = useCallback(async (source: RemoteSource) => {
    const xml = selectableSourceXml(source);
    if (!xml || !boseIp.trim()) return;
    setNowPlaying((current) => ({ ...current, source: source.source ?? current.source }));
    try {
      await fetch(`${API_BASE}/bose/${encodeURIComponent(boseIp)}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: xml
      });
    } finally {
      scheduleStatusSync();
    }
  }, [boseIp, scheduleStatusSync]);

  const discover = useCallback(async () => {
    const response = await fetch(`${API_BASE}/discover`, { cache: 'no-store' });
    const payload = await readJson<{ devices: Array<{ ip: string; name?: string }> }>(response);
    const device = payload.devices?.[0];
    if (device?.ip) {
      setBoseIp(device.ip);
      setDeviceName(device.name || 'SoundTouch');
      await syncStatus(true);
    }
  }, [setBoseIp, syncStatus]);

  const savePreset = useCallback(async (preset: ReplacementPreset) => {
    const response = await fetch(`${API_BASE}/replacement-presets/${preset.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preset)
    });
    const updated = await readJson<ReplacementPreset>(response);
    setPresets((current) => current.map((item) => item.id === updated.id ? updated : item));
    presetsFetchedAtRef.current = Date.now();
    return updated;
  }, []);

  const testStream = useCallback(async (streamUrl: string) => {
    const response = await fetch(`${API_BASE}/stream-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ streamUrl })
    });
    const result = await readJson<StreamCheckResult>(response);
    setStreamCheck(result);
    return result;
  }, []);

  const searchRadios = useCallback(async (query: string, country = '', tag = '') => {
    setRadioSearchLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (country.trim()) params.set('country', country.trim());
      if (tag.trim()) params.set('tag', tag.trim());
      const response = await fetch(`${API_BASE}/radio-search?${params.toString()}`, { cache: 'no-store' });
      const payload = await readJson<{ stations: RadioSearchResult[] }>(response);
      setRadioResults(payload.stations ?? []);
      return payload.stations ?? [];
    } finally {
      setRadioSearchLoading(false);
    }
  }, []);

  const selectableSources = useMemo(() => sources.map((source) => ({
    ...source,
    label: sourceLabel(source),
    selectable: Boolean(selectableSourceXml(source))
  })), [sources]);

  const displayNowPlaying = useMemo(() => {
    if (nowPlaying.source === 'UPNP' && !nowPlaying.title && lastStartedPreset?.name) {
      return { ...nowPlaying, title: lastStartedPreset.name, playStatus: PLAY_STATE };
    }
    return nowPlaying;
  }, [lastStartedPreset, nowPlaying]);

  return {
    status: online ? 'online' : 'offline',
    statusLoading,
    nowPlaying: displayNowPlaying,
    volume,
    online,
    boseIp,
    setBoseIp,
    deviceName,
    sources: selectableSources,
    presets,
    commandPending,
    debugEnabled,
    debugCounters,
    lastStatusAt,
    radioResults,
    radioSearchLoading,
    streamCheck,
    loadPresets,
    syncStatus,
    playPreset,
    stop,
    playPause,
    volumeUp,
    volumeDown,
    setVolume,
    selectSource,
    discover,
    savePreset,
    testStream,
    searchRadios
  };
}
