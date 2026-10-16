// User-supplied codes/quantities only. Tests attach synthetic facts, never real card details.
export const compactDecklist = `1xOP09-062
4xOP17-113
3xST34-003
4xOP17-074
4xOP17-107
4xOP17-109
2xOP17-111
4xOP17-102
3xOP05-073
3xOP17-106
3xEB04-058
4xOP17-114
4xOP16-119
4xOP17-112
1xOP11-067
3xOP09-078 `;
export const compactEntries = compactDecklist
  .trim()
  .split("\n")
  .map((line) => {
    const [quantity, code] = line.trim().split("x");
    return { quantity: Number(quantity), code };
  });
