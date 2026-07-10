const LABEL_TRANSLATIONS = {
  // Tipos de bolso
  Bag: "Bolso",
  Handbag: "Bolso de mano",
  Purse: "Cartera",
  Backpack: "Mochila",
  "Tote Bag": "Bolso tote",
  Clutch: "Clutch",
  Wallet: "Billetera",
  Satchel: "Morral",
  Briefcase: "Maletín",
  "Messenger Bag": "Bolso mensajero",
  "Shoulder Bag": "Bolso de hombro",
  "Belt Bag": "Riñonera",
  "Bucket Bag": "Bolso bucket",
  "Crossbody Bag": "Bolso cruzado",
  "Duffle Bag": "Bolso de deporte",
  "Fanny Pack": "Riñonera",
  "Hobo Bag": "Bolso hobo",
  Luggage: "Equipaje",
  Suitcase: "Maleta",
  "Diaper Bag": "Bolso pañalero",
  "Gym Bag": "Bolso de gimnasio",

  // Accesorios y detalles
  Zipper: "Cremallera",
  Buckle: "Hebilla",
  Handle: "Asa",
  Strap: "Correa",
  Chain: "Cadena",
  Clasp: "Broche",
  Lock: "Candado",
  Hardware: "Herrajes",
  Lining: "Forro",
  Pocket: "Bolsillo",
  Tassel: "Borla",
  Charm: "Charm",
  Hook: "Gancho",
  Metal: "Metal",
  Logo: "Logo",
  Brand: "Marca",
  Monogram: "Monograma",
  Embroidery: "Bordado",
  Stud: "Tachuela",
  Rivet: "Remache",
  Fringe: "Flecos",
  Bow: "Lazo",
  Button: "Botón",
  Velcro: "Velcro",
  Magnetic: "Magnético",
  Snap: "Broche a presión",
  Bead: "Cuenta",
  Necklace: "Cadena",
  Pendant: "Pendiente",


  // Tamaños
  Mini: "Mini",
  Micro: "Micro",
  Small: "Pequeño",
  Medium: "Mediano",
  Large: "Grande",
  Oversized: "Extragrande",
  Compact: "Compacto",
  Jumbo: "Jumbo",
  Petite: "Petite",
  Big: "Grande",
  "Mediano-Grande": "Mediano-grande",

  // Materiales
  Leather: "Cuero",
  Suede: "Gamuza",
  Canvas: "Lona",
  Fabric: "Tela",
  Nylon: "Nylon",
  Velvet: "Terciopelo",
  Patent: "Charol",
  Woven: "Tejido",
  Straw: "Paja",
  Denim: "Denim",
  Polyester: "Poliéster",
  Cotton: "Algodón",
  Synthetic: "Sintético",
  Fur: "Piel",
  Satin: "Satén",
  Silk: "Seda",
  Yarn: "Hilo",
  Knitwear: "Tejido de punto",

  // Categorías padre comunes de Rekognition
  Color: "Color",
  Colors: "Colores",
  Accessory: "Accesorio",
  Accessories: "Accesorios",
  Clothing: "Ropa",
  Apparel: "Prendas",
  Fashion: "Moda",
  Person: "Persona",
  People: "Personas",
  Human: "Humano",
  Object: "Objeto",
  Textile: "Textil",
  Pattern: "Patrón",
  Texture: "Textura",
  Material: "Material",
  Furniture: "Mueble",
  Animal: "Animal",
  Plant: "Planta",
  Food: "Comida",
  Nature: "Naturaleza",
  Indoor: "Interior",
  Outdoor: "Exterior",
  Electronics: "Electrónica",
  Vehicle: "Vehículo",
  Building: "Edificio",
  Room: "Habitación",
  Art: "Arte",
  Sport: "Deporte",
  Sports: "Deportes",
  Tool: "Herramienta",
  Weapon: "Arma",
  Jewelry: "Joyería",
  Shoe: "Zapato",
  Shoes: "Zapatos",
  Footwear: "Calzado",
  Hat: "Sombrero",
  Glasses: "Gafas",
  Watch: "Reloj",
  Phone: "Teléfono",
  Computer: "Computadora",
  Book: "Libro",
  Toy: "Juguete",
  Kitchen: "Cocina",
  Bathroom: "Baño",
  Bedroom: "Dormitorio",
  "Living Room": "Sala",
  Office: "Oficina",
  Street: "Calle",
  City: "Ciudad",
  Landscape: "Paisaje",
  Sky: "Cielo",
  Water: "Agua",
  Tree: "Árbol",
  Flower: "Flor",
  Grass: "Césped",
  Mountain: "Montaña",
  Beach: "Playa",
  Snow: "Nieve",
  Rain: "Lluvia",
  Sun: "Sol",
  Cloud: "Nube",
  Night: "Noche",
  Day: "Día",

};

