type Value = string | number;

// A copy of the rows in the order of one value: numbers by size, texts by alphabet.
export function sortRows<Row>(rows: Row[], value: (row: Row) => Value, descending: boolean): Row[] {
  const sorted = [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    return typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
  });
  return descending ? sorted.reverse() : sorted;
}
