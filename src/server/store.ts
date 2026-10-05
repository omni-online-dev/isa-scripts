import { randomUUID } from "crypto";
import type { DocumentReference, Firestore, WriteBatch } from "firebase-admin/firestore";
import type { Clinic, SyncRun, SyncTrigger } from "@/core/schema";
import { getAdminDb, projectId } from "./firebaseAdmin";

/** Lo que está publicado ahora mismo. */
export interface PublishedState {
  version: number;
  checksum: string;
  clinics: Clinic[];
}

/** Una publicación: el estado completo (para la copia) y solo lo que cambia (para escribir). */
export interface Publication {
  version: number;
  checksum: string;
  publishedAt: string;
  trigger: SyncTrigger;
  /** Todas las clínicas de la versión. */
  clinics: Clinic[];
  /** Clínicas nuevas o modificadas: las únicas que se escriben. */
  changed: Clinic[];
  /** Ids de las clínicas que desaparecen. */
  removed: string[];
}

export interface Snapshot {
  version: number;
  publishedAt: string;
  clinics: Clinic[];
}

export type StoredRun = SyncRun & { id: string };

export interface ClinicStore {
  getCurrent(): Promise<PublishedState | null>;
  /** Publicación atómica: o se escribe todo o no se escribe nada. */
  publish(publication: Publication): Promise<void>;
  saveRun(run: SyncRun): Promise<string>;
  /** Últimas ejecuciones, de la más reciente a la más antigua. */
  listRuns(limit: number): Promise<StoredRun[]>;
  getSnapshot(version: number): Promise<Snapshot | null>;
  /** false si otra sincronización tiene el cerrojo. Caduca solo a los `ttlMs`. */
  acquireLock(ttlMs: number): Promise<boolean>;
  releaseLock(): Promise<void>;
}

/** Para tests y para desarrollo local sin credenciales. No persiste nada. */
export class MemoryClinicStore implements ClinicStore {
  /** Publicaciones recibidas, en orden: los tests miran qué se escribió. */
  readonly publications: Publication[] = [];
  readonly runs: StoredRun[] = [];
  private clinics = new Map<string, Clinic>();
  private current: { version: number; checksum: string } | null = null;
  private lockedUntil = 0;

  async getCurrent(): Promise<PublishedState | null> {
    return this.current && structuredClone({ ...this.current, clinics: [...this.clinics.values()] });
  }

  async publish(publication: Publication): Promise<void> {
    const copy = structuredClone(publication);
    for (const clinic of copy.changed) this.clinics.set(clinic.id, clinic);
    for (const id of copy.removed) this.clinics.delete(id);
    this.current = { version: copy.version, checksum: copy.checksum };
    this.publications.push(copy);
  }

  async saveRun(run: SyncRun): Promise<string> {
    const id = `run-${this.runs.length + 1}`;
    this.runs.push({ ...structuredClone(run), id });
    return id;
  }

  async listRuns(limit: number): Promise<StoredRun[]> {
    return structuredClone(this.runs.slice(-limit).reverse());
  }

  async getSnapshot(version: number): Promise<Snapshot | null> {
    const found = this.publications.find((p) => p.version === version);
    return found
      ? structuredClone({ version, publishedAt: found.publishedAt, clinics: found.clinics })
      : null;
  }

  async acquireLock(ttlMs: number): Promise<boolean> {
    if (Date.now() < this.lockedUntil) return false;
    this.lockedUntil = Date.now() + ttlMs;
    return true;
  }

  async releaseLock(): Promise<void> {
    this.lockedUntil = 0;
  }
}

/** Firestore admite 500 escrituras por lote; se deja margen. */
const MAX_BATCH_WRITES = 450;

type Write = (batch: WriteBatch) => void;

/**
 * Datos bajo `env/{ns}` para que staging y producción puedan compartir proyecto:
 * `clinics/{id}`, `meta/current`, `meta/lock`, `syncRuns/{autoId}`, `snapshots/{version}`.
 */
export class FirestoreClinicStore implements ClinicStore {
  private readonly root: DocumentReference;
  /** Identifica a esta instancia como dueña del cerrojo. */
  private readonly owner = randomUUID();

