/** Evento de dominio: una licitación fue validada y persistida. */
export class LicitacionProcesadaEvent {
  constructor(
    readonly codigoExterno: string,
    readonly fuente: string,
  ) {}
}
