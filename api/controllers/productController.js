const productDAO = require("../dao/productDAO");
const Product = require("../models/product");
const CloudinaryService = require("../services/cloudinaryService");
const RekognitionService = require("../services/rekognitionService");
const { stripCmFromList, stripCmSuffix } = require("../utils/dimensions");

const toArray = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => toArray(item))
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [String(value).trim()].filter(Boolean);
};

const normalizeProduct = (product) => {
  if (!product) return product;

  const plainProduct = product.toObject ? product.toObject() : { ...product };

  return {
    ...plainProduct,
    color: toArray(plainProduct.color || plainProduct.colors),
    dimensions: stripCmFromList(
      toArray(plainProduct.dimensions || plainProduct.dimension),
    ),
    materials: toArray(plainProduct.materials),
  };
};

const sanitizeProductBody = (body = {}) => {
  const data = { ...body };

  if (data.dimensions !== undefined) {
    data.dimensions = stripCmFromList(toArray(data.dimensions));
  }

  if (typeof data.dimension === "string") {
    data.dimension = stripCmSuffix(data.dimension);
  }

  return data;
};

const createProduct = async (req, res) => {
  try {
    const product = await productDAO.createProduct(
      sanitizeProductBody(req.body),
    );

    res.status(201).json(normalizeProduct(product));
  } catch (error) {
    res.status(400).json({
      error: error.message,
    });
  }
};

const createProductFromForm = async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const description = req.body.description?.trim();
    const type = req.body.type?.trim();
    const color = req.body.color?.trim();
    const dimensions = req.body.dimensions?.trim();
    const materials = req.body.materials?.trim();

    if (!name || !description || !type || !color || !dimensions || !materials) {
      return res.status(400).json({
        error:
          "Nombre, descripción, tipo, colores, dimensiones y materiales son obligatorios",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "La imagen del producto es obligatoria",
      });
    }

    console.log("[createProductFromForm] Validando imagen con Rekognition", {
      hasFile: Boolean(req.file),
      fileSize: req.file?.size,
      mimetype: req.file?.mimetype,
    });

    await RekognitionService.validateImage(req.file.buffer);

    console.log(
      "[createProductFromForm] Rekognition OK, subiendo a Cloudinary",
    );

    const uploadResult = await CloudinaryService.uploadImageBuffer(
      req.file.buffer,
      CloudinaryService.FOLDERS.PRODUCTS,
    );

    const productData = {
      name,
      description,
      type,
      color: toArray(color),
      dimensions: stripCmFromList(toArray(dimensions)),
      materials: toArray(materials),
      photo: uploadResult.url,
      photoPublicId: uploadResult.publicId,
    };

    const product = await productDAO.createProduct(productData);

    res.status(201).json(normalizeProduct(product));
  } catch (error) {
    res.status(400).json({
      error: error.message,
    });
  }
};

const getProducts = async (req, res) => {
  try {
    const products = await productDAO.getProducts();

    res.json(products.map(normalizeProduct));
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const getProductById = async (req, res) => {
  try {
    const product = await productDAO.getProductById(req.params.id);

    if (!product) {
      return res.status(404).json({
        error: "Producto no encontrado",
      });
    }

    res.json(normalizeProduct(product));
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const updateProduct = async (req, res) => {
  try {
    const existingProduct = await productDAO.getProductById(req.params.id);

    if (!existingProduct) {
      return res.status(404).json({
        error: "Producto no encontrado",
      });
    }

    const updateData = sanitizeProductBody(req.body);

    if (!updateData.photo?.trim() && !existingProduct.photo?.trim()) {
      return res.status(400).json({
        error: "La imagen del producto es obligatoria",
      });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      },
    );

    res.json(normalizeProduct(updatedProduct));
  } catch (error) {
    res.status(400).json({
      error: error.message,
    });
  }
};

const updateProductFromForm = async (req, res) => {
  try {
    const existingProduct = await productDAO.getProductById(req.params.id);

    if (!existingProduct) {
      return res.status(404).json({
        error: "Producto no encontrado",
      });
    }

    const name = req.body.name?.trim();
    const description = req.body.description?.trim();
    const type = req.body.type?.trim();
    const color = req.body.color?.trim();
    const dimensions = req.body.dimensions?.trim();
    const materials = req.body.materials?.trim();

    if (!name || !description || !type || !color || !dimensions || !materials) {
      return res.status(400).json({
        error:
          "Nombre, descripción, tipo, colores, dimensiones y materiales son obligatorios",
      });
    }

    const updateData = {
      name,
      description,
      type,
      color: toArray(color),
      dimensions: stripCmFromList(toArray(dimensions)),
      materials: toArray(materials),
    };

    if (req.file) {
      try {
        await CloudinaryService.deleteProductImage(existingProduct);
      } catch (deleteError) {
        console.error(
          "No se pudo eliminar la foto anterior:",
          deleteError.message,
        );
      }

      const uploadResult = await CloudinaryService.uploadImageBuffer(
        req.file.buffer,
        CloudinaryService.FOLDERS.PRODUCTS,
      );
      updateData.photo = uploadResult.url;
      updateData.photoPublicId = uploadResult.publicId;
    } else if (!existingProduct.photo?.trim()) {
      return res.status(400).json({
        error: "Debes subir una imagen del producto",
      });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      },
    );

    res.json(normalizeProduct(updatedProduct));
  } catch (error) {
    res.status(400).json({
      error: error.message,
    });
  }
};

const deleteProductPhoto = async (req, res) => {
  try {
    const product = await productDAO.getProductById(req.params.id);

    if (!product) {
      return res.status(404).json({
        error: "Producto no encontrado",
      });
    }

    const photoUrl = product.photo?.trim();

    if (!photoUrl && !product.photoPublicId?.trim()) {
      return res.status(400).json({
        error: "Este producto no tiene imagen",
      });
    }

    await CloudinaryService.deleteProductImage(product);

    product.photo = "";
    product.photoPublicId = "";
    await product.save();

    res.json(normalizeProduct(product));
  } catch (error) {
    res.status(400).json({
      error: error.message,
    });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await productDAO.getProductById(req.params.id);

    if (!product) {
      return res.status(404).json({
        error: "Producto no encontrado",
      });
    }

    const hasCloudinaryImage =
      Boolean(product.photoPublicId?.trim()) ||
      CloudinaryService.isCloudinaryUrl(product.photo);

    if (hasCloudinaryImage) {
      await CloudinaryService.deleteProductImage(product);
    }

    await Product.findByIdAndDelete(req.params.id);

    res.json({
      message: "Producto eliminado",
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

module.exports = {
  createProduct,
  createProductFromForm,
  getProducts,
  getProductById,
  updateProduct,
  updateProductFromForm,
  deleteProductPhoto,
  deleteProduct,
};
