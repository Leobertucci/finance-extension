import { getStockChart } from "@/lib/msn-finance";

export async function GET(request: Request) {
  const msnId = new URL(request.url).searchParams.get("msnId")?.trim();

  if (!msnId) {
    return Response.json(
      { error: "Informe o ID do ativo no MSN." },
      { status: 400 },
    );
  }

  try {
    const data = await getStockChart(msnId);
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível carregar o gráfico do MSN Finance.";
    console.error("[api/stocks]", message);
    return Response.json({ error: message }, { status: 502 });
  }
}
