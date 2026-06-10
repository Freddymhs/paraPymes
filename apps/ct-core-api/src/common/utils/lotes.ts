/** Parte `items` en lotes consecutivos de hasta `tamano` elementos. */
export const partirEnLotes = <T>(
  items: readonly T[],
  tamano: number,
): T[][] => {
  if (tamano < 1) {
    throw new RangeError(`Tamaño de lote inválido: ${tamano}`);
  }
  const lotes: T[][] = [];
  for (let inicio = 0; inicio < items.length; inicio += tamano) {
    lotes.push(items.slice(inicio, inicio + tamano));
  }
  return lotes;
};
