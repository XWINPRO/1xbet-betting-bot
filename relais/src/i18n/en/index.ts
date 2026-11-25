import { admin } from "./admin";
import { common } from "./common";
import { courier } from "./courier";
import { dashboard } from "./dashboard";
import { errors } from "./errors";
import { publicPages } from "./public";

/** Dictionnaire anglais : texte français (clé) → texte anglais. */
export const en: Record<string, string> = {
  ...errors,
  ...common,
  ...publicPages,
  ...dashboard,
  ...courier,
  ...admin,
};
