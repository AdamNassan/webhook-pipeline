import type { Response } from "express";

export type ValidatedStore = {
  params?: unknown;
  query?: unknown;
  body?: unknown;
};

export function getValidated(res: Response): ValidatedStore {
  if (!res.locals.validated) {
    res.locals.validated = {};
  }

  return res.locals.validated as ValidatedStore;
}
