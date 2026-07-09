const cloudinary = require("../config/cloudinary");

const FOLDERS = {
  QUOTATIONS: "Bolsos-CAP",
  PRODUCTS: "Productos-Bolsos-CAP",
};

function isCloudinaryUrl(imageUrl) {
  return typeof imageUrl === "string" && imageUrl.includes("cloudinary.com");
}

function getPublicIdFromUrl(imageUrl) {
  if (!isCloudinaryUrl(imageUrl)) {
    return null;
  }

  try {
    const pathname = new URL(imageUrl).pathname;
    const uploadMarker = "/upload/";
    const uploadIndex = pathname.indexOf(uploadMarker);

    if (uploadIndex === -1) {
      return null;
    }

    const segments = pathname
      .slice(uploadIndex + uploadMarker.length)
      .split("/")
      .filter(Boolean);

    while (segments.length > 0) {
      const segment = segments[0];

      if (/^v\d+$/.test(segment)) {
        segments.shift();
        continue;
      }

      if (
        segment.includes(",") ||
        /^[a-z0-9]+_[a-z0-9]/i.test(segment)
      ) {
        segments.shift();
        continue;
      }

      break;
    }

    const publicIdWithExt = segments.join("/");

    if (!publicIdWithExt) {
      return null;
    }

    return publicIdWithExt.replace(/\.[^/.]+$/, "");
  } catch {
    return null;
  }
}

/**
 * Sube un buffer de imagen a Cloudinary.
 * @param {Buffer} buffer
 * @param {string} folder
 * @returns {Promise<{ url: string, publicId: string }>}
 */
function uploadImageBuffer(buffer, folder = FOLDERS.QUOTATIONS) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(buffer);
  });
}

async function deleteImageByPublicId(publicId) {
  if (!publicId?.trim()) {
    throw new Error("Public ID de imagen inválido");
  }

  const result = await cloudinary.uploader.destroy(publicId.trim(), {
    resource_type: "image",
    invalidate: true,
  });

  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error("No se pudo eliminar la imagen de Cloudinary");
  }

  return { publicId, result: result.result };
}

/**
 * Elimina una imagen de Cloudinary a partir de su URL.
 * @param {string} imageUrl
 * @returns {Promise<{ publicId: string, result: string }>}
 */
async function deleteImageByUrl(imageUrl) {
  const publicId = getPublicIdFromUrl(imageUrl);

  if (!publicId) {
    throw new Error("La imagen no está alojada en Cloudinary");
  }

  return deleteImageByPublicId(publicId);
}

/**
 * Elimina una imagen usando publicId guardado o URL como respaldo.
 * @param {{ photoPublicId?: string, photo?: string }} source
 */
async function deleteProductImage(source = {}) {
  const publicId = source.photoPublicId?.trim();
  const photoUrl = source.photo?.trim();

  if (publicId) {
    return deleteImageByPublicId(publicId);
  }

  if (isCloudinaryUrl(photoUrl)) {
    return deleteImageByUrl(photoUrl);
  }

  return null;
}

module.exports = {
  FOLDERS,
  isCloudinaryUrl,
  getPublicIdFromUrl,
  uploadImageBuffer,
  deleteImageByPublicId,
  deleteImageByUrl,
  deleteProductImage,
};
