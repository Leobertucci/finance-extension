import { resolveMsnId } from "@/lib/msn-finance";

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get("symbol")?.trim();

  if (!symbol) {
    return Response.json(
      { error: "Informe o símbolo do ativo para fazer a busca." },
      { status: 400 },
    );
  }

  try {
    const msnId = await resolveMsnId(symbol);
    return Response.json({ msnId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível encontrar o símbolo no MSN Finance.";
    console.error("[api/stocks/resolve]", message);
    return Response.json({ error: message }, { status: 502 });
  }
}
