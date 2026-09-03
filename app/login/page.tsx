import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  // Already logged in -- no reason to show the login form again.
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
      <div style={{ width: 320 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Sign in</h1>
        <LoginForm />
      </div>
    </div>
  );
}
