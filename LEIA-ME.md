# In Foco · Landing "Tamanho do Prejuízo"

Página estática de captura de leads com calculadora de perdas. Não tem backend próprio:
o front envia os dados para um Google Apps Script, que grava numa planilha.

```
index.html                     a landing (HTML + CSS + JS, tudo embutido)
privacidade.html               política de privacidade — RASCUNHO, precisa de revisão jurídica
favicon.ico
assets/                        logos, ícones e imagem de compartilhamento
apps-script-leads-in-foco.gs   o "backend": cola no Apps Script da planilha
teste-apps-script.js           testes do .gs, rodam no Node sem precisar do Google
*.bak                          versão original, antes das correções
```

---

## Antes de publicar

### 1. Gravação dos leads  ✅ feito

Está tudo no ar e verificado:

- Planilha **Leads In Foco** (`1metdDbiDck9CqOgRA-jJTmrbLxt0CbhKNFfqIFbMnCQ`), aba **Leads**
- Projeto Apps Script vinculado a ela, implantado como App da Web, Versão 1
- `LEAD_ENDPOINT` preenchido no `index.html`

**Se algum dia precisar alterar o `.gs`:** editar não basta. É preciso
**Implantar → Gerenciar implantações → editar (lápis) → Versão: Nova versão → Implantar**.
Sem isso a URL continua servindo o código antigo, silenciosamente. A URL `/exec`
não muda ao criar nova versão — só muda se você criar uma implantação do zero.

**Teste rápido do endpoint** a qualquer momento, pelo navegador ou terminal:

```bash
curl https://script.google.com/macros/s/AKfycbyLgCo5fM0JFJSVWesRUJ4zmieDtOo8PRHr24K2xGmrcHoRbe8VeTi_1_KRIe8A6D8lnw/exec
# esperado: {"ok":true,"servico":"Leads In Foco"}
```

Se devolver outra coisa, a implantação caiu ou foi substituída.

### 2. Domínio nas meta tags  ✅ feito

As tags `canonical`, `og:url` e `og:image` já apontam para `https://produtivo.estudyou.com`
(linhas 11, 15 e 18 do `index.html`). São elas que controlam o preview exibido quando
alguém manda o link no WhatsApp. Se o domínio mudar, troque nas três.

### 3. Política de privacidade  ✅ feito

`privacidade.html` está publicável, sem campos pendentes. O canal para pedidos de
exclusão e acesso a dados é o **WhatsApp (69) 99956-5508** — o mesmo que já aparece
na landing. O formulário exige o aceite marcado, e o consentimento fica registrado
na coluna **Consentimento** da planilha, porque a LGPD pede que ele seja comprovável.

Não há DPO nomeado no texto: a lei pede que o encarregado seja designado, mas não
inventei um nome. Se vocês designarem alguém, acrescente na seção 1. O prazo de
retenção está descrito por critério ("enquanto durar o interesse comercial") em vez
de um número fixo — se preferirem cravar um prazo, é a seção 6.

Vale uma leitura do jurídico quando sobrar tempo. O texto descreve corretamente o que
a página coleta, mas quem responde por ele é a empresa.

### 4. Conferir o telefone

O número está num lugar só: a constante `WHATSAPP` no `index.html`. Ela alimenta o botão do
topo, o CTA final e o telefone embaixo dele. Formato: `55` + DDD + número, só dígitos.

---

## Colocando no servidor (Coolify)

O servidor roda **Coolify** em `painel.client4you.com.br`, projeto **infoco teste.**,
ambiente **production**. O domínio `produtivo.estudyou.com` já aponta para lá.

O Coolify não aceita upload de pasta: ele puxa de um Git ou constrói um Dockerfile.
Usamos Git — assim atualizar o site vira `git push`.

**Criando o recurso (uma vez só)**

1. No projeto → **+ New** → **Public Repository** (ou *Private Repository with Deploy Key*,
   se o repo for fechado).
2. Cole a URL do repositório e selecione o branch `master`.
3. **Build Pack: Dockerfile** — não "Static" nem "Nixpacks". O `Dockerfile` da raiz já
   monta o nginx com os cabeçalhos e o cache corretos.
