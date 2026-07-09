/**
 * Quita el sufijo "cm" al final de una cadena de dimensiones.
 * @param {string} value
 * @returns {string}
 */
function stripCmSuffix(value) {
  if (value == null || value === "") return value;
  return String(value).trim().replace(/\s*cm\s*$/i, "");
}

/**
 * @param {string|string[]|null|undefined} values
 * @returns {string[]}
 */
function stripCmFromList(values) {
  if (!values) return [];

  const list = Array.isArray(values) ? values : [values];

  return list
    .map((item) => stripCmSuffix(item))
    .filter((item) => item != null && String(item).trim() !== "");
}

module.exports = { stripCmSuffix, stripCmFromList };
