import { memo, useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ReplacementPreset, RemoteSource, useSoundTouchRemote } from '../hooks/useSoundTouchRemote';

type PresetDraft = {
  name: string;
  streamUrl: string;
  logoUrl: string;
  category: string;
  notes: string;
};

const NowPlayingCard = memo(function NowPlayingCard({ nowPlaying, volume }: { nowPlaying: ReturnType<typeof useSoundTouchRemote>['nowPlaying']; volume: number }) {
  const title = nowPlaying.title || nowPlaying.itemName || nowPlaying.stationName || 'Pronto';
  return (
    <div className="remote-card now-playing-card">
      <p className="eyebrow">Now Playing</p>
      <h2>{title}</h2>
      <p>{nowPlaying.artist || nowPlaying.stationName || 'SoundTouch Radio Remote'}</p>
      <div className="now-playing-meta">
        <span>{nowPlaying.source || 'UPNP'}</span>
        <span>{nowPlaying.playStatus || 'STOPPED'}</span>
        <span>Vol {volume}</span>
      </div>
    </div>
  );
});

const VolumeControl = memo(function VolumeControl({
  volume,
  onVolumeDown,
  onVolumeUp,
  onSetVolume,
  onPlayPause,
  onStop,
  disabled
}: {
  volume: number;
  onVolumeDown: () => void;
  onVolumeUp: () => void;
  onSetVolume: (volume: number) => void;
  onPlayPause: () => void;
  onStop: () => void;
  disabled: boolean;
}) {
  return (
    <div className="remote-card transport-card">
      <h2>Controlli</h2>
      <div className="transport-grid">
        <button type="button" onClick={onPlayPause} disabled={disabled}>▶︎/Ⅱ</button>
        <button type="button" onClick={onStop} disabled={disabled}>■</button>
        <button type="button" onClick={onVolumeDown} disabled={disabled}>−</button>
        <button type="button" onClick={onVolumeUp} disabled={disabled}>＋</button>
        <button type="button" onClick={() => onSetVolume(0)} disabled={disabled}>Mute</button>
      </div>
      <label className="remote-volume-slider" htmlFor="remote-volume">
        <span>Volume {volume}</span>
        <input id="remote-volume" type="range" min="0" max="100" value={volume} onChange={(event) => onSetVolume(Number(event.target.value))} disabled={disabled} />
      </label>
    </div>
  );
});

const PresetCard = memo(function PresetCard({ preset, active, loading, disabled, onPlay, onEdit }: {
  preset: ReplacementPreset;
  active: boolean;
  loading: boolean;
  disabled: boolean;
  onPlay: (preset: ReplacementPreset) => void;
  onEdit: (preset: ReplacementPreset) => void;
}) {
  const handlePlay = useCallback(() => onPlay(preset), [onPlay, preset]);
  const handleEdit = useCallback(() => onEdit(preset), [onEdit, preset]);
  return (
    <article className={active ? 'active' : ''}>
      <div className="remote-preset-topline">
        <span>{preset.id}</span>
        <button type="button" onClick={handleEdit} aria-label={`Modifica preset ${preset.id}`}>✎</button>
      </div>
      {preset.logoUrl ? <img src={preset.logoUrl} alt="" /> : <div className="remote-logo-placeholder">♪</div>}
      <h3>{preset.name}</h3>
      <p>{preset.category || 'Radio'}</p>
      <button type="button" className="remote-play-button" onClick={handlePlay} disabled={disabled || !preset.enabled || !preset.streamUrl.trim()}>
        {loading ? 'Avvio…' : active ? 'In onda' : 'Play'}
      </button>
    </article>
  );
});

