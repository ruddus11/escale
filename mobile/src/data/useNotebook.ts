import { useCallback, useEffect, useRef, useState } from "react";
import { notebookRepository } from "./sqlite";
import type { NotebookData } from "./model";
import type { Key } from "../i18n/strings";
import { KeyedError } from "../i18n/errors";
export function useNotebook() {
  const [data, setData] = useState<NotebookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Key | "">("");
  const current = useRef(data);
  const busy = useRef(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await notebookRepository.load();
      current.current = next;
      setData(next);
    } catch {
      setError("store.loadFailed");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function commit(
    update: (value: NotebookData) => NotebookData,
    recovery?: NotebookData,
  ) {
    if (busy.current || (!current.current && !recovery))
      throw new KeyedError("common.tryLater");
    busy.current = true;
    setSaving(true);
    try {
      const next = recovery ?? update(current.current!);
      await notebookRepository.save(next);
      current.current = next;
      setData(next);
      setError("");
    } catch (e) {
      setError("store.saveFailed");
      throw e;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return { data, loading, saving, error, load, commit };
}
