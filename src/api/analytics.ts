export async function fetchAnalytics(teamId: string, days: number) {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  const res = await fetch(`${backendUrl}/run-analytics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ team_id: teamId, days })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Analytics backend error");
  }

  return res.json();
}
