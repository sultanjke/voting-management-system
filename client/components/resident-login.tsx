"use client";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ResidentPasskeyOptionsResponse, ResidentPasskeyVerifyResponse } from "@shared/contracts";

import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/components/language-provider";

type ApiErrorResponse = {
  error?: string;
};

const SESSION_HINT_POPUP_FLAG = "rv_show_session_hint_popup";

export function ResidentLogin() {
  const { t } = useI18n();
  const [phone, setPhone] = useState("");
  const [houseCode, setHouseCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<"signin" | "register" | null>(null);
  const [expandedSection, setExpandedSection] = useState<"signin" | "register" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [passkeySupported, setPasskeySupported] = useState<boolean>(true);

  useEffect(() => {
    const checkPasskeySupport = async () => {
      if (typeof window === "undefined") {
        return;
      }

      if (!window.isSecureContext || typeof window.PublicKeyCredential === "undefined") {
        setPasskeySupported(false);
        return;
      }

      if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") {
        setPasskeySupported(true);
        return;
      }

      try {
        const uvpaAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setPasskeySupported(Boolean(uvpaAvailable));
      } catch {
        setPasskeySupported(false);
      }
    };

    void checkPasskeySupport();
  }, []);

  const completeLogin = () => {
    setInfo(t("residentLogin.success"));
    window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(SESSION_HINT_POPUP_FLAG, "1");
      } catch {
        // ignore browser storage issues
      }
      window.location.reload();
    }, 700);
  };

  const mapPasskeyError = (fallbackKey: string, value: unknown) => {
    if (value instanceof Error && value.name === "NotAllowedError") {
      return t("residentLogin.passkeyCancelled");
    }

    return t(fallbackKey);
  };

  const signInWithPasskey = async () => {
    if (!passkeySupported) {
      setError(t("residentLogin.unsupported"));
      return;
    }

    setLoading(true);
    setLoadingAction("signin");
    setError(null);
    setInfo(null);

    try {
      const optionsResponse = await fetch("/api/resident/auth/passkey/login/options", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      });
      const optionsPayload = (await optionsResponse.json().catch(() => ({}))) as
        | (ResidentPasskeyOptionsResponse & ApiErrorResponse)
        | ApiErrorResponse;

      if (!optionsResponse.ok || !("challengeId" in optionsPayload) || !("options" in optionsPayload)) {
        setError(optionsPayload.error ?? t("residentLogin.passkeySignInFailed"));
        return;
      }

      const authenticationResponse = await startAuthentication(optionsPayload.options as any);

      const verifyResponse = await fetch("/api/resident/auth/passkey/login/verify", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          challengeId: optionsPayload.challengeId,
          response: authenticationResponse
        })
      });
      const verifyPayload = (await verifyResponse.json().catch(() => ({}))) as ResidentPasskeyVerifyResponse & ApiErrorResponse;

      if (!verifyResponse.ok || !verifyPayload.success) {
        setError(verifyPayload.error ?? t("residentLogin.passkeySignInFailed"));
        return;
      }

      completeLogin();
    } catch (requestError) {
      setError(mapPasskeyError("residentLogin.passkeySignInFailed", requestError));
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  };

  const enrollPasskey = async () => {
    if (!passkeySupported) {
      setError(t("residentLogin.unsupported"));
      return;
    }

    setLoading(true);
    setLoadingAction("register");
    setError(null);
    setInfo(null);

    try {
      const optionsResponse = await fetch("/api/resident/auth/passkey/register/options", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          phone,
          houseCode
        })
      });
      const optionsPayload = (await optionsResponse.json().catch(() => ({}))) as
        | (ResidentPasskeyOptionsResponse & ApiErrorResponse)
        | ApiErrorResponse;

      if (!optionsResponse.ok || !("challengeId" in optionsPayload) || !("options" in optionsPayload)) {
        setError(optionsPayload.error ?? t("residentLogin.passkeyRegisterFailed"));
        return;
      }

      const registrationResponse = await startRegistration(optionsPayload.options as any);

      const verifyResponse = await fetch("/api/resident/auth/passkey/register/verify", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          challengeId: optionsPayload.challengeId,
          response: registrationResponse
        })
      });
      const verifyPayload = (await verifyResponse.json().catch(() => ({}))) as ResidentPasskeyVerifyResponse & ApiErrorResponse;

      if (!verifyResponse.ok || !verifyPayload.success) {
        setError(verifyPayload.error ?? t("residentLogin.passkeyRegisterFailed"));
        return;
      }

      setInfo(t("residentLogin.passkeyRegistered"));
      completeLogin();
    } catch (requestError) {
      setError(mapPasskeyError("residentLogin.passkeyRegisterFailed", requestError));
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  };

  const toggleSection = (section: "signin" | "register") => {
    setExpandedSection((current) => (current === section ? null : section));
    setError(null);
    setInfo(null);
  };

  return (
    <main className="app-shell relative flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <div className="fixed right-4 top-4 z-30">
        <LanguageSwitcher />
      </div>

      <section className="glass-panel w-full max-w-xl p-7">
        <div className="mb-5">
          <h1 className="mb-5 text-3xl font-bold">{t("residentLogin.title")}</h1>
          <p className="mt-2 text-sm text-slate-600">{t("residentLogin.subtitle")}</p>
        </div>

        {!passkeySupported ? (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {t("residentLogin.unsupported")}
          </p>
        ) : null}

        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <button
              aria-controls="passkey-signin-panel"
              aria-expanded={expandedSection === "signin"}
              className="secondary-btn flex w-full items-center justify-between text-left"
              disabled={loading || !passkeySupported}
              onClick={() => toggleSection("signin")}
              type="button"
            >
              <span>{t("residentLogin.passkeySignIn")}</span>
              <span
                aria-hidden="true"
                className={`inline-block text-sm text-slate-500 transition-transform duration-200 ${
                  expandedSection === "signin" ? "rotate-180" : ""
                }`}
              >
                ▼
              </span>
            </button>

            <div
              className={`overflow-hidden transition-all duration-300 ${
                expandedSection === "signin" ? "mt-3 max-h-24 opacity-100" : "max-h-0 opacity-0"
              }`}
              id="passkey-signin-panel"
            >
              <button
                className="primary-btn w-full"
                disabled={loading || !passkeySupported}
                onClick={signInWithPasskey}
                type="button"
              >
                {loadingAction === "signin" ? t("residentLogin.passkeySigningIn") : t("residentLogin.passkeySignIn")}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <button
              aria-controls="passkey-register-panel"
              aria-expanded={expandedSection === "register"}
              className="secondary-btn flex w-full items-center justify-between text-left"
              disabled={loading || !passkeySupported}
              onClick={() => toggleSection("register")}
              type="button"
            >
              <span>{t("residentLogin.passkeyRegister")}</span>
              <span
                aria-hidden="true"
                className={`inline-block text-sm text-slate-500 transition-transform duration-200 ${
                  expandedSection === "register" ? "rotate-180" : ""
                }`}
              >
                ▼
              </span>
            </button>

            <div
              className={`overflow-hidden transition-all duration-300 ${
                expandedSection === "register" ? "mt-3 max-h-[26rem] opacity-100" : "max-h-0 opacity-0"
              }`}
              id="passkey-register-panel"
            >
              <p className="mb-3 text-sm font-medium text-slate-700">{t("residentLogin.firstTimeTitle")}</p>

              <div className="space-y-3">
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
              </div>

              <button
                className="primary-btn mt-3 w-full"
                disabled={loading || !passkeySupported || !phone.trim() || !houseCode.trim()}
                onClick={enrollPasskey}
                type="button"
              >
                {loadingAction === "register" ? t("residentLogin.passkeyRegistering") : t("residentLogin.passkeyRegister")}
              </button>
            </div>
          </div>
        </div>

        {info ? <p className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800">{info}</p> : null}
        {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

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
