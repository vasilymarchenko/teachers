"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * What a page of the `(app)` group shows when it fails on the server — T-038.
 *
 * It sits beside the `(app)` layout, so the boundary it creates is *inside*
 * the shell: the navigation panel stays, and only the work area is replaced.
 * Without this file the framework's own screen takes the whole window, in
 * English, which is what a teacher saw the one time the calendar threw.
 *
 * The words are Ukrainian and say nothing about the cause, because the teacher
 * can do nothing with one; the digest is logged for whoever reads the console.
 *
 * A client component because an error boundary has to be one. The prop is
 * `retry` in this version of Next.js — see
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-4" role="alert">
      <h1 className="text-2xl font-semibold">Не вдалося завантажити сторінку</h1>
      <p className="text-muted-foreground text-sm">
        Щось пішло не так, і ми не змогли показати цю сторінку. Ваші дані на
        місці. Спробуйте ще раз або відкрийте інший розділ у меню.
      </p>
      <Button onClick={() => retry()} type="button">
        Спробувати ще раз
      </Button>
    </div>
  );
}
