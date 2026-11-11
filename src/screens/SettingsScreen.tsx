import { useEffect, useRef, useState } from 'react';
import { exportJson, importJson, resetAll, setGoogleState } from '../actions';
import { todayKey } from '../core/dates';
import { frequencyLabel } from '../core/habits';
import type { AppState } from '../core/types';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { clearToken, disconnectGoogle, getAccessToken, googleConfigured } from '../google/auth';
import { driveSyncNow } from '../google/drive';
import { adoptCandidate, listImportCandidates, syncNow, type ImportCandidate } from '../google/sync';
import { askNotificationPermission, notificationsSupported } from '../notify';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function ImportSheet({ state, onClose }: { state: AppState; onClose: () => void }) {
  const [items, setItems] = useState<ImportCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState(state.categories[0]?.id ?? '');

  useEffect(() => {
    let cancelled = false;
    listImportCandidates()
      .then((r) => { if (!cancelled) setItems(r); })
      .catch((e) => { if (!cancelled) setError(errMsg(e)); });
    return () => { cancelled = true; };
  }, []);

  return (
    <Sheet title="Importar da agenda" onClose={onClose}>
      <p className="hint" style={{ marginBottom: 10 }}>
        Eventos recorrentes com horário dos próximos 90 dias. Ao importar, o evento continua na sua agenda e passa a ficar sincronizado com o hábito.
      </p>
      <div className="field" style={{ marginBottom: 10 }}>
        <label htmlFor="imp-cat">Categoria dos hábitos importados</label>
        <select id="imp-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {state.categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
      </div>
      {error && <p className="warn">{error}</p>}
      {!items && !error && <p className="hint">Buscando…</p>}
      {items?.length === 0 && <p className="hint">Nenhum evento recorrente novo encontrado.</p>}
      {items?.map((c) => (
        <div className="row" key={c.eventId}>
          <div className="main">
            <div className="title">{c.title}</div>
            <div className="sub">
              <span>⏰ {c.time}</span>
              <span>{c.frequency ? frequencyLabel(c.frequency) : 'repetição não suportada (vira diário)'}</span>
            </div>
          </div>
          <button
            className="btn"
            style={{ padding: '8px 14px' }}
            disabled={busy === c.eventId}
            onClick={async () => {
              setBusy(c.eventId);
              try {
                await adoptCandidate(c, categoryId);
                setItems((cur) => cur?.filter((x) => x.eventId !== c.eventId) ?? null);
              } catch (e) {
                setError(errMsg(e));
              } finally {
                setBusy(null);
              }
            }}
          >
            Importar
          </button>
        </div>
      ))}
    </Sheet>
  );
}

