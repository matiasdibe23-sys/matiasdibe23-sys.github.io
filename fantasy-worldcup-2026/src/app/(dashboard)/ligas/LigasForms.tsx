"use client";

import { useActionState } from "react";
import { Loader2, Plus, LogIn } from "lucide-react";
import { crearLiga, unirseALiga } from "./actions";

export default function LigasForms() {
  const [createState, createAction, createPending] = useActionState(
    async (_: unknown, fd: FormData) => crearLiga(fd),
    null
  );
  const [joinState, joinAction, joinPending] = useActionState(
    async (_: unknown, fd: FormData) => unirseALiga(fd),
    null
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Create */}
      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-bold text-white">Crear liga</h2>
        </div>
        <form action={createAction} className="space-y-3">
          <input
            name="nombre"
            placeholder="Nombre de tu liga"
            required
            minLength={3}
            maxLength={40}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-white focus:outline-none"
          />
          {createState?.error && (
            <p className="text-xs text-red-400">{createState.error}</p>
          )}
          <button
            type="submit"
            disabled={createPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-black text-black hover:bg-zinc-100 disabled:opacity-50"
          >
            {createPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Crear
          </button>
        </form>
      </div>

      {/* Join */}
      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center gap-2">
          <LogIn className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-bold text-white">Unirse a liga</h2>
        </div>
        <form action={joinAction} className="space-y-3">
          <input
            name="codigo"
            placeholder="Código de acceso"
            required
            minLength={4}
            maxLength={10}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm uppercase text-white placeholder:normal-case placeholder:text-slate-600 focus:border-white focus:outline-none"
          />
          {joinState?.error && (
            <p className="text-xs text-red-400">{joinState.error}</p>
          )}
          <button
            type="submit"
            disabled={joinPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {joinPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            Unirse
          </button>
        </form>
      </div>
    </div>
  );
}

