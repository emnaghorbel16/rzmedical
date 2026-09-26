"use client";
import { getApiUrl, getBaseUrl, parseJsonSafe } from "@/utils/api";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "@/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState, useEffect, useRef } from "react";

const API_URL = getApiUrl();

export default function SignInForm() {
  const router = useRouter();
  const [step, setStep] = useState<"credentials" | "otp">("credentials");

  // Step 1
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 2
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(600); // 10 minutes
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Show a notice when redirected here because the session expired
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("session") === "expired") {
      setInfo("Votre session a expiré. Veuillez vous reconnecter.");
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (step !== "otp") return;
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // Step 1: login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || "Erreur de connexion");
      setSuccess("Code envoyé ! Vérifiez votre email.");
      setStep("otp");
      setCountdown(600);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: OTP input handler
  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  // Step 2: verify OTP
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) { setError("Entrez le code complet à 6 chiffres"); return; }
    setError(null); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || "Code incorrect");
      // Save token and user
      localStorage.setItem("rzm_token", data.token);
      localStorage.setItem("rzm_user", JSON.stringify(data.user));
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    setError(null); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error);
      setOtp(["", "", "", "", "", ""]);
      setCountdown(600);
      setSuccess("Nouveau code envoyé !");
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full">
      <div className="w-full max-w-md sm:pt-10 mx-auto mb-5">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon />
          Retour au tableau de bord
        </Link>
      </div>

      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-8">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${step === "credentials" ? "bg-brand-500 text-white" : "bg-green-500 text-white"}`}>
              {step === "otp" ? "✓" : "1"}
            </div>
            <div className={`h-0.5 flex-1 transition-colors ${step === "otp" ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-800"}`} />
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${step === "otp" ? "bg-brand-500 text-white" : "bg-gray-200 text-gray-400 dark:bg-gray-800"}`}>
              2
            </div>
          </div>

          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              {step === "credentials" ? "Connexion Admin" : "Vérification 2FA"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {step === "credentials"
                ? "Entrez vos identifiants administrateur"
                : `Code envoyé à ${email}`}
            </p>
          </div>

          {info && (
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">
              {info}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-600 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
              {success}
            </div>
          )}

          {/* STEP 1: Credentials */}
          {step === "credentials" && (
            <form onSubmit={handleLogin}>
              <div className="space-y-5">
                <div>
                  <Label>Email <span className="text-error-500">*</span></Label>
                  <Input
                    type="email"
                    placeholder="admin@randzmedical.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Mot de passe <span className="text-error-500">*</span></Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Votre mot de passe"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                    >
                      {showPassword
                        ? <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                        : <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />}
                    </span>
                  </div>
                </div>
                <Button className="w-full" size="sm" disabled={loading}>
                  {loading ? "Envoi du code..." : "Continuer →"}
                </Button>
              </div>
            </form>
          )}

          {/* STEP 2: OTP */}
          {step === "otp" && (
            <form onSubmit={handleVerify}>
              <div className="space-y-6">
                <div>
                  <Label>Code à 6 chiffres reçu par email</Label>
                  <div className="flex gap-3 mt-2">
                    {otp.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={el => { otpRefs.current[idx] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleOtpChange(idx, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(idx, e)}
                        className="w-12 h-14 text-center text-xl font-bold border-2 rounded-xl transition-colors focus:outline-none focus:border-brand-500 dark:bg-gray-800 dark:text-white border-gray-300 dark:border-gray-700"
                      />
                    ))}
                  </div>
                </div>

                {/* Countdown */}
                <div className="flex items-center justify-between text-sm">
                  <span className={countdown < 60 ? "text-red-500 font-medium" : "text-gray-500"}>
                    Expire dans : <span className="font-mono">{formatTime(countdown)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading || countdown > 540}
                    className="text-brand-500 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Renvoyer le code
                  </button>
                </div>

                <Button className="w-full" size="sm" disabled={loading || otp.join("").length < 6}>
                  {loading ? "Vérification..." : "Se connecter"}
                </Button>

                <button
                  type="button"
                  onClick={() => { setStep("credentials"); setError(null); setSuccess(null); }}
                  className="w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
                >
                  ← Modifier l&apos;email
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