  constructor(
    private readonly db: Firestore,
    namespace: string,
  ) {
    this.root = db.collection("env").doc(namespace);
  }

  private get clinics() {
    return this.root.collection("clinics");
  }
  private get current() {
    return this.root.collection("meta").doc("current");
  }
  private get lock() {
    return this.root.collection("meta").doc("lock");
  }

  async getCurrent(): Promise<PublishedState | null> {
    const [meta, clinics] = await Promise.all([this.current.get(), this.clinics.get()]);
    const data = meta.data();
    if (!data) return null;
    return {
      version: Number(data.version),
      checksum: String(data.checksum),
      clinics: clinics.docs.map((doc) => doc.data() as Clinic),
    };
  }

  async publish(publication: Publication): Promise<void> {
    const { version, checksum, publishedAt, trigger, clinics, changed, removed } = publication;
    const writes: Write[] = [
      ...changed.map((clinic): Write => (batch) => batch.set(this.clinics.doc(clinic.id), clinic)),
      ...removed.map((id): Write => (batch) => batch.delete(this.clinics.doc(id))),
      // La copia guarda las clínicas como texto JSON: un solo campo, muy por debajo del límite.
      (batch) =>
        batch.set(this.root.collection("snapshots").doc(String(version)), {
          version,
          publishedAt,
          checksum,
          clinicCount: clinics.length,
          clinics: JSON.stringify(clinics),
        }),
      // `meta/current` va el último: si hubiera que trocear, la versión solo cambia al final.
      (batch) =>
        batch.set(this.current, { version, publishedAt, trigger, clinicCount: clinics.length, checksum }),
    ];

    // Lo normal es un único lote atómico. Solo se trocea con más de 450 escrituras.
    for (let start = 0; start < writes.length; start += MAX_BATCH_WRITES) {
      const batch = this.db.batch();
      for (const write of writes.slice(start, start + MAX_BATCH_WRITES)) write(batch);
      await batch.commit();
    }
  }

  async saveRun(run: SyncRun): Promise<string> {
    const doc = await this.root.collection("syncRuns").add(run);
    return doc.id;
  }

  async listRuns(limit: number): Promise<StoredRun[]> {
    const runs = await this.root.collection("syncRuns").orderBy("startedAt", "desc").limit(limit).get();
    return runs.docs.map((doc) => ({ ...(doc.data() as SyncRun), id: doc.id }));
  }

  async getSnapshot(version: number): Promise<Snapshot | null> {
    const data = (await this.root.collection("snapshots").doc(String(version)).get()).data();
    if (!data) return null;
    return {
      version,
      publishedAt: String(data.publishedAt),
      clinics: JSON.parse(String(data.clinics)) as Clinic[],
    };
  }

  async acquireLock(ttlMs: number): Promise<boolean> {
    return this.db.runTransaction(async (tx) => {
      const held = (await tx.get(this.lock)).data();
      const now = Date.now();
      if (held && Number(held.expiresAt) > now) return false;
      tx.set(this.lock, { owner: this.owner, expiresAt: now + ttlMs });
      return true;
    });
  }

  async releaseLock(): Promise<void> {
    await this.db.runTransaction(async (tx) => {
      const held = (await tx.get(this.lock)).data();
      // Si caducó y lo tomó otra ejecución, no es nuestro: no se toca.
      if (held?.owner === this.owner) tx.delete(this.lock);
    });
  }
}

let store: ClinicStore | undefined;

/** `STORE=memory|firestore`. Sin indicarlo: Firestore si hay proyecto; si no, memoria. */
export function getClinicStore(env: NodeJS.ProcessEnv = process.env): ClinicStore {
  if (store) return store;
  const kind = env.STORE?.trim() || (projectId(env) ? "firestore" : "memory");
  if (kind === "memory") store = new MemoryClinicStore();
  else if (kind === "firestore") {
    store = new FirestoreClinicStore(getAdminDb(), env.DATA_NAMESPACE?.trim() || "staging");
  } else throw new Error(`STORE no válido: «${kind}». Usa "memory" o "firestore".`);
  return store;
}
