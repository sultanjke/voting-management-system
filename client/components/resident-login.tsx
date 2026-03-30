"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/components/language-provider";

type RequestResponse = {
  message?: string;
  devCode?: string;
  retryAfterSeconds?: number;
  error?: string;
};

const OTP_LENGTH = 6;

export function ResidentLogin() {
  const { t } = useI18n();
  const [phone, setPhone] = useState("");
  const [houseCode, setHouseCode] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(Array.from({ length: OTP_LENGTH }, () => ""));
  const [step, setStep] = useState<"request" | "verify">("request");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState(false);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const lastAttemptedCodeRef = useRef<string | null>(null);
  const otpCode = otpDigits.join("");

  useEffect(() => {
    if (step === "verify") {
      otpInputRefs.current[0]?.focus();
    }
  }, [step]);

  const setOtpDigit = (index: number, value: string) => {
    if (loading || otpSuccess) {
      return;
    }

    const normalized = value.replace(/\D/g, "");
    if (!normalized) {
      setOtpDigits((previous) => {
        const next = [...previous];
        next[index] = "";
        return next;
      });
      return;
    }

    if (normalized.length > 1) {
      setOtpDigits((previous) => {
        const next = [...previous];
        for (let position = index; position < OTP_LENGTH; position += 1) {
          next[position] = normalized[position - index] ?? "";
        }
        return next;
      });
      otpInputRefs.current[Math.min(index + normalized.length, OTP_LENGTH - 1)]?.focus();
      return;
    }

    setOtpDigits((previous) => {
      const next = [...previous];
      next[index] = normalized;
      return next;
    });

    if (index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, key: string) => {
    if (key === "Backspace") {
      if (otpDigits[index]) {
        setOtpDigits((previous) => {
          const next = [...previous];
          next[index] = "";
          return next;
        });
        return;
      }

      if (index > 0) {
        setOtpDigits((previous) => {
          const next = [...previous];
          next[index - 1] = "";
          return next;
        });
        otpInputRefs.current[index - 1]?.focus();
      }
      return;
    }

    if (key === "ArrowLeft" && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
      return;
    }

    if (key === "ArrowRight" && index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (text: string) => {
    if (loading || otpSuccess) {
      return;
    }

    const normalized = text.replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!normalized) {
      return;
    }

    setOtpDigits((previous) => {
      const next = [...previous];
      for (let index = 0; index < OTP_LENGTH; index += 1) {
        next[index] = normalized[index] ?? "";
      }
      return next;
    });

    otpInputRefs.current[Math.min(normalized.length, OTP_LENGTH) - 1]?.focus();
  };

  const requestOtp = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    setOtpSuccess(false);

    try {
      const response = await fetch("/api/resident/auth/otp/request", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ phone, houseCode })
      });

      const payload = (await response.json()) as RequestResponse;
      if (!response.ok) {
        setError(t("residentLogin.requestFailed"));
        return;
      }

      setInfo(payload.devCode ? t("residentLogin.devCode", { code: payload.devCode }) : t("residentLogin.codeSent"));
      setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
      lastAttemptedCodeRef.current = null;
      setStep("verify");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = useCallback(
    async (candidateCode = otpCode, options?: { silentFail?: boolean }) => {
      const silentFail = options?.silentFail ?? false;

      if (candidateCode.length !== OTP_LENGTH) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/resident/auth/otp/verify", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ phone, houseCode, code: candidateCode })
        });

        if (!response.ok) {
          if (!silentFail) {
            setError(t("residentLogin.verifyFailed"));
          }
          return;
        }

        setOtpSuccess(true);
        setInfo(t("residentLogin.success"));
        window.setTimeout(() => {
          window.location.reload();
        }, 1000);
      } finally {
        setLoading(false);
      }
    },
    [houseCode, otpCode, phone, t]
  );

  useEffect(() => {
    if (step !== "verify" || loading || otpSuccess) {
      return;
    }

    if (otpCode.length !== OTP_LENGTH) {
      lastAttemptedCodeRef.current = null;
      return;
    }

    if (lastAttemptedCodeRef.current === otpCode) {
      return;
    }

    lastAttemptedCodeRef.current = otpCode;
    void verifyOtp(otpCode, { silentFail: true });
  }, [loading, otpCode, otpSuccess, step, verifyOtp]);

  return (
    <main className="app-shell relative flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <div className="fixed right-4 top-4 z-30">
        <LanguageSwitcher />
      </div>
      <section className="glass-panel w-full max-w-xl p-7">
        <div className="mb-5">
          <h1 className="text-3xl mb-5 font-bold">{t("residentLogin.title")}</h1>
          <p className="mt-2 text-sm text-slate-600">{t("residentLogin.subtitle")}</p>
        </div>

        {step === "request" ? (
          <div className="space-y-4">
            <div>
              <label className="field-label" htmlFor="phone-input">
                {t("residentLogin.phoneLabel")}
              </label>
              <input
                id="phone-input"
                className="field-input"
                placeholder="+7"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="house-input">
                {t("residentLogin.houseLabel")}
              </label>
              <input
                id="house-input"
                className="field-input"
                placeholder="1 - 40"
                value={houseCode}
                onChange={(event) => setHouseCode(event.target.value)}
              />
            </div>
            <button className="primary-btn w-full" disabled={loading} onClick={requestOtp} type="button">
              {loading ? t("residentLogin.sending") : t("residentLogin.send")}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="field-label" htmlFor="otp-input-0">
                {t("residentLogin.otpLabel")}
              </label>
              <div className="mt-2 grid grid-cols-6 gap-2 sm:gap-3">
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      otpInputRefs.current[index] = element;
                    }}
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    className={`h-12 rounded-xl border text-center text-xl font-semibold text-slate-900 transition-all duration-300 ${
                      otpSuccess
                        ? "border-emerald-500 ring-2 ring-emerald-200 shadow-[0_0_14px_rgba(34,197,94,0.28)]"
                        : "border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    }`}
                    disabled={loading || otpSuccess}
                    id={`otp-input-${index}`}
                    inputMode="numeric"
                    maxLength={1}
                    onChange={(event) => setOtpDigit(index, event.target.value)}
                    onFocus={(event) => event.currentTarget.select()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && otpCode.length === OTP_LENGTH) {
                        void verifyOtp(otpCode, { silentFail: true });
                        return;
                      }
                      handleOtpKeyDown(index, event.key);
                    }}
                    onPaste={(event) => {
                      event.preventDefault();
                      handleOtpPaste(event.clipboardData.getData("text"));
                    }}
                    pattern="[0-9]*"
                    type="text"
                    value={digit}
                  />
                ))}
              </div>
            </div>
            {/* <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
              {loading ? t("residentLogin.verifying") : t("residentLogin.autoVerifyHint")}
            </p> */}
            <button
              className="secondary-btn w-full"
              disabled={loading || otpSuccess}
              onClick={() => {
                setStep("request");
                setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
                lastAttemptedCodeRef.current = null;
                setOtpSuccess(false);
                setInfo(null);
                setError(null);
              }}
              type="button"
            >
              {t("residentLogin.back")}
            </button>
          </div>
        )}

        {info ? (
          <p
            className={`mt-4 rounded-xl px-3 py-2 text-sm ${
              otpSuccess
                ? "animate-pulse border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "bg-blue-50 text-blue-800"
            }`}
          >
            {info}
          </p>
        ) : null}
        {error ? <p className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800">{error}</p> : null}

        <div className="mt-4 text-center">
          <Link
            className="text-sm text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
            href="/admin/login"
          >
            {t("residentLogin.goToAdmin")}
          </Link>
        </div>

      </section>
    </main>
  );
}
