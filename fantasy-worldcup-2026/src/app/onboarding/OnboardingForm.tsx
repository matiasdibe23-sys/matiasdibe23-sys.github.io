"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { completarOnboarding } from "./actions";

export function OnboardingForm() {
  const [state, formAction, isPending] = useActionState(completarOnboarding, null);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="nombre_equipo" className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Nombre del equipo
        </Label>
        <Input
          id="nombre_equipo"
          name="nombre_equipo"
          type="text"
          placeholder="Ej: Galácticos FC"
          required
          minLength={3}
          maxLength={30}
          className="h-12 border-slate-700 bg-slate-800 text-lg text-white placeholder:text-slate-600 focus:border-white focus:ring-white"
        />
        <p className="text-xs text-slate-600">Entre 3 y 30 caracteres.</p>
      </div>

      {state?.error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-400">
          {state.error}
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="h-12 w-full bg-white text-base font-black text-black hover:bg-zinc-100"
      >
        {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "¡Empezar a fichar!"}
      </Button>
    </form>
  );
}