4. **Ports Exposes: 80**. Esse campo não aparece no formulário de criação quando o
   build pack é Dockerfile — fica na tela de configuração, em **Network**, e vem com
   **3000** por padrão. O `EXPOSE 80` do Dockerfile não o sobrescreve. Se ficar 3000,
   o deploy conclui, o container fica *healthy* e mesmo assim o site responde **502**,
   porque o proxy encaminha para uma porta onde ninguém escuta.
5. Em **Domains**, informe `https://produtivo.estudyou.com`. O Coolify emite o certificado
   via Let's Encrypt automaticamente — o TLS é terminado no proxy dele (Caddy, neste
   servidor), e por isso o `nginx.conf` daqui fala HTTP puro dentro do container.
   Só configure o domínio depois que o DNS resolver: sem isso a emissão do certificado
   falha e o Let's Encrypt limita as tentativas.
6. **Deploy**. Ao mudar qualquer configuração depois, o Coolify avisa
   "unapplied configuration changes" — é preciso **Redeploy** para valer.

**Atualizando depois**

```bash
git add -A && git commit -m "o que mudou" && git push
```

Se o webhook estiver ligado, o Coolify redeploya sozinho. Senão, clique em **Redeploy** no painel.

**Os dois arquivos de infraestrutura**

- `Dockerfile` — `nginx:1.27-alpine` + os arquivos estáticos. Sem build, sem dependências.
- `nginx.conf` — rotas, gzip, cache e cabeçalhos de segurança.

Cuidado ao mexer no `nginx.conf`: um `add_header` dentro de um `location` **descarta todos os
herdados do `server`**. É por isso que os cabeçalhos de segurança aparecem repetidos em cada
`location` — não é descuido. Se criar um `location` novo, repita-os lá também.

Para conferir qualquer alteração antes de subir:

```bash
docker build -t infoco-landing . && docker run --rm -p 8098:80 infoco-landing
curl -sI http://localhost:8098/        # deve trazer Cache-Control: no-cache + os 3 de segurança
```

**Checklist pós-deploy**

- [ ] A página abre em `https://produtivo.estudyou.com` com cadeado válido
- [ ] O logo aparece no topo e no rodapé (se não, o `COPY assets/` falhou no build)
- [ ] `/privacidade.html` abre e **não** está mais com o aviso vermelho de rascunho
- [ ] Mandar o link para si mesmo no WhatsApp e ver se o preview carrega a imagem
- [ ] Preencher o formulário e confirmar a linha na planilha
- [ ] Clicar em "Quero economizar agora" e ver a coluna **Clicou no WhatsApp** virar "Sim"

> Os dois últimos itens só passam depois do `LEAD_ENDPOINT` configurado.
> Enquanto ele estiver vazio, a página sobe e funciona, mas não registra nada.

---

## Como funciona

**Dois eventos, uma linha.** O formulário dispara `cadastro`, que cria a linha com um UUID.
O clique no CTA dispara `clicou_whatsapp`, que acha a mesma linha pelo UUID e completa com os
números da calculadora. Por isso a coluna **Clicou no WhatsApp** é o filtro que importa: quem
está com "Não" calculou o prejuízo e não chamou ninguém — é a fila de retomada.

**Falha é silenciosa por natureza.** O envio usa `mode: "no-cors"`, que é o que contorna o
bloqueio de CORS do Apps Script, mas em troca impede o JavaScript de ler a resposta. A página
não tem como saber se a gravação deu certo. Por isso o checklist acima pede a conferência
manual na planilha depois de publicar.

**O cálculo é propositalmente conservador:** 1h30 por dia (e não as 2h da fonte citada),
22 dias úteis e jornada de 220 h para o valor-hora. Está tudo em `calcular()`, junto com a
tabela de preços `FAIXAS` — que é uma cópia da tabela do produto. Se o preço mudar lá,
precisa mudar aqui também.

---

## Rodando local

```bash
# qualquer servidor estático serve; o importante é não abrir via file://
python -m http.server 8099
# depois: http://localhost:8099
```

Testes do Apps Script (simula a planilha, não toca no Google):

```bash
node teste-apps-script.js apps-script-leads-in-foco.gs
```

Rode-os sempre que mexer no `.gs` — principalmente se alterar a lista `COLUNAS`,
porque a ordem das colunas é o que liga o script à planilha.
