import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface PassageiroImpressao {
  poltrona: number;
  nome: string;
  cpf: string | null;
}

export interface DadosListaImpressao {
  destino: string;
  dataSaida: Date;
  veiculoApelido: string;
  veiculoPlaca: string;
  passageiros: PassageiroImpressao[];
}

/**
 * Lista de passageiros imprimível para fiscalização ANTT na estrada (H1.13):
 * nome + documento quando informado — passageiro sem CPF nunca bloqueia a
 * geração, sai só com o nome. Dois formatos (`pdf` via `pdfkit`, biblioteca
 * leve que não depende de headless browser; `html` para impressão direto do
 * navegador).
 */
@Injectable()
export class ListaImpressaoService {
  gerarHtml(dados: DadosListaImpressao): string {
    const linhas = dados.passageiros
      .map(
        (p) => `
        <tr>
          <td>${escaparHtml(String(p.poltrona))}</td>
          <td>${escaparHtml(p.nome)}</td>
          <td>${p.cpf ? escaparHtml(p.cpf) : '—'}</td>
        </tr>`,
      )
      .join('');

    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Lista de passageiros — ${escaparHtml(dados.destino)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; padding: 24px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  p.subtitulo { color: #444; margin-top: 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; font-size: 14px; }
  th { background: #f2f2f2; }
  @media print {
    body { padding: 0; }
  }
</style>
</head>
<body>
  <h1>Lista de passageiros — ${escaparHtml(dados.destino)}</h1>
  <p class="subtitulo">
    Saída: ${formatarDataHora(dados.dataSaida)} · Veículo: ${escaparHtml(dados.veiculoApelido)} (${escaparHtml(dados.veiculoPlaca)}) · Total: ${dados.passageiros.length}
  </p>
  <table>
    <thead>
      <tr><th>Poltrona</th><th>Nome</th><th>CPF</th></tr>
    </thead>
    <tbody>${linhas}</tbody>
  </table>
</body>
</html>`;
  }

  gerarPdf(dados: DadosListaImpressao): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Colunas com x/y explícitos (não depende do cursor automático do
      // pdfkit, cujo avanço de `.y` após texto posicionado varia por versão).
      const margemEsquerda = doc.page.margins.left;
      const colPoltrona = margemEsquerda;
      const colNome = margemEsquerda + 70;
      const colCpf = margemEsquerda + 340;
      const alturaLinha = 20;

      doc.fontSize(16).text(`Lista de passageiros — ${dados.destino}`);
      doc
        .fontSize(10)
        .fillColor('#444')
        .text(
          `Saída: ${formatarDataHora(dados.dataSaida)} · Veículo: ${dados.veiculoApelido} (${dados.veiculoPlaca}) · Total: ${dados.passageiros.length}`,
        );
      doc.fillColor('#000');
      doc.moveDown(1);

      let y = doc.y;
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('Poltrona', colPoltrona, y, { width: 60 });
      doc.text('Nome', colNome, y, { width: colCpf - colNome - 10 });
      doc.text('CPF', colCpf, y);
      y += alturaLinha;
      doc.font('Helvetica');

      for (const p of dados.passageiros) {
        if (y > doc.page.height - doc.page.margins.bottom - alturaLinha) {
          doc.addPage();
          y = doc.page.margins.top;
        }
        doc.text(String(p.poltrona), colPoltrona, y, { width: 60 });
        doc.text(p.nome, colNome, y, { width: colCpf - colNome - 10 });
        doc.text(p.cpf ?? '—', colCpf, y);
        y += alturaLinha;
      }

      doc.end();
    });
  }
}

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatarDataHora(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);
}
