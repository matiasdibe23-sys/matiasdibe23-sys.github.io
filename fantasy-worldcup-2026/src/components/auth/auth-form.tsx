"use client";

import { useState, useTransition } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { login, signup } from "@/app/(auth)/login/actions";
import { Loader2 } from "lucide-react";

export function AuthForm() {
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signupMessage, setSignupMessage] = useState<{ error?: string; success?: string } | null>(null);
  const [isPendingLogin, startLoginTransition] = useTransition();
  const [isPendingSignup, startSignupTransition] = useTransition();

  function handleLogin(formData: FormData) {
    setLoginError(null);
    startLoginTransition(async () => {
      const result = await login(formData);
      if (result?.error) setLoginError(result.error);
    });
  }

  function handleSignup(formData: FormData) {
    setSignupMessage(null);
    startSignupTransition(async () => {
      const result = await signup(formData);
      setSignupMessage(result ?? null);
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="space-y-1 text-center">
          <h1 className="text-5xl font-black tracking-tighter text-white">
            FANTASY<span className="text-yellow-400">26</span>
          </h1>
          <p className="text-sm text-slate-500">
            Arma tu equipo ideal del Mundial 2026
          </p>
        </div>

        {/* Auth Card */}
        <Card className="border-slate-800 bg-slate-900 shadow-2xl">
          <Tabs defaultValue="login">
            <CardHeader className="pb-0 pt-5">
              <TabsList className="grid w-full grid-cols-2 bg-slate-800">
                <TabsTrigger
                  value="login"
                  className="font-bold data-[state=active]:bg-white data-[state=active]:text-black"
                >
                  Iniciar Sesión
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="font-bold data-[state=active]:bg-white data-[state=active]:text-black"
                >
                  Registrarse
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-5">
              {/* Login Tab */}
              <TabsContent value="login">
                <form action={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email" className="text-slate-300 text-xs font-semibold uppercase tracking-widest">
                      Email
                    </Label>
                    <Input
                      id="login-email"
                      name="email"
                      type="email"
                      placeholder="tu@email.com"
                      required
                      className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-600 focus:border-white focus:ring-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password" className="text-slate-300 text-xs font-semibold uppercase tracking-widest">
                      Contraseña
                    </Label>
                    <Input
                      id="login-password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      required
                      className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-600 focus:border-white focus:ring-white"
                    />
                  </div>

                  {loginError && (
                    <div className="rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-400">
                      {loginError}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isPendingLogin}
                    className="h-11 w-full bg-white font-black text-black hover:bg-zinc-100"
                  >
                    {isPendingLogin ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar al juego"}
                  </Button>
                </form>
              </TabsContent>

              {/* Signup Tab */}
              <TabsContent value="signup">
                <form action={handleSignup} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-username" className="text-slate-300 text-xs font-semibold uppercase tracking-widest">
                      Nombre de usuario
                    </Label>
                    <Input
                      id="signup-username"
                      name="username"
                      type="text"
                      placeholder="MiEquipo2026"
                      required
                      minLength={3}
                      maxLength={30}
                      className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-600 focus:border-white focus:ring-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email" className="text-slate-300 text-xs font-semibold uppercase tracking-widest">
                      Email
                    </Label>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="tu@email.com"
                      required
                      className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-600 focus:border-white focus:ring-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-password" className="text-slate-300 text-xs font-semibold uppercase tracking-widest">
                      Contraseña
                    </Label>
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      required
                      minLength={6}
                      className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-600 focus:border-white focus:ring-white"
                    />
                  </div>

                  {signupMessage?.error && (
                    <div className="rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-400">
                      {signupMessage.error}
                    </div>
                  )}
                  {signupMessage?.success && (
                    <div className="rounded-lg border border-green-800 bg-green-950/50 px-3 py-2 text-sm text-green-400">
                      {signupMessage.success}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isPendingSignup}
                    className="h-11 w-full bg-white font-black text-black hover:bg-zinc-100"
                  >
                    {isPendingSignup ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear mi equipo"}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <p className="text-center text-xs text-slate-700">
          FantasyMundial 2026 · Todos los derechos reservados
        </p>
      </div>
    </div>
  );
}

