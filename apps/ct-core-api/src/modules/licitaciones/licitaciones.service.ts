import { Injectable } from '@nestjs/common';
import { LicitacionesRepository } from './licitaciones.repository.js';
import { LicitacionDocument } from './licitacion.schema.js';

@Injectable()
export class LicitacionesService {
  constructor(private readonly repository: LicitacionesRepository) {}

  async findPublicadas(): Promise<LicitacionDocument[]> {
    return this.repository.findByEstado('publicada');
  }

  async findOne(codigoExterno: string): Promise<LicitacionDocument | null> {
    return this.repository.findOne(codigoExterno);
  }

  async count(): Promise<number> {
    return this.repository.count();
  }
}
