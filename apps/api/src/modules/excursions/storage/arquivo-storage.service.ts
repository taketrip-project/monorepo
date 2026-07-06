export interface ArquivoSalvo {
  /** Chave do objeto no storage (S3 key, ou caminho local em dev/teste). */
  chave: string;
  /** URL pública de leitura do arquivo. */
  url: string;
}

/**
 * Abstração de armazenamento de arquivo (S3) usada pelas fotos da excursão
 * (H1.5, `docs/api/excursions.yaml`). `FotosService` depende SÓ desta
 * interface, nunca do SDK da AWS diretamente — mesmo padrão de
 * `EmailService`/`SesEmailService` em `notifications`: troca de provedor
 * fica barata e os testes injetam um fake local em vez de bater no S3 de
 * verdade (ver `S3ArquivoStorageService` vs. `LocalArquivoStorageService`).
 */
export abstract class ArquivoStorageService {
  abstract salvar(
    buffer: Buffer,
    contentType: string,
    extensao: string,
    organizacaoId: string,
  ): Promise<ArquivoSalvo>;

  abstract remover(chave: string): Promise<void>;

  /** Reconstrói a URL pública a partir da chave persistida (`foto_excursao.s3_key`). */
  abstract urlPublica(chave: string): string;
}
