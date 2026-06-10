import { normalizarRut } from './rut';

describe('normalizarRut', () => {
  it('normaliza RUT con puntos y guión', () => {
    expect(normalizarRut('12.345.678-5')).toBe('12345678-5');
  });

  it('normaliza RUT sin guión', () => {
    expect(normalizarRut('123456785')).toBe('12345678-5');
  });

  it('normaliza dígito verificador K en minúscula', () => {
    expect(normalizarRut('20.347.878-k')).toBe('20347878-K');
  });

  it('rechaza dígito verificador inválido', () => {
    expect(normalizarRut('12.345.678-9')).toBeNull();
  });

  it('rechaza basura no parseable', () => {
    expect(normalizarRut('sin-rut')).toBeNull();
    expect(normalizarRut('')).toBeNull();
  });
});