const SourceSelector = memo(function SourceSelector({ sources, disabled, onSelect }: {
  sources: Array<RemoteSource & { label: string; selectable: boolean }>;
  disabled: boolean;
  onSelect: (source: RemoteSource) => void;
}) {
  return (
    <div className="remote-card sources-card">
      <h2>Sorgenti</h2>
      <div className="source-button-list">
        {sources.length === 0 ? <p className="hint">Aggiorna lo stato per leggere le sorgenti.</p> : sources.map((source, index) => (
          <button key={`${source.source}-${source.sourceAccount}-${index}`} type="button" onClick={() => onSelect(source)} disabled={disabled || !source.selectable} title={source.selectable ? `Seleziona ${source.label}` : 'Non selezionabile via API locale'}>
            <span>{source.label}</span>
            <small>{source.selectable ? 'Seleziona' : 'Non selezionabile'}</small>
          </button>
        ))}
      </div>
    </div>
  );
});

function makeDraft(preset: ReplacementPreset): PresetDraft {
  return {
    name: preset.name,
    streamUrl: preset.streamUrl,
    logoUrl: preset.logoUrl ?? '',
    category: preset.category ?? '',
    notes: preset.notes ?? ''
  };
}

export default function RemotePage() {
  const remote = useSoundTouchRemote();
  const [editingPreset, setEditingPreset] = useState<ReplacementPreset | null>(null);
  const [draft, setDraft] = useState<PresetDraft>({ name: '', streamUrl: '', logoUrl: '', category: '', notes: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCountry, setSearchCountry] = useState('');
  const [searchTag, setSearchTag] = useState('');

  const disabled = !remote.boseIp.trim();
  const activePresetId = useMemo(() => remote.presets.find((preset) => preset.name === remote.nowPlaying.title)?.id, [remote.nowPlaying.title, remote.presets]);

  const openEditor = useCallback((preset: ReplacementPreset) => {
    setEditingPreset(preset);
    setDraft(makeDraft(preset));
  }, []);

  const savePreset = useCallback(async () => {
    if (!editingPreset) return;
    await remote.savePreset({
      ...editingPreset,
      name: draft.name.trim() || `Preset ${editingPreset.id}`,
      streamUrl: draft.streamUrl.trim(),
      logoUrl: draft.logoUrl.trim(),
      category: draft.category.trim(),
      notes: draft.notes.trim(),
      enabled: true
    });
    setEditingPreset(null);
  }, [draft, editingPreset, remote]);

  const runRadioSearch = useCallback((event: FormEvent) => {
    event.preventDefault();
    void remote.searchRadios(searchQuery, searchCountry, searchTag);
  }, [remote, searchCountry, searchQuery, searchTag]);

  return (
    <div className="app-shell remote-route">
      <main className="dashboard-grid">
        <section className="panel remote-control-panel">
          <div className="remote-header-card">
            <div>
              <p className="eyebrow">Bose SoundTouch 30</p>
              <h1>SoundTouch Radio Remote</h1>
              <p>{remote.deviceName} · {remote.boseIp || 'IP non impostato'}</p>
            </div>
            <div className={`remote-status ${remote.online ? 'online' : 'offline'}`}>
              <span />
              <strong>{remote.online ? 'Online' : 'Offline'}</strong>
            </div>
          </div>

          <div className="remote-layout">
            <section className="remote-main-column">
              <NowPlayingCard nowPlaying={remote.nowPlaying} volume={remote.volume} />
              <VolumeControl
                volume={remote.volume}
                onVolumeDown={remote.volumeDown}
                onVolumeUp={remote.volumeUp}
                onSetVolume={remote.setVolume}
                onPlayPause={remote.playPause}
                onStop={remote.stop}
                disabled={disabled}
              />
              <div className="remote-card presets-remote-card">
                <div className="remote-section-heading">
                  <h2>Preset Radio</h2>
                  <span>{remote.presets.length}/6</span>
                </div>
                <div className="remote-preset-grid">
                  {remote.presets.map((preset) => (
                    <PresetCard
                      key={preset.id}
                      preset={preset}
                      active={activePresetId === preset.id}
                      loading={remote.commandPending && activePresetId === preset.id}
                      disabled={disabled}
                      onPlay={remote.playPreset}
                      onEdit={openEditor}
                    />
                  ))}
                </div>
              </div>
            </section>

            <aside className="remote-side-column">
              <SourceSelector sources={remote.sources} disabled={disabled} onSelect={remote.selectSource} />
              <div className="remote-card settings-card">
                <h2>Impostazioni</h2>
                <label htmlFor="remote-ip">IP Bose</label>
                <input id="remote-ip" value={remote.boseIp} onChange={(event) => remote.setBoseIp(event.target.value)} placeholder="192.168.1.50" inputMode="decimal" />
                <button type="button" onClick={() => void remote.discover()}>Cerca dispositivo</button>
                <button type="button" onClick={() => void remote.syncStatus(true)} disabled={disabled || remote.statusLoading}>Aggiorna stato</button>
                <a href="/dashboard/diagnostics">Diagnostica avanzata</a>
                {remote.debugEnabled ? (
                  <small className="remote-last-command">/api/status ultimi 60s: {remote.debugCounters.statusCallsLast60s} · ultimo {remote.debugCounters.lastStatusAt || remote.lastStatusAt || 'n/d'}</small>
                ) : null}
              </div>
            </aside>
          </div>

          {editingPreset ? (
            <div className="modal-backdrop" role="presentation" onClick={() => setEditingPreset(null)}>
              <section className="preset-modal remote-edit-modal" role="dialog" aria-modal="true" aria-label="Modifica preset" onClick={(event) => event.stopPropagation()}>
                <div className="section-title-row">
                  <div>
                    <p className="eyebrow">Preset {editingPreset.id}</p>
                    <h2>Modifica preset</h2>
                  </div>
                  <button type="button" onClick={() => setEditingPreset(null)}>Chiudi</button>
                </div>
                <label>Nome preset<input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
                <label>Stream URL<input value={draft.streamUrl} onChange={(event) => setDraft((current) => ({ ...current, streamUrl: event.target.value }))} /></label>
                <label>Logo URL opzionale<input value={draft.logoUrl} onChange={(event) => setDraft((current) => ({ ...current, logoUrl: event.target.value }))} /></label>
                <div className="modal-search-box">
                  <h3>Ricerca radio web</h3>
                  <form className="radio-search-form" onSubmit={runRadioSearch}>
                    <input className="big-search-input" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cerca una radio…" />
                    <div className="search-filter-row">
                      <input value={searchCountry} onChange={(event) => setSearchCountry(event.target.value)} placeholder="Paese" />
                      <input value={searchTag} onChange={(event) => setSearchTag(event.target.value)} placeholder="Tag" />
                    </div>
                    <button type="submit" disabled={remote.radioSearchLoading}>{remote.radioSearchLoading ? 'Cerco…' : 'Cerca'}</button>
                  </form>
                  <div className="modal-radio-results">
                    {remote.radioResults.slice(0, 8).map((station, index) => (
                      <button key={`${station.streamUrl}-${index}`} type="button" onClick={() => setDraft({
                        name: station.name,
                        streamUrl: station.streamUrl,
                        logoUrl: station.favicon,
                        category: station.tags.split(',')[0] || station.country || 'Radio',
                        notes: [station.codec, station.bitrate ? `${station.bitrate} kbps` : '', station.language, station.homepage].filter(Boolean).join(' · ')
                      })}>
                        <strong>{station.name}</strong>
                        <small>{[station.country, station.codec, station.bitrate ? `${station.bitrate} kbps` : ''].filter(Boolean).join(' · ')}</small>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="modal-action-row">
                  <button type="button" onClick={() => void remote.testStream(draft.streamUrl)} disabled={!draft.streamUrl.trim()}>Test stream</button>
                  <button type="button" className="primary-action" onClick={() => void savePreset()} disabled={!draft.streamUrl.trim()}>Salva</button>
                </div>
                {remote.streamCheck ? (
                  <div className={`stream-status ${remote.streamCheck.potentiallyPlayable ? 'ok' : 'error'}`}>
                    <span>{remote.streamCheck.potentiallyPlayable ? 'Stream valido' : 'Verifica non conclusiva'}</span>
                    <small>{remote.streamCheck.mimeType ?? remote.streamCheck.error ?? `HTTP ${remote.streamCheck.status ?? 'n/d'}`}</small>
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
