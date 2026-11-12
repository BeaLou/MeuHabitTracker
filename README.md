# Ritmo — rastreador de hábitos com Google Agenda

PWA em React + TypeScript (Vite). Funciona offline, instala no celular e sincroniza hábitos com o Google Agenda nos dois sentidos. Os dados ficam no aparelho (localStorage) e, se você quiser, são sincronizados entre aparelhos pelo seu próprio Google Drive; não há servidor.

## O que tem

- **Hoje**: faixa semanal, filtro por categoria, hábitos e tarefas do dia (toque no círculo: feito → pulado → vazio) e os eventos do dia da sua agenda.
- **Hábitos**: cartões com os últimos 7 dias clicáveis, sequência 🔥, taxa de conclusão, prioridade, horário, lembrete e frequência (todos os dias ou dias específicos).
- **Detalhe do hábito**: calendário mensal colorido, anotações por dia, pontuação (média exponencial), melhor/atual sequência, totais da semana/mês/ano e edição.
- **Tarefas**, **Categorias** (nome, ícone, cor) e **Timer** de foco (pode concluir um hábito ao terminar).
- **Lembretes** por notificação e **backup** em JSON.

## Rodando

```bash
npm install
cp .env.example .env.local   # depois preencha VITE_GOOGLE_CLIENT_ID (veja abaixo)
npm run dev                  # http://localhost:5173
npm test                     # testes das regras (sequência, pontuação, RRULE, mapeamento)
npm run build                # gera dist/ (PWA pronto para publicar)
```

Sem `VITE_GOOGLE_CLIENT_ID` o app funciona normalmente; só a integração com a agenda fica desligada.

## Google Agenda: configuração (uma vez)

1. Em <https://console.cloud.google.com/> crie um projeto.
2. **APIs e serviços → Biblioteca** → ative a **Google Calendar API** e a **Google Drive API** (esta serve ao sync entre aparelhos).
3. **Tela de permissão OAuth** (Google Auth Platform): tipo *Externo*, preencha nome e e-mail, e adicione você como **usuário de teste**. Enquanto o app estiver em "Testando", só os usuários de teste conseguem entrar (basta você).
4. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**.
   - *Origens JavaScript autorizadas*: `http://localhost:5173` e, quando publicar, a URL do site (ex.: `https://seuusuario.github.io`).
   - Não precisa de URI de redirecionamento nem de client secret.
5. Copie o ID do cliente para `.env.local`:
   `VITE_GOOGLE_CLIENT_ID=1234-abc.apps.googleusercontent.com`
6. No app: ⚙ **Ajustes → Conectar Google Agenda**.

Escopos pedidos: `calendar.events` (criar, ler e editar eventos) e `drive.appdata` (pasta privada do app no Drive: o app só vê o arquivo que ele mesmo cria, nunca seus outros arquivos). O Google limita o token de apps só de navegador a ~1 h. O app o renova sozinho em segundo plano (sem popup, enquanto você estiver logado no Google) e guarda o token neste aparelho; se a renovação falhar, basta tocar em Sincronizar para reconectar. Sessões realmente longas exigiriam um backend com refresh token.

## Como a sincronização funciona

| Situação | O que acontece |
| --- | --- |
| Hábito com horário + "Sincronizar com o Google Agenda" | Vira um evento **recorrente** na agenda principal (diário ou nos dias escolhidos), com lembrete e duração. |
| Você edita título, horário, duração, repetição ou lembrete **no app** | O evento é atualizado (a data de início original da série é preservada). |
| Você edita o evento **na agenda** | A mudança volta para o hábito. Se os dois lados mudaram, vence quem mexeu por último. |
| Você apaga o evento na agenda | O hábito e o histórico ficam; só o vínculo é desfeito. |
| Você exclui o hábito no app | O evento é apagado **apenas se o Ritmo o criou**. |
| **Importar eventos da agenda** (Ajustes) | Lista eventos recorrentes com horário (ex.: Pilates, Psicoterapia). Ao importar, o evento continua intacto na agenda e vira hábito sincronizado; o histórico começa hoje. Eventos que já existiam **nunca são apagados** pelo app. |

Sincroniza ao abrir, ao voltar para o app (a cada 5 min no máximo), ~4 s depois de editar um hábito e no botão **Sincronizar agora**. Se a sessão do Google expirar, toque em Sincronizar para reconectar.

Limites conhecidos: só repetições diárias ou semanais em dias fixos viram hábitos (mensal, "a cada 2 semanas" e "N vezes" são ignoradas na importação); eventos de dia inteiro não são importados; só a agenda principal é usada; a marcação de "feito" fica no app (não é gravada na agenda).

## Usar no desktop e no celular (sync entre aparelhos)

O layout é responsivo: em telas largas aparece o menu lateral e os hábitos em duas colunas; no celular, a barra inferior. Para os dados ficarem iguais nos dois:

1. Publique o `dist/` (veja "Instalar") e abra a mesma URL no celular e no computador.
2. Nos dois: ⚙ **Ajustes → Conectar** com a mesma conta Google e marque **Sincronizar entre aparelhos (Google Drive)**.

Os hábitos, o histórico (dia a dia), as anotações, tarefas, categorias e sessões de foco ficam num único arquivo `ritmo-data.json` na pasta privada do app. Sincroniza ao abrir, ao voltar para a aba, a cada minuto e ~5 s depois de editar. O merge é por item (vence a edição mais recente) e por dia no histórico; exclusões se propagam por "lápides". Timer e ajustes do Google são de cada aparelho e não vão para o Drive. Se dois aparelhos gravarem no mesmo segundo, a próxima sincronização reconcilia; o histórico de dias diferentes nunca se perde.

No Chrome do desktop, o ícone de instalar aparece na barra de endereço (ou menu ⋮ → Salvar e compartilhar → Instalar página como app).

## Lembretes (importante)

Navegadores não agendam notificações com o app fechado sem um servidor de push. Por isso:

- O app avisa enquanto está aberto ou em segundo plano (ative em Ajustes → Notificações).
- Para lembrete **com o app fechado**, sincronize o hábito com a agenda: quem avisa é o app Google Agenda do celular, com o lembrete que você escolheu.

## Instalar no celular

Publique o conteúdo de `dist/` em qualquer hospedagem HTTPS (GitHub Pages, Netlify, Vercel, Cloudflare Pages). No Chrome do Android: menu ⋮ → **Instalar app**. Lembre de adicionar a URL publicada nas *origens JavaScript autorizadas* do passo 4.

## Estrutura

```
src/core/     regras puras (datas, sequência, pontuação, merge entre aparelhos, tipos) + testes
src/google/   login (GIS), API do Calendar, Drive (sync entre aparelhos), RRULE, mapeamento hábito↔evento
src/screens/  Hoje, Hábitos, Detalhe, Tarefas, Categorias, Timer, Ajustes
src/store.ts  estado global com persistência em localStorage
public/       manifest, service worker e ícones
```

## Próximos passos possíveis

- Backend (ex.: .NET + PostgreSQL) para push de verdade e sync em tempo real.
- Gravar a conclusão do dia na agenda (ex.: marcar a ocorrência).
- Hábitos com meta numérica (ex.: 2 L de água) e widgets.
