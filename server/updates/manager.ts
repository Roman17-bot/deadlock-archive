import { randomBytes, randomUUID } from 'node:crypto';
import type { HeroSnapshot } from '../../shared/types';
import type { PublicationState, UpdateState } from '../../shared/update-types';
import { getLatestVersion, refreshData } from './source';
import { readVersionHistory } from './history';
import type { VersionHistory } from '../../shared/version-history';

export interface UpdateManager {
  getSnapshot(): HeroSnapshot;
  getHistory(): Promise<VersionHistory>;
  getState(): UpdateState;
  getSessionToken(): string;
  start(options: { publish: boolean }): UpdateState;
}

export class UpdateConflictError extends Error {
  constructor() {
    super('An update is already in progress');
  }
}

export interface UpdateManagerOptions {
  snapshot: HeroSnapshot;
  root: string;
  refresh?: typeof refreshData;
  checkVersion?: typeof getLatestVersion;
  publish?: (options: { expectedVersion: number }) => Promise<PublicationState>;
  onSaved?: (snapshot: HeroSnapshot) => void | Promise<void>;
}

export function createUpdateManager(options: UpdateManagerOptions): UpdateManager {
  let current = structuredClone(options.snapshot);
  let running = false;
  const token = randomBytes(32).toString('hex');
  let state: UpdateState = {
    phase: 'idle',
    clientVersion: current.meta.clientVersion,
    localSaved: false,
    changed: false,
    message: 'Можно проверить и обновить локальные данные.',
    updatedAt: new Date().toISOString(),
  };
  const update = (patch: Partial<UpdateState>) => {
    state = { ...state, ...patch, updatedAt: new Date().toISOString() };
  };
  const readState = () => structuredClone(state);
  async function execute(publish: boolean) {
    let warning = '';
    try {
      const latest = await (options.checkVersion ?? getLatestVersion)();
      if (latest.version < current.meta.clientVersion)
        throw new Error('Refusing version downgrade');
      if (latest.version === current.meta.clientVersion) {
        update({ phase: 'succeeded', upToDate: true, message: 'Текущая версия актуальна.' });
        return;
      }
      const refreshed = await (options.refresh ?? refreshData)({
        root: options.root,
        expectedVersion: latest.version,
      });
      if (!refreshed.changed) {
        update({ phase: 'succeeded', upToDate: true, message: 'Текущая версия актуальна.' });
        return;
      }
      update({ phase: 'saving', message: 'Проверенные данные сохранены локально.' });
      current = structuredClone(refreshed.snapshot);
      update({
        localSaved: true,
        changed: refreshed.changed,
        clientVersion: current.meta.clientVersion,
        historySaved: refreshed.historySaved,
      });
      try {
        await options.onSaved?.(structuredClone(current));
      } catch {
        warning = ' Индекс базы знаний не обновлён; повторите импорт.';
      }
      if (refreshed.historySaved === false) {
        update({
          phase: 'succeeded',
          message:
            'Локальные данные сохранены. История версий не сохранена; публикация не отправлена. Исправьте историю перед публикацией.' +
            warning,
        });
        return;
      }
      if (publish) {
        update({
          phase: 'publishing',
          message: 'Локальные данные сохранены. Отправляем публикацию в GitHub.',
        });
        const dispatch = options.publish ?? (await import('./publish')).dispatchPublication;
        const publication = await dispatch({ expectedVersion: current.meta.clientVersion });
        update({
          phase: 'succeeded',
          publication,
          message:
            'Локальные данные сохранены. Публикация отправлена в очередь GitHub Actions; развёртывание ещё не подтверждено.' +
            warning,
        });
      } else {
        update({
          phase: 'succeeded',
          message:
            (refreshed.changed
              ? 'Локальные данные обновлены.'
              : 'Проверка завершена: локальные данные актуальны.') + warning,
        });
      }
    } catch {
      const error = state.localSaved
        ? 'Локальные данные сохранены, но отправка публикации не удалась. Запустите GitHub Actions вручную: повторное обновление той же версии не отправляет публикацию.'
        : 'Обновление не удалось. Предыдущий локальный снимок сохранён.';
      update({ phase: 'failed', error, message: error + warning });
    } finally {
      running = false;
    }
  }
  return {
    getSnapshot: () => structuredClone(current),
    getHistory: () => readVersionHistory(options.root),
    getState: readState,
    getSessionToken: () => token,
    start({ publish }) {
      if (running) throw new UpdateConflictError();
      running = true;
      state = {
        phase: 'checking',
        clientVersion: current.meta.clientVersion,
        localSaved: false,
        changed: false,
        message: 'Проверяем источники и версию игры.',
        updatedAt: new Date().toISOString(),
        jobId: randomUUID(),
      };
      // Reserve the job before scheduling work so concurrent requests cannot race.
      void Promise.resolve().then(() => execute(publish));
      return readState();
    },
  };
}
