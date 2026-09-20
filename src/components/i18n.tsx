"use client";
import { createContext, useContext } from "react";
import { tFor } from "@/lib/i18n";

const Ctx = createContext("en");
/** Gives client components in ZUARI Site the signed-in user's language. */
export const I18nProvider = ({ locale, children }: { locale: string; children: React.ReactNode }) => <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
export const useT = () => tFor(useContext(Ctx));
