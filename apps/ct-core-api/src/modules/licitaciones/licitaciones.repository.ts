import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Licitacion, LicitacionDocument } from './licitacion.schema.js';

@Injectable()
export class LicitacionesRepository {
  constructor(
    @InjectModel(Licitacion.name)
    private readonly model: Model<LicitacionDocument>,
  ) {}

  async upsertByCodigoExterno(
    codigoExterno: string,
    data: Partial<Licitacion>,
  ): Promise<LicitacionDocument> {
    return this.model.findOneAndUpdate(
      { codigoExterno },
      { $set: data },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  async findByEstado(estado: string): Promise<LicitacionDocument[]> {
    return this.model.find({ estado }).sort({ fechaCierre: 1 }).exec();
  }

  async findOne(codigoExterno: string): Promise<LicitacionDocument | null> {
    return this.model.findOne({ codigoExterno }).exec();
  }

  async count(): Promise<number> {
    return this.model.countDocuments().exec();
  }
}
