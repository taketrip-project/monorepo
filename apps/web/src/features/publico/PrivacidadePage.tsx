import { useEffect } from 'react';
import { PublicoLayout } from './PublicoLayout';
import './publico.css';

/**
 * Política de privacidade (H3.7, ADR 010 — LGPD mínimo documental).
 * Rota pública /privacidade, estática, linkada a partir do aviso no
 * formulário público de reserva. O conteúdo é o Anexo B do ADR, palavra
 * por palavra — mudança de texto aqui é decisão humana, não de frontend.
 */
export function PrivacidadePage() {
  useEffect(() => {
    document.title = 'Política de Privacidade · taketrip';
  }, []);

  return (
    <PublicoLayout>
      <article className="tt-publico-politica">
        <h1 className="tt-publico-politica-titulo">Política de Privacidade — Taketrip</h1>

        <p>
          O Taketrip é a plataforma que organizadores de excursão usam para gerenciar reservas,
          pagamentos e embarque. Esta página explica, sem juridiquês, o que acontece com os seus
          dados quando você reserva uma excursão por aqui.
        </p>

        <section>
          <h2>Quem é responsável pelos seus dados</h2>
          <ul>
            <li>
              <strong>O organizador da excursão</strong> (a agência ou pessoa que publicou a página
              em que você reservou) é o <strong>controlador</strong> dos seus dados: é ele quem
              decide usá-los para operar a excursão.
            </li>
            <li>
              <strong>O Taketrip</strong> é o <strong>operador</strong>: guarda e processa esses
              dados a serviço do organizador, e não os usa para mais nada.
            </li>
          </ul>
        </section>

        <section>
          <h2>Quais dados coletamos</h2>
          <p>
            Ao reservar, você informa <strong>nome</strong>, <strong>WhatsApp</strong> e, se quiser,{' '}
            <strong>CPF</strong> (opcional). Só isso.
          </p>
        </section>

        <section>
          <h2>Para que os dados são usados</h2>
          <ul>
            <li>Registrar e acompanhar a sua reserva (poltrona, pagamento, situação).</li>
            <li>
              Contato do organizador com você pelo WhatsApp (confirmação, cobrança, avisos de
              embarque).
            </li>
            <li>
              Lista de passageiros da viagem — documento que a fiscalização rodoviária (ANTT) pode
              exigir na estrada.
            </li>
          </ul>
        </section>

        <section>
          <h2>Com quem os dados são compartilhados</h2>
          <ul>
            <li>
              Com a <strong>fiscalização</strong>, quando exigido por lei (lista de passageiros).
            </li>
            <li>
              Com o <strong>provedor de pagamento</strong>, apenas o necessário para gerar a
              cobrança PIX, quando o organizador usa pagamento online.
            </li>
            <li>
              Com <strong>ninguém mais</strong>. O Taketrip não vende nem cruza seus dados, e uma
              organização nunca vê dados de passageiros de outra.
            </li>
          </ul>
        </section>

        <section>
          <h2>Seus direitos e como pedir</h2>
          <p>
            Você pode pedir a qualquer momento para <strong>ver, corrigir ou apagar</strong> os seus
            dados. O canal é o <strong>WhatsApp do organizador da sua excursão</strong> — é ele quem
            atende e executa o pedido. A exclusão pode ser limitada enquanto houver obrigação legal
            de guarda (por exemplo, documentos da viagem).
          </p>
        </section>

        <section>
          <h2>Por quanto tempo guardamos</h2>
          <p>
            Pelo tempo necessário à excursão e às obrigações legais do organizador. Depois disso, os
            dados podem ser apagados a pedido.
          </p>
        </section>
      </article>
    </PublicoLayout>
  );
}