export function SettingsScreen({ state, onBack }: { state: AppState; onBack: () => void }) {
  const g = state.google;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission>(notificationsSupported() ? Notification.permission : 'denied');
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setMessage(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const connect = () => run(async () => {
    await getAccessToken(true); // precisa vir de um clique: abre o popup de login/consentimento
    setGoogleState({ connected: true });
    await syncNow();
  });

  const sync = () => run(async () => {
    await getAccessToken(true);
    const r = await syncNow();
    if (g.driveSync) await driveSyncNow();
    setMessage(r.errors.length ? r.errors.join('\n') : null);
  });

  const toggleDrive = (on: boolean) => run(async () => {
    if (!on) {
      setGoogleState({ driveSync: false });
      return;
    }
    // pede o consentimento de novo: o token atual pode não ter a permissão da pasta do app no Drive
    clearToken();
    await getAccessToken(true);
    setGoogleState({ driveSync: true });
    await driveSyncNow();
  });

  const download = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ritmo-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="app overlay">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Voltar"><Icon name="back" /></button>
        <h1>Ajustes</h1>
      </div>
      <div className="screen">
        <div className="section-title">Conta Google</div>
        {!googleConfigured ? (
          <p className="warn">
            Falta configurar o login do Google. Crie um Client ID OAuth e coloque em <code>VITE_GOOGLE_CLIENT_ID</code> no arquivo <code>.env.local</code> (passo a passo no README). O resto do app funciona normalmente sem isso.
          </p>
        ) : !g.connected ? (
          <>
            <p className="hint" style={{ marginBottom: 10 }}>
              Conecte para enviar hábitos com horário para a agenda (com lembrete nativo no celular), importar eventos recorrentes como hábitos e manter os dados iguais entre celular e computador.
            </p>
            <button className="btn" style={{ width: '100%' }} disabled={busy} onClick={connect}>Conectar Google Agenda</button>
          </>
        ) : (
          <>
            <p className="hint">
              Conectado. {g.lastSyncAt ? `Última sincronização: ${new Date(g.lastSyncAt).toLocaleString('pt-BR')} — ${g.lastSyncMessage ?? ''}` : 'Ainda não sincronizado.'}
            </p>
            <div className="btns" style={{ marginTop: 10 }}>
              <button className="btn" disabled={busy} onClick={sync}><Icon name="sync" /> {busy ? 'Sincronizando…' : 'Sincronizar agora'}</button>
              <button className="btn ghost" disabled={busy} onClick={() => setShowImport(true)}>Importar eventos da agenda</button>
              <button
                className="btn danger"
                disabled={busy}
                onClick={() => run(async () => { await disconnectGoogle(); setGoogleState({ connected: false, driveSync: false }); })}
              >
                Desconectar
              </button>
            </div>
            <label className="inline" htmlFor="drive-sync" style={{ marginTop: 14 }}>
              <input id="drive-sync" type="checkbox" checked={g.driveSync} disabled={busy} onChange={(e) => void toggleDrive(e.target.checked)} />
              Sincronizar entre aparelhos (Google Drive)
            </label>
            <p className="hint" style={{ marginTop: 4 }}>
              {g.driveSync
                ? `Hábitos, histórico, tarefas e categorias ficam iguais em todos os aparelhos em que você entrar com esta conta.${g.lastDriveSyncAt ? ` Última: ${new Date(g.lastDriveSyncAt).toLocaleString('pt-BR')} — ${g.lastDriveMessage ?? ''}` : ''}`
                : 'Guarda uma cópia dos seus dados numa pasta privada do app no seu Drive (o app não vê seus outros arquivos).'}
            </p>
            <p className="hint" style={{ marginTop: 8 }}>
              Hábitos com horário e “Sincronizar com o Google Agenda” ligado viram eventos recorrentes. Mudanças feitas na agenda (título, horário, repetição) voltam para o hábito. Eventos que já existiam na sua agenda nunca são apagados pelo Ritmo.
            </p>
          </>
        )}
        {message && <p className="warn" style={{ whiteSpace: 'pre-line', marginTop: 8 }}>{message}</p>}

        <div className="section-title">Notificações</div>
        <p className="hint" style={{ marginBottom: 8 }}>
          Os lembretes do app funcionam com ele aberto ou em segundo plano. Para lembretes com o app fechado, sincronize o hábito com o Google Agenda: o lembrete é feito pelo app da agenda.
        </p>
        <button
          className="btn ghost"
          style={{ width: '100%' }}
          disabled={!notificationsSupported() || perm === 'granted'}
          onClick={async () => setPerm(await askNotificationPermission())}
        >
          {perm === 'granted' ? 'Notificações ativadas ✓' : perm === 'denied' ? 'Notificações bloqueadas no navegador' : 'Ativar notificações'}
        </button>

        <div className="section-title">Dados</div>
        <div className="btns">
          <button className="btn ghost" onClick={download}>Exportar backup (JSON)</button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>Importar backup</button>
          <input
            ref={fileRef} type="file" accept="application/json" hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                if (window.confirm('Importar substitui todos os dados atuais. Continuar?')) importJson(await f.text());
              } catch (err) {
                setMessage(errMsg(err));
              }
            }}
          />
          <button className="btn danger" onClick={() => { if (window.confirm('Apagar todos os hábitos, tarefas e histórico deste aparelho?')) resetAll(); }}>
            Apagar todos os dados
          </button>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>Os dados ficam só neste aparelho (armazenamento local do navegador). Faça backup de vez em quando.</p>
      </div>
      {showImport && <ImportSheet state={state} onClose={() => setShowImport(false)} />}
    </div>
  );
}
