export async function fetchAnalytics(id: string, mode: "MANAGER" | "TEAM", days?: number) {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  const body: Record<string, any> =
    mode === "MANAGER"
      ? { manager_id: id }
      : { team_id: id };

  if (days !== undefined) {
    body.days = days;
  }

  const res = await fetch(`${backendUrl}/run-analytics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}