# Finance Extension

Protótipo local da página de nova guia da extensão Finance para Microsoft Edge.
Por enquanto, a página mostra o gráfico intradiário do BDR ROXO34 (Nu Holdings)
usando os serviços de busca e cotações do MSN Finance.

## Rodar localmente

Instale as dependências e inicie o servidor de desenvolvimento:

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). A página busca o código
do ativo pelo ticker `ROXO34`, consulta os preços intradiários e permite
atualizar os dados manualmente.

As chamadas ao MSN são feitas no servidor pela rota `/api/stocks/roxo34`; a
chave usada pela chamada de gráficos não é enviada ao navegador.
