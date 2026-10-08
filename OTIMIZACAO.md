# Otimização do detalhe e das respostas

O detalhe agora constrói o universo de chaves a partir da produção e das
tentativas do período/produto antes de relacioná-lo ao cadastro da Datalake e à
hierarquia. A união das chaves evita duplicar uma loja que produziu e tentou.
Os totais por situação continuam separados; Cancelado é o nome exibido para
`NAO AVERBADO`.

- `qualquer_movimento=1`: contratos nas situações filtradas ou tentativas no
  período. É a carga inicial do painel, suficiente para somar as métricas.
- `incluir_sem_movimento=1`: acrescenta lojas ativas no período. Não inclui
  lojas históricas inativas sem movimento. Lojas inativas com movimento
  continuam no universo.
- Sem essas opções, permanece o recorte pelo assunto: averbado, situação
  selecionada ou tentativas.

O front busca as ativas sem movimento ao marcar a opção correspondente.
O card de cobertura já solicita essa variante na abertura. Requisições antigas
não substituem o contexto mais recente, inclusive ao fechar o painel ou voltar
de uma loja ao resumo. O gráfico mantém a visualização anterior durante a busca
e permite tentar novamente após uma falha.

O Excel usa o mesmo universo limitado. Quando exporta grupos, inclui ativas sem
movimento porque exibe a coluna **Lojas ativas**; a lista de lojas segue a opção
selecionada. Assim, essa coluna não passa a contar somente as ativas que produziram.

O executor SQL possui cache local por processo, com `CACHE_SEGUNDOS=300` e
`CACHE_MAX_ENTRADAS=64` por padrão. Zero em qualquer opção desliga o cache.
Nome, SQL, parâmetros, tokens e destino do banco participam da chave. Há limite
de entradas, expiração, trava para acesso concorrente e cópia dos dicionários
retornados. Erros não são armazenados. Os valores SQL são escalares; objetos
mutáveis aninhados exigiriam cópia profunda se introduzidos futuramente.
Cada processo mantém seu próprio cache; os dados podem ter até o TTL de defasagem.
A configuração está documentada em `.env.example`; o `.env` existente foi preservado.

Respostas JSON de sucesso a partir de 2 KB podem usar gzip quando aceito pelo
cliente e quando a compressão reduz o corpo. São preservados `Vary`, negociação
de qualidade e tamanho do corpo. Downloads, streaming, respostas parciais,
conteúdo já comprimido e `no-transform` ficam fora dessa transformação.

O indicador Tentativas usa a soma de `QTD_CLIENTES` da tabela diária em todos
os recortes: KPI, série diária, equipe, rotina, detalhe, Dia Útil e Excel.
Conversão usa a soma de `QTD_CONVERTIDAS` dividida por essa quantidade de clientes.
As chaves internas `tentativas`/`qtd_tentativas` foram mantidas para compatibilidade.
Essa soma respeita a granularidade da fonte; não deduplica clientes entre dias,
lojas ou produtos. Lojas com tentativa e último DU com tentativa consideram
`QTD_CLIENTES > 0`.

Não foram criados índices no banco. Índices de datas/chave de loja e respectivas
colunas incluídas dependem da avaliação do DBA. A ordem física dos joins e a
materialização de CTEs são decisões do SQL Server; não há promessa de ganho
medido. A pedido do usuário, as medições e execuções de testes foram interrompidas.
