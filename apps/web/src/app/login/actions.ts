"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loginLocalUser, logoutLocalSession, registerLocalUser, webSessionCookieName } from "../../lib/auth-api";

export async function registerAction(formData: FormData) {
  try {
    await registerLocalUser({
      email: requiredString(formData, "email"),
      password: requiredString(formData, "password"),
      name: optionalString(formData, "name")
    });
  } catch (error) {
    redirect(`/login?error=${encodeURIComponent(messageFor(error))}`);
  }

  revalidateAuthViews();
  redirect("/login?registered=1");
}

export async function loginAction(formData: FormData) {
  try {
    const session = await loginLocalUser({
      email: requiredString(formData, "email"),
      password: requiredString(formData, "password")
    });
    const cookieStore = await cookies();
    cookieStore.set(webSessionCookieName, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(session.expiresAt)
    });
  } catch (error) {
    redirect(`/login?error=${encodeURIComponent(messageFor(error))}`);
  }

  revalidateAuthViews();
  redirect("/login?loggedIn=1");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get(webSessionCookieName)?.value;
  try {
    await logoutLocalSession(token);
  } catch (error) {
    redirect(`/login?error=${encodeURIComponent(messageFor(error))}`);
  }

  cookieStore.delete(webSessionCookieName);
  revalidateAuthViews();
  redirect("/login?loggedOut=1");
}

function revalidateAuthViews(): void {
  revalidatePath("/");
  revalidatePath("/login");
  revalidatePath("/settings");
}

function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} ist erforderlich.`);
  }
  return value.trim();
}

function optionalString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : "Auth-Aktion konnte nicht gespeichert werden.";
}