const COLOR_BASES = [
  "cornflowerblue",
  "mediumslateblue",
  "mediumspringgreen",
  "mediumseagreen",
  "mediumvioletred",
  "mediumturquoise",
  "mediumorchid",
  "yellowgreen",
  "springgreen",
  "darkseagreen",
  "darkolivegreen",
  "darkslategray",
  "darkslategrey",
  "darkslateblue",
  "darkgoldenrod",
  "darkorange",
  "darkorchid",
  "darkmagenta",
  "darkviolet",
  "darkcyan",
  "darkgray",
  "darkgrey",
  "darkblue",
  "darkgreen",
  "darkred",
  "lightgray",
  "lightgrey",
  "lightgreen",
  "lightblue",
  "lightcyan",
  "lightpink",
  "lightcoral",
  "lightsalmon",
  "lightyellow",
  "paleturquoise",
  "palegreen",
  "palevioletred",
  "blueviolet",
  "dodgerblue",
  "midnightblue",
  "slateblue",
  "slategray",
  "slategrey",
  "royalblue",
  "steelblue",
  "powderblue",
  "seagreen",
  "orangered",
  "deeppink",
  "hotpink",
  "rosybrown",
  "saddlebrown",
  "mediumblue",
  "mediumpurple",
  "forestgreen",
  "limegreen",
  "skyblue",
  "navyblue",
  "purple",
  "violet",
  "indigo",
  "orange",
  "yellow",
  "magenta",
  "cyan",
  "brown",
  "green",
  "black",
  "white",
  "beige",
  "coral",
  "salmon",
  "khaki",
  "olive",
  "teal",
  "navy",
  "maroon",
  "crimson",
  "gold",
  "silver",
  "ivory",
  "azure",
  "gray",
  "grey",
  "blue",
  "red",
  "pink",
].sort((a, b) => b.length - a.length);

const LOWERCASE_TRANSLATIONS = Object.fromEntries(
  Object.entries(LABEL_TRANSLATIONS).map(([key, value]) => [
    key.toLowerCase(),
    value,
  ]),
);

function formatColorName(name) {
  if (!name || typeof name !== "string") return name;

  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  if (/\s/.test(trimmed) && !/^[a-z]+$/i.test(trimmed.replace(/\s/g, ""))) {
    return trimmed;
  }
  if (/^#?[0-9a-f]{3,8}$/i.test(trimmed)) return trimmed;

  let tokens = [trimmed.toLowerCase().replace(/\s+/g, "")];
  let changed = true;

  while (changed) {
    changed = false;

    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];

      for (const base of COLOR_BASES) {
        if (token.endsWith(base) && token.length > base.length) {
          const prefix = token.slice(0, -base.length);
          tokens.splice(i, 1, prefix || null, base);
          tokens = tokens.filter(Boolean);
          changed = true;
          break;
        }
      }

      if (changed) break;
    }
  }

  return tokens.join(" ");
}

function translateLabel(name) {
  if (!name || typeof name !== "string") return name;

  const trimmed = name.trim();
  if (LABEL_TRANSLATIONS[trimmed]) {
    return LABEL_TRANSLATIONS[trimmed];
  }

  const lower = trimmed.toLowerCase();
  if (LOWERCASE_TRANSLATIONS[lower]) {
    return LOWERCASE_TRANSLATIONS[lower];
  }

  return trimmed;
}

function translateColorLabel(name) {
  if (!name || typeof name !== "string") return name;

  const formatted = formatColorName(name);
  const translated = translateLabel(formatted);

  if (translated !== formatted) {
    return translated;
  }

  const lowerFormatted = formatted.toLowerCase();
  if (LOWERCASE_TRANSLATIONS[lowerFormatted]) {
    return LOWERCASE_TRANSLATIONS[lowerFormatted];
  }

  return formatted;
}

function translateNamedItem(item) {
  if (!item || typeof item !== "object") return item;
  return {
    ...item,
    name: translateColorLabel(item.name),
  };
}

function translateNamedItems(items) {
  if (!Array.isArray(items)) return items;
  return items.map(translateNamedItem);
}

function translateLabelWithParents(label) {
  if (!label || typeof label !== "object") return label;
  return {
    ...label,
    name: translateLabel(label.name),
    parents: Array.isArray(label.parents)
      ? label.parents.map(translateLabel)
      : label.parents,
  };
}

module.exports = {
  LABEL_TRANSLATIONS,
  formatColorName,
  translateLabel,
  translateColorLabel,
  translateNamedItem,
  translateNamedItems,
  translateLabelWithParents,
};
