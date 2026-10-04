# Market New Tab

Extensão local para Microsoft Edge que mostra gráficos intradiários dos ativos
escolhidos. É possível adicionar um ativo usando seu símbolo (por exemplo,
`ROXO34`) ou informar diretamente o ID usado pelo MSN Finance (por exemplo,
`calgcw`).

## Desenvolvimento com Next.js

O Next.js funciona como preview web. Nesse modo, o catálogo é salvo no
`localStorage` do navegador e os Route Handlers do Next consultam o MSN:

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Gerar e carregar a extensão no Edge

Gere o pacote local da extensão:

```bash
npm run build:extension
```

No Edge, abra `edge://extensions`, habilite o **Modo de desenvolvedor**, clique
em **Carregar sem pacote** e selecione a pasta `dist` deste projeto. A nova guia
passa a ser fornecida pela extensão, e o catálogo fica salvo em
`chrome.storage.local`, sendo recuperado quando o Edge abre novas guias.

Para desenvolver a interface servida pelo Vite:

```bash
npm run dev:extension
```

O servidor Vite é apenas um preview web; para testar o armazenamento da
extensão, carregue a pasta `dist` no Edge.

O pacote solicita acesso de armazenamento e aos hosts de autosuggest e gráficos
do MSN Finance. A chave de gráficos fornecida pelo MSN faz parte do código
distribuído da extensão e, como em qualquer extensão cliente, pode ser vista no
pacote local.
