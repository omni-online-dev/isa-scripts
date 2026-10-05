import { Fragment } from "react";
import { cn } from "@/lib/utils";

/**
 * Texto de guion: párrafos separados por línea en blanco, saltos de línea simples
 * y **negrita** para los datos que cambian de una clínica a otra.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {text.split(/\n{2,}/).map((paragraph, p) => (
        <p key={p}>
          {paragraph.split("\n").map((line, l) => (
            <Fragment key={l}>
              {l > 0 && <br />}
              {line.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                part.startsWith("**") && part.endsWith("**") ? (
                  <strong key={i} className="rounded bg-cyan-50 px-1 font-semibold text-cyan-900">
                    {part.slice(2, -2)}
                  </strong>
                ) : (
                  part
                ),
              )}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
