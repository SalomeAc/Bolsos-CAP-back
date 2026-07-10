const { stripCmSuffix, stripCmFromList } = require("../../api/utils/dimensions");

describe("dimensions utils", () => {
  it("stripCmSuffix elimina sufijo cm", () => {
    expect(stripCmSuffix("26 x 22 x 8 cm")).toBe("26 x 22 x 8");
    expect(stripCmSuffix("20CM")).toBe("20");
    expect(stripCmSuffix("")).toBe("");
    expect(stripCmSuffix(null)).toBeNull();
  });

  it("stripCmFromList normaliza listas y filtra vacíos", () => {
    expect(stripCmFromList(["20 cm", "30cm", ""])).toEqual(["20", "30"]);
    expect(stripCmFromList("25 cm")).toEqual(["25"]);
    expect(stripCmFromList(null)).toEqual([]);
  });
});
