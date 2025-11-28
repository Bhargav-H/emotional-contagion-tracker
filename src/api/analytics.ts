export async function fetchAnalytics(id: string, days: number, mode: "MANAGER" | "TEAM") {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  const body =
    mode === "MANAGER"
      ? { manager_id: id, days }
      : { team_id: id, days };

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
