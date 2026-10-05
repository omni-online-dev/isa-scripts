import { bearerToken } from "./secrets";
import { getAdminAuth, getAdminDb, projectId } from "./firebaseAdmin";

/** Correos con rol de administración aunque no tengan documento en users/ (arranque). */
function bootstrapAdmins(env: NodeJS.ProcessEnv): string[] {
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Correo de la persona administradora que hace la petición, o null si no lo es.
 * Exige un token de Firebase con correo verificado y rol admin en users/{email}.
 * Sin proyecto de Firebase y fuera de producción (modo local) se permite todo.
 */
export async function adminEmail(request: Request, env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  if (!projectId(env)) return env.NODE_ENV === "production" ? null : "modo local";

  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const email = decoded.email?.toLowerCase();
    if (!email || decoded.email_verified !== true) return null;
    if (bootstrapAdmins(env).includes(email)) return email;
    const user = (await getAdminDb().collection("users").doc(email).get()).data();
    return user?.role === "admin" && user.active !== false ? email : null;
  } catch {
    return null;
  }
}

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
